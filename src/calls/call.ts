// What every call of every species has: name, lock state, reference clips, scoring weights
// and a cited description. Species-specific lists live in turkey.ts, barred-owl.ts and elk.ts.

import type { Weights } from '../audio/score';

export interface CallDef {
  /** Unique within its species. */
  id: string;
  name: string;
  /** True while the app cannot score this call (no references, or the scorer cannot tell it apart). */
  locked: boolean;
  /** Why a locked call is locked, as shown on screen. Default: LOCK_NO_RECORDINGS. */
  lock?: LockInfo;
  /** Paths relative to public/ (and to the site base URL). */
  references: string[];
  weights: Weights;
  /** What the call is and when the animal uses it. Every claim cites one of `sources`. */
  description: { meaning: string; when: string };
  sources: Source[];
}

export interface LockInfo {
  /** Short badge text. */
  label: string;
  /** One line on the call page. */
  reason: string;
}

export interface Source {
  title: string;
  url: string;
}

export const LOCK_NO_RECORDINGS: LockInfo = {
  label: 'Recordings needed',
  reason: 'There are no reference recordings with an allowed license for this call yet, so it cannot be played or practiced.',
};

/** Badge and reason of a locked call. */
export const lockInfo = (call: CallDef): LockInfo => call.lock ?? LOCK_NO_RECORDINGS;

/** shortcut: uncalibrated equal weights for calls without references; tune each once it has 3+ clips. */
export const UNCALIBRATED: Weights = { rhythm: 1, pitch: 1, tone: 1 };
