// The five wild turkey calls. Reference files live in public/audio/turkey/
// (licenses in manifest.json and ATTRIBUTION.md). A call with no references is
// locked: the app shows it but cannot score it.

import type { Weights } from '../audio/score';

export type TurkeyCallId = 'yelp' | 'cut' | 'purr' | 'gobble' | 'kee-kee-run';

export interface CallDef {
  id: TurkeyCallId;
  name: string;
  /** True while there are no reference recordings to score against. */
  locked: boolean;
  /** Paths relative to public/ (and to the site base URL). */
  references: string[];
  weights: Weights;
  /** What the call is and when turkeys use it. Every claim cites one of `sources`. */
  description: { meaning: string; when: string };
  sources: Source[];
}

export interface Source {
  title: string;
  url: string;
}

// Sources for the descriptions below. Both pages give near-identical text for each call.
// shortcut: the page text was read through web-search excerpts because this build
// environment's network blocks both hosts; re-read the pages directly when next editing a description.
const SC_DNR: Source = {
  title: 'South Carolina DNR, Wild Turkey sounds',
  url: 'https://www.dnr.sc.gov/wildlife/turkey/sound/turkeysound_index.html',
};
const ODWC: Source = {
  title: 'Oklahoma Dept. of Wildlife Conservation, Wild Turkey Sounds',
  url: 'https://www.wildlifedepartment.com/hunting/resources/turkey/sounds',
};

/** shortcut: uncalibrated equal weights for calls without references; tune each once it has 3+ clips. */
const UNCALIBRATED: Weights = { rhythm: 1, pitch: 1, tone: 1 };

const refs = (call: TurkeyCallId, count: number) =>
  Array.from({ length: count }, (_, i) => `audio/turkey/${call}-${i + 1}.wav`);

export const TURKEY_CALLS: CallDef[] = [
  {
    id: 'yelp',
    name: 'Yelp',
    locked: false,
    references: refs('yelp', 3),
    // Grid search over rhythm/pitch/tone in 0.5..3 (each >= 0.5 so no part is ignored), on the
    // calibration set: best worst-case margin 22.6 vs putts/junk, 27.2 vs gobble.
    // shortcut: fitted to 3 clips from one recording session; re-tune with yelps from other
    // birds and with real phone takes.
    weights: { rhythm: 3, pitch: 0.5, tone: 0.5 },
    // SC DNR and ODWC: "a basic turkey sound", "often delivered in a series of single-note
    // vocalizations", meaning depends on how the hen uses it.
    description: {
      meaning: 'The basic turkey sound, usually a series of single notes.',
      when: 'Made by hens; what it means depends on how the hen uses it.',
    },
    sources: [SC_DNR, ODWC],
  },
  {
    id: 'cut',
    name: 'Cut',
    locked: true,
    references: [],
    weights: UNCALIBRATED,
    // SC DNR and ODWC: fast, loud, erratic single notes; a modified cluck, heard at a great
    // distance, often used by a single turkey looking for companionship.
    description: {
      meaning: 'Fast, loud, erratic single notes: a modified cluck.',
      when: 'Carries a long way. Often made by a lone turkey looking for company.',
    },
    sources: [SC_DNR, ODWC],
  },
  {
    id: 'purr',
    name: 'Purr',
    locked: true,
    references: [],
    weights: UNCALIBRATED,
    // SC DNR and ODWC: soft, rolling call turkeys make when content, usually heard from
    // feeding birds, reassures turkeys as they get in close.
    description: {
      meaning: 'A soft, rolling call of a content turkey.',
      when: 'Usually heard from feeding birds. Reassures turkeys that are close.',
    },
    sources: [SC_DNR, ODWC],
  },
  {
    id: 'gobble',
    name: 'Gobble',
    locked: false,
    references: refs('gobble', 6),
    // From test/calibration.test.ts: the dominant-frequency track does not separate gobbles
    // from putts or the tone sweep (gobble is a burst of broadband pulses), tone does.
    // Equal weights passed with min margin 18.1; these give 28.1 (numbers in docs/STATUS.md).
    weights: { rhythm: 1, pitch: 0.5, tone: 1.5 },
    // SC DNR and ODWC: the principal vocalization of the male wild turkey, used primarily
    // in the spring to let hens know he is in the area.
    description: {
      meaning: 'The main call of the male (gobbler).',
      when: 'Mostly in spring, to let hens know he is in the area.',
    },
    sources: [SC_DNR, ODWC],
  },
  {
    id: 'kee-kee-run',
    name: 'Kee kee run',
    locked: true,
    references: [],
    weights: UNCALIBRATED,
    // SC DNR: the kee kee is the call of lost young turkeys, adults make variations; the
    // kee kee run is a kee kee with a yelp. (ODWC's page has no kee kee run entry.)
    description: {
      meaning: 'A kee kee (the lost call of young turkeys) followed by a yelp.',
      when: 'Young turkeys separated from the flock; adult birds make variations of it.',
    },
    sources: [SC_DNR],
  },
];

export const callById = (id: TurkeyCallId): CallDef => {
  const c = TURKEY_CALLS.find((x) => x.id === id);
  if (!c) throw new Error(`unknown call ${id}`);
  return c;
};
