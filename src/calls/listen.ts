// Recordings a locked call can still play ("listen only"): the app cannot score these calls yet,
// but hearing the real animal is useful on its own. Kept apart from CallDef.references, which
// are the scorer's references. Only clips the manifest does not mark `uncertain`
// (test/listen.test.ts checks every path). Left out on purpose until the owner decides:
// turkey kee kee run (classified by measurement only, not confirmed), barred owl caterwaul and
// elk cow mew (manifest notes call them uncertain), barred owl ascending-hoot-5 (the recordist
// labels it as another call).

import type { CallDef } from './call';
import type { Species } from './species';

const clips = (species: string, call: string, numbers: number[]) => numbers.map((n) => `audio/${species}/${call}-${n}.wav`);
const upTo = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

const LISTEN: Record<string, string[]> = {
  'barred-owl/ascending-hoot': clips('barred-owl', 'ascending-hoot', [1, 2, 3, 4, 6]),
  'eastern-screech-owl/monotone-trill': clips('eastern-screech-owl', 'monotone-trill', upTo(10)),
  'eastern-screech-owl/whinny': clips('eastern-screech-owl', 'whinny', [1, 2, 4, 5, 6, 7, 8, 9, 10]),
  'elk/bugle': clips('elk', 'bugle', upTo(7)),
  'elk/glug': clips('elk', 'glug', upTo(3)),
  'mallard/quack': clips('mallard', 'quack', upTo(6)),
  'mallard/hail-call': clips('mallard', 'hail-call', upTo(8)),
  'mallard/drake-raeb': clips('mallard', 'drake-raeb', upTo(7)),
  'wood-duck/hen-flush': clips('wood-duck', 'hen-flush', upTo(9)),
  'wood-duck/drake-whistle': clips('wood-duck', 'drake-whistle', upTo(4)),
};

/** Clips the call page can play: the references of an unlocked call, the listen-only clips of a locked one. */
export const playableClips = (species: Species, call: CallDef): string[] =>
  call.locked ? (LISTEN[`${species.id}/${call.id}`] ?? []) : call.references;

/** Keys ('<species>/<call>') of the listen-only table, for the tests. */
export const LISTEN_KEYS = Object.keys(LISTEN);
