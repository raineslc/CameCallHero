// Calling challenge: one free take (up to CHALLENGE_SECONDS) that can hold a whole sequence of
// calls. The take is split into calls at pauses, each call is scored against every unlocked
// call of the species with the practice scorer, and the take gets one 0-100 score. The split
// gap, thresholds and rank titles are per species (src/challenge/rules.ts).

import { extractFeatures, frameGeometry, HOP_SEC, type AudioClip, type Band, type Features, type Note } from '../audio/features';
import { checkTake, scoreTake, type Rejection } from '../audio/score';
import type { CallDef } from '../calls/call';
import { starsFor } from '../practice/hits';
import type { ChallengeRules } from './rules';

/** Longest take, seconds (after the count-in). */
export const CHALLENGE_SECONDS = 20;

/**
 * Audio kept on each side of a call when it is scored on its own: the references keep at
 * least 0.3 s before the call for the noise floor (public/audio/turkey/manifest.json).
 * Never more than half the pause to the next call.
 */
export const SEGMENT_PAD_SEC = 0.3;

/** True if `score` reaches the species' threshold for `callId` (no threshold: never). */
export const isRecognized = (rules: Pick<ChallengeRules, 'recognizeMin'>, callId: string, score: number): boolean =>
  Number.isFinite(score) && score >= (rules.recognizeMin[callId] ?? Infinity);

/** Groups notes (frames, in order) into calls: a gap of `gapFrames` or more starts a new call. */
export function segmentNotes(notes: readonly Note[], gapFrames: number): Note[] {
  const out: Note[] = [];
  for (const n of notes) {
    const last = out[out.length - 1];
    if (last && n.start - last.end < gapFrames) last.end = Math.max(last.end, n.end);
    else out.push({ start: n.start, end: n.end });
  }
  return out;
}

export interface SegmentResult {
  /** Seconds from the start of the take: first note start, last note end. */
  start: number;
  end: number;
  /** Best-matching call and its score (0-100); call null if nothing scored above 0. */
  call: CallDef | null;
  score: number;
  /** Index of the best reference of `call`, for playback; -1 if none. */
  bestReference: number;
  recognized: boolean;
}

/**
 * Challenge score, 0-100: each recognized call's score weighted by how long it lasts; time
 * spent on calls that were not recognized counts as 0.
 *
 *   score = sum(recognized: score_i * length_i) / sum(all: length_i)
 *
 * So it is the duration-weighted mean of the recognized calls, times the share of calling
 * time that was recognized. Length = first note start to last note end of the call; pauses
 * between calls do not count. No bonuses.
 */
export function challengeScore(segments: readonly Pick<SegmentResult, 'start' | 'end' | 'score' | 'recognized'>[]): number {
  let total = 0;
  let sum = 0;
  for (const s of segments) {
    const len = s.end - s.start;
    if (!(len > 0) || !Number.isFinite(len)) continue;
    total += len;
    if (s.recognized && Number.isFinite(s.score)) sum += Math.min(100, Math.max(0, s.score)) * len;
  }
  return total > 0 ? Math.min(100, Math.max(0, sum / total)) : 0;
}

/** Rank title by star band (1-5 stars), from the species' rank titles. */
export const rankFor = (ranks: ChallengeRules['ranks'], score: number): string => ranks[starsFor(score) - 1];

/** A call of the species with its analyzed references. */
export interface CallRefs {
  call: CallDef;
  refs: Features[];
}

/**
 * Result of one challenge take.
 *
 * Extra rating hook: a second, independent rating (for example an on-device bird recognizer)
 * goes in a new field here, filled after analyzeChallenge, and is shown next to the score.
 * It must not change `score`, whose formula is challengeScore.
 */
export interface ChallengeResult {
  /** Why the take as a whole was not scored (scorer gates), or null. */
  rejected: Rejection | null;
  /** Length of the take, seconds. */
  seconds: number;
  segments: SegmentResult[];
  score: number;
  stars: number;
  rank: string;
}

/** A take split into calls: each call's place in the take and its own analysis. */
export interface SplitTake {
  rejected: Rejection | null;
  seconds: number;
  /** Seconds from the start of the take; `features` of the call's slice (with padding). */
  parts: { start: number; end: number; features: Features }[];
}

/**
 * Splits a take into calls at pauses of `gapSec` (the species' split gap), after the scorer's take gates
 * (clipping, too quiet, too noisy, no call) on the whole take. Each call is cut out with
 * SEGMENT_PAD_SEC of audio around it and analyzed on its own, as a practice take would be.
 * `noiseFloorDb` is the count-in floor (as in practice); `band` the species' analysis band.
 */
export function splitTake(take: AudioClip, noiseFloorDb: number | undefined, band: Band, gapSec: number): SplitTake {
  const seconds = take.sampleRate > 0 ? take.samples.length / take.sampleRate : 0;
  const whole = extractFeatures(take, { noiseFloorDb, band, maxSeconds: CHALLENGE_SECONDS + 1 });
  const rejected = checkTake(whole, noiseFloorDb);
  if (rejected) return { rejected, seconds, parts: [] };

  const { hop, fftSize } = frameGeometry(whole.sampleRate);
  const groups = segmentNotes(whole.notes, Math.round(gapSec / HOP_SEC));
  const startSample = (n: Note) => n.start * hop;
  const endSample = (n: Note) => (n.end - 1) * hop + fftSize;
  const pad = Math.round(SEGMENT_PAD_SEC * whole.sampleRate);
  const len = whole.sampleCount;
  const parts = groups.map((g, k) => {
    const prev = groups[k - 1];
    const next = groups[k + 1];
    const a = Math.round(Math.max(0, startSample(g) - pad, prev ? (endSample(prev) + startSample(g)) / 2 : 0));
    const b = Math.round(Math.min(len, endSample(g) + pad, next ? (endSample(g) + startSample(next)) / 2 : len));
    // shortcut: a call longer than MAX_SECONDS (15 s) is analyzed up to that length; fine while references are under 6 s.
    const features = extractFeatures({ samples: take.samples.subarray(a, b), sampleRate: take.sampleRate }, { noiseFloorDb, band });
    return { start: g.start * HOP_SEC, end: g.end * HOP_SEC, features };
  });
  return { rejected: null, seconds, parts };
}

/**
 * Splits a take into calls and scores each against every call in `calls`; the best match names
 * it. `rules` are the species' split gap, thresholds and rank titles (src/challenge/rules.ts).
 */
export function analyzeChallenge(take: AudioClip, calls: readonly CallRefs[], noiseFloorDb: number | undefined, band: Band, rules: ChallengeRules): ChallengeResult {
  const split = splitTake(take, noiseFloorDb, band, rules.gapSec);
  if (split.rejected) return { rejected: split.rejected, seconds: split.seconds, segments: [], score: 0, stars: 0, rank: '' };
  const segments = split.parts.map(({ start, end, features }): SegmentResult => {
    let best: { call: CallDef | null; score: number; bestReference: number } = { call: null, score: 0, bestReference: -1 };
    for (const { call, refs } of calls) {
      const r = scoreTake(features, refs, call.weights, { noiseFloorDb });
      if (!r.rejected && r.score > best.score) best = { call, score: r.score, bestReference: r.bestReference };
    }
    return { start, end, ...best, recognized: best.call !== null && isRecognized(rules, best.call.id, best.score) };
  });
  const score = challengeScore(segments);
  return { rejected: null, seconds: split.seconds, segments, score, stars: starsFor(score), rank: rankFor(rules.ranks, score) };
}

/**
 * One next step: the part of the take that cost the most points. Each call costs
 * (100 - score) x its share of the calling time; calls that were not recognized cost 100 x
 * their share (together, as one part).
 */
export function nextStep(result: Pick<ChallengeResult, 'segments'>, callNames: string): { text: string; practice: CallDef | null } {
  const segs = result.segments.filter((s) => s.end > s.start);
  const total = segs.reduce((t, s) => t + s.end - s.start, 0);
  if (!segs.some((s) => s.recognized) || !(total > 0))
    return { text: `Start with the calls the app can recognize so far: ${callNames}.`, practice: null };
  const missed = segs.filter((s) => !s.recognized).reduce((t, s) => t + s.end - s.start, 0);
  let worst: SegmentResult | null = null;
  let worstCost = 0;
  for (const s of segs) {
    const cost = s.recognized ? (100 - s.score) * (s.end - s.start) : 0;
    if (cost > worstCost) {
      worst = s;
      worstCost = cost;
    }
  }
  if (missed * 100 >= worstCost && missed > 0)
    return {
      text: `${missed.toFixed(1)} s of calling was not recognized and scored 0. Use the calls the app knows (${callNames}) or leave that part out.`,
      practice: null,
    };
  if (worst?.call)
    return { text: `Your ${worst.call.name.toLowerCase()} cost the most points (${Math.round(worst.score)}). Practice it on its own.`, practice: worst.call };
  return { text: 'Every call scored 100. Try a longer sequence.', practice: null };
}
