// Plain-language feedback after a take: one line for each part of the score, with a verdict
// and one thing to do. Lines state only what was measured in the take and in the closest
// reference recording; they make no claims about the calls beyond those measurements.
// `noun` names the animal (default 'turkey').
// Words are for a hunter with no music or audio background: no "pitch", "tone", "rhythm",
// "semitones" or "frequency" in the text (a unit test checks this).

import type { Features } from '../audio/features';
import { NOTE_BREAK_SCALE, noteShapes, partWeights, scoreTake, type SubScores, type Weights } from '../audio/score';
import { spanSeconds } from './plan';

export type Part = keyof SubScores;
export const PARTS: readonly Part[] = ['rhythm', 'pitch', 'tone'];
/** On-screen names of the sub-scores. */
export const PART_LABELS: Record<Part, string> = { rhythm: 'Timing & notes', pitch: 'High/low', tone: 'Sound' };

export type Verdict = 'Good' | 'Close' | 'Needs work';

export interface Tip {
  part: Part;
  label: string;
  /** Null when the call has fewer than 2 references (no reference level to compare with). */
  verdict: Verdict | null;
  text: string;
  /**
   * The one thing to do for this part, short and plain (no final full stop), or null when the
   * verdict is Good and nothing measured differs.
   */
  action: string | null;
}

/**
 * The sub-scores real turkeys reach: each reference scored against the call's other references
 * (leave-one-out, as in the calibration test), lowest value per part. Null with < 2 references.
 */
export function referenceLevels(refs: Features[], weights: Weights): SubScores | null {
  const levels: SubScores = { rhythm: Infinity, pitch: Infinity, tone: Infinity };
  let any = false;
  refs.forEach((f, i) => {
    const others = refs.filter((_, j) => j !== i);
    if (others.length === 0) return;
    const r = scoreTake(f, others, weights);
    if (r.rejected) return;
    any = true;
    for (const p of PARTS) levels[p] = Math.min(levels[p], r[p]);
  });
  return any ? levels : null;
}

/**
 * "Close" covers this many points below the reference level.
 * shortcut: 15 is the calibration margin (the gap required between the right call and a wrong
 * one), reused here, not tuned per part; revisit with scored takes from testers.
 */
export const CLOSE_BAND = 15;

/** Good: at least what one turkey recording scores against another. Close: within CLOSE_BAND below that. */
export function verdictFor(score: number, level: number): Verdict {
  if (score >= level) return 'Good';
  if (score >= level - CLOSE_BAND) return 'Close';
  return 'Needs work';
}

function median(v: number[]): number {
  if (v.length === 0) return 0;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function medianHz(f: Features): number {
  const v: number[] = [];
  for (const n of f.notes) for (let i = n.start; i < n.end; i++) if (f.domHz[i] > 0) v.push(f.domHz[i]);
  return median(v);
}

/** High/low differences smaller than this (semitones, internal only) are not mentioned. */
const HIGH_LOW_TIP_SEMITONES = 2;
/** Call-length differences smaller than this fraction are not mentioned. */
const LENGTH_TIP_FRACTION = 0.2;
/**
 * Differences in how far notes drop from high to low (mel bands, the scorer's note "break")
 * smaller than this are not mentioned: half the scorer's NOTE_BREAK_SCALE, where its
 * note-break match has fallen to about 60%.
 */
const BREAK_TIP_BANDS = NOTE_BREAK_SCALE / 2;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const seconds = (s: number) => `${s.toFixed(1)} seconds`;
const sentence = (parts: string[]) => {
  const s = parts.join(' and ');
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
};
/** A verdict of Good with something left to fix: offered as optional, not as a correction. */
const closer = (text: string, verdict: Verdict | null) =>
  verdict === 'Good' ? `To get even closer: ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
/** "6 notes in 2.0 seconds" / "1 note lasting 0.9 seconds". */
export const describeNotes = (count: number, span: number) =>
  count === 1 ? `1 note lasting ${seconds(span)}` : `${plural(count, 'note')} in ${seconds(span)}`;

type Line = { text: string; action: string | null };

function timingText(take: Features, ref: Features, verdict: Verdict | null, noun: string): Line {
  const a = spanSeconds(take);
  const b = spanSeconds(ref);
  const dn = take.notes.length - ref.notes.length;
  const todo: string[] = [];
  if (dn > 0) todo.push(`make ${plural(dn, 'fewer note')}`);
  if (dn < 0) todo.push(`make ${plural(-dn, 'more note')}`);
  const lengthOff = b > 0 && Math.abs(a - b) > LENGTH_TIP_FRACTION * b;
  if (lengthOff) todo.push(a > b ? 'make the whole call shorter' : 'make the whole call longer');
  const measured = `You made ${describeNotes(take.notes.length, a)}. The closest ${noun} recording has ${describeNotes(ref.notes.length, b)}.`;
  const advice = todo.length
    ? closer(sentence(todo), verdict)
    : verdict === 'Good'
      ? 'Keep it up.'
      : 'Listen again and copy when each note starts and how long it lasts.';
  const action =
    dn !== 0
      ? `Make ${plural(ref.notes.length, 'note')} instead of ${take.notes.length}`
      : lengthOff
        ? `Make the whole call about ${seconds(b)} long instead of ${seconds(a)}`
        : verdict === 'Good'
          ? null
          : 'Copy when each note starts and how long it lasts';
  return { text: `${measured} ${advice}`, action };
}

function highLowText(take: Features, ref: Features, verdict: Verdict | null, noun: string): Line {
  const lines: string[] = [];
  const actions: string[] = [];
  const a = medianHz(take);
  const b = medianHz(ref);
  const st = a > 0 && b > 0 ? 12 * Math.log2(a / b) : 0;
  if (st >= HIGH_LOW_TIP_SEMITONES) {
    lines.push(`Your call was higher than the ${noun}'s. Make it deeper.`);
    actions.push('Make your call deeper');
  }
  if (st <= -HIGH_LOW_TIP_SEMITONES) {
    lines.push(`Your call was deeper than the ${noun}'s. Make it higher.`);
    actions.push('Make your call higher');
  }

  // Each note's drop from high to low (the scorer's per-note break).
  const takeFall = median(noteShapes(take).map((s) => s.fall));
  const refFall = median(noteShapes(ref).map((s) => s.fall));
  if (take.notes.length > 0 && ref.notes.length > 0) {
    if (refFall - takeFall >= BREAK_TIP_BANDS) {
      if (refFall >= BREAK_TIP_BANDS) {
        lines.push(
          `Each ${noun} note starts high and drops lower. Yours ${takeFall <= 0 ? 'did not drop' : 'dropped less'}. Let each note break downward.`,
        );
        actions.push('Let each note start high and break downward');
      } else {
        lines.push(`Your notes rise toward their end; the ${noun}'s do not. Keep the end of each note from going up.`);
        actions.push('Keep the end of each note from going up');
      }
    } else if (takeFall - refFall >= BREAK_TIP_BANDS) {
      lines.push(`Your notes drop from high to low more than the ${noun}'s. Keep each note steadier.`);
      actions.push('Keep each note steadier');
    }
  }
  if (lines.length) return { text: closer(lines.join(' '), verdict), action: actions[0] };
  return verdict === 'Good'
    ? { text: 'Keep it up.', action: null }
    : { text: `Listen again and follow where the ${noun}'s call goes higher and lower.`, action: `Follow where the ${noun}'s call goes higher and lower` };
}

function soundText(verdict: Verdict | null, noun: string): Line {
  return verdict === 'Good'
    ? { text: 'Keep it up.', action: null }
    : { text: `Listen again and copy the sound of the ${noun}, not just the timing.`, action: `Copy the sound of the ${noun}, not just the timing` };
}

/** One line per part, in the order timing, high/low, sound. `ref` is the closest reference. */
export function tipsFor(scores: SubScores, take: Features, ref: Features, levels: SubScores | null, noun = 'turkey'): Tip[] {
  return PARTS.map((part) => {
    const verdict = levels ? verdictFor(scores[part], levels[part]) : null;
    const line = part === 'rhythm' ? timingText(take, ref, verdict, noun) : part === 'pitch' ? highLowText(take, ref, verdict, noun) : soundText(verdict, noun);
    return { part, label: PART_LABELS[part], verdict, ...line };
  });
}

export const SAME_AGAIN = 'Do it again the same way';

/**
 * The single most useful thing to do next: the action of the part that costs the total score
 * the most, i.e. the largest weight x (reference level - sub-score), or weight x (100 -
 * sub-score) without reference levels. Parts with no action are skipped; if none has one, the
 * take matched the references on every part.
 */
export function nextStep(tips: Tip[], scores: SubScores, levels: SubScores | null, weights: Weights): string {
  const w = partWeights(weights);
  const cost = (p: Part) => {
    const gap = levels ? Math.max(0, levels[p] - scores[p]) : 100 - scores[p];
    return w[p] * (Number.isFinite(gap) ? gap : 0);
  };
  const ranked = tips.filter((t) => t.action !== null).sort((a, b) => cost(b.part) - cost(a.part));
  return ranked[0]?.action ?? SAME_AGAIN;
}
