// Multi-species plumbing (Phase 8): routes with a species, call lookup, links, best-score keys,
// the per-species analysis band, and species words in the practice tips.
import { describe, expect, it } from 'vitest';
import { extractFeatures, FULL_BAND } from '../src/audio/features';
import { LivePitch } from '../src/audio/pitch';
import { OWL_BAND } from '../src/calls/barred-owl';
import { BARRED_OWL, bestId, callHref, ELK, homeHref, MALLARD, practiceHref, resolveCall, SPECIES, TURKEY, WOOD_DUCK } from '../src/calls/species';
import { TURKEY_CALLS } from '../src/calls/turkey';
import { loadBest, saveBest } from '../src/practice/storage';
import { tipsFor } from '../src/practice/tips';
import { backHref, matchRoute } from '../src/router';

const SR = 44100;
const tone = (hz: number, sec = 1, amp = 0.3) => {
  const x = new Float32Array(Math.round(SR * sec));
  for (let i = 0; i < x.length; i++) x[i] = amp * Math.sin((2 * Math.PI * hz * i) / SR);
  return x;
};
/** 0.5 s quiet, `sec` of tone, 0.5 s quiet, with a little noise for the floor. */
const clip = (hz: number, sec = 1) => {
  const pad = Math.round(0.5 * SR);
  const t = tone(hz, sec);
  const x = new Float32Array(t.length + 2 * pad);
  let seed = 1;
  for (let i = 0; i < x.length; i++) {
    seed = (seed * 16807) % 2147483647;
    x[i] = 0.001 * (seed / 2147483647 - 0.5);
  }
  x.set(t.map((v, i) => v + x[pad + i]), pad);
  return { samples: x, sampleRate: SR };
};

describe('species routes', () => {
  const routes = { '/': 1, '/mic': 1, '/call': 1, '/practice': 1 };
  const scopes = SPECIES.map((s) => s.id);
  it('moves a species prefix into the param', () => {
    expect(matchRoute('/barred-owl/call/inspection-call', routes, '/', scopes)).toEqual(['/call', 'barred-owl/inspection-call']);
    expect(matchRoute('/barred-owl/practice/inspection-call', routes, '/', scopes)).toEqual(['/practice', 'barred-owl/inspection-call']);
    expect(matchRoute('/turkey/call/gobble', routes, '/', scopes)).toEqual(['/call', 'turkey/gobble']);
    expect(matchRoute('/barred-owl', routes, '/', scopes)).toEqual(['/', 'barred-owl']);
    expect(matchRoute('/barred-owl/', routes, '/', scopes)).toEqual(['/', 'barred-owl']);
    expect(matchRoute('/barred-owl/nope/x', routes, '/', scopes)).toEqual(['/', '']);
  });
  it('keeps old turkey links working unchanged', () => {
    expect(matchRoute('/call/gobble', routes, '/', scopes)).toEqual(['/call', 'gobble']);
    expect(matchRoute('/practice/yelp', routes, '/', scopes)).toEqual(['/practice', 'yelp']);
    expect(matchRoute('/mic', routes, '/', scopes)).toEqual(['/mic', '']);
  });
  it('back goes to the species home or the species call page', () => {
    expect(backHref('/call', 'barred-owl/inspection-call')).toBe('#/barred-owl');
    expect(backHref('/practice', 'barred-owl/inspection-call')).toBe('#/barred-owl/call/inspection-call');
    expect(backHref('/call', 'gobble')).toBe('#/');
    expect(backHref('/practice', 'gobble')).toBe('#/call/gobble');
    expect(backHref('/', 'barred-owl')).toBeNull();
  });
});

describe('species calls', () => {
  it('resolves short turkey params and species params; unknown is null', () => {
    expect(resolveCall('gobble')).toMatchObject({ species: TURKEY, call: { id: 'gobble' } });
    expect(resolveCall('turkey/gobble')).toMatchObject({ species: TURKEY, call: { id: 'gobble' } });
    expect(resolveCall('barred-owl/inspection-call')).toMatchObject({ species: BARRED_OWL, call: { id: 'inspection-call' } });
    expect(resolveCall('inspection-call')).toBeNull();
    expect(resolveCall('barred-owl/gobble')).toBeNull();
    expect(resolveCall('elk/calf-call')).toMatchObject({ species: ELK, call: { id: 'calf-call' } });
    expect(resolveCall('elk/inspection-call')).toBeNull();
    expect(resolveCall('calf-call')).toBeNull();
    expect(resolveCall('nope/gobble')).toBeNull();
    expect(resolveCall('')).toBeNull();
  });
  it('call ids are unique within each species; turkey ids are unchanged', () => {
    for (const s of SPECIES) expect(new Set(s.calls.map((c) => c.id)).size).toBe(s.calls.length);
    expect(TURKEY.calls).toBe(TURKEY_CALLS);
    expect(TURKEY.calls.map((c) => c.id)).toEqual(['yelp', 'cut', 'purr', 'gobble', 'kee-kee-run']);
  });
  it('owl references live in the owl folder, elk references in the elk folder', () => {
    for (const c of BARRED_OWL.calls) for (const p of c.references) expect(p).toMatch(/^audio\/barred-owl\//);
    for (const c of ELK.calls) for (const p of c.references) expect(p).toMatch(/^audio\/elk\//);
  });
  it('species order and ids: turkey (default), barred owl, elk, mallard, great horned owl, wood duck', () => {
    expect(SPECIES.map((s) => s.id)).toEqual(['turkey', 'barred-owl', 'elk', 'mallard', 'great-horned-owl', 'wood-duck']);
    expect(ELK.calls.map((c) => [c.id, c.locked])).toEqual([
      ['bugle', true],
      ['glug', true],
      ['cow-mew', true],
      ['calf-call', false],
    ]);
  });
  it('mallard: its own band, every call cited; locked calls have no references', () => {
    expect(MALLARD.band).toEqual({ minHz: 1000, maxHz: 4000 });
    expect(MALLARD.calls.map((c) => c.id)).toEqual(['quack', 'hail-call', 'drake-raeb']);
    for (const c of MALLARD.calls) {
      expect(c.sources.length).toBeGreaterThan(0);
      if (c.locked) expect(c.references).toEqual([]);
      for (const p of c.references) expect(p).toMatch(/^audio\/mallard\//);
    }
    expect(resolveCall('mallard/quack')).toMatchObject({ species: MALLARD, call: { id: 'quack' } });
    expect(resolveCall('quack')).toBeNull();
    const quack = MALLARD.calls[0];
    expect([homeHref(MALLARD), callHref(MALLARD, quack), practiceHref(MALLARD, quack), bestId(MALLARD, quack)]).toEqual([
      '#/mallard',
      '#/mallard/call/quack',
      '#/mallard/practice/quack',
      'mallard.quack',
    ]);
  });
  it('wood duck: its own band, every call cited; both calls locked, without references', () => {
    expect(WOOD_DUCK.band).toEqual({ minHz: 300, maxHz: 10000 });
    expect(WOOD_DUCK.calls.map((c) => [c.id, c.locked])).toEqual([
      ['hen-flush', true],
      ['drake-whistle', true],
    ]);
    for (const c of WOOD_DUCK.calls) {
      expect(c.sources.length).toBeGreaterThan(0);
      if (c.locked) expect(c.references).toEqual([]);
      for (const p of c.references) expect(p).toMatch(/^audio\/wood-duck\//);
    }
    const whistle = WOOD_DUCK.calls[1];
    expect(resolveCall('wood-duck/drake-whistle')).toMatchObject({ species: WOOD_DUCK, call: { id: 'drake-whistle' } });
    expect([homeHref(WOOD_DUCK), callHref(WOOD_DUCK, whistle), practiceHref(WOOD_DUCK, whistle), bestId(WOOD_DUCK, whistle)]).toEqual([
      '#/wood-duck',
      '#/wood-duck/call/drake-whistle',
      '#/wood-duck/practice/drake-whistle',
      'wood-duck.drake-whistle',
    ]);
  });
  it('links: turkey keeps the short form, other species carry their id; every link resolves', () => {
    const gobble = TURKEY.calls.find((c) => c.id === 'gobble')!;
    const hoo = BARRED_OWL.calls.find((c) => c.id === 'inspection-call')!;
    expect([homeHref(TURKEY), callHref(TURKEY, gobble), practiceHref(TURKEY, gobble)]).toEqual(['#/', '#/call/gobble', '#/practice/gobble']);
    expect([homeHref(BARRED_OWL), callHref(BARRED_OWL, hoo), practiceHref(BARRED_OWL, hoo)]).toEqual([
      '#/barred-owl',
      '#/barred-owl/call/inspection-call',
      '#/barred-owl/practice/inspection-call',
    ]);
    const routes = { '/': 1, '/call': 1, '/practice': 1 };
    for (const s of SPECIES)
      for (const c of s.calls) {
        const [, param] = matchRoute(callHref(s, c).slice(1), routes, '/', SPECIES.map((x) => x.id));
        expect(resolveCall(param)).toEqual({ species: s, call: c });
      }
  });
});

describe('best-score keys', () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
  };
  it('turkey keys are the pre-Phase-8 keys; owl keys are prefixed and do not collide', () => {
    const store = mem();
    store.setItem('camecallhero.best.gobble', '71'); // saved by an older version
    const gobble = TURKEY.calls.find((c) => c.id === 'gobble')!;
    expect(loadBest(bestId(TURKEY, gobble), store)).toBe(71);
    const hoo = BARRED_OWL.calls.find((c) => c.id === 'inspection-call')!;
    expect(bestId(BARRED_OWL, hoo)).toBe('barred-owl.inspection-call');
    expect(saveBest(bestId(BARRED_OWL, hoo), 55, store)).toBe(true);
    expect(store.m.get('camecallhero.best.barred-owl.inspection-call')).toBe('55');
    expect(loadBest(bestId(TURKEY, gobble), store)).toBe(71);
  });
  it('elk keys are prefixed by the species id', () => {
    const store = mem();
    const calf = ELK.calls.find((c) => c.id === 'calf-call')!;
    expect(bestId(ELK, calf)).toBe('elk.calf-call');
    expect(saveBest(bestId(ELK, calf), 62, store)).toBe(true);
    expect([...store.m.keys()]).toEqual(['camecallhero.best.elk.calf-call']);
    expect(callHref(ELK, calf)).toBe('#/elk/call/calf-call');
    expect(practiceHref(ELK, calf)).toBe('#/elk/practice/calf-call');
  });
});

describe('analysis band', () => {
  it('default is the full band: same features as before', () => {
    const c = clip(1000);
    expect(extractFeatures(c, { band: FULL_BAND })).toEqual(extractFeatures(c));
  });
  it('the owl band ignores sound above it in the dominant frequency and mel bands', () => {
    // A 500 Hz hoot with a louder 3 kHz tone on top (a background bird).
    const c = clip(500);
    const bird = tone(3000, 1, 0.6);
    const pad = Math.round(0.5 * SR);
    for (let i = 0; i < bird.length; i++) c.samples[pad + i] = c.samples[pad + i] * 0.5 + bird[i] * 0.5;
    const full = extractFeatures(c);
    const owl = extractFeatures(c, { band: OWL_BAND });
    const med = (f: typeof full) => {
      const v = Array.from(f.domHz).filter((h) => h > 0).sort((a, b) => a - b);
      return v[Math.floor(v.length / 2)];
    };
    expect(Math.abs(med(full) - 3000)).toBeLessThan(50);
    expect(Math.abs(med(owl) - 500)).toBeLessThan(50);
    // Notes and loudness do not depend on the band.
    expect(owl.notes).toEqual(full.notes);
    expect(owl.peakDb).toBe(full.peakDb);
  });
  it('LivePitch searches the same band', () => {
    const x = tone(500, 0.2, 0.2).map((v, i) => v + 0.4 * Math.sin((2 * Math.PI * 3000 * i) / SR));
    const full = new LivePitch(SR);
    const owl = new LivePitch(SR, 2048, OWL_BAND);
    full.push(x);
    owl.push(x);
    expect(Math.abs(full.dominantHz() - 3000)).toBeLessThan(30);
    expect(Math.abs(owl.dominantHz() - 500)).toBeLessThan(30);
  });
});

describe('tips name the species', () => {
  it('say "owl" for owls and "turkey" by default', () => {
    const take = extractFeatures(clip(800, 0.5));
    const ref = extractFeatures(clip(400, 1));
    const low = { rhythm: 0, pitch: 0, tone: 0 };
    const owl = tipsFor(low, take, ref, null, 'owl').map((t) => t.text).join(' ');
    const turkey = tipsFor(low, take, ref, null).map((t) => t.text).join(' ');
    expect(owl).toMatch(/owl/);
    expect(owl).not.toMatch(/turkey/);
    expect(turkey).toMatch(/turkey/);
    expect(turkey.replaceAll('turkey', 'owl')).toBe(owl);
  });
});
