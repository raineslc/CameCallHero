# Phase 11 — Mallard

## Goal
Add the mallard (*Anas platyrhynchos*) as a species in one phase, doing what Phases 7 + 8 + 8b
did for the barred owl: cited call definitions, legal wild reference clips, the species in the
app, and each call unlocked only if it passes calibration. Turkey and owl behaviour, scores and
storage keys stay exactly as they are.

## Do
1. **Pick the calls** duck hunters practice. Candidates: hen quack, hail/greeting call
   (decrescendo), feed chuckle, comeback call, lonesome hen, drake grunt/"raeb".
   Include a call only if a source says what it is: Cornell (All About Birds, Birds of the
   World), Ducks Unlimited, or a state wildlife agency. Record the source and the definition in
   the manifest (`callDefinitions`); cite it in `src/calls/mallard.ts`. Do not invent facts.
   A hunter's calling pattern with no description of the wild bird's call (so a wild clip
   cannot be classified against it) is left out, with the reason in STATUS.md.
2. **References** per Phase 1/7 and AGENTS.md: xeno-canto and the other Phase 1 sources; check
   every file's license on its own page (CC0, BY, BY-SA, BY-NC, BY-NC-SA, US-gov PD; never ND,
   never Macaulay, never unknown).
3. **Wild birds only.** Mallards hybridise with domestic ducks and live in parks: reject
   recordings whose page says the bird is domestic, farm, captive or fed in a park; note
   anything doubtful in the clip's `notes`. No playback-response recordings (record
   `playbackUsed` per clip; the test requires `false`).
4. ≥ 3 clips per call from ≥ 2 recordings/recordists where possible. Trim to the call, keep
   ≥ 0.3 s lead-in, mono 44.1 kHz 16-bit WAV, no filtering or gain change, reject clipped
   originals. Save `public/audio/mallard/<call>-<n>.wav` + `manifest.json` in the owl format.
5. **Classify by measurement** (note count, durations, level and pitch across notes) against
   the cited definition; write the reasoning in each clip's `notes`; mark uncertain clips.
6. `ATTRIBUTION.md` entries for every file; extend `test/reference-audio.test.js` to the
   mallard folder (no playback, call definitions cite sources, < 15 MB).
7. **App**: `src/calls/mallard.ts` (calls, band measured from the references), registered in
   `src/calls/species.ts`. Screens say "duck"/"ducks", not "turkey" or "owl".
8. **Calibrate** like `test/calibration-owl.test.ts`: leave-one-out, margin 15 unchanged,
   matrix rule over the mallard calls, negatives = other mallard calls, turkey and owl
   references, turkey wrong-call fixtures, junk. Tune weights/band, never the margin; no
   loosening after seeing results. Calls that fail stay locked with the best margin and what
   was tried in STATUS.md.
9. If the Phase 10 challenge for all species is on `main`, check the mallard challenge works.

## Done when
- ≥ 3 clips per included call, each with license proof in the manifest; tests check them.
- Mallard calibration test runs; each mallard call unlocked only if it passes.
- All existing tests pass unchanged (turkey and owl calibration output identical); a11y e2e
  covers the mallard screens.
- `npm ci && npm test && npm run build` pass; STATUS.md updated with clips, margins, matrix,
  and an owner check of the call wording if sources were read only through search excerpts.

## Gate
If no mallard call reaches 3 legal clips, merge nothing except a STATUS.md note and tell the
orchestrator. If clips exist but no call passes calibration, merge the species with all calls
locked and the numbers in STATUS.md.
