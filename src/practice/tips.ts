// One plain tip from the weakest sub-score. Tips state what was measured in the take and in
// the closest reference; they make no claims about turkey calls beyond those measurements.

import type { Features } from '../audio/features';
import type { SubScores } from '../audio/score';
import { spanSeconds } from './plan';

export type Part = keyof SubScores;

/** Lowest sub-score; ties go to rhythm, then pitch, then tone. */
export function weakestPart(s: SubScores): Part {
  const order: Part[] = ['rhythm', 'pitch', 'tone'];
  return order.reduce((a, b) => (s[b] < s[a] ? b : a));
}

function medianHz(f: Features): number {
  const v: number[] = [];
  for (const n of f.notes) for (let i = n.start; i < n.end; i++) if (f.domHz[i] > 0) v.push(f.domHz[i]);
  if (v.length === 0) return 0;
  v.sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
}

/** Pitch differences smaller than this (semitones) are not mentioned. */
const PITCH_TIP_SEMITONES = 2;
/** Length differences smaller than this fraction are not mentioned. */
const LENGTH_TIP_FRACTION = 0.2;

const notes = (n: number) => `${n} note${n === 1 ? '' : 's'}`;

export function tipFor(scores: SubScores, take: Features, ref: Features): { part: Part; text: string } {
  const part = weakestPart(scores);
  if (part === 'rhythm') {
    const a = spanSeconds(take);
    const b = spanSeconds(ref);
    const measured = `Yours: ${notes(take.notes.length)} over ${a.toFixed(2)} s. Closest reference: ${notes(ref.notes.length)} over ${b.toFixed(2)} s.`;
    let advice = 'Match the number of notes and the gaps between them.';
    if (b > 0 && Math.abs(a - b) > LENGTH_TIP_FRACTION * b) advice = a > b ? 'Make the call shorter.' : 'Make the call longer.';
    else if (take.notes.length === ref.notes.length) advice = 'Match how much of the call is sound and how much is gap.';
    return { part, text: `Rhythm was your weakest part. ${measured} ${advice}` };
  }
  if (part === 'pitch') {
    const a = medianHz(take);
    const b = medianHz(ref);
    const st = a > 0 && b > 0 ? 12 * Math.log2(a / b) : 0;
    if (Math.abs(st) >= PITCH_TIP_SEMITONES)
      return {
        part,
        text: `Pitch was your weakest part. Your call sat about ${Math.round(Math.abs(st))} semitones ${st > 0 ? 'higher' : 'lower'} than the closest reference. Listen again and aim ${st > 0 ? 'lower' : 'higher'}.`,
      };
    return { part, text: 'Pitch was your weakest part. Listen again and follow where the reference rises and falls.' };
  }
  return {
    part,
    text: 'Tone was your weakest part: the mix of low and high sound in your call differs from the reference. Listen again and copy how it sounds, not only its timing.',
  };
}
