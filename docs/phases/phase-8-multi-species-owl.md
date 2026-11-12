# Phase 8 — Multi-species: barred owl

## Goal
The app handles species → calls instead of wild turkey only, and the barred owl calls from
Phase 7 are added, each unlocked only if it passes calibration. Turkey behaviour and scores
stay exactly as they are.

## Do
1. Generalize the turkey-only code:
   - `src/calls/turkey.ts` and `TurkeyCallId` → a species list, each species with its calls
     (e.g. `src/calls/species.ts`, `src/calls/turkey.ts`, `src/calls/barred-owl.ts`).
     Call ids stay unique per species; turkey ids keep their current values.
   - Audio paths and manifests per species: `public/audio/<species>/manifest.json`
     (`src/library/references.ts` loads the manifest of the call's species).
   - Routes carry the species: e.g. `#/<species>/call/<id>` and `#/<species>/practice/<id>`.
     Old turkey links (`#/call/<id>`, `#/practice/<id>`) keep working (redirect).
   - Saved best scores: keep existing turkey keys readable so no saved score is lost.
   - Home, library (call page) and practice screens: no "turkey" text for owl calls (headings,
     "Play turkey", "the turkey's notes", "When turkeys use it", aria labels).
2. Species picker on home: wild turkey and barred owl, ≥ 44 px targets, theme tokens only.
3. Barred owl calls from `public/audio/barred-owl/manifest.json` (`callDefinitions`):
   two-phrase hoot, ascending hoot, inspection call, caterwaul. Descriptions on screen come
   from the cited sources there. Those were read through search excerpts (see `readVia`):
   re-read the sources directly before showing the text, or keep the `shortcut:` comment.
4. Calibrate each owl call with the same rules as Phase 2/2b (`test/calibration.test.ts`):
   - leave-one-out over the call's references, margin ≥ 15 points over every negative;
   - negatives: the other owl calls, turkey calls, and the junk clips
     (`test/fixtures/junk`); add owl wrong-call fixtures if needed, same license rules;
   - cross-call confusion matrix over the owl calls, printed in the test output and the PR;
   - tune features/weights, not the margin; changing the margin needs a written reason.
   A call that fails stays locked with a reason on screen (like kee kee run). The caterwaul
   is a two-bird duet and its clips are marked uncertain: expect it to stay locked.
5. Owl hoots sit at ~0.35–0.75 kHz, lower than turkey calls: check that the scorer's
   frequency range, note segmentation and quiet-light thresholds still work there, and
   that clips with very low level (two-phrase-hoot-3/4, peak ~-33 dBFS) are not rejected
   as "too quiet" when used as references.

## Done when
- All existing tests pass unchanged (turkey calibration numbers and scores identical).
- Owl calibration test runs; each owl call is unlocked only if it passes.
- New unit tests for anything new in scoring; e2e covers the species picker and one owl
  call page on 360 px.
- `npm ci && npm test && npm run build` pass; STATUS.md updated with the owl matrix.

## Gate
If no owl call passes calibration, merge the multi-species code with all owl calls locked,
write the numbers in STATUS.md, and stop (no hand-off).
