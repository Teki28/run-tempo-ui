'use client';

import React, { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import type { ReachableRange } from '@/lib/audio';
import content from '../content.json';

type ValidLang = 'en' | 'zh' | 'ja';

/** Ends of the BPM slider. The reachable band is drawn against this scale. */
const BPM_MIN = 30;
const BPM_MAX = 300;

interface BpmControlsProps {
  lang: ValidLang;
  onBpmChange: (bpm: number) => void;
  onVolumeChange: (volume: number) => void;
  defaultBpm?: number;
  defaultVolume?: number;
  /** What the analysed song can actually deliver. Null until it is analysed. */
  reachable?: ReachableRange | null;
  /** The song's own tempo, for the note explaining where the band comes from. */
  songBpm?: number | null;
  /** Stretch limit as a percentage, for that same note. */
  maxStretchPct?: number;
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));

/** Position of a BPM on the slider scale, as a percentage, clamped to it. */
const scalePct = (bpm: number) =>
  Math.min(100, Math.max(0, ((bpm - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100));

export default function BpmControls({
  lang,
  onBpmChange,
  onVolumeChange,
  defaultBpm = 170,
  defaultVolume = 100,
  reachable = null,
  songBpm = null,
  maxStretchPct,
}: BpmControlsProps) {
  const [bpm, setBpm] = useState(defaultBpm);
  const [volume, setVolume] = useState(defaultVolume);

  const handleBpmChange = (value: number[]) => {
    setBpm(value[0]);
    onBpmChange(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    onVolumeChange(value[0]);
  };

  const copy = content[lang].main.bpmControls;

  return (
    <Card className="p-6 space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="bpm-slider" className="text-gray-900">
              BPM
            </Label>
            <span className="text-sm font-medium text-gray-900">{bpm}</span>
          </div>
          <Slider
            id="bpm-slider"
            min={BPM_MIN}
            max={BPM_MAX}
            step={1}
            value={[bpm]}
            onValueChange={handleBpmChange}
            className="w-full"
          />
          {reachable && (
            // Drawn as its own strip under the slider rather than shaded onto
            // the track: the track is painted by Radix and anything laid over
            // it also covers the thumb.
            <div
              className="relative h-1 w-full overflow-hidden rounded-full bg-gray-200"
              aria-hidden="true"
            >
              <div
                className="absolute h-1 rounded-full bg-green-500/70"
                style={{
                  left: `${scalePct(reachable.minBpm)}%`,
                  width: `${Math.max(
                    1,
                    scalePct(reachable.maxBpm) - scalePct(reachable.minBpm),
                  )}%`,
                }}
              />
            </div>
          )}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{BPM_MIN}</span>
            {reachable && (
              <span className="text-green-700">
                {fill(copy.reachable, {
                  min: Math.round(reachable.minBpm),
                  max: Math.round(reachable.maxBpm),
                })}
              </span>
            )}
            <span>{BPM_MAX}</span>
          </div>
          {reachable && songBpm !== null && maxStretchPct !== undefined && (
            <p className="text-xs text-gray-500">
              {fill(copy.reachableNote, {
                song: songBpm.toFixed(1),
                limit: maxStretchPct,
              })}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="volume-slider" className="text-gray-900">
              {copy.volume}
            </Label>
            <span className="text-sm font-medium text-gray-900">{volume}%</span>
          </div>
          <Slider
            id="volume-slider"
            min={0}
            max={500}
            step={5}
            value={[volume]}
            onValueChange={handleVolumeChange}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>500%</span>
          </div>
        </div>
      </div>

    </Card>
  );
}
