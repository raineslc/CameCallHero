# Status

## Phase 10: calling challenge for every species (2026-11-13, [#19](https://github.com/raineslc/GameCallHero/pull/19))

**Owner: please try on the phone**
1. Calls → **Barred owl** → **Calling challenge** → I'm ready. Stay quiet for the 3-2-1, then make a
   "who cooks for you" (both phrases), pause **2 s or more**, then a hoo-wah; tap Stop. Are both named
   and recognized? Owl calls closer together than 1.3 s are scored as one call.
2. Check the turkey challenge still has your saved scores (its leaderboard key is unchanged).

What changed:
- **Challenge for any species**: `#/<species>/challenge` (turkey keeps `#/challenge`), entry on every
  species home. A species with no call the challenge can recognize shows "Coming soon" (home and route).
- **Per-species data, no per-species code**: `src/challenge/rules.ts` holds each species' split gap,
  recognition thresholds, rank titles (and optional notes). `test/challenge.test.ts` runs the Phase 9
  measurements for every species with unlocked calls and fails, printing the values, if an entry is
  missing or drifts. Adding a species to the challenge = one data entry.
- **Split gap rule**: longest pause between notes inside any unlocked reference × 1.8 (Phase 9's room
  for a slower caller), rounded to 0.1 s. Turkey 0.28 s (yelp-3) → **0.5 s** (unchanged). Barred owl
  0.70 s (two-phrase-hoot-7, the pause between the two phrases) → **1.3 s**.
- **Thresholds** (worst wrong sound + 1, whole clips and through the split; wrong sounds = junk,
  `test/fixtures/<species>-other`, the species' locked-call recordings, the other unlocked calls):
  - Turkey (unchanged): yelp **40** (putt-2 39.6), gobble **53** (putt-4 52.8). Kee kee run left out
    (ends in a yelp). Lowest leave-one-out: 62.2 / 67.7.
  - Barred owl: who cooks for you **48** (ascending-hoot-5 47.0), hoo-wah **52** (two-phrase-hoot-2
    51.2). Lowest leave-one-out: 62.8 / 69.4.
- **Rank titles**: turkey keeps Poult/Jake/Gobbler/Longbeard/Boss gobbler. Owl: Night listener, Hoot
  rookie, Night caller, Moon hooter, Who-cooker supreme (made-up names; the help says rank titles are
  just names).
- **Leaderboard per species**: turkey keeps `camecallhero.challenge.board`; others
  `camecallhero.challenge.board.<species>`. Score card title and share text name the species.
- Back button from a species' challenge goes to that species' home.
- `docs/ROADMAP.md`: Phases 10-15 and candidate species (linked from `docs/PLAN.md`).

Verified: unit tests (gap and thresholds recomputed per species; owl take hoot + 2 s + hoo-wah →
both recognized 99.9 / 98.7; an ascending hoot between them is Not recognized and lowers the score;
per-species boards; routes); e2e with fake mic: owl hoot + hoo-wah → "Who cooks for you 98",
"Hoo-wah 99", saved to the owl board, turkey board stays empty; turkey challenge e2e unchanged;
a11y pass on `#/barred-owl/challenge`; full e2e suite.

Not verified / known limits:
- Nothing on a real phone (real owl callers, by voice or call).
- Owl thresholds fitted to few clips (7 + 3 references, 4 recordings for the hoot). The hoo-wah line
  (52) is set by a two-phrase hoot scored as a hoo-wah.
- Two owl calls less than 1.3 s apart merge into one call and score lower.
- The "Coming soon" state is covered by a unit test only: no species without unlocked calls exists yet.

## Phase 9: turkey calling challenge (2026-11-13, [#18](https://github.com/raineslc/GameCallHero/pull/18))

**Owner: please try on the phone**
1. Calls → Wild turkey → **Calling challenge** → I'm ready. Stay quiet for the 3-2-1, then call a
   sequence (for example a yelp series, a pause, a gobble), tap Stop. Are the calls split and named
   sensibly? Does a real yelp/gobble from a person or a box call clear the recognition line?
2. Enter a name, Save score, pass the phone, and try **Share score card** (on Android Chrome it should
   open the share sheet with a PNG).

What changed:
- **Challenge screen** (`#/challenge`, `src/screens/challenge.ts`): free take up to 20 s with Stop,
  same capture, count-in quiet light, loudness meter and take gates as practice; mic released before
  scoring; nothing plays while recording.
- **Split into calls** (`src/challenge/analyze.ts`): notes (the scorer's own note finder) are grouped
  at pauses of 0.5 s or more. Measured within-call gaps: yelp 0.08–0.28 s, gobble 0.04 s (kee kee run,
  locked: up to 0.37 s, plus one 1.01 s pause in kee-kee-run-3). Each call is cut out with up to 0.3 s
  around it and scored against every unlocked turkey call; the best match names it.
- **Recognition thresholds** (`RECOGNIZE_MIN`): worst wrong sound + 1, measured both as whole clips and
  through the challenge split: **yelp 40** (worst putt-2 39.6), **gobble 53** (worst putt-4 52.8 — one
  putt of the series split off by its 0.7 s pauses; as a whole clip it scored only 17.8). Lowest
  leave-one-out: yelp 62.2, gobble 67.7. `test/challenge.test.ts` recomputes them from the files.
- **Score** = Σ(recognized score × call length) / Σ(all call lengths); not recognized counts 0, pauses
  do not count, no bonuses. Stars as practice; ranks by star band: Poult, Jake, Gobbler, Longbeard,
  Boss gobbler. One next step: the part that cost the most points.
- **Leaderboard** (`src/challenge/leaderboard.ts`): top 10 in localStorage, validated on every read;
  names cleaned (control/bidi characters, spaces, 20 characters) and shown as text only. Clear asks first.
- **Score card** (`src/challenge/card.ts`): 1080×1350 PNG on canvas from theme tokens; Web Share with
  the file when the browser can share files, else a download. Image only.
- **Extra rating hook**: documented on `ChallengeResult` (a new field filled after
  `analyzeChallenge`, shown next to the score, never changing `score`). No code added for it.
- `extractFeatures` takes an optional `maxSeconds` (the 20 s take is only note-split, no DTW on it).

Verified: unit tests (segmentation, thresholds, formula incl. random/NaN inputs, ranks, next step,
leaderboard with corrupt/throwing storage); e2e with fake mic: reference yelp + 1 s pause + gobble →
"Yelp 94", "Gobble 98", score 95; noise and silence rejected; leaderboard entry saved, survives reload,
cleared; share falls back to download in headless Chromium (PNG checked); design pass on intro,
recording, results, leaderboard. Screenshots: `docs/screenshots/challenge-*.png`.

Not verified / known limits:
- Nothing on a real phone (Web Share sheet, real callers, box/slate calls).
- Thresholds are tight: putts reach 39.6–39.7 as a yelp (line 40). Fitted to few clips.
- If the background gets louder after the count-in than during it, wrong sounds score higher (with a
  count-in 10 dB quieter than a putt's background, putts reached 46–60). Same as practice.
- A yelp series much longer than the references (~2–3 s) scores lower (call length is part of rhythm).
- Kee kee runs score 50–66 as a yelp, so one may be named "Yelp".
- A call more than ~20–30 dB quieter than the loudest call in the take is not split out (the scorer's
  note finder drops notes far below the peak, to ignore background birds and echo). It is left out of
  the score, not counted as 0 (Codex review on #18; revisit with real phone takes).

## Phase 8b: separate the owl two-phrase hoot from the ascending hoot (2026-11-13, [#17](https://github.com/raineslc/GameCallHero/pull/17))

**Owner: please check / try**
1. **On the phone**: Calls → **Barred owl** → **Who cooks for you** → Practice. Make the full call
   (two sets of four hoots, ~3 s). Is the score sensible? Does an ascending series of even hoots,
   or a single hoo-wah, score clearly lower?
2. The pass is narrow (see below). If real takes score oddly, relocking it is a one-line change
   in `src/calls/barred-owl.ts` (`locked: true`, `references: []`).

Gate: one owl hoot call unlocked (two-phrase hoot); the ascending hoot stays locked.

What changed:
- **New structure feature** (`structureShape`, `structureSimilarity` in `src/audio/score.ts`):
  the loudness envelope of the call (dB above the note threshold, so level does not matter),
  its normalized autocorrelation, and the highest value in two lag windows: 0.25–0.5 s (even
  note spacing) and 1.2–2.5 s (a repeated phrase). Windows come from the reference
  measurements in the manifest: ascending-hoot notes start 0.32–0.40 s apart; the two sets of
  the two-phrase hoot start 1.56–1.94 s apart. Similarity = 100·exp(−mean |difference| / 0.2);
  0.2 was set before the grid search and not tuned.
- **Weights get an optional `structure`.** Absent or 0 (all turkey calls, hoo-wah): nothing
  changes. Otherwise it is folded into rhythm ("Timing & notes" on screen): rhythm becomes
  (r·rhythm + s·structure)/(r+s) and its weight r+s, so the total equals four weighted parts and
  the screen still shows three. `nextStep` uses the same part weights (`partWeights`).
- **Who cooks for you unlocked**: weights rhythm 3 / pitch 0.5 / tone 2 / structure 3, the 7
  manifest clips as references. Ascending hoot lock reason now says "other owl calls" (its worst
  negatives are the two-phrase hoot and caterwaul-1, not only the two-phrase hoot).
- Unit tests for the feature (repeat vs even spacing, single note, no call, level, range, NaN,
  unchanged scores without a structure weight, the four-part total); random-input range test
  includes structure weights. New e2e `e2e/practice-owl-hoot.e2e.ts`: fake mic plays two-phrase
  hoot 1, scored 89.7, saved under the owl key.

### Calibration (same rules: margin 15, leave-one-out, matrix rule, all negatives incl. turkey and junk)

| Call | Weights (r/p/t/s) | Worst-case margin | Before (Phase 8) | Result |
|---|---|---|---|---|
| Who cooks for you (two-phrase hoot) | 3 / 0.5 / 2 / 3 | **15.7** (leave-one-out 15.9, matrix 15.7) | 4.1 | **unlocked** |
| Ascending hoot | 2.5 / 3 / 2.5 / 2 | 13.0 (matrix 13.0) | 4.0 | locked, "Coming soon" |
| Hoo-wah | 1 / 2.5 / 1.5 / – | 18.3 (unchanged) | 18.3 | unlocked |
| Caterwaul | 0.5 / 0.5 / 3 / – | -39.2 (unchanged) | -39.2 | locked |

**The two-phrase pass is narrow**: of 1512 weight sets (r/p/t 0.5..3, s 0..3, step 0.5) only 4
reach 15 (15.0, 15.3, 15.6, 15.7), all with pitch 0.5 and rhythm 2.5–3. Fitted to 7 clips from 4
recordings. Worst negatives: kee-kee-run-4 (turkey, 49.0) and, for clip 7, the tone sweep (45.9).
Lowest leave-one-out scores: clip 7 (62.8), clips 5/6 (64.9).

Ascending hoot: worst negative two-phrase-hoot-7 (53.4) for clips 1–4 and 6, caterwaul-1 (53.4) for
clip 5. two-phrase-hoot-7 has the most even note spacing of the two-phrase clips (envelope
autocorrelation 0.34 at the note lag vs 0.01–0.24 for the others), and caterwaul-1 has a run of
evenly spaced notes 0.36 s apart.

Owl confusion matrix (mean score; own row leave-one-out):

| take \ target | two-phrase | ascending | hoo-wah | caterwaul |
|---|---|---|---|---|
| two-phrase hoot | **70.6** | 50.9 | 48.3 | 33.6 |
| ascending hoot | 44.0 | **67.6** | 44.8 | 35.0 |
| hoo-wah | 37.6 | 40.6 | **81.2** | 29.5 |
| caterwaul | 27.6 | 33.7 | 21.7 | 24.3 |

What was tried (measured on the references, best worst-case margins two-phrase / ascending):
- **Phrase segmentation by gaps**: not used. Echo merges notes (two-phrase-hoot-5/6 come out as
  3 notes); the largest-to-median gap ratio overlaps between the calls (two-phrase 1.0–3.5,
  ascending 1.1–3.2 with the scorer's notes; 1.68–6.0 vs 1.05–1.61 at a −15 dB threshold, where
  two-phrase-hoot-3 at 1.68 is still close to ascending-hoot-2 at 1.61).
- **Pitch rise across notes**: not used. With the scorer's dominant frequency (43 Hz bins) the
  slope over the notes is negative for ascending-hoot-3/4 (their faint first notes read at
  600–690 Hz) and positive for some two-phrase clips; the mel spectral centroid per note did not
  show the rise either. The manifest's measured rises (e.g. 409 → 538 Hz) need a finer pitch
  measure than the scorer has.
- **Envelope autocorrelation, two peak values** (kept): blended into rhythm with r/p/t 0.5..3 and
  structure share 0–1: 14.8 / 12.9; as its own weight 0..3: **15.7 / 13.0**.
- **Envelope autocorrelation, whole curve** (lags 0.1–2.5 s, mean |difference|): 6.1 / 5.6.
- Margin, negatives, leave-one-out and the matrix rule are unchanged; turkey calibration output
  is byte-identical to `main` (diffed, 55 lines).

Next for the ascending hoot: more clips (especially two-phrase clips with clearly uneven spacing
and more ascending series), or a finer pitch measure for the rise across notes.

Verified: `npm ci && npm test` (236 unit tests), `npm run build`, `npm run e2e` (59 passed, 3
skipped). Not verified: anything on a real phone; a human "who cooks for you" (only recorded
owls were scored).

## Phase 8: multi-species app and barred owl calls (2026-11-13, [#16](https://github.com/raineslc/GameCallHero/pull/16))

**Owner: please check / try**
1. **Owl call wording** (owner: check owl call wording against sources). The owl text on screen
   (`src/calls/barred-owl.ts`) comes from Odom & Mennill 2010 and Birds of the World, read only
   through web-search excerpts: this environment still blocks birdsoftheworld.org, doi.org,
   bioone.org and academic.oup.com (checked 2026-11-13). The "when" line of the ascending hoot
   says the sources used do not say when owls give it.
2. **On the phone**: Calls → **Barred owl** → **Hoo-wah** → Practice. Make a hoo-wah (one note
   that rises, then falls, ~0.5–0.9 s). Is the score sensible? Does the orange trail follow the
   note? Does a gobble or a yelp score clearly lower?
3. Your turkey best scores should still show on the Wild turkey list (same storage keys).

Gate: passed (one owl call unlocked), so the phase hands off.

What changed:
- **Species → calls.** `src/calls/call.ts` (shared call type), `turkey.ts` (unchanged calls and
  weights), `barred-owl.ts`, `species.ts` (species list, link helpers, best-score keys).
- **Routes:** `#/<species>`, `#/<species>/call/<id>`, `#/<species>/practice/<id>`. Turkey is the
  default species and keeps its old short links (`#/call/<id>`, `#/practice/<id>`) as the links
  the app makes, so saved links and home-screen shortcuts work without a redirect (no reload, no
  extra history entry); `#/turkey/call/<id>` also works. Owl links always carry `barred-owl`.
- **Best scores:** turkey keys unchanged (`camecallhero.best.<call>`); owl keys
  `camecallhero.best.barred-owl.<call>` (unit test and owl e2e check both).
- **Manifests per species:** `loadManifest(species)` reads `public/audio/<species>/manifest.json`.
- **Home:** species picker (two 44 px buttons, picked one filled orange), then that species' calls.
- **Owl screens say "owl"**: "When owls use it", "Play owl", "Your notes vs. the owl", lane label,
  help text, tips (`tipsFor(..., noun)`; turkey text unchanged by default).
- **Owl analysis band 200–1500 Hz** (`OWL_BAND`): mel bands and dominant-frequency search
  (references, takes, live pitch trail) for owl calls only. Loudness, gates, note segmentation,
  quiet light and meter do not use the band, so they are the same for both species. Turkey
  features use the old 150–8000 Hz band; `extractFeatures` without a band is unchanged
  (unit test), and the turkey calibration output is byte-identical to `main` (diffed).

### Owl calibration (`test/calibration-owl.test.ts`)

Same rules as Phase 2/2b: leave-one-out, margin ≥ 15 over every negative (other owl calls, all
turkey references incl. kee kee run, turkey wrong-call fixtures, junk), all analyzed in the owl
band; plus the matrix rule (lowest same-call score − highest other-owl-call score ≥ 15). Margin
not changed. Weights: grid over rhythm/pitch/tone 0.5..3 (step 0.5), per call.

| Call | Clips | Best weights (r/p/t) | Worst-case margin | Result |
|---|---|---|---|---|
| Hoo-wah (inspection call) | 3 | 1 / 2.5 / 1.5 | **18.3** (matrix 18.3) | **unlocked** |
| Who cooks for you (two-phrase hoot) | 7 | 2 / 0.5 / 2.5 | 4.1 | locked, "Coming soon" |
| Ascending hoot | 6 | 2.5 / 2 / 2.5 | 4.0 | locked, "Coming soon" |
| Caterwaul (duet) | 3 | 0.5 / 0.5 / 3 | -39.2 | locked, "Not practicable" |

Hoo-wah leave-one-out: clip 1 87.1 (margin 36.0), clip 2 87.1 (36.5), clip 3 69.4 (18.3; worst
negative two-phrase-hoot-2 at 51.2).

Owl confusion matrix (mean score; row = call made, column = call scored as; own row leave-one-out):

| take \ target | two-phrase | ascending | hoo-wah | caterwaul |
|---|---|---|---|---|
| two-phrase hoot | 64.7 | 54.3 | 48.3 | 33.6 |
| ascending hoot | 49.3 | 63.3 | 44.8 | 35.0 |
| hoo-wah | 40.4 | 39.2 | **81.2** | 29.5 |
| caterwaul | 28.0 | 28.7 | 21.7 | 24.3 |

How the band was chosen: 4 bands tried on the calibration set (150–8000, 150–2000, 200–1500,
250–3000 Hz). Hoo-wah best margins: 15.3, 13.6, 18.3, 5.5. At 150–8000 Hz only 2 of 343 weight
sets passed (15.3, 15.1), at 200–1500 Hz 38 did, so 200–1500 Hz is the less fragile choice; it
also matches the measured owl range (hoots 0.35–0.75 kHz, caterwaul high notes ≤ 1.4 kHz). Also
tried a lower note threshold (15/20 dB below peak instead of 30, to split echo-merged notes):
no hoot series reached 15 (best 7.2), so it was not kept.

Why the hoot series fail: within-call scores are about as low as cross-call scores (two-phrase
same-call 60–75 vs. ascending clips at ~59). Causes seen in the measurements: echo merges notes
(two-phrase-hoot-5/6 come out as 3 notes, -3/-4 as 6), and the recordings differ a lot from
each other. More clips per call, or a feature for the pitch rise across notes, would be the
next thing to try.

Checks asked for in the brief:
- **Quiet clips:** two-phrase-hoot-3/4 (loudest frame -37.2 dBFS) pass every gate unchanged
  (gate is -50 dBFS); a 30× louder copy scores the same (unit test). No normalisation needed:
  level never enters the score. The only owl clip failing a gate is caterwaul-2 (too noisy).
- **Note segmentation:** fine for the hoo-wah (always 1 note); poor for the hoot series (echo), see above.
- **Quiet light:** unchanged and species-independent (-21.2 dBFS, from a 6.1 dB turkey crest).
  Hoo-wah crests are 4.25, 4.23 and 6.40 dB, so for a call like clip 3 a green light at a floor
  between -21.5 and -21.2 dBFS could still be refused as too noisy (0.3 dB; the turkey yelp-3
  has the same kind of 0.07 dB gap).

Verified: `npm ci && npm test` (230 unit tests), `npm run build`, `npm run e2e` (59 passed, 3 screenshot tests skipped: existing
43 untouched except owl screens added to the a11y screen list, plus new `e2e/species.e2e.ts`
(picker, owl call page, locked owl calls, new-style turkey link) and `e2e/practice-owl.e2e.ts`
(fake mic plays hoo-wah 1: scored 88.3, saved under the owl key, no "turkey" text)). Screenshots:
`docs/screenshots/home-owl-360.png`, `call-owl-hoo-wah-360.png`.

Not verified: anything on a real phone; a human hoo-wah (only recorded owls were scored); the
owl text against the full sources.

## Phase 7: barred owl reference audio (owner request, 2026-11-12, [#15](https://github.com/raineslc/GameCallHero/pull/15))

Gate: passed. Every call has ≥ 3 clips from ≥ 3 recordists; no call is short.

| Call | Clips | Recordings (recordists) | Ready to calibrate in Phase 8 |
|---|---|---|---|
| two-phrase hoot ("who cooks for you, who cooks for you-all") | 7 | XC1141309, XC715195, XC911365, XC690957 (4) | yes |
| ascending hoot | 6 | XC911364, XC1001471, XC545772, XC172893 (4) | yes (ascending-hoot-5 label uncertain: recordist called it "who cooks for you") |
| inspection call ("hoo-wah") | 3 | XC683551, XC1002439, XC550538 (3) | yes, at the minimum of 3 |
| caterwaul (duet) | 3 | XC413729, XC593644, XC911366 (3) | clips marked uncertain; a two-bird duet; expect it to stay locked |

- 19 clips, 6.7 MB, all xeno-canto, all "Playback used: no" on their pages. Licenses: CC BY-NC-SA 4.0
  (16 clips), CC BY-SA 4.0 (3 clips). Details and per-clip measurements: `public/audio/barred-owl/manifest.json`.
- Call definitions with sources are in the manifest (`callDefinitions`): Odom & Mennill 2010,
  *The Condor* 112:549–560 (peer reviewed) and Cornell's Birds of the World. **Both were read only
  through web-search excerpts** (this environment blocks those hosts); Phase 8 must re-read them
  before showing the text in the app.
- Not included: one-phrase hoot (excerpts disagree on its structure), two/three-note hoots (no
  description found). The owner's "descending hoo-aww" is the inspection call ("hoo-wah": rises,
  then falls).
- Rejected: wisconagus recordings (playback used), XC683551's second call (a sample-identical copy
  of the first), XC413729 17.5–21.9 s (clipped), XC656431 (the recordist says it ended a series,
  so it may be the series' final "hoo-aw", not an inspection call).
- Not verified: no expert or recordist confirmed the classifications; no one listened to the clips
  (classification is by spectrogram and measurement).

## Practice and mic check redesign (owner request, 2026-11-12, [#14](https://github.com/raineslc/GameCallHero/pull/14))

Owner's question: how can the sound measuring interface look better and help make better calls.
All six approved items are built on the practice and mic check screens.

**Owner: try on the phone (Galaxy S25+, Chrome)** — none of this is verified on a real phone:
1. Mic check: call into the phone; the meter should read **Good** for a normal call, **Back off** when
   very close and loud, **Move closer** when quiet. Your floor of -39 dBFS gives a green quiet light.
2. Yelp practice: does the quiet light turn green during the 3-2-1? Do blocks turn orange ("Hit") when
   you call on them, and does the count ("4 of 10 hit · Streak 4") feel right, not early or late?
3. Results: do "Play yours" and "Play turkey" play, and is the "Next try" line useful?

What changed:
- **Hit or miss per note.** A lane note is hit when your sound is on (the chunk's loudest scorer frame
  >= 10 dB above the count-in floor, the scorer's own note threshold) inside the note's window: start
  and end widened by 0.15 s, never past the middle of the gap to a neighbouring note, after the tap-test
  offset. 0.15 s = half a mic chunk (~23 ms) + untuned margin for the tap-test shortcut (marked
  `shortcut:` in `src/practice/hits.ts`). Running count and streak above the lane; visual only, the
  score is unchanged. Only the newest "Hit"/"Miss" label is drawn (labels of close yelp notes overlapped).
  `Lane.draw` still allocates nothing.
- **Blocks shaped like the sound.** Each block is slanted from the median dominant frequency of the note's
  first third (bottom) to its last third (top) — the scorer's note-break thirds. 51%+ of yelp reference
  notes slant downward (unit test). Gobble's dominant frequency jumps (broadband pulses), so its slants
  are irregular; that is what is measured.
- **Quiet light during the 3-2-1.** Green "Quiet enough" / red "Too much background noise. Move away from
  fans, wind or traffic." Threshold: the highest floor at which a call like the references can be 15 dB
  (scorer's `minSnrDb`) above it without clipping = 20·log10(0.99) − 6.1 dB crest − 15 ≈ -21.2 dBFS. The
  6.1 dB crest is the smallest of the gobble/yelp references (yelp-3, 6.17 dB), rounded down; a unit
  test checks the light agrees with `checkTake` on every reference scaled to just below clipping, for
  floors from -40 to -15 dBFS. This is lenient: a green light means a pass is possible, not easy.
  The count-in floor is now measured live (`LiveFloor`), equal to the previous `extractFeatures` value (unit test).
- **Loudness meter with zones** (practice and mic check): too quiet below max(-50 dBFS, floor + 15),
  too loud from the clip-safe level (≈ -6.2 dBFS) or any sample at the clipping level; labels "Move
  closer" / "Good" / "Back off". Level = loudest scorer frame of each mic chunk, held 0.6 s.
- **Results.** 1–5 stars (equal 20-point bands, `shortcut:` comment in `hits.ts`; reference gobbles score
  73–82 against each other = 4–5 stars), a bar per part, "Play yours" (the take, from memory, through a
  new AudioContext closed when playback ends) and "Play turkey" (closest reference). Both are on the
  results screen only; starting a take stops all playback first. Overlay of your notes vs. the closest
  reference: filled = hit, hollow = missed/extra, plus "You hit n of N turkey notes".
  The lane counts hits against reference clip 1 (the one shown); results count them against the
  closest clip, so the two numbers can differ.
- **One next step**, big: the action of the part that costs the total most (weight × gap to the
  reference level), e.g. "Next try: make 6 notes instead of 12".
- **Kee kee run** shows "Coming soon" (home, call page, practice) with the reason: 4 recordings, but the
  scorer cannot yet tell it apart from a yelp. Cut and purr keep "Recordings needed".
- Removed the practice screen's own "← Gobble" link (the header has a back button).
- No vibration anywhere.

Verified: `npm ci && npm test` (163 unit tests), `npm run build`, `npm run e2e` (43 passed, run twice,
2 and 4 workers). New e2e with the fake mic: gobble and yelp references get hits (yelp 10 of 10),
silence gets a green light and all misses, steady noise 6 dB above the threshold gets a red light and
is refused; Play yours / Play turkey play with the mic closed; mic check meter reaches Good; a11y pass on
count-in and take. Screenshots (360 px): `docs/screenshots/practice-count-in-360.png`,
`practice-lane-hits-360.png`, `practice-results-360.png`, `mic-check-meter-360.png`
(`SCREENSHOTS=1 npx playwright test e2e/screenshots.e2e.ts`).

Not verified: anything on a real phone; whether the hit tolerance feels right; frame rate.

## Owner: new link after the rename (look PR, 2026-11-12)

The app is now called **Game Call Hero** everywhere a person reads it, and you renamed the
repository to `GameCallHero` while this PR was open. All links now use the new name.

1. The site is now **https://raineslc.github.io/GameCallHero/**. Until this PR merges and the
   Pages deploy runs, that link most likely loads a page without its scripts and styles: the
   old build had `/CameCallHero/` built into its asset paths (not checked: this environment
   cannot reach github.io). The new build uses relative paths. The old link `/CameCallHero/` stops working: GitHub Pages does not
   redirect after a rename. Remove the old home-screen app and install it again from the new
   link. Saved best scores do not carry over: they belong to the old address.
2. Check the new look on your phone (Galaxy S25+): header, call list, a call page.

## Owner: next steps (Phase 6, feedback release, 2026-11-12)

All six phases are done. Nothing more is planned; the next work depends on your decisions.

1. **Check the release on your phone** (not verified by any test): open
   https://raineslc.github.io/GameCallHero/ in Chrome, ⋮ → Add to Home screen / Install app,
   confirm the orange turkey-track icon appears and the app opens full screen. Do one gobble
   practice take.
2. **Share the link** with testers: https://raineslc.github.io/GameCallHero/ (or the README:
   https://github.com/raineslc/GameCallHero#readme, which has the test steps). Tell them only
   gobble can be practiced and that feedback needs a GitHub account.
3. **Collect issues**: feedback arrives through the "Tester feedback" form
   (`.github/ISSUE_TEMPLATE/feedback.yml`, linked from the README and the app footer); recording
   offers through "Contribute a turkey recording" (`recording.yml`, CC0 or CC BY 4.0 only).
   The forms apply the labels `feedback` and `recording` (both created). Before using a contributed recording: check it is a
   wild bird, classify the call, and add it to `ATTRIBUTION.md` and the manifest.
4. **Decide on Google Play** (not started). Before any app-store release, write to each NC
   recordist (AGENTS.md hard rule). Play also needs a developer account and a privacy
   policy URL. Wrapping the web app (Trusted Web Activity) needs Digital Asset Links and
   probably an offline page (service worker). Not researched in detail.
5. **Open decisions from earlier phases** (below): scoring phase for yelp / kee kee run; cut and
   purr recordings; listening check of the yelp and kee kee run clips.

### Known limits (testers will hit these)

- Only gobble is practicable; references are 6 clips, 2 sessions, 1 recordist.
- Yelp, kee kee run: locked (scorer cannot separate them yet). Cut, purr: no recordings.
- Tested only in Chromium with a simulated mic; on a real phone only the Phase 3 mic check
  was run (owner, Android Chrome). Practice, lane frame rate, tap test and scores of real calls
  on a phone: not verified.
- Noise floor on the owner's phone was high (-39 dBFS); cause unknown.
- Rhythm score ignores per-note spacing (Phase 2 open issue).
- No offline mode (no service worker). Other browsers and iPhone untested.
- Feedback needs a GitHub account; there is no in-app form (no backend by design).

## Issue #11 fix: plain practice help (tester feedback, 2026-11-12, [#12](https://github.com/raineslc/CameCallHero/pull/12))

- Results: one line per part with a verdict and one thing to do, in plain words; sub-scores
  renamed **Timing & notes** (rhythm), **High/low** (pitch), **Sound** (tone); the numbers are unchanged.
  Lines state only measurements: note count and call length vs. the closest reference; "higher" /
  "deeper" when the median dominant frequency differs by 2+ semitones; each note's drop from high
  to low (the Phase 2b note break) when it differs by 2+ mel bands. Sound gives no direction (the
  tone measure has none).
- Verdicts: **Good** = at least the lowest leave-one-out sub-score of the call's references against
  each other (computed in the app from the same clips); **Close** = up to 15 below that;
  **Needs work** = lower. shortcut: 15 is the calibration margin reused, not tuned. Real yelps score
  low on Sound and High/low against each other (levels 29 and 32), so a gobble-like take can get
  "Sound: Good" as a yelp; revisit when yelps from other birds are added.
- Goal before the count-in and above the lane: "Make N notes in about X seconds" (shown reference).
  While recording: "Notes so far: n of N", counted with the scorer's own segmentation on each mic
  chunk (no per-frame allocation); the final count equals the scored count (unit test on every
  reference and the phone take; e2e checks it). It can change mid-take: a louder note raises the
  threshold for all notes.
- "How it works" box with a colour legend on the practice screen, checked against `src/ui/lane.ts`.
- Not verified: whether the owner finds the new wording clear; anything on a real phone.

## Phase 6 notes

- README: what it is, link, current limits, Android test steps, recording contributions,
  privacy, developer commands, license and attribution.
- Issue forms: `feedback.yml` (phone, browser, call device, call, score, fair?, notes) and
  `recording.yml` (call, bird, place and month, equipment, license CC0 / CC BY 4.0, credit,
  file, confirmation). Footer "Send feedback" link opens the feedback form.
- Web app manifest (`public/manifest.webmanifest`, standalone, start URL and scope the Pages
  path) and icons 192 / 512 PNG (also maskable; the track stays inside the safe circle), SVG,
  180 px Apple touch icon. Icons drawn by `scripts/make-icons.mjs` from the theme tokens. The
  manifest repeats `--bg` as a literal colour (JSON cannot read CSS tokens).
- `e2e/manifest.e2e.ts`: manifest and every icon load, PNG sizes match, Chromium parses the
  manifest without errors. shortcut: headless Chromium's installability check returns no errors
  even with no manifest, so install itself is not tested; check it on a phone.
- `e2e/a11y.e2e.ts` design pass at 360 px on home, mic check (idle, live, after a take), all five
  call pages, all five practice pages and gobble practice results: text contrast >= 4.5:1
  against the nearest opaque background, no text whose nearest opaque background is `.camo`,
  every link and button >= 44 px tall, no horizontal scroll. A self-test injects bad elements
  to prove the check catches them. Found nothing to fix. Limits: text drawn on canvases (lane,
  spectrograms) and disabled buttons are not checked.
- Playwright: 37 tests, run 3x in a row (1 worker) and 2x with 4 workers: no failures.

## Look update notes (branch `look-rename-camo-layout`)

- Name: "Game Call Hero" in the header, `<title>`, web manifest (name and short_name; a
  launcher may shorten the label), README, docs, AGENTS.md, issue form, LICENSE, package name
  `gamecallhero`. Repo and Pages links point to `GameCallHero` (owner renamed the repo during
  this PR). Kept: the `localStorage` prefix `camecallhero.` (a code identifier; renaming it
  would drop scores saved at the same address).
- Paths: Vite `base: './'`, manifest `start_url` / `scope` `./`, audio and icons relative.
  `e2e/base-path.e2e.ts` serves the same build under `/mirror/OtherName/` (all other e2e
  tests use `/GameCallHero/`): home, camo, clip playback, manifest and icons load, and no
  request leaves the prefix.
- Camo: `scripts/make-camo.mjs` writes `public/camo.png` (512 px, 4-colour indexed PNG,
  about 8 kB, shown at 256 CSS px): three seeded periodic noise fields with domain warping,
  cut into olive base, brown and dark-green shapes and broken black strands, from the
  `--camo-*` tokens. The noise wraps at the tile edge, so it tiles without seams; the script
  fails if colour changes across the wrap edge are unusually frequent. Our own pattern, no
  commercial camo copied. A static PNG, so no runtime filter cost.
- Layout: 56 px sticky header (back button on inner screens, name, Calls, Mic check, all on
  solid plates over the camo). Home: one compact row per call (name, best score, one-line
  meaning, spectrogram thumbnail or "Recordings needed"); all five rows fit at 360 x 740
  (e2e). Call page: facts line, 128 px spectrogram, Play + Practice on the first screen
  (e2e), "When turkeys use it" and "Reference clips and licenses" in `<details>`.
- Practice and mic check screens were not restructured (another session redesigns them);
  they only pick up the new header, footer and heading sizes. Practice still has its own
  "← Gobble" link besides the header back button.
- Screenshots (before/after, 360 and 412 px): `docs/screenshots/`.
- Not verified: the look on a real phone.

## Phase 3 phone result (owner, Android, Chrome, 2026-11-12)

- Settings table: echo cancellation, noise suppression and auto gain all **off** as
  requested; 1 channel; track and AudioContext both 48000 Hz. The phone honoured every request.
- One 5 s take, a yelp made by mouth (owner's words): `test/fixtures/phone/yelp-mouth-1.wav`, CC0 (owner decision).
  Measured with `extractFeatures`: peak -10.6 dBFS (74% of full scale, no clipping),
  noise floor -39.4 dBFS, 12 notes over 3.51 s: one 0.29 s note, then ten notes of
  0.08-0.10 s about 0.3 s apart. Scorer accepts it (about 29 dB above the floor).
  Yelp is unlocked since Phase 2b: this take scores 51.2 as yelp.
- Open: the noise floor is high (CI fake-mic take: -62 dBFS). With auto gain off this is
  real background or mic noise; the cause is not known.
- Still wanted from the owner: one WAV of each other call they can make, named by call.
  Owner recordings are practice takes for tuning, not references (references are wild-turkey recordings, see `docs/PLAN.md`).

## Phase 1 re-run with NC licenses (2026-11-12) — cut and purr still missing

**Owner decision:** reference audio may now be CC BY-NC or CC BY-NC-SA (never ND), because
the app stays free and open source: no ads, purchases or donations (AGENTS.md "Hard
rules"). Code is MIT (`LICENSE`); audio keeps its own licenses (`ATTRIBUTION.md`).

**New clips** (all Richard E. Webster, CC BY-NC-SA 4.0, Arizona, bird seen, no playback):

| Call | Clips | Sessions | Usable? |
|---|---|---|---|
| yelp | `yelp-1..3` | 1 (XC779658) | yes, 3 clips; all from one session |
| kee kee run | `kee-kee-run-1..4` | 2 (XC614092, XC779655) | yes |
| cut | 0 | | **missing** |
| purr | 0 | | **missing** |

Classified by spectrogram measurement against cited descriptions (manifest `notes`), not by
an expert: **owner, please listen** to the seven files in `public/audio/turkey/` (after
merge also e.g. https://raineslc.github.io/GameCallHero/audio/turkey/yelp-1.wav) and say if
any is wrong. No xeno-canto recordist labels a yelp, cut,
purr or kee kee run; candidates for cut/purr (XC377125, XC700666, XC778473) were not clear
enough to classify.

**Scoring update (Phase 2b, branch `phase-2b-calibrate-yelp-kee-kee`): yelp unlocked,
kee kee run still locked.**

- New in `src/audio/score.ts`: per-note rhythm (each note's length and spacing, aligned note
  by note with DTW; closes the Phase 2 open issue below) and a per-note "break" in pitch
  (spectral centroid of a note's first third minus its last third; yelps break downward).
- Yelp weights `{ rhythm: 3, pitch: 0.5, tone: 0.5 }` from a grid search (each weight 0.5-3).
  shortcut: fitted to 3 clips from one session (XC779658); re-tune with yelps from other birds.
- Calibration now (all need >= 15): yelp leave-one-out 22.6 / 28.6 / 31.5 (worst negative
  putt-2); gobble 23.4-41.5 (was 28.1 minimum before; still passes); matrix: gobble takes
  score 26.2 as yelp vs 66.2 yelp-as-yelp, yelp takes 35.2 as gobble vs 77.2.
- Owner's phone yelp (`test/fixtures/phone/yelp-mouth-1.wav`, by mouth): 51.2 as yelp
  (rhythm 61, pitch 18, tone 24), 25.6 as gobble. Accepted, not scored highly.
- **Kee kee run stays locked (owner decision, 2026-11-12).** No scoring variant or weights
  separated yelp from kee kee run by 15 (best 7.7): a kee kee run contains yelps by
  definition (SC DNR). Owner chose to keep the strict test and unlock yelp only. The four
  kee kee run clips stay in `public/audio/turkey/` for later.
- Tried and dropped: comparing tone only inside notes (helped yelp, cut gobble's margin to 16).

**Next:** cut and purr references (owner field recordings, CC0, or recordist permission).

## Earlier decision (Phase 2): proceed with gobble only

Proceed with **gobble only**. Only `public/audio/turkey/gobble-*.wav` exist (6 clips,
CC BY-SA). The engine is built for all five calls; yelp, cut, purr and kee kee run are
`locked: true` in `src/calls/turkey.ts` with no references, and the 5x5 cross-call
matrix test activates by itself once 2+ calls have 3+ references.

**Missing references: yelp, cut, purr, kee kee run.** Options for getting them are in
the Phase 1 search log below and in [PR #1](https://github.com/raineslc/GameCallHero/pull/1).

## Phases

| # | Phase | State | PR |
|---|---|---|---|
| 0 | Bootstrap | done | pushed to `main` (empty repo had no base branch) |
| 1 | Reference audio | partial — gobble, yelp, kee kee run; cut and purr missing | [#1](https://github.com/raineslc/GameCallHero/pull/1), re-run: [#5](https://github.com/raineslc/GameCallHero/pull/5) |
| 2 | Scoring engine | done — gobble calibrated, other calls locked | [#2](https://github.com/raineslc/GameCallHero/pull/2) |
| 2b | Calibrate yelp | done — yelp unlocked; kee kee run locked (cannot be told from yelp) | [#10](https://github.com/raineslc/GameCallHero/pull/10) |
| 3 | Mic check | done — fake-mic test in CI; real phone not tested | [#3](https://github.com/raineslc/GameCallHero/pull/3) |
| 4 | Library | done — gobble playable; 4 calls listed as "Recordings needed" | [#4](https://github.com/raineslc/GameCallHero/pull/4) |
| 5 | Practice | done — gobble playable; locked calls keep Practice disabled; real phone not tested | [#8](https://github.com/raineslc/GameCallHero/pull/8) |
| 6 | Feedback release | done — README, issue forms, manifest + icons, design pass; install not verified on a phone | [#9](https://github.com/raineslc/GameCallHero/pull/9) |
| 7 | Barred owl reference audio | done — 4 calls, 19 clips; caterwaul uncertain | [#15](https://github.com/raineslc/GameCallHero/pull/15) |

## Phase 1 search log (2026-11-12)

| Source | Result |
|---|---|
| xeno-canto (website search; API v3 needs a key) | 141 recordings. Licenses: 102 BY-NC-SA 4.0, 12 BY-NC-SA 3.0, 17 BY-NC-ND 2.5, 4 BY-NC-ND 4.0, 5 BY-SA 3.0, 1 BY-SA 4.0. Used: XC136045, XC134155 (gobble). Checked, not used: XC104532, XC104533, XC134744, XC320490 (putts; juvenile whistles at XC104532 ~79–82 s are a possible kee kee candidate but not a full run). |
| Wikimedia Commons | Audio: only mirrors of the same xeno-canto files, plus `Gobbler.ogg` (pdsounds.org "public domain" by user "bod", tagged poultry — not a US-government work and probably domestic: rejected). Videos whose sound track may hold calls were **not checked**: Wikimedia answered every download with HTTP 429 for 30+ min. Candidates: `Wild Turkey (Meleagris gallopavo).webm` (USFWS, public domain), `Wild Turkeys in North bay.webm`, `Wild Turkey Red Hill Valley 1.webm` / `2.webm`, `20260428 wild tom turkey matthaei botanical gardens wm.webm` (all CC BY-SA 4.0). |
| xeno-canto, NC re-run (2026-11-12) | 120 non-ND recordings downloaded; US/Canada hen and flock recordings checked on spectrograms. Used: XC779658 (yelp), XC614092 and XC779655 (kee kee run). Not used: XC786182 (high whistles, other birds over them), XC1140501 (regular notes without a clear yelp break), XC778473 (descending pulsed notes, unclassified), XC377125 (low repeated notes, unclassified), XC700666 (soft calls masked by stream). Recordings outside the US and Canada skipped (France, Italy, Cyprus, Colombia: introduced or domestic birds; 3 Mexico files not checked). |
| Freesound | HTTP 403 from this environment; not searched. |
| NPS sound gallery | No turkey recordings listed. |
| USFWS digital media | digitalmedia.fws.gov redirects to fws.gov, which the environment blocks. |

## Phase 2 calibration (gobble, leave-one-out)

Same-call score vs. the worst negative (4 putt-like turkey clips, claps, tone sweep,
silence, white/pink noise, wind), required margin 15:

| Take | Same call | Other session only | Worst negative | Margin |
|---|---|---|---|---|
| gobble-1 | 76.8 | 74.1 | putt-3 45.3 | 31.5 |
| gobble-2 | 76.8 | 72.9 | putt-3 44.7 | 32.1 |
| gobble-3 | 73.4 | 69.7 | putt-3 45.3 | 28.1 |
| gobble-4 | 81.5 | 74.1 | putt-3 45.3 | 36.3 |
| gobble-5 | 80.2 | 67.3 | putt-3 45.3 | 35.0 |
| gobble-6 | 81.5 | 70.7 | putt-3 45.3 | 36.3 |

Limits: only two birds/sessions; no speech junk clip; real phone recordings not tested
(needs the owner, Phase 3+). Gobble weights rhythm 1, pitch 0.5, tone 1.5 (equal weights
gave a 18.1 minimum margin before the review fixes).

Open issues (from Codex review of #2, P2):
- ~~Rhythm compares only call length, note count and voiced fraction, not per-note
  lengths and gaps.~~ Fixed in Phase 2b (per-note alignment).

## Phase 3 notes

- Mic check at `#/mic`: live level, clipping warning and noise floor (both from the Phase 2
  `extractFeatures` / `checkTake` gates on the last 3 s), requested vs. actual
  `track.getSettings()`, AudioContext sample rate, 5 s take with spectrogram, scorer
  verdict and WAV download.
- Playwright (`npm run e2e`, runs in CI after the build) uses Chromium's fake mic fed with
  `gobble-1.wav`: level above zero, 5 s WAV of the right size, tracks `ended` and
  AudioContext `closed` after leaving the screen; denied / no-mic messages.
- Chromium's fake device reports 2 channels although 1 was requested; the worklet
  down-mixes to mono either way. What real Android phones report is unknown until the
  owner's screenshot.
- Not verified: anything on a real phone (voice processing actually off, sample rate,
  level of a real call, behaviour when another app holds the mic).

## Phase 4 notes

- Home (`#/`) lists the five calls as cards: name, one-line meaning, small spectrogram
  (gobble) or a "Recordings needed" badge (yelp, cut, purr, kee kee run). Mic check stays in
  the nav and as a button on home.
- Call detail (`#/call/<id>`): meaning, when turkeys use it, source links, measured length,
  large spectrogram with playhead, one play button and attribution line per clip (from
  `manifest.json`), Practice button (`#/practice/<id>`, placeholder until Phase 5). Locked
  calls: no play buttons, no measurements, Practice disabled.
- Descriptions cite South Carolina DNR "Wild Turkey sounds" and Oklahoma ODWC "Wild Turkey
  Sounds" (comments in `src/calls/turkey.ts`). Both hosts are blocked from this build
  environment, so the page text was read through web-search excerpts, not loaded directly.
  Owner may want to skim both pages against the wording in the app.
- Gobble length is the scorer's own measurement: 1–2 notes, 0.63–1.15 s over 6 clips.
  The manifest notes describe each clip as one ~0.95 s burst; segmentation splits gobble-3
  in two and measures gobble-2 at 0.63 s. Revisit with the per-note rhythm fix above.
- Spectrograms and features are computed once per clip and kept in memory for the visit.
- Playwright at 360 px: every call page loads, every gobble clip plays with no HTTP error,
  attribution shown, no horizontal scroll, audio paused and source dropped on leaving.
- Not verified: playback on a real phone.

## Phase 5 notes

- Practice at `#/practice/<id>`: Listen (reference clip 1, with spectrogram) → **I'm ready** →
  3-2-1 count-in (noise floor measured, passed to the scorer) → perform against a silent lane →
  Results. The timeline runs on the mic's own sample count; the mic opens per take and is
  released as soon as the take ends (and on Cancel / leaving the screen).
- Lane: reference notes (grey, orange outline while active) scroll down to the hit line; pitch
  on a log axis from the references' own 10th–90th percentile dominant frequency, widened by an
  octave each side; the live dominant frequency (same measure as the scorer's) is the orange
  trail, drawn only when the chunk is 10 dB above the count-in floor. `Lane.draw` allocates
  nothing (preallocated trail buffers, colours read once). Checked by reading the code, not by
  a profiler.
- Take length: 0.5 s lead + longest reference call + 1.5 s tail (about 3.2 s for gobble).
- Results: score, rhythm / pitch / tone, overlay of your notes vs. the closest reference's
  notes, one tip from the weakest sub-score (states measured lengths / note counts / semitone
  offset only), Try again, Listen again. Rejected takes show the scorer's reason, no score.
- Best score per call in `localStorage` (`camecallhero.best.<id>`), shown on home cards.
- Tap test (4 clicks, 1 s apart) stores `camecallhero.latencyMs`; used only to shift the
  trail and the overlay. shortcut: it measures speaker + touch delay, not mic input delay;
  scoring does not use it.
- Playwright (fake mic): files built at test time from `gobble-1.wav` and `putt-3.wav`
  (count-in background noise at the clip's own noise floor + clip + tail; written to the
  git-ignored `e2e/.fake-mic/`, not shipped). Gobble take scored 95.6–96.6 (it is one of the
  six references, so this checks the plumbing, not calibration); same-call level (lowest
  leave-one-out, computed in the test) 73.4; putt take 46.5. Also: mic released after the
  take, on Cancel and when leaving during the count-in; locked call never opens the mic;
  permission denied message; tap test stores a latency; 360 px, no horizontal scroll, 44 px
  targets.
- Not verified: anything on a real phone (lane frame rate, trail offset, tap-test values,
  whether a real gobble call from a person or a box call scores like the references).

## Notes
- Live site: https://raineslc.github.io/GameCallHero/ (Pages deploy from `main` works; owner confirmed it loads on their phone).
- Project environment `camecallhero` allows: xeno-canto.org, commons.wikimedia.org,
  upload.wikimedia.org, freesound.org, cdn.freesound.org, www.nps.gov, digitalmedia.fws.gov.
- Wikimedia rate-limits this environment heavily (HTTP 429); expect slow downloads.
- Junk clips for the calibration test are synthesized (`scripts/make-junk-clips.mjs`):
  silence, white noise, wind, claps, pink noise, tone sweep. No speech clip yet.
- Wrong-call negatives: `test/fixtures/turkey-other/putt-*.wav` (Jongsma, CC BY-SA), test-only.
