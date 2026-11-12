// On-device storage for practice: best score per call and the tap-calibration latency.
// localStorage can be missing or throw (private mode, blocked storage); every access is
// wrapped, and a failure only means the value is not remembered.

type Store = Pick<Storage, 'getItem' | 'setItem'>;

// Keeps the app's old name so best scores saved before the rename are still found.
const PREFIX = 'camecallhero.';
const bestKey = (callId: string) => `${PREFIX}best.${callId}`;
const LATENCY_KEY = `${PREFIX}latencyMs`;
/** Tap latencies outside this range are not plausible and are not stored or used. */
export const MAX_LATENCY_MS = 500;

function defaultStore(): Store | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function read(key: string, store: Store | null): number | null {
  try {
    const raw = store?.getItem(key);
    if (raw === null || raw === undefined || raw.trim() === '') return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

function write(key: string, value: number, store: Store | null): boolean {
  try {
    if (!store) return false;
    store.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

/** Best stored score 0..100, or null if none (or the stored value is invalid). */
export function loadBest(callId: string, store = defaultStore()): number | null {
  const v = read(bestKey(callId), store);
  return v !== null && v >= 0 && v <= 100 ? v : null;
}

/** Stores `score` if it beats the stored best. Returns true when it is a new best. */
export function saveBest(callId: string, score: number, store = defaultStore()): boolean {
  if (!Number.isFinite(score) || score < 0 || score > 100) return false;
  // Scores are shown rounded; compare what the user sees.
  const s = Math.round(score);
  const prev = loadBest(callId, store);
  if (prev !== null && s <= prev) return false;
  return write(bestKey(callId), s, store);
}

export function loadLatency(store = defaultStore()): number | null {
  const v = read(LATENCY_KEY, store);
  return v !== null && v >= 0 && v <= MAX_LATENCY_MS ? v : null;
}

export function saveLatency(ms: number, store = defaultStore()): boolean {
  if (!Number.isFinite(ms) || ms < 0 || ms > MAX_LATENCY_MS) return false;
  return write(LATENCY_KEY, Math.round(ms), store);
}
