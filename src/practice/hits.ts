// Hit or miss per reference note on the practice lane, and the star rating of a result.
// Visual feedback only: the score stays the scorer's (score.ts).
//
// A note is hit when the user's sound is active at a time inside the note's hit window: the
// note's start and end, each widened by HIT_TOLERANCE_SEC, but never past the middle of the
// gap to the next or previous note, so one sound cannot hit two notes. Times are on the
// practice timeline with the tap-test latency already removed by the caller.

export interface Span {
  start: number;
  end: number;
}

/**
 * Widening of each note's window, seconds, on both sides.
 * Measured parts: the live sound is measured per mic chunk (2048 samples: 43–46 ms at 48 or
 * 44.1 kHz) and stamped at the chunk centre, so its time is uncertain by about half a chunk
 * (~23 ms). Not measured: the tap-test latency is speaker + touch delay, a stand-in for the mic
 * delay (latency.ts), so it can be off by an unknown amount.
 * shortcut: 0.15 s = half a chunk plus ~0.13 s untuned margin for that unknown; tune it with
 * phone takes once testers report hits that look early or late.
 */
export const HIT_TOLERANCE_SEC = 0.15;

/** Note states in HitTracker.state. */
export const PENDING = 0;
export const HIT = 1;
export const MISS = 2;

/** Hit windows [lo, hi) of time-ordered, non-overlapping notes. */
export function hitWindows(notes: readonly Span[], tolSec = HIT_TOLERANCE_SEC): { lo: Float64Array; hi: Float64Array } {
  const n = notes.length;
  const lo = new Float64Array(n);
  const hi = new Float64Array(n);
  const tol = Number.isFinite(tolSec) && tolSec > 0 ? tolSec : 0;
  for (let i = 0; i < n; i++) {
    const { start, end } = notes[i];
    let a = start - tol;
    let b = end + tol;
    if (i > 0) a = Math.max(a, Math.min(start, (notes[i - 1].end + start) / 2));
    if (i < n - 1) b = Math.min(b, Math.max(end, (end + notes[i + 1].start) / 2));
    lo[i] = a;
    hi[i] = b;
  }
  return { lo, hi };
}

/**
 * Decides hit or miss for each note while a take runs. update() is called once per mic chunk
 * with non-decreasing times; it allocates nothing.
 */
export class HitTracker {
  /** PENDING, HIT or MISS per note. */
  readonly state: Uint8Array;
  /** Timeline time (s) at which each note was decided; NaN while pending. */
  readonly decidedAt: Float64Array;
  private readonly lo: Float64Array;
  private readonly hi: Float64Array;
  private next = 0;
  hits = 0;
  misses = 0;
  streak = 0;
  bestStreak = 0;

  constructor(notes: readonly Span[], tolSec = HIT_TOLERANCE_SEC) {
    ({ lo: this.lo, hi: this.hi } = hitWindows(notes, tolSec));
    this.state = new Uint8Array(notes.length);
    this.decidedAt = new Float64Array(notes.length).fill(NaN);
  }

  get total(): number {
    return this.state.length;
  }

  reset(): void {
    this.state.fill(PENDING);
    this.decidedAt.fill(NaN);
    this.next = this.hits = this.misses = this.streak = this.bestStreak = 0;
  }

  private decide(i: number, s: number, t: number): void {
    this.state[i] = s;
    this.decidedAt[i] = t;
    if (s === HIT) {
      this.hits++;
      this.streak++;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;
    } else {
      this.misses++;
      this.streak = 0;
    }
  }

  /** `t`: time of the sound (s); `active`: the user's sound is on. Returns true if a note was decided. */
  update(t: number, active: boolean): boolean {
    if (!Number.isFinite(t)) return false;
    let changed = false;
    while (this.next < this.state.length && t >= this.hi[this.next]) {
      if (this.state[this.next] === PENDING) {
        this.decide(this.next, MISS, t);
        changed = true;
      }
      this.next++;
    }
    const i = this.next;
    if (active && i < this.state.length && t >= this.lo[i] && this.state[i] === PENDING) {
      this.decide(i, HIT, t);
      changed = true;
    }
    return changed;
  }

  /** The take ended at time t: notes still pending are missed. */
  finish(t: number): boolean {
    let changed = false;
    for (let i = this.next; i < this.state.length; i++)
      if (this.state[i] === PENDING) {
        this.decide(i, MISS, t);
        changed = true;
      }
    this.next = this.state.length;
    return changed;
  }
}

/**
 * After the take: which reference notes were hit by any take note overlapping their window,
 * and which take notes hit a reference note. Same windows as the live lane.
 */
export function matchNotes(ref: readonly Span[], take: readonly Span[], tolSec = HIT_TOLERANCE_SEC): { refHit: boolean[]; takeHit: boolean[] } {
  const { lo, hi } = hitWindows(ref, tolSec);
  const refHit = ref.map(() => false);
  const takeHit = take.map(() => false);
  ref.forEach((_, i) =>
    take.forEach((n, j) => {
      if (n.end > lo[i] && n.start < hi[i]) {
        refHit[i] = true;
        takeHit[j] = true;
      }
    }),
  );
  return { refHit, takeHit };
}

/**
 * Lowest total score (0–100) for 1..5 stars: 1 star below 20, 2 from 20, 3 from 40, 4 from 60,
 * 5 from 80. shortcut: equal 20-point bands, not calibrated per call. For scale: reference
 * gobbles score 73–82 against each other (Phase 2 calibration), so a take as close as one
 * turkey recording to another gets 4 or 5 stars. Revisit with scored tester takes.
 */
export const STAR_BANDS = [0, 20, 40, 60, 80] as const;

/** 1..5 stars from a total score; non-finite scores get 1. */
export function starsFor(score: number): number {
  if (!Number.isFinite(score)) return 1;
  let stars = 1;
  for (let k = 1; k < STAR_BANDS.length; k++) if (score >= STAR_BANDS[k]) stars = k + 1;
  return stars;
}
