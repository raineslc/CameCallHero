// The species the app knows, each with its calls. Turkey is the default species: its links
// keep their short form (#/call/<id>, #/practice/<id>) so saved links, home-screen shortcuts
// and best scores from before Phase 8 keep working; other species carry their id in the
// link (#/<species>/call/<id>).

import { FULL_BAND, type Band } from '../audio/features';
import { OWL_BAND, OWL_CALLS } from './barred-owl';
import type { CallDef } from './call';
import { ELK_BAND, ELK_CALLS } from './elk';
import { MALLARD_BAND, MALLARD_CALLS } from './mallard';
import { EASTERN_SCREECH_OWL_CALLS } from './eastern-screech-owl';
import { GREAT_HORNED_OWL_CALLS } from './great-horned-owl';
import { TURKEY_CALLS } from './turkey';
import { WOOD_DUCK_BAND, WOOD_DUCK_CALLS } from './wood-duck';

export interface Species {
  id: string;
  /** Heading and picker label. */
  name: string;
  /** Singular and plural nouns used in on-screen text ("Play turkey", "When turkeys use it"). */
  noun: string;
  nounPlural: string;
  calls: CallDef[];
  /** Analysis band for this species' references and takes. */
  band: Band;
}

export const TURKEY: Species = { id: 'turkey', name: 'Wild turkey', noun: 'turkey', nounPlural: 'turkeys', calls: TURKEY_CALLS, band: FULL_BAND };
export const BARRED_OWL: Species = { id: 'barred-owl', name: 'Barred owl', noun: 'owl', nounPlural: 'owls', calls: OWL_CALLS, band: OWL_BAND };
export const ELK: Species = { id: 'elk', name: 'Elk', noun: 'elk', nounPlural: 'elk', calls: ELK_CALLS, band: ELK_BAND };
export const MALLARD: Species = { id: 'mallard', name: 'Mallard', noun: 'duck', nounPlural: 'ducks', calls: MALLARD_CALLS, band: MALLARD_BAND };

// Great horned owl hoots measure 269-452 Hz (manifest notes), inside the barred owl's band.
export const GREAT_HORNED_OWL: Species = {
  id: 'great-horned-owl',
  name: 'Great horned owl',
  noun: 'owl',
  nounPlural: 'owls',
  calls: GREAT_HORNED_OWL_CALLS,
  band: OWL_BAND,
};

// Eastern screech-owl trills measure 560-818 Hz and whinnies 754-1249 Hz (manifest notes), inside
// the barred owl's band.
export const EASTERN_SCREECH_OWL: Species = {
  id: 'eastern-screech-owl',
  name: 'Eastern screech-owl',
  noun: 'owl',
  nounPlural: 'owls',
  calls: EASTERN_SCREECH_OWL_CALLS,
  band: OWL_BAND,
};

export const WOOD_DUCK: Species = { id: 'wood-duck', name: 'Wood duck', noun: 'duck', nounPlural: 'ducks', calls: WOOD_DUCK_CALLS, band: WOOD_DUCK_BAND };

export const SPECIES: Species[] = [TURKEY, BARRED_OWL, ELK, MALLARD, GREAT_HORNED_OWL, EASTERN_SCREECH_OWL, WOOD_DUCK];
export const DEFAULT_SPECIES = TURKEY;

export const speciesById = (id: string): Species | undefined => SPECIES.find((s) => s.id === id);

/**
 * The call a route parameter names: '<species>/<call>' or, for the default species, '<call>'.
 * Null if either is unknown.
 */
export function resolveCall(param: string): { species: Species; call: CallDef } | null {
  const slash = param.indexOf('/');
  const species = slash < 0 ? DEFAULT_SPECIES : speciesById(param.slice(0, slash));
  const id = slash < 0 ? param : param.slice(slash + 1);
  const call = species?.calls.find((c) => c.id === id);
  return species && call ? { species, call } : null;
}

const prefix = (s: Species) => (s === DEFAULT_SPECIES ? '' : `/${s.id}`);

export const homeHref = (s: Species) => `#${prefix(s) || '/'}`;
export const callHref = (s: Species, call: CallDef) => `#${prefix(s)}/call/${call.id}`;
export const practiceHref = (s: Species, call: CallDef) => `#${prefix(s)}/practice/${call.id}`;

/**
 * Key of a call's best score in storage. Turkey calls keep their bare id (the key used before
 * Phase 8, so saved scores are still found); other species are prefixed by the species id.
 */
export const bestId = (s: Species, call: CallDef) => (s === DEFAULT_SPECIES ? call.id : `${s.id}.${call.id}`);
