// Feature extraction for scoring a call: loudness envelope, note segmentation,
// log-mel spectrogram with per-recording noise normalization, dominant-frequency track.
// Everything is measured relative to the recording itself (noise floor, peak), so the
// absolute input level and the microphone's average colouring do not change the result.

import { powerSpectrum } from './fft';

export interface AudioClip {
  samples: Float32Array;
  sampleRate: number;
}

/** A note: frames [start, end), end exclusive. */
export interface Note {
  start: number;
  end: number;
}

export interface Features {
  sampleRate: number;
  frameCount: number;
  /** Frame RMS in dBFS. */
  rmsDb: Float32Array;
  /** Mel bands 0..validBands-1 are measurable at this sample rate (all 40 at 17.8 kHz and up). */
  validBands: number;
  /** Per frame: log-mel energy above the recording's own per-band noise floor, in dB, >= 0. */
  mel: Float32Array[];
  /** Per frame: dominant frequency in Hz inside a note, 0 outside notes. */
  domHz: Float32Array;
  /** 10th percentile of frame RMS, dBFS. */
  noiseFloorDb: number;
  /** Loudest frame RMS, dBFS. */
  peakDb: number;
  /** Largest absolute sample value. */
  peakSample: number;
  /** Longest run of consecutive samples at or above CLIP_LEVEL. */
  longestClipRun: number;
  /** Number of samples at or above CLIP_LEVEL. */
  clipSamples: number;
  /** Number of analyzed samples. */
  sampleCount: number;
  notes: Note[];
  /** First note start to last note end, or null if no notes. */
  span: Note | null;
}

export const HOP_SEC = 0.01;
export const CLIP_LEVEL = 0.99;
const MEL_BANDS = 40;
/** Frequency range of the mel bands and of the dominant-frequency search. */
export const MIN_HZ = 150;
export const MAX_HZ = 8000;
const SILENT_DB = -120;
/** Notes: frames louder than max(noise floor + NOTE_ABOVE_FLOOR_DB, peak - NOTE_BELOW_PEAK_DB). */
const NOTE_ABOVE_FLOOR_DB = 10;
const NOTE_BELOW_PEAK_DB = 30;
/** Gaps shorter than this many frames are bridged; notes shorter than MIN_NOTE_FRAMES dropped. */
const MAX_GAP_FRAMES = 3;
const MIN_NOTE_FRAMES = 2;
/** Notes whose loudest frame is this far below the loudest note are background (other birds, echo). */
const NOTE_MIN_REL_DB = 20;
/** Mel energy within this many dB of the band's noise floor counts as noise. */
const MEL_NOISE_MARGIN_DB = 6;
/** Mel bands more than this far below the frame's loudest band are ignored (window leakage, reverb). */
const MEL_FRAME_RANGE_DB = 40;
/** Frames this close to a note are not background; at least MIN_BACKGROUND_FRAMES are needed. */
const BACKGROUND_GUARD_FRAMES = 3;
const MIN_BACKGROUND_FRAMES = 10;
/** shortcut: takes longer than this are cut (DTW cost grows with length^2); raise if longer calls are added. */
export const MAX_SECONDS = 15;

const hzToMel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
const melToHz = (mel: number) => 700 * (10 ** (mel / 2595) - 1);

/**
 * Triangular mel filters as [firstBin, weights[]] over an n/2+1 bin spectrum.
 * Band edges are always MIN_HZ..MAX_HZ, so band b means the same frequencies at every
 * sample rate. Bands reaching above `maxHz` cannot be measured and get no weights.
 */
function melFilters(fftSize: number, sampleRate: number, maxHz: number): { first: number; w: Float64Array }[] {
  const binHz = sampleRate / fftSize;
  const lo = hzToMel(MIN_HZ);
  const hi = hzToMel(MAX_HZ);
  const edges = Array.from({ length: MEL_BANDS + 2 }, (_, i) => melToHz(lo + ((hi - lo) * i) / (MEL_BANDS + 1)));
  const filters = [];
  for (let b = 0; b < MEL_BANDS; b++) {
    const [f0, f1, f2] = [edges[b], edges[b + 1], edges[b + 2]];
    if (f2 > maxHz) {
      filters.push({ first: 0, w: new Float64Array(0) });
      continue;
    }
    const first = Math.max(0, Math.floor(f0 / binHz));
    const last = Math.min(fftSize / 2, Math.ceil(f2 / binHz));
    const w = new Float64Array(last - first + 1);
    for (let k = first; k <= last; k++) {
      const hz = k * binHz;
      w[k - first] = Math.max(0, hz <= f1 ? (hz - f0) / (f1 - f0) : (f2 - hz) / (f2 - f1));
    }
    filters.push({ first, w });
  }
  return filters;
}

function percentile(values: ArrayLike<number>, p: number): number {
  if (values.length === 0) return SILENT_DB;
  const sorted = Array.from(values).sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

const toDb = (power: number) => Math.max(SILENT_DB, 10 * Math.log10(power + 1e-12));

export function findNotes(rmsDb: Float32Array, noiseFloorDb: number, peakDb: number): Note[] {
  const threshold = Math.max(noiseFloorDb + NOTE_ABOVE_FLOOR_DB, peakDb - NOTE_BELOW_PEAK_DB);
  const raw: Note[] = [];
  for (let i = 0; i < rmsDb.length; ) {
    if (rmsDb[i] > threshold) {
      let j = i;
      while (j < rmsDb.length && rmsDb[j] > threshold) j++;
      raw.push({ start: i, end: j });
      i = j;
    } else i++;
  }
  const merged: Note[] = [];
  for (const n of raw) {
    const prev = merged[merged.length - 1];
    if (prev && n.start - prev.end <= MAX_GAP_FRAMES) prev.end = n.end;
    else merged.push({ ...n });
  }
  const long = merged.filter((n) => n.end - n.start >= MIN_NOTE_FRAMES);
  const notePeak = (n: Note) => Math.max(...rmsDb.subarray(n.start, n.end));
  const loudest = Math.max(...long.map(notePeak));
  return long.filter((n) => notePeak(n) >= loudest - NOTE_MIN_REL_DB);
}

/** Analysis hop and FFT frame length in samples. */
export function frameGeometry(sampleRate: number): { hop: number; fftSize: number } {
  return {
    hop: Math.max(1, Math.round(HOP_SEC * sampleRate)),
    // Largest power of two not above 30 ms (1024 at 44.1/48 kHz, about 23 ms).
    fftSize: 2 ** Math.max(6, Math.floor(Math.log2(Math.max(64, 0.03 * sampleRate)))),
  };
}

/** Frame RMS in dBFS of x[off, off + size), with the same sample clean-up and rounding as extractFeatures. */
export function frameRmsDb(x: Float32Array, off: number, size: number): number {
  let sq = 0;
  for (let i = 0; i < size; i++) {
    const v = x[off + i];
    const c = Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
    sq += c * c;
  }
  return toDb(sq / size);
}

/**
 * Walks the notes findNotes would build from rmsDb[0, n). Returns the loudest note's peak
 * (count = false) or the number of notes whose peak is at least minPeak (count = true).
 * Allocates nothing, so it can run on every mic chunk.
 */
function walkNotes(rmsDb: Float32Array, n: number, threshold: number, count: boolean, minPeak: number): number {
  let result = count ? 0 : -Infinity;
  let start = -1;
  let end = -1;
  let peak = -Infinity;
  for (let i = 0; i < n; ) {
    if (!(rmsDb[i] > threshold)) {
      i++;
      continue;
    }
    let j = i;
    let p = -Infinity;
    while (j < n && rmsDb[j] > threshold) {
      if (rmsDb[j] > p) p = rmsDb[j];
      j++;
    }
    if (start >= 0 && i - end <= MAX_GAP_FRAMES) {
      end = j;
      if (p > peak) peak = p;
    } else {
      if (start >= 0 && end - start >= MIN_NOTE_FRAMES) {
        if (!count) result = Math.max(result, peak);
        else if (peak >= minPeak) result++;
      }
      start = i;
      end = j;
      peak = p;
    }
    i = j;
  }
  if (start >= 0 && end - start >= MIN_NOTE_FRAMES) {
    if (!count) result = Math.max(result, peak);
    else if (peak >= minPeak) result++;
  }
  return result;
}

/** findNotes(rmsDb.subarray(0, n), noiseFloorDb, peakDb).length, without allocating. */
export function countNotes(rmsDb: Float32Array, n: number, noiseFloorDb: number, peakDb: number): number {
  const threshold = Math.max(noiseFloorDb + NOTE_ABOVE_FLOOR_DB, peakDb - NOTE_BELOW_PEAK_DB);
  const loudest = walkNotes(rmsDb, n, threshold, false, 0);
  return loudest === -Infinity ? 0 : walkNotes(rmsDb, n, threshold, true, loudest - NOTE_MIN_REL_DB);
}

/**
 * Counts the notes of a take while it is recorded, by the scorer's own segmentation: frame
 * RMS on the same grid as extractFeatures, the count-in noise floor, and the loudest frame so
 * far. Once the whole take is in, the count equals extractFeatures(take, { noiseFloorDb }).notes.length.
 * Before that it can change: a louder note later raises the threshold for all notes.
 */
export class LiveNoteCounter {
  private readonly rms: Float32Array;
  private readonly hop: number;
  private readonly fftSize: number;
  private frames = 0;
  private peak = SILENT_DB;
  count = 0;

  constructor(
    sampleRate: number,
    takeSamples: number,
    private readonly noiseFloorDb: number,
  ) {
    const g = frameGeometry(sampleRate);
    this.hop = g.hop;
    this.fftSize = g.fftSize;
    const len = Math.min(takeSamples, Math.floor(MAX_SECONDS * sampleRate));
    this.rms = new Float32Array(len >= this.fftSize ? 1 + Math.floor((len - this.fftSize) / this.hop) : 0);
  }

  /** `buf[start, end)` is the take recorded so far (start = the take's first sample). Returns the count. */
  update(buf: Float32Array, start: number, end: number): number {
    let added = false;
    while (this.frames < this.rms.length && start + this.frames * this.hop + this.fftSize <= end) {
      const f = this.frames++;
      this.rms[f] = frameRmsDb(buf, start + f * this.hop, this.fftSize);
      if (this.rms[f] > this.peak) this.peak = this.rms[f]; // stored (float32) value, as extractFeatures' peakDb
      added = true;
    }
    if (added) this.count = countNotes(this.rms, this.frames, this.noiseFloorDb, this.peak);
    return this.count;
  }
}

export interface FeatureOptions {
  /** Noise floor measured during the count-in (dBFS). Used instead of the take's own estimate,
   *  which reads the call itself when the take has little background. */
  noiseFloorDb?: number;
}

export function extractFeatures(clip: AudioClip, opts: FeatureOptions = {}): Features {
  const sampleRate = Number.isFinite(clip.sampleRate) && clip.sampleRate >= 4000 ? clip.sampleRate : 0;
  const maxLen = Math.floor(MAX_SECONDS * sampleRate);
  const x = new Float64Array(Math.min(clip.samples.length, maxLen));
  let peakSample = 0;
  let run = 0;
  let longestClipRun = 0;
  let clipSamples = 0;
  for (let i = 0; i < x.length; i++) {
    const v = clip.samples[i];
    x[i] = Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
    const a = Math.abs(x[i]);
    if (a > peakSample) peakSample = a;
    run = a >= CLIP_LEVEL ? run + 1 : 0;
    if (run > longestClipRun) longestClipRun = run;
    if (a >= CLIP_LEVEL) clipSamples++;
  }

  const { hop, fftSize } = frameGeometry(sampleRate);
  const frameCount = sampleRate > 0 && x.length >= fftSize ? 1 + Math.floor((x.length - fftSize) / hop) : 0;
  const window = Float64Array.from({ length: fftSize }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / fftSize));
  const maxHz = Math.min(MAX_HZ, 0.45 * sampleRate);
  const filters = sampleRate > 0 ? melFilters(fftSize, sampleRate, maxHz) : [];
  const binHz = sampleRate / fftSize;
  const loBin = Math.ceil(MIN_HZ / binHz);
  const hiBin = Math.floor(maxHz / binHz);

  const rmsDb = new Float32Array(frameCount);
  const logMel: Float32Array[] = [];
  const peakBin = new Int32Array(frameCount);
  const frame = new Float64Array(fftSize);
  for (let f = 0; f < frameCount; f++) {
    const off = f * hop;
    let sq = 0;
    for (let i = 0; i < fftSize; i++) {
      const v = x[off + i];
      sq += v * v;
      frame[i] = v * window[i];
    }
    rmsDb[f] = toDb(sq / fftSize);
    const p = powerSpectrum(frame);
    const m = new Float32Array(MEL_BANDS);
    filters.forEach(({ first, w }, b) => {
      let e = 0;
      for (let k = 0; k < w.length; k++) e += w[k] * p[first + k];
      m[b] = toDb(e);
    });
    logMel.push(m);
    let best = loBin;
    for (let k = loBin; k <= hiBin; k++) if (p[k] > p[best]) best = k;
    peakBin[f] = best;
  }

  const noiseFloorDb =
    opts.noiseFloorDb !== undefined && Number.isFinite(opts.noiseFloorDb) ? opts.noiseFloorDb : percentile(rmsDb, 0.1);
  const peakDb = frameCount ? Math.max(...rmsDb) : SILENT_DB;
  const notes = frameCount ? findNotes(rmsDb, noiseFloorDb, peakDb) : [];

  // Per-recording normalization: measure each band against the band's own noise floor
  // (20th percentile; removes level and the steady colouring of mic and room) and against
  // the frame's loudest band (keeps only the frame's spectral shape).
  // The band floor comes from background frames only (away from notes), so a long steady
  // note is not taken for noise. Without enough background, only the frame range applies.
  const validBands = filters.filter((f) => f.w.length > 0).length;
  const nearNote = new Uint8Array(frameCount);
  for (const n of notes)
    for (let f = Math.max(0, n.start - BACKGROUND_GUARD_FRAMES); f < Math.min(frameCount, n.end + BACKGROUND_GUARD_FRAMES); f++) nearNote[f] = 1;
  const background = logMel.filter((_, f) => !nearNote[f]);
  const bandFloor = Array.from({ length: MEL_BANDS }, (_, b) =>
    background.length >= MIN_BACKGROUND_FRAMES ? percentile(background.map((m) => m[b]), 0.5) : SILENT_DB,
  );
  const mel = logMel.map((m) => {
    const top = Math.max(...m.subarray(0, validBands));
    return m.map((v, b) =>
      b < validBands ? Math.max(0, v - Math.max(bandFloor[b] + MEL_NOISE_MARGIN_DB, top - MEL_FRAME_RANGE_DB)) : 0,
    );
  });

  const domHz = new Float32Array(frameCount);
  for (const n of notes) for (let f = n.start; f < n.end; f++) domHz[f] = peakBin[f] * binHz;

  return {
    sampleRate,
    frameCount,
    validBands,
    rmsDb,
    mel,
    domHz,
    noiseFloorDb,
    peakDb,
    peakSample,
    longestClipRun,
    clipSamples,
    sampleCount: x.length,
    notes,
    span: notes.length ? { start: notes[0].start, end: notes[notes.length - 1].end } : null,
  };
}
