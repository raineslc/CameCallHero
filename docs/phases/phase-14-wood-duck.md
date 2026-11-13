# Phase 14 — Wood duck

## Goal
Add the wood duck (*Aix sponsa*) as a species in one phase, following the Phase 11 mallard
process: cited call definitions, legal wild reference clips, the species in the app, and each
call unlocked only if it passes calibration and the calling challenge rules. Turkey, owl, elk and
mallard behaviour, scores and storage keys stay exactly as they are.

## Do
1. **Pick the calls.** Candidates: hen flushing/alarm "oo-eek" whistle, hen squeal, drake
   whistle ("jeeb"). Include a call only if a source says what it is: Cornell (All About Birds,
   Birds of the World), Ducks Unlimited, or a state wildlife agency. Record the source and the
   definition in the manifest (`callDefinitions`); cite it in `src/calls/wood-duck.ts`. Do not
   invent facts. A candidate no source separates from another call is left out, with the reason
   in STATUS.md.
2. **References** per Phase 1/7 and AGENTS.md: xeno-canto and the other Phase 1 sources; check
   every file's license on its own page (CC0, BY, BY-SA, BY-NC, BY-NC-SA, US-gov PD; never ND,
   never Macaulay, never unknown).
3. **Wild birds only.** Wood ducks are kept in waterfowl collections and have escaped or feral
   populations in Europe: use only recordings from North America (the native range) and
   reject pages that say the bird is escaped, feral, captive, domestic or in a park. No
   playback-response recordings (`playbackUsed` per clip; the test requires `false`).
4. ≥ 3 clips per call from ≥ 2 recordings/recordists where possible. Trim to the call, keep
   ≥ 0.3 s lead-in, mono 44.1 kHz 16-bit WAV, no filtering or gain change, reject clipped
   originals. Save `public/audio/wood-duck/<call>-<n>.wav` + `manifest.json` in the mallard format.
5. **Classify by measurement** (note count, durations, level and pitch across notes) against
   the cited definition; write the reasoning in each clip's `notes`; mark uncertain clips.
6. `ATTRIBUTION.md` entries for every file; extend `test/reference-audio.test.js` to the
   wood duck folder (licenses, no playback, wild-bird note, call definitions cite sources, < 15 MB).
7. **App**: `src/calls/wood-duck.ts` (calls, band measured from the references), registered in
   `src/calls/species.ts`. Screens say "duck"/"ducks".
8. **Calibrate** like `test/calibration-mallard.test.ts`: leave-one-out, margin 15 unchanged,
   matrix rule over the wood duck calls, negatives = other wood duck calls, turkey, owl, elk and
   mallard references, turkey wrong-call fixtures, junk. Tune weights/band, never the margin; no
   loosening after seeing results.
9. **Challenge** (Phase 11 lesson): check early that each call that passes calibration also
   passes `test/challenge.test.ts` (a different call's single note, split out by the challenge,
   must not score as the call). Add the `CHALLENGE_RULES` entry for unlocked calls with the
   values the test prints.

## Done when
- ≥ 3 clips per included call, each with license proof in the manifest; tests check them.
- Wood duck calibration test runs; each call unlocked only if it passes calibration and the
  challenge test.
- All existing tests pass unchanged (other species' calibration output identical); a11y e2e
  covers the wood duck screens.
- `npm ci && npm test && npm run build` pass; STATUS.md updated with clips, margins, matrix,
  and an owner check of the call wording if sources were read only through search excerpts.

## Gate
If no call reaches 3 legal clips, merge nothing except a STATUS.md note and tell the
orchestrator. If clips exist but no call passes, merge the species with all calls locked and
the numbers in STATUS.md.
