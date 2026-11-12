// Live mic monitoring for the Mic check screen. Noise floor and clipping come from the
// Phase 2 feature extractor and take checks, so the screen shows what the scorer will see.

import { extractFeatures, type Features } from './features';
import { checkTake, type Rejection } from './score';

const SILENT_DB = -120;

/** RMS and peak of one chunk. rmsDb in dBFS (>= -120), peak as |sample| 0..1. */
export function chunkLevel(x: Float32Array): { rmsDb: number; peak: number } {
  let sq = 0;
  let peak = 0;
  let n = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    if (!Number.isFinite(v)) continue;
    sq += v * v;
    n++;
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  const rmsDb = n ? Math.max(SILENT_DB, 10 * Math.log10(sq / n + 1e-12)) : SILENT_DB;
  return { rmsDb, peak: Math.min(1, peak) };
}

/** Keeps the most recent `capacity` samples. */
export class RollingBuffer {
  private buf: Float32Array;
  private n = 0;
  constructor(readonly capacity: number) {
    this.buf = new Float32Array(Math.max(1, Math.floor(capacity)));
  }
  push(x: Float32Array): void {
    const cap = this.buf.length;
    if (x.length >= cap) {
      this.buf.set(x.subarray(x.length - cap));
      this.n = cap;
      return;
    }
    const keep = Math.min(this.n, cap - x.length);
    this.buf.copyWithin(0, this.n - keep, this.n);
    this.buf.set(x, keep);
    this.n = keep + x.length;
  }
  get length(): number {
    return this.n;
  }
  /** Copy of the buffered samples, oldest first. */
  toArray(): Float32Array {
    return this.buf.slice(0, this.n);
  }
}

/** Collects exactly `target` samples, then reports done. */
export class TakeRecorder {
  private buf: Float32Array;
  private n = 0;
  constructor(readonly target: number) {
    this.buf = new Float32Array(Math.max(0, Math.floor(target)));
  }
  /** Returns true once the take is complete; extra samples are ignored. */
  push(x: Float32Array): boolean {
    const take = Math.min(x.length, this.buf.length - this.n);
    if (take > 0) this.buf.set(x.subarray(0, take), this.n);
    this.n += Math.max(0, take);
    return this.done;
  }
  get done(): boolean {
    return this.n >= this.buf.length;
  }
  get recorded(): number {
    return this.n;
  }
  get samples(): Float32Array {
    return this.buf.subarray(0, this.n);
  }
}

export interface LiveStatus {
  /** Quietest-10% frame RMS of the window, dBFS; null if the window is too short to measure. */
  noiseFloorDb: number | null;
  /** The window would fail the scorer's clipping check. */
  clipped: boolean;
}

/** Noise floor and clipping of the last few seconds, by the scorer's own measures. */
export function liveStatus(samples: Float32Array, sampleRate: number): LiveStatus {
  const f = extractFeatures({ samples, sampleRate });
  return {
    noiseFloorDb: f.frameCount > 0 ? f.noiseFloorDb : null,
    clipped: checkTake(f)?.reason === 'clipped',
  };
}

export interface TakeReport {
  features: Features;
  /** Why the scorer would refuse this take, or null if it would score it. */
  rejection: Rejection | null;
}

export function analyzeTake(samples: Float32Array, sampleRate: number): TakeReport {
  const features = extractFeatures({ samples, sampleRate });
  return { features, rejection: checkTake(features) };
}
