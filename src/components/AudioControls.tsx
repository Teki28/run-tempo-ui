'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import {
  ClickTrackPlayer,
  DEFAULT_MAX_STRETCH_PCT,
  loadClick,
  planClicks,
  reachableRange,
  resolvePlan,
  type MixPlan,
  type MixSettings,
  type PreparedTrack,
} from '@/lib/audio';
import BpmControls from './BpmControls';
import TempoPanel from './TempoPanel';
import content from '../content.json';

type ValidLang = 'en' | 'zh' | 'ja';

interface AudioControlsProps {
  lang: ValidLang;
  /** Full-length sources, decoded lazily one at a time when downloading. */
  files: File[];
}

/** The audition material: the analysed first track plus its stretched preview. */
interface Audition {
  track: PreparedTrack;
  /** Stretched preview and the rate it was stretched by, so it can be reused. */
  music: AudioBuffer;
  playbackRate: number;
}

export default function AudioControls({ lang, files }: AudioControlsProps) {
  const [bpm, setBpm] = useState(170);
  const [volume, setVolume] = useState(100);
  const [nudgeMs, setNudgeMs] = useState(0);
  const [snap, setSnap] = useState(false);

  const [plan, setPlan] = useState<MixPlan | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const player = useRef<ClickTrackPlayer | null>(null);
  const audition = useRef<Audition | null>(null);
  const clickBuffer = useRef<AudioBuffer | null>(null);

  const { analyse, download, progress, activity, describe } = useAudioEngine();

  // Memoised so the callbacks below are not rebuilt on every render.
  const settings: MixSettings = useMemo(
    () => ({ bpm, volume, nudgeMs, snap, maxStretchPct: DEFAULT_MAX_STRETCH_PCT }),
    [bpm, volume, nudgeMs, snap],
  );

  // What this song can actually deliver, for the band under the BPM slider.
  // Only meaningful once the beats are known: on the fixed-grid fallback any
  // target is met exactly, so there is no band to draw.
  const reachable = useMemo(
    () =>
      plan?.beatLocked && plan.songBpm !== null
        ? reachableRange(plan.songBpm, { maxStretchPct: DEFAULT_MAX_STRETCH_PCT })
        : null,
    [plan?.beatLocked, plan?.songBpm],
  );

  // One player for the life of the component. Created lazily so no
  // AudioContext exists until the user actually asks for sound.
  const ensurePlayer = useCallback(() => {
    if (!player.current) {
      const created = new ClickTrackPlayer();
      created.onStateChange = (state) => setIsPlaying(state.playing);
      player.current = created;
    }
    return player.current;
  }, []);

  useEffect(
    () => () => {
      player.current?.dispose();
      player.current = null;
    },
    [],
  );

  /** Decode, analyse and stretch the audition material, reusing what it can. */
  const prepareAudition = useCallback(
    async (target: MixSettings): Promise<Audition> => {
      const existing = audition.current;
      const track = existing?.track ?? (await analyse(files[0]));
      const resolved = resolvePlan(track, target);

      // Re-stretching the preview is only needed when the rate changed.
      if (existing && Math.abs(existing.playbackRate - resolved.playbackRate) < 1e-9) {
        return { ...existing, track };
      }

      let music = track.preview;
      if (Math.abs(resolved.playbackRate - 1) > 1e-9) {
        const channels: Float32Array[] = [];
        for (let c = 0; c < track.preview.numberOfChannels; c++) {
          channels.push(Float32Array.from(track.preview.getChannelData(c)));
        }
        // Imported on demand, not at module scope: SoundTouch is ~115kB and
        // a static import puts it in the page's initial load, where a visitor
        // who never uploads a song pays for it.
        //
        // Ten seconds stretches in a few tens of milliseconds, so this stays
        // on the main thread; the worker is reserved for full-length tracks.
        const { stretchChannels } = await import('@/lib/audio/stretch/core');
        const stretched = stretchChannels({ channels, factor: 1 / resolved.playbackRate });
        music = new AudioBuffer({
          length: stretched[0].length,
          numberOfChannels: stretched.length,
          sampleRate: track.preview.sampleRate,
        });
        stretched.forEach((data, index) => music.copyToChannel(data, index));
      }

      const next = { track, music, playbackRate: resolved.playbackRate };
      audition.current = next;
      return next;
    },
    [analyse, files],
  );

  const handlePlay = useCallback(async () => {
    const live = ensurePlayer();
    if (live.playing) {
      live.stop();
      setIsPlaying(false);
      return;
    }

    // Unlock the AudioContext here, synchronously, while still inside the
    // gesture. iOS will not let it start after the awaits below, and failing
    // that way is silent — the context simply never produces sound.
    live.prime();

    setIsPreparing(true);
    setError(null);
    try {
      clickBuffer.current ??= await loadClick();
      const ready = await prepareAudition(settings);
      const resolved = resolvePlan(ready.track, settings);
      setPlan(resolved);

      const clicks = planClicks(resolved, ready.track.analysis, settings, ready.music.duration);
      live.play({
        music: ready.music,
        click: clickBuffer.current,
        clicks,
        volume,
      });
    } catch (err) {
      setError(describe(err));
    } finally {
      setIsPreparing(false);
    }
  }, [describe, ensurePlayer, prepareAudition, settings, volume]);

  // Volume is a live gain change, so it never needs a re-render of the audio.
  useEffect(() => {
    player.current?.setVolume(volume);
  }, [volume]);

  /**
   * Re-derive the click grid whenever the alignment settings change.
   *
   * This is the payoff of scheduling clicks live instead of baking them into a
   * rendered clip: a nudge or a BPM change is audible within a tick, so the
   * user can tune the alignment against the music they are hearing.
   */
  useEffect(() => {
    const ready = audition.current;
    const live = player.current;
    if (!ready || !live) return;

    const resolved = resolvePlan(ready.track, settings);
    setPlan(resolved);

    // A changed stretch means new audio, not just a new grid; that needs a
    // restart, which we leave to the user rather than cutting them off.
    if (Math.abs(resolved.playbackRate - ready.playbackRate) > 1e-9) return;

    if (live.playing) {
      live.setClicks(planClicks(resolved, ready.track.analysis, settings, ready.music.duration));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, nudgeMs, snap]);

  const handleDownload = async (merge: boolean) => {
    setIsDownloading(true);
    setError(null);
    try {
      const { blob, filename } = await download(files, settings, merge);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(describe(err));
    } finally {
      setIsDownloading(false);
    }
  };

  const copy = content[lang].main.audioControls;
  const percent = progress === null ? 0 : Math.round(progress * 100);

  return (
    <div className="space-y-6">
      <div className="text-xs text-gray-500">{copy.tip}</div>

      <BpmControls
        lang={lang}
        onBpmChange={setBpm}
        onVolumeChange={setVolume}
        defaultBpm={bpm}
        defaultVolume={volume}
        reachable={reachable}
        songBpm={plan?.songBpm ?? null}
        maxStretchPct={DEFAULT_MAX_STRETCH_PCT}
      />

      <TempoPanel
        lang={lang}
        plan={plan}
        activity={activity}
        targetBpm={bpm}
        nudgeMs={nudgeMs}
        onNudgeChange={setNudgeMs}
        snap={snap}
        onSnapChange={setSnap}
        maxStretchPct={DEFAULT_MAX_STRETCH_PCT}
      />

      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => void handlePlay()}
          disabled={isPreparing}
          className={`flex items-center justify-center rounded-full px-4 py-2 font-medium text-white transition-colors ${
            isPreparing ? 'cursor-not-allowed bg-gray-400' : 'bg-green-500 hover:bg-green-600'
          }`}
        >
          {isPreparing ? (
            <svg
              className="h-5 w-5 animate-spin text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <span className="flex items-center">
              <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                {isPlaying ? (
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                ) : (
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                    clipRule="evenodd"
                  />
                )}
              </svg>
              {isPlaying ? copy.pauseProcessed : copy.playProcessed}
            </span>
          )}
        </button>

        <button
          onClick={() => void handleDownload(false)}
          disabled={isDownloading}
          className="flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {isDownloading
            ? copy.downloading
            : `${copy.download} (${files.length} file${files.length > 1 ? 's' : ''})`}
        </button>

        {files.length > 1 && (
          <button
            onClick={() => void handleDownload(true)}
            disabled={isDownloading}
            className="flex items-center justify-center rounded-full bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {isDownloading ? copy.Merging : copy.MergeToOneAndDownload}
          </button>
        )}
      </div>

      {isDownloading && progress !== null && (
        <div className="space-y-1">
          <div className="h-2.5 w-full rounded-full bg-gray-200">
            <div
              className="h-2.5 rounded-full bg-blue-600 transition-all duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="text-xs text-gray-600">
            {copy.processing} {percent}%
          </div>
        </div>
      )}

      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
    </div>
  );
}
