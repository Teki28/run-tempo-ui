'use client';

import React, { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import content from '../content.json';

type ValidLang = 'en' | 'zh' | 'ja';

interface BpmControlsProps {
  lang: ValidLang;
  onBpmChange: (bpm: number) => void;
  onVolumeChange: (volume: number) => void;
  defaultBpm?: number;
  defaultVolume?: number;
  /** Locked while the mixed audio is playing — the rendered clip is fixed, so a
   *  change here could not be heard until it is re-rendered anyway. */
  disabled?: boolean;
}

export default function BpmControls({
  lang,
  onBpmChange,
  onVolumeChange,
  defaultBpm = 120,
  defaultVolume = 100,
  disabled = false,
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
  const dimmed = disabled ? 'text-gray-400' : 'text-gray-900';

  return (
    <Card className={`p-6 space-y-6 transition-colors ${disabled ? 'bg-gray-50' : ''}`}>
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="bpm-slider" className={dimmed}>
              BPM
            </Label>
            <span className={`text-sm font-medium ${dimmed}`}>{bpm}</span>
          </div>
          <Slider
            id="bpm-slider"
            min={30}
            max={300}
            step={1}
            value={[bpm]}
            onValueChange={handleBpmChange}
            disabled={disabled}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>30</span>
            <span>300</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="volume-slider" className={dimmed}>
              {copy.volume}
            </Label>
            <span className={`text-sm font-medium ${dimmed}`}>{volume}%</span>
          </div>
          <Slider
            id="volume-slider"
            min={0}
            max={500}
            step={5}
            value={[volume]}
            onValueChange={handleVolumeChange}
            disabled={disabled}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>500%</span>
          </div>
        </div>
      </div>

      {/* Always mounted so the buttons below never jump when playback starts —
          the note appearing under the cursor mid-click made it easy to hit the
          wrong button. Hidden from assistive tech while inactive. */}
      <div
        role="status"
        aria-hidden={!disabled}
        className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs transition-opacity ${
          disabled
            ? 'border-amber-200 bg-amber-50 text-amber-800 opacity-100'
            : 'pointer-events-none border-transparent text-transparent opacity-0'
        }`}
      >
        <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <span>{copy.pauseToAdjust}</span>
      </div>
    </Card>
  );
}
