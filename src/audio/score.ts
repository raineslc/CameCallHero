// Scores a take against reference recordings of one call.
// Tone: DTW over normalized log-mel frames (alignment makes timing offsets and
// device latency irrelevant). Pitch: dominant-frequency shape along the DTW path.
// Rhythm: call length, note count and how much of the call is sound vs gap.
// The take is compared with every reference; the best match counts.

import { extractFeatures, type AudioClip, type Features } from './features';

export interface Weights {
  rhythm: number;
  pitch: number;
  tone: number;
}

export interface SubScores {
  rhythm: number;
  pitch: number;
  tone: number;
}

export type RejectReason = 'too-quiet' | 'clipped' | 'too-noisy' | 'no-call' | 'no-reference';

export interface Rejection {
  reason: RejectReason;
  message: string;
}

export interface ScoreResult extends SubScores {
  /** 0-100. 0 when rejected. */
  score: number;
  /** Index of the best-matching reference, -1 if none. */
  bestReference: number;
  rejected: Rejection | null;
}

export const GATES = {
  /** Loudest 10 ms frame must reach this (dBFS). Gate only; level never enters the score. */
  minPeakDb: -50,
  /** Loudest frame must be this far above the noise floor (dB). */
  minSnrDb: 15,
  /** A run of this many samples at full scale (|x| >= 0.99) counts as clipped. */
  clipRunSamples: 3,
};

/** Distance-to-score mapping. Set once before calibration and not tuned; they only stretch the 0-100 scale. */
const TONE_SCALE = 0.35; // mean cosine distance at which tone falls to 100/e
const PITCH_SHAPE_SCALE = 6; // semitones
const PITCH_OFFSET_SCALE = 12; // semitones

const clamp100 = (v: number) => (Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0);

export function checkTake(f: Features, noiseFloorDb?: number): Rejection | null {
  if (f.longestClipRun >= GATES.clipRunSamples)
    return { reason: 'clipped', message: 'Too loud: the recording clipped. Back off the mic and try again.' };
  if (f.frameCount === 0 || f.peakDb < GATES.minPeakDb)
    return { reason: 'too-quiet', message: 'Too quiet: no call was heard. Call closer to the phone.' };
  const floor = noiseFloorDb !== undefined && Number.isFinite(noiseFloorDb) ? Math.max(noiseFloorDb, f.noiseFloorDb) : f.noiseFloorDb;
  if (f.peakDb - floor < GATES.minSnrDb)
    return { reason: 'too-noisy', message: 'Too noisy: the call is not clearly louder than the background.' };
  if (!f.span) return { reason: 'no-call', message: 'No call found in the recording.' };
  return null;
}

function cosineDistance(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 && nb === 0) return 0; // both silent: a gap matches a gap
  if (na === 0 || nb === 0) return 1;
  return Math.max(0, Math.min(1, 1 - dot / Math.sqrt(na * nb)));
}

/** DTW with steps (1,0), (0,1), (1,1). Returns mean cost along the path and the path. */
export function dtw(a: Float32Array[], b: Float32Array[]): { meanCost: number; path: [number, number][] } {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return { meanCost: 1, path: [] };
  const cost = new Float64Array(n * m);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      const d = cosineDistance(a[i], b[j]);
      if (i === 0 && j === 0) cost[0] = d;
      else {
        const up = i > 0 ? cost[(i - 1) * m + j] : Infinity;
        const left = j > 0 ? cost[i * m + j - 1] : Infinity;
        const diag = i > 0 && j > 0 ? cost[(i - 1) * m + j - 1] : Infinity;
        cost[i * m + j] = d + Math.min(up, left, diag);
      }
    }
  const path: [number, number][] = [];
  let i = n - 1;
  let j = m - 1;
  path.push([i, j]);
  while (i > 0 || j > 0) {
    const up = i > 0 ? cost[(i - 1) * m + j] : Infinity;
    const left = j > 0 ? cost[i * m + j - 1] : Infinity;
    const diag = i > 0 && j > 0 ? cost[(i - 1) * m + j - 1] : Infinity;
    if (diag <= up && diag <= left) {
      i--;
      j--;
    } else if (up <= left) i--;
    else j--;
    path.push([i, j]);
  }
  path.reverse();
  return { meanCost: cost[n * m - 1] / path.length, path };
}

const semitones = (hz: number) => 12 * Math.log2(hz / 440);

function median(v: number[]): number {
  const s = [...v].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

function voicedFraction(f: Features): number {
  if (!f.span) return 0;
  const voiced = f.notes.reduce((sum, n) => sum + n.end - n.start, 0);
  return voiced / (f.span.end - f.span.start);
}

const ratio = (a: number, b: number) => (Math.max(a, b) > 0 ? Math.min(a, b) / Math.max(a, b) : 1);

/** Compares two analyzed recordings. Does not apply the take gates (see scoreTake). */
export function compare(take: Features, ref: Features): SubScores {
  if (!take.span || !ref.span) return { rhythm: 0, pitch: 0, tone: 0 };
  const a = take.mel.slice(take.span.start, take.span.end);
  const b = ref.mel.slice(ref.span.start, ref.span.end);
  const { meanCost, path } = dtw(a, b);
  const tone = 100 * Math.exp(-meanCost / TONE_SCALE);

  // Pitch: dominant-frequency shape (relative to each recording's median) along the
  // aligned path, plus a smaller term for the overall pitch offset.
  const pa: number[] = [];
  const pb: number[] = [];
  for (const [i, j] of path) {
    const ha = take.domHz[take.span.start + i];
    const hb = ref.domHz[ref.span.start + j];
    if (ha > 0 && hb > 0) {
      pa.push(semitones(ha));
      pb.push(semitones(hb));
    }
  }
  let pitch = 0;
  if (pa.length > 0) {
    const ma = median(pa);
    const mb = median(pb);
    const shape = pa.reduce((s, v, k) => s + Math.abs(v - ma - (pb[k] - mb)), 0) / pa.length;
    pitch = 70 * Math.exp(-shape / PITCH_SHAPE_SCALE) + 30 * Math.exp(-Math.abs(ma - mb) / PITCH_OFFSET_SCALE);
  }

  const durSim = ratio(take.span.end - take.span.start, ref.span.end - ref.span.start);
  const countSim = ratio(take.notes.length, ref.notes.length);
  const fillSim = 1 - Math.abs(voicedFraction(take) - voicedFraction(ref));
  // Call length gates the rest: a 40 ms click is not a 1 s call, however its notes compare.
  const rhythm = 100 * Math.sqrt(durSim) * (0.5 * countSim + 0.5 * fillSim);

  return { rhythm: clamp100(rhythm), pitch: clamp100(pitch), tone: clamp100(tone) };
}

export function combine(s: SubScores, w: Weights): number {
  const total = w.rhythm + w.pitch + w.tone;
  if (!(total > 0)) return 0;
  return clamp100((w.rhythm * s.rhythm + w.pitch * s.pitch + w.tone * s.tone) / total);
}

export interface ScoreOptions {
  /** Noise floor measured during the count-in (dBFS); the louder of this and the take's own floor is used. */
  noiseFloorDb?: number;
}

/** Scores a take against analyzed references; the best-matching reference counts. */
export function scoreTake(take: AudioClip | Features, references: Features[], weights: Weights, opts: ScoreOptions = {}): ScoreResult {
  const f = 'samples' in take ? extractFeatures(take) : take;
  const zero = { score: 0, rhythm: 0, pitch: 0, tone: 0, bestReference: -1 };
  if (references.length === 0)
    return { ...zero, rejected: { reason: 'no-reference', message: 'No reference recordings for this call yet.' } };
  const rejected = checkTake(f, opts.noiseFloorDb);
  if (rejected) return { ...zero, rejected };
  let best: ScoreResult = { ...zero, rejected: null };
  references.forEach((ref, i) => {
    const s = compare(f, ref);
    const score = combine(s, weights);
    if (best.bestReference === -1 || score > best.score) best = { ...s, score, bestReference: i, rejected: null };
  });
  return best;
}
