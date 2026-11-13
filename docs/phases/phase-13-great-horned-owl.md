# Phase 13 — Great horned owl

## Goal
Add the great horned owl (*Bubo virginianus*) as a species in one phase: cited call
definitions, wild reference recordings, and the app, with each call unlocked only if it passes
calibration. Phases 7, 8 and 8b did this for the barred owl; follow them. Turkey and barred owl
behaviour, scores and storage keys stay exactly as they are.

## Do
1. **Calls.** Hunters hoot like a great horned owl to make turkeys gobble (locator call);
   birders know the territorial hoot series, which differs between male and female, plus
   barks and screams. Include a call only if a source says what it is: Cornell (All About
   Birds, Birds of the World), a state wildlife agency, or a peer-reviewed description. Record
   the source and definition in the manifest (`callDefinitions`). If the source hosts are
   blocked, read via search excerpts, say so in `readVia`, and keep a `shortcut:` comment on the
   app text. Do not invent facts.
2. **References** per `phase-1-reference-audio.md` and AGENTS.md: xeno-canto first. Check every
   license on the recording's own page (never ND, never Macaulay). Wild birds only: reject
   playback recordings unless the page says the bird was not responding; record `playbackUsed`
   per clip. Target ≥ 3 clips per call from ≥ 2 recordists. Trim to the call with ≥ 0.3 s
   lead-in, mono 44.1 kHz 16-bit WAV, no filtering or gain change, no clipped samples.
   Save `public/audio/great-horned-owl/<call>-<n>.wav` + `manifest.json` (barred owl format) and
   list every file in `ATTRIBUTION.md`. Extend `test/reference-audio.test.js` to the folder.
3. **Classify by measurement** (note count, durations, pitch) against the cited definition and
   the recordist's sex label; write the reasoning per clip in `notes`; mark uncertain clips.
4. **App.** Add the species to `src/calls/species.ts` (`src/calls/great-horned-owl.ts`), reuse
   the owl band if the measurements support it. Picker, routes, call pages, practice and best
   scores come from the species list; best-score keys `camecallhero.best.great-horned-owl.<call>`.
5. **Calibrate** with the same rules as Phase 8/8b (`test/calibration-great-horned-owl.test.ts`):
   leave-one-out, margin ≥ 15 unchanged, matrix rule over the great horned owl calls; negatives:
   the other great horned owl calls, every barred owl clip (other-species negatives), turkey
   references, turkey wrong-call fixtures, junk. Tune features/weights, never the margin or the
   negatives. A failing call stays locked with a reason on screen.

## Done when
- ≥ 3 clips for each included call, each with license proof in the manifest; audio < 15 MB.
- The reference-audio test covers the new manifest (license, no playback, format, sources).
- Calibration test runs; each call unlocked only if it passes; margins and attempts in STATUS.md.
- Turkey and barred owl calibration output unchanged; existing unit and e2e tests pass; e2e a11y
  covers the new screens at 360 px.
- `npm ci && npm test && npm run build` pass.

## Gate
If no call reaches 3 legal clips, merge only a STATUS.md note and tell the orchestrator.
If no call passes calibration, merge the species with all calls locked and report the numbers.
