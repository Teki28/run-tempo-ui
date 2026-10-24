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
}

export default function BpmControls({
  lang,
  onBpmChange,
  onVolumeChange,
  defaultBpm = 170,
  defaultVolume = 100,
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
            min={30}
            max={300}
            step={1}
            value={[bpm]}
            onValueChange={handleBpmChange}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>30</span>
            <span>300</span>
          </div>
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
