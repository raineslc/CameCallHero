// Reference clips for the library: loads each WAV once, measures it with the scoring
// engine's own feature extraction, and keeps features, the rendered spectrogram and the
// manifest (attribution) in memory for the rest of the visit.

import { extractFeatures, FULL_BAND, HOP_SEC, type Band, type Features } from '../audio/features';
import { parseWav } from '../audio/wav';
import { renderSpectrogram } from '../ui/spectrogram';

/** One entry of public/audio/<species>/manifest.json (fields the app uses). */
export interface ClipInfo {
  file: string;
  call: string;
  sourceUrl: string;
  /** xeno-canto catalogue number (XC…); absent for other sources. */
  sourceId?: string;
  /** Archive or library name and the recording's title there (sources without an id, e.g. NPS). */
  source?: string;
  sourceTitle?: string;
  author: string;
  license: string;
  licenseUrl: string;
  trimStartSec: number;
  trimEndSec: number;
}

/** Link text naming where a clip comes from: "xeno-canto XC123" or "<library>: <title>". */
export function sourceLabel(info: Pick<ClipInfo, 'sourceId' | 'source' | 'sourceTitle'>): string {
  if (info.sourceId) return `xeno-canto ${info.sourceId}`;
  if (info.source && info.sourceTitle) return `${info.source}: ${info.sourceTitle}`;
  return info.source ?? info.sourceTitle ?? 'Original recording';
}

export interface Measure {
  clips: number;
  notes: [number, number];
  seconds: [number, number];
}

const base = import.meta.env.BASE_URL;
const manifestPath = (speciesId: string) => `audio/${speciesId}/manifest.json`;

/** Site URL of a path relative to public/. */
export const assetUrl = (path: string) => `${base}${path}`;

async function fetchOk(path: string): Promise<Response> {
  const res = await fetch(assetUrl(path));
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res;
}

const once = <T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> => {
  let p = cache.get(key);
  if (!p) {
    p = load();
    // A failed load is not cached, so leaving and re-opening the screen retries it.
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
};

const featureCache = new Map<string, Promise<Features>>();
const imageCache = new Map<string, Promise<HTMLCanvasElement>>();
const manifestCache = new Map<string, Promise<ClipInfo[]>>();

const bandKey = (path: string, band: Band) => `${band.minHz}-${band.maxHz}:${path}`;

/** The clip analyzed in `band` (the species' band; default FULL_BAND, as for turkey). */
export const loadFeatures = (path: string, band: Band = FULL_BAND): Promise<Features> =>
  once(featureCache, bandKey(path, band), async () => {
    const bytes = new Uint8Array(await (await fetchOk(path)).arrayBuffer());
    return extractFeatures(parseWav(bytes), { band });
  });

/** The clip's spectrogram, rendered once per visit. Copy it with drawImage; do not draw on it. */
export const loadSpectrogram = (path: string, band: Band = FULL_BAND): Promise<HTMLCanvasElement> =>
  once(imageCache, bandKey(path, band), async () => renderSpectrogram(await loadFeatures(path, band)));

/** Clips of public/audio/<speciesId>/manifest.json. */
export const loadManifest = (speciesId: string): Promise<ClipInfo[]> =>
  once(manifestCache, speciesId, async () => ((await (await fetchOk(manifestPath(speciesId))).json()) as { clips: ClipInfo[] }).clips);

/** Manifest entry for a reference path such as 'audio/turkey/gobble-1.wav'. */
export const clipInfo = (manifest: ClipInfo[], path: string): ClipInfo | undefined =>
  manifest.find((c) => path.endsWith(`/${c.file}`));

/** Seconds from the first note's start to the last note's end (0 if no notes). */
export const callSeconds = (f: Features): number => (f.span ? (f.span.end - f.span.start) * HOP_SEC : 0);

/** Range of note counts and call lengths over the references, as the scorer measures them. */
export function measure(features: Features[]): Measure | null {
  if (features.length === 0) return null;
  const notes = features.map((f) => f.notes.length);
  const secs = features.map(callSeconds);
  return {
    clips: features.length,
    notes: [Math.min(...notes), Math.max(...notes)],
    seconds: [Math.min(...secs), Math.max(...secs)],
  };
}

const range = ([a, b]: [number, number], fmt: (n: number) => string) => (fmt(a) === fmt(b) ? fmt(a) : `${fmt(a)}–${fmt(b)}`);

export function describeMeasure(m: Measure): string {
  const notes = range(m.notes, String);
  const unit = m.notes[1] === 1 ? 'note' : 'notes';
  return `${notes} ${unit}, ${range(m.seconds, (s) => s.toFixed(2))} s long (as the scorer measures ${m.clips} reference clip${m.clips === 1 ? '' : 's'})`;
}

/** Fraction 0..1 across the spectrogram for playback time t (s); the image has one column per HOP_SEC. */
export const playheadFraction = (t: number, f: Features): number =>
  f.frameCount > 0 && Number.isFinite(t) ? Math.max(0, Math.min(1, t / (f.frameCount * HOP_SEC))) : 0;
