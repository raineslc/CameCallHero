// Timeline and lane geometry of one practice take. All times are seconds from the moment
// the mic delivered its first sample (the start of the count-in).
//
//   0 ........ COUNT_IN_SEC ........ callAt ................ end
//   count-in (noise floor)  perform: lead, then the reference call, then a tail

import { HOP_SEC, MAX_HZ, MIN_HZ, type Features } from '../audio/features';

export const COUNT_IN_SEC = 3;
/** Recording starts this long before the first reference note reaches the hit line. */
export const LEAD_SEC = 0.5;
/** Recording continues this long after the longest reference call would end. */
export const TAIL_SEC = 1.5;
/** Seconds of the timeline visible above / below the hit line. */
export const AHEAD_SEC = 2.5;
export const BEHIND_SEC = 0.8;

export interface LaneNote {
  start: number;
  end: number;
  /** Median dominant frequency of the note, Hz; 0 if it has none. */
  hz: number;
}

export interface PracticePlan {
  /** Count-in ends and recording of the take starts. */
  performStart: number;
  /** The shown reference's first note reaches the hit line. */
  callAt: number;
  /** Recording stops. */
  end: number;
  /** Notes of the shown reference, on the timeline. */
  notes: LaneNote[];
  /** Pitch axis of the lane (log scale), Hz. */
  loHz: number;
  hiHz: number;
}

function median(v: number[]): number {
  if (v.length === 0) return 0;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Notes of a recording as seconds from its first note, with their median dominant frequency. */
export function notesOf(f: Features): LaneNote[] {
  if (!f.span) return [];
  const t0 = f.span.start;
  return f.notes.map((n) => {
    const hz: number[] = [];
    for (let i = n.start; i < n.end; i++) if (f.domHz[i] > 0) hz.push(f.domHz[i]);
    return { start: (n.start - t0) * HOP_SEC, end: (n.end - t0) * HOP_SEC, hz: median(hz) };
  });
}

export const spanSeconds = (f: Features): number => (f.span ? (f.span.end - f.span.start) * HOP_SEC : 0);

/**
 * Pitch axis: the 10th to 90th percentile of the references' dominant frequency inside notes,
 * widened by an octave each side, within MIN_HZ..MAX_HZ. Falls back to the full range.
 */
export function pitchRange(refs: Features[]): [number, number] {
  const hz: number[] = [];
  for (const f of refs) for (const n of f.notes) for (let i = n.start; i < n.end; i++) if (f.domHz[i] > 0) hz.push(f.domHz[i]);
  if (hz.length === 0) return [MIN_HZ, MAX_HZ];
  hz.sort((a, b) => a - b);
  const lo = Math.max(MIN_HZ, hz[Math.floor(0.1 * (hz.length - 1))] / 2);
  const hi = Math.min(MAX_HZ, hz[Math.ceil(0.9 * (hz.length - 1))] * 2);
  return hi > lo * 1.5 ? [lo, hi] : [MIN_HZ, MAX_HZ];
}

/** `shown` is the reference drawn on the lane; `all` sets the take length (longest call) and pitch axis. */
export function makePlan(shown: Features, all: Features[]): PracticePlan {
  const performStart = COUNT_IN_SEC;
  const callAt = performStart + LEAD_SEC;
  const longest = Math.max(spanSeconds(shown), ...all.map(spanSeconds));
  const [loHz, hiHz] = pitchRange(all.length ? all : [shown]);
  const notes = notesOf(shown).map((n) => ({ ...n, start: n.start + callAt, end: n.end + callAt }));
  return { performStart, callAt, end: callAt + longest + TAIL_SEC, notes, loHz, hiHz };
}

/** Horizontal position 0..1 of a frequency on the lane's log pitch axis (clamped; 0 Hz is centred). */
export function pitchX(hz: number, loHz: number, hiHz: number): number {
  if (!(hz > 0) || !(hiHz > loHz) || !(loHz > 0)) return 0.5;
  return Math.max(0, Math.min(1, Math.log(hz / loHz) / Math.log(hiHz / loHz)));
}

/** Vertical position of timeline time `t` when the lane shows time `now` at the hit line. */
export const laneY = (t: number, now: number, hitY: number, pxPerSec: number): number => hitY - (t - now) * pxPerSec;

/** What the user is asked to make: the shown reference's note count and call length (s). */
export function noteTarget(f: Features): { notes: number; seconds: number } {
  return { notes: notesOf(f).length, seconds: spanSeconds(f) };
}

export const targetText = (t: { notes: number; seconds: number }): string =>
  t.notes === 1
    ? `Make 1 note lasting about ${t.seconds.toFixed(1)} seconds.`
    : `Make ${t.notes} notes in about ${t.seconds.toFixed(1)} seconds.`;
