# Phase 15 — Eastern screech-owl

## Goal
Add the eastern screech-owl (*Megascops asio*) as a species in one phase: cited call
definitions, wild reference recordings, and the app, with each call unlocked only if it passes
calibration. Phase 13 (great horned owl) did this; follow it. Turkey, barred owl, elk, mallard
and great horned owl behaviour, scores and storage keys stay exactly as they are.

## Do
1. **Calls.** Candidates: the descending whinny and the monotone trill ("bounce" song,
   tremolo). Include a call only if a source says what it is: Cornell (All About Birds, Birds
   of the World), a state wildlife agency, or a peer-reviewed description. Record the source
   and definition in the manifest (`callDefinitions`). If the source hosts are blocked, read via
   search excerpts, say so in `readVia`, and keep a `shortcut:` comment on the app text. Do not
   invent facts.
2. **References** per `phase-1-reference-audio.md` and AGENTS.md: xeno-canto first. Check every
   license on the recording's own page (never ND, never Macaulay). Wild birds only:
   screech-owl recordings are often responses to playback or to a whistled imitation, so check
   each page and reject those; record `playbackUsed` per clip. Skip recordings the recordist
   filtered or noise-reduced, and two owls overlapping. Target ≥ 3 clips per call from ≥ 2
   recordists. Trim to the call with ≥ 0.3 s lead-in, mono 44.1 kHz 16-bit WAV, no filtering
   or gain change, no clipped samples. Save `public/audio/eastern-screech-owl/<call>-<n>.wav` +
   `manifest.json` (great horned owl format) and list every file in `ATTRIBUTION.md`. Extend
   `test/reference-audio.test.js` to the folder.
3. **Classify by measurement** (duration, pitch at start/middle/end, pulse rate) against the
   cited definition; write the reasoning per clip in `notes`; mark uncertain clips.
4. **App.** Add the species to `src/calls/species.ts` (`src/calls/eastern-screech-owl.ts`); use
   the owl band if the measurements support it. Picker, routes, call pages, practice and best
   scores come from the species list; best-score keys `camecallhero.best.eastern-screech-owl.<call>`.
   Six species in the picker: keep the home screen usable at 360 px.
5. **Calibrate** with the same rules as Phase 13 (`test/calibration-eastern-screech-owl.test.ts`):
   leave-one-out, margin ≥ 15 unchanged, matrix rule over the screech-owl calls; negatives: the
   other screech-owl calls, every barred owl and great horned owl clip, turkey references,
   turkey wrong-call fixtures, junk. Tune features/weights, never the margin or the negatives.
   A failing call stays locked with a reason on screen.
6. **Challenge.** A `CHALLENGE_RULES` entry for each unlocked call, with the values
   `test/challenge.test.ts` prints. Check practice calibration and the challenge test early
   (Phase 11: a call can pass practice and fail the challenge).

## Done when
- ≥ 3 clips for each included call, each with license proof in the manifest; audio < 15 MB.
- The reference-audio test covers the new manifest (license, no playback, format, sources).
- Calibration test runs; each call unlocked only if it passes; margins and attempts in STATUS.md.
- Other species' calibration output unchanged; existing unit and e2e tests pass; e2e a11y
  covers the new screens at 360 px.
- `npm ci && npm test && npm run build` pass.

## Gate
If no call reaches 3 legal clips, merge only a STATUS.md note and tell the orchestrator.
If no call passes calibration, merge the species with all calls locked and report the numbers.
