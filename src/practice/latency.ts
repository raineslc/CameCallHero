// One-time latency calibration: the user taps along to a few clicks; the delay between
// each click being started by the app and the tap is the device's "app to user" latency.
// shortcut: this measures speaker + touch delay and is used as a stand-in for the mic input
// delay when drawing the live trail; upgrade to a speaker-to-mic loopback measurement if
// the trail looks offset on real phones. Scoring does not use it (DTW aligns the take).

export const CLICKS = 4;
/** Longer than 2 x MATCH_WINDOW_MS, so off-beat taps match no click. */
export const CLICK_INTERVAL_SEC = 1.0;
/** First click this long after the test starts. */
export const FIRST_CLICK_SEC = 0.8;
/** A tap counts for the nearest click when within this many ms of it. */
export const MATCH_WINDOW_MS = 400;
/** At least this many clicks need a matching tap. */
export const MIN_MATCHED = 3;

/**
 * Median tap delay in ms (negative delays, i.e. early taps, count as 0), or null if too few
 * taps lined up with the clicks. Times are in the same clock (ms), e.g. performance.now().
 */
export function latencyFromTaps(clickMs: number[], tapMs: number[]): number | null {
  const offsets: number[] = [];
  const used = new Set<number>();
  for (const c of clickMs) {
    let best = -1;
    for (let i = 0; i < tapMs.length; i++) {
      if (used.has(i) || !Number.isFinite(tapMs[i])) continue;
      if (best === -1 || Math.abs(tapMs[i] - c) < Math.abs(tapMs[best] - c)) best = i;
    }
    if (best !== -1 && Math.abs(tapMs[best] - c) <= MATCH_WINDOW_MS) {
      used.add(best);
      offsets.push(tapMs[best] - c);
    }
  }
  if (offsets.length < MIN_MATCHED) return null;
  offsets.sort((a, b) => a - b);
  const mid = offsets.length / 2;
  const median = offsets.length % 2 ? offsets[Math.floor(mid)] : (offsets[mid - 1] + offsets[mid]) / 2;
  return Math.max(0, Math.round(median));
}
