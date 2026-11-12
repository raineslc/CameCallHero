// Loudness zones for the live meters (practice and mic check) and the quiet check before a
// take. Every boundary comes from the scorer's own gates (score.ts GATES, features.ts
// CLIP_LEVEL), so the screen agrees with what the scorer accepts.
//
//   too quiet | good                                   | too loud
//   ----------+----------------------------------------+---------->  loudest frame RMS, dBFS
//         max(minPeakDb, floor + minSnrDb)        LOUDEST_SAFE_DB

import { CLIP_LEVEL } from './features';
import { GATES } from './score';

/**
 * How far the loudest frame RMS of a call sits below its largest sample (dB), rounded down
 * from the smallest value in the gobble and yelp references to 0.1 dB (yelp-3: 6.17 dB; a unit test
 * recomputes it). A call this "flat" reaches the clipping level when its loudest frame is at
 * LOUDEST_SAFE_DB; a call with more crest clips earlier.
 */
export const REFERENCE_CREST_DB = 6.1;

/** Loudest frame RMS a call like the references can have without clipping, dBFS (about -6.2). */
export const LOUDEST_SAFE_DB = 20 * Math.log10(CLIP_LEVEL) - REFERENCE_CREST_DB;

/**
 * Highest noise floor at which the scorer can still accept a call like the references: the
 * call must be GATES.minSnrDb above the floor without clipping. Above this the scorer
 * rejects every such take as too noisy (or clipped).
 */
export const MAX_QUIET_FLOOR_DB = LOUDEST_SAFE_DB - GATES.minSnrDb;

export type Zone = 'quiet' | 'good' | 'loud';

export interface Zones {
  /** Below this the loudest frame is too quiet for the scorer (dBFS). */
  quietTop: number;
  /** At or above this a call like the references would clip (dBFS). */
  loudBottom: number;
}

/** Zones for a measured noise floor (dBFS), or null before one is measured. */
export function meterZones(floorDb: number | null): Zones {
  const snr = floorDb !== null && Number.isFinite(floorDb) ? floorDb + GATES.minSnrDb : -Infinity;
  return { quietTop: Math.min(LOUDEST_SAFE_DB, Math.max(GATES.minPeakDb, snr)), loudBottom: LOUDEST_SAFE_DB };
}

/**
 * Zone of a level (loudest frame RMS, dBFS) and the chunk's largest sample (0..1). Any sample
 * at the clipping level counts as loud: stricter than the scorer, which needs a run of 3 or
 * 0.1% of samples, so the meter warns before a take is rejected.
 */
export function zoneFor(levelDb: number, peak: number, z: Zones): Zone {
  if (peak >= CLIP_LEVEL || levelDb >= z.loudBottom) return 'loud';
  if (!(levelDb >= z.quietTop)) return 'quiet';
  return 'good';
}

export const ZONE_TEXT: Record<Zone, string> = { quiet: 'Move closer', good: 'Good', loud: 'Back off' };

export const QUIET_OK_TEXT = 'Quiet enough';
export const QUIET_BAD_TEXT = 'Too much background noise. Move away from fans, wind or traffic.';

/** Quiet check of the count-in floor, by the scorer's too-noisy gate (see MAX_QUIET_FLOOR_DB). */
export function quietCheck(floorDb: number): { ok: boolean; text: string } {
  const ok = Number.isFinite(floorDb) && floorDb <= MAX_QUIET_FLOOR_DB;
  return { ok, text: ok ? QUIET_OK_TEXT : QUIET_BAD_TEXT };
}

/** Meter scale, dBFS. */
export const METER_MIN_DB = -60;
export const METER_MAX_DB = 0;

/** Position 0..1 of a level on the meter scale. */
export const meterPos = (db: number): number =>
  Number.isFinite(db) ? Math.max(0, Math.min(1, (db - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB))) : 0;

/** A level is held this long (s) so the zone label shows the last note, not the gap after it. */
export const HOLD_SEC = 0.6;

/** Peak hold for the meter: the highest level of the last HOLD_SEC. Allocates nothing. */
export class LevelHold {
  private db = -Infinity;
  private peak = 0;
  private at = -Infinity;
  private peakAt = -Infinity;
  /** `t` in seconds, non-decreasing. Returns the held level. */
  push(levelDb: number, peak: number, t: number): number {
    if (levelDb >= this.db || t - this.at > HOLD_SEC) {
      this.db = levelDb;
      this.at = t;
    }
    if (peak >= this.peak || t - this.peakAt > HOLD_SEC) {
      this.peak = peak;
      this.peakAt = t;
    }
    return this.db;
  }
  get levelDb(): number {
    return this.db;
  }
  get peakSample(): number {
    return this.peak;
  }
  reset(): void {
    this.db = -Infinity;
    this.peak = 0;
    this.at = -Infinity;
    this.peakAt = -Infinity;
  }
}
