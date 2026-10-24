'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { MAX_NUDGE_MS, needsSnapOffer, type MixPlan } from '@/lib/audio';
import type { Activity } from '@/hooks/useAudioEngine';
import content from '../content.json';

type ValidLang = 'en' | 'zh' | 'ja';

interface TempoPanelProps {
  lang: ValidLang;
  /** Null until the song has been analysed. */
  plan: MixPlan | null;
  /** Non-null while a long job is running. */
  activity: Activity | null;
  targetBpm: number;
  nudgeMs: number;
  onNudgeChange: (ms: number) => void;
  snap: boolean;
  onSnapChange: (snap: boolean) => void;
  maxStretchPct: number;
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));

/** A labelled figure in the readout row. */
function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold text-gray-900 tabular-nums truncate">{value}</div>
      {hint && <div className="text-xs text-gray-500 truncate">{hint}</div>}
    </div>
  );
}

export default function TempoPanel({
  lang,
  plan,
  activity,
  targetBpm,
  nudgeMs,
  onNudgeChange,
  snap,
  onSnapChange,
  maxStretchPct,
}: TempoPanelProps) {
  const copy = content[lang].main.tempo;

  const ratioLabel = (ratio: number): string => {
    const table = copy.ratios as Record<string, string>;
    return table[String(ratio)] ?? `x${ratio}`;
  };

  const stretchLabel = (pct: number) =>
    Math.abs(pct) < 0.05 ? copy.noStretch : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;

  const phaseLabel = (phase: Activity['phase']) =>
    (copy.phases as Record<string, string>)[phase] ?? copy.analysing;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-gray-900">{copy.sectionTitle}</h3>
        {plan?.beatLocked && !snap && (
          <span className="text-xs text-green-700">{copy.beatLocked}</span>
        )}
        {plan && !plan.beatLocked && (
          <span className="text-xs text-amber-700">{copy.gridFallback}</span>
        )}
      </div>

      {activity ? (
        <div className="space-y-2" role="status" aria-live="polite">
          <div className="flex justify-between text-sm text-gray-700">
            <span>{phaseLabel(activity.phase)}</span>
            <span className="tabular-nums">{Math.round(activity.fraction * 100)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all duration-150"
              style={{ width: `${Math.round(activity.fraction * 100)}%` }}
            />
          </div>
        </div>
      ) : !plan ? (
        <p className="text-sm text-gray-500">{copy.notAnalysed}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure
            label={copy.songTempo}
            value={plan.songBpm === null ? '—' : `${plan.songBpm.toFixed(1)}`}
          />
          <Figure
            label={copy.ratio}
            value={plan.choice ? `x${plan.choice.ratio}` : '—'}
            hint={plan.choice ? ratioLabel(plan.choice.ratio) : undefined}
          />
          <Figure
            label={copy.stretch}
            value={plan.choice ? stretchLabel(plan.choice.stretchPct) : copy.noStretch}
          />
          <Figure label={copy.clickTempo} value={`${plan.effectiveBpm.toFixed(1)}`} />
        </div>
      )}

      {plan?.choice && needsSnapOffer(plan.choice) && !snap && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
          <div className="text-sm font-medium text-amber-900">{copy.tooFarTitle}</div>
          <p className="text-xs text-amber-800">
            {fill(copy.tooFarBody, {
              limit: maxStretchPct,
              effective: plan.choice.effectiveBpm.toFixed(1),
              gap: Math.abs(plan.choice.residualBpm).toFixed(1),
              target: targetBpm,
            })}
          </p>
          <button
            type="button"
            onClick={() => onSnapChange(true)}
            className="rounded-full bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700"
          >
            {fill(copy.snapAction, { natural: plan.choice.naturalBpm.toFixed(1) })}
          </button>
        </div>
      )}

      {plan?.choice && snap && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-blue-200 bg-blue-50 p-3">
          <span className="text-xs text-blue-900">
            {fill(copy.snapActive, { natural: plan.choice.naturalBpm.toFixed(1) })}
          </span>
          <button
            type="button"
            onClick={() => onSnapChange(false)}
            className="rounded-full border border-blue-300 bg-white px-3 py-1 text-xs font-medium text-blue-800 transition-colors hover:bg-blue-100"
          >
            {fill(copy.snapUndo, { target: targetBpm })}
          </button>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="nudge-slider" className="text-gray-900">
            {copy.nudge}
          </Label>
          <span className="text-sm font-medium text-gray-900 tabular-nums">
            {nudgeMs > 0 ? '+' : ''}
            {nudgeMs} ms
          </span>
        </div>
        <Slider
          id="nudge-slider"
          min={-MAX_NUDGE_MS}
          max={MAX_NUDGE_MS}
          step={5}
          value={[nudgeMs]}
          onValueChange={(value) => onNudgeChange(value[0])}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>-{MAX_NUDGE_MS}</span>
          <span>{copy.nudgeHint}</span>
          <span>+{MAX_NUDGE_MS}</span>
        </div>
      </div>
    </div>
  );
}
