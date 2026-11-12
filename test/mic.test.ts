import { describe, expect, it } from 'vitest';
import { classifyMicError, compareSettings, micSupportProblem, MicStartError } from '../src/audio/capture';
import { analyzeTake, chunkLevel, liveStatus, RollingBuffer, TakeRecorder } from '../src/audio/monitor';
import { encodeWav } from '../src/audio/wav';
import { parseWav, readWav } from './wav';

const SR = 48000;
const sine = (seconds: number, amp: number, hz = 1000, sr = SR) =>
  Float32Array.from({ length: Math.round(seconds * sr) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / sr));
/** Deterministic noise in [-amp, amp]. */
const noise = (seconds: number, amp: number, sr = SR) => {
  let s = 12345;
  return Float32Array.from({ length: Math.round(seconds * sr) }, () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return amp * (2 * (s / 0x7fffffff) - 1);
  });
};

describe('mic errors', () => {
  const named = (name: string) => Object.assign(new Error('x'), { name });
  it('maps permission, no-device and busy errors', () => {
    expect(classifyMicError(named('NotAllowedError')).kind).toBe('denied');
    expect(classifyMicError(named('SecurityError')).kind).toBe('denied');
    expect(classifyMicError(named('NotFoundError')).kind).toBe('no-mic');
    expect(classifyMicError(named('NotReadableError')).kind).toBe('busy');
  });
  it('keeps unknown errors readable', () => {
    const e = classifyMicError(new Error('boom'));
    expect(e.kind).toBe('other');
    expect(e.message).toContain('boom');
    expect(classifyMicError(undefined).kind).toBe('other');
  });
  it('passes MicStartError through', () => {
    const info = { kind: 'no-mic' as const, message: 'm' };
    expect(classifyMicError(new MicStartError(info))).toBe(info);
  });
  it('reports insecure context before missing APIs', () => {
    expect(micSupportProblem({ secure: false, hasGetUserMedia: false, hasAudioWorklet: false })?.kind).toBe('insecure');
    expect(micSupportProblem({ secure: true, hasGetUserMedia: false, hasAudioWorklet: true })?.kind).toBe('unsupported');
    expect(micSupportProblem({ secure: true, hasGetUserMedia: true, hasAudioWorklet: false })?.kind).toBe('unsupported');
    expect(micSupportProblem({ secure: true, hasGetUserMedia: true, hasAudioWorklet: true })).toBeNull();
  });
});

describe('compareSettings', () => {
  it('flags settings the phone did not honour or did not report', () => {
    const rows = compareSettings({ echoCancellation: false, noiseSuppression: true, channelCount: 1 });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(byKey.echoCancellation.ok).toBe(true);
    expect(byKey.noiseSuppression).toMatchObject({ ok: false, actual: true });
    expect(byKey.autoGainControl).toMatchObject({ ok: false, actual: undefined });
    expect(byKey.channelCount.ok).toBe(true);
  });
});

describe('chunkLevel', () => {
  it('measures RMS and peak', () => {
    const lv = chunkLevel(sine(0.1, 0.5));
    expect(lv.peak).toBeCloseTo(0.5, 2);
    expect(lv.rmsDb).toBeCloseTo(20 * Math.log10(0.5 / Math.SQRT2), 1);
  });
  it('is finite for silence, empty and NaN input', () => {
    expect(chunkLevel(new Float32Array(100)).rmsDb).toBe(-120);
    expect(chunkLevel(new Float32Array(0))).toEqual({ rmsDb: -120, peak: 0 });
    expect(chunkLevel(Float32Array.of(NaN, 0.25)).peak).toBe(0.25);
  });
});

describe('RollingBuffer', () => {
  it('keeps the newest samples in order', () => {
    const b = new RollingBuffer(5);
    b.push(Float32Array.of(1, 2, 3));
    expect(Array.from(b.toArray())).toEqual([1, 2, 3]);
    b.push(Float32Array.of(4, 5, 6));
    expect(Array.from(b.toArray())).toEqual([2, 3, 4, 5, 6]);
    b.push(Float32Array.of(7, 8, 9, 10, 11, 12));
    expect(Array.from(b.toArray())).toEqual([8, 9, 10, 11, 12]);
  });
});

describe('TakeRecorder', () => {
  it('collects exactly the target length across chunks', () => {
    const r = new TakeRecorder(5);
    expect(r.push(Float32Array.of(1, 2, 3))).toBe(false);
    expect(r.push(Float32Array.of(4, 5, 6, 7))).toBe(true);
    expect(Array.from(r.samples)).toEqual([1, 2, 3, 4, 5]);
    expect(r.push(Float32Array.of(9))).toBe(true);
    expect(r.recorded).toBe(5);
  });
});

describe('liveStatus (scorer gates on the live window)', () => {
  it('measures the noise floor of steady noise', () => {
    // Uniform noise, amplitude a: RMS a/sqrt(3).
    const s = liveStatus(noise(3, 0.01), SR);
    expect(s.noiseFloorDb).not.toBeNull();
    expect(Math.abs(s.noiseFloorDb! - 20 * Math.log10(0.01 / Math.sqrt(3)))).toBeLessThan(1.5);
    expect(s.clipped).toBe(false);
  });
  it('flags a clipped window and not a loud clean one', () => {
    const clipped = sine(3, 1.5).map((v) => Math.max(-1, Math.min(1, v)));
    expect(liveStatus(clipped, SR).clipped).toBe(true);
    expect(liveStatus(sine(3, 0.9), SR).clipped).toBe(false);
  });
  it('returns null floor when the window is too short', () => {
    expect(liveStatus(new Float32Array(10), SR).noiseFloorDb).toBeNull();
  });
});

describe('analyzeTake', () => {
  it('accepts a real gobble and rejects silence', () => {
    const g = readWav(new URL('../public/audio/turkey/gobble-1.wav', import.meta.url));
    expect(analyzeTake(g.samples, g.sampleRate).rejection).toBeNull();
    expect(analyzeTake(new Float32Array(5 * SR), SR).rejection?.reason).toBe('too-quiet');
  });
  it('accepts a real phone take (owner, Android, 48 kHz)', () => {
    const t = readWav(new URL('./fixtures/phone/yelp-mouth-1.wav', import.meta.url));
    expect(t.sampleRate).toBe(48000);
    const { features, rejection } = analyzeTake(t.samples, t.sampleRate);
    expect(rejection).toBeNull();
    expect(features.notes.length).toBeGreaterThan(0);
  });
});

describe('encodeWav', () => {
  it('round-trips through the test WAV reader', () => {
    const x = sine(0.05, 0.7, 440, 44100);
    const bytes = encodeWav(x, 44100);
    expect(bytes.length).toBe(44 + x.length * 2);
    const back = parseWav(bytes);
    expect(back.sampleRate).toBe(44100);
    expect(back.samples.length).toBe(x.length);
    for (let i = 0; i < x.length; i++) expect(Math.abs(back.samples[i] - x[i])).toBeLessThan(1 / 16000);
  });
  it('clamps out-of-range and non-finite samples', () => {
    const back = parseWav(encodeWav(Float32Array.of(2, -2, NaN, Infinity), 8000)).samples;
    expect(back[0]).toBeCloseTo(32767 / 32768, 6);
    expect(back[1]).toBe(-1);
    expect(back[2]).toBe(0);
    expect(back[3]).toBe(0);
  });
});
