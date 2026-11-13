# Phase 12 — Elk

## Goal
Add elk (*Cervus canadensis*) as a species in one phase: reference audio (as Phase 7 did for the
barred owl), the species and its calls in the app (Phase 8), and calibration of each call with the
same rules (Phases 8/8b). Turkey and owl behaviour, scores and storage keys stay unchanged.

## Do
1. **Calls.** Candidates: bull bugle, bull grunt / chuckle / glug, cow mew / chirp, estrus cow,
   calf call. Include a call only if a source says what it is: Rocky Mountain Elk Foundation, the
   National Park Service, a state wildlife agency, or a peer-reviewed description. Record the source
   and the definition in the manifest (`callDefinitions`) and cite it in `src/calls/elk.ts`. Do not
   invent facts (e.g. when elk use a call, if no source says so).
2. **References.** Elk are mammals; bird archives may not cover them. Search, in order:
   NPS sound libraries on www.nps.gov (Yellowstone, Rocky Mountain National Park, the NPS Natural
   Sounds gallery); xeno-canto (check whether it accepts mammals); any other source the environment
   reaches. License rules as AGENTS.md: CC0, CC BY, CC BY-SA, CC BY-NC, CC BY-NC-SA or US-government
   public domain, checked on each file's own page (for NPS: the library page must say the files are
   public domain; files credited to a third party are left out). Never ND, never Macaulay.
   Wild animals only: no recordings of people using elk calls; record playback per clip as the page
   states it (`playbackUsed`: true / false / null for "not stated"); reject `true`.
3. **Clips.** Target ≥ 3 clips per call, from ≥ 2 recordings where possible. Trim to the call, keep
   ≥ 0.3 s lead-in where the recording has it (say so in `notes` when not), mono 44.1 kHz 16-bit WAV
   (bugles reach above 2 kHz with harmonics). No filtering or gain change. Reject clipped originals.
   Save `public/audio/elk/<call>-<n>.wav` + `manifest.json` (owl manifest format) and list every
   file in `ATTRIBUTION.md`. Extend `test/reference-audio.test.js` to the folder.
4. **Classify** each clip by measuring it against the cited definition; write the reasoning in
   `notes`; mark uncertain clips.
5. **App.** `src/calls/elk.ts` (calls, descriptions with sources, an analysis band measured from the
   references), added to `src/calls/species.ts`. Routes, best-score keys
   (`camecallhero.best.elk.<call>`) and on-screen nouns come from the species, as for the owl.
6. **Calibrate** (`test/calibration-elk.test.ts`), same rules as Phases 2/8: leave-one-out over the
   call's references, margin ≥ 15 over every negative (other elk calls, all turkey and barred owl
   references, turkey wrong-call fixtures, junk clips), all analyzed in the elk band; matrix rule
   (lowest same-call score − highest other-elk-call score ≥ 15); elk confusion matrix printed.
   Margin unchanged; tune band / weights / features, never the margin or the negatives. A call that
   fails stays locked with a reason on screen; record margins and what was tried in STATUS.md.

## Done when
- Each included call has ≥ 3 legal clips with license proof in the manifest; new audio < 15 MB.
- License test covers the elk manifest (allowed license, no playback, mono 44.1 kHz 16-bit, every
  call definition cites a source).
- Elk calibration test runs; each elk call is unlocked only if it passes.
- Turkey and owl calibration output and scores unchanged; existing storage keys unchanged.
- `npm ci && npm test && npm run build` pass; a11y e2e covers the elk screens at 360 px.
- `docs/STATUS.md` updated (clips per call, margins, unlocked calls, owner checks).

## Gate
If no elk call reaches 3 legal clips, do not add the species: merge only a STATUS.md note listing
the sources checked and the options (hosts to allow, recordists to ask), and tell the orchestrator.
If clips exist but no call passes calibration, add the species with every call locked and stop.
