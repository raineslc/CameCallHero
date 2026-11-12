# Phase 7 — Barred owl reference audio

## Goal
Real wild barred owl (*Strix varia*) recordings for the calls a hunter or birder would
practice, legally usable in the app, with each call defined from a cited source.
Audio and call definitions only: no app code changes (Phase 8 makes the app multi-species).

## Do
1. Pick the calls. Candidates: the 8-note "who cooks for you, who cooks for you-all" hoot,
   single/two-note hoots, the descending "hoo-aww", the caterwaul / "monkey" duet.
   Include a call only if a source says what it is: Cornell (All About Birds, Birds of the
   World), a state wildlife agency, or a peer-reviewed description. Record the source and
   the definition in the manifest (`callDefinitions`). Do not invent facts.
2. Search xeno-canto (website search; the v3 API needs a key) and the other Phase 1 sources.
3. Check every file's license on its own page. Allowed: CC0, CC BY, CC BY-SA, CC BY-NC,
   CC BY-NC-SA, US-government public domain. Never ND, never Macaulay Library, never
   unknown (AGENTS.md "Hard rules").
4. Wild birds only. Reject recordings that used playback unless the page says the recorded
   bird was not responding to it; record "playback used" per clip either way.
5. Target ≥ 3 clips per call from ≥ 2 recordings or recordists where possible.
6. Trim to the call, keep ≥ 0.3 s lead-in for the noise floor, convert to mono 44.1 kHz
   16-bit WAV. No filtering or gain change. Reject clipped originals.
7. Save as `public/audio/barred-owl/<call>-<n>.wav`, with
   `public/audio/barred-owl/manifest.json` in the turkey manifest's format.
8. Classify each clip by measuring it (note count, durations, frequency contour) against
   the cited definition; write the reasoning in the clip's `notes`. Mark uncertain clips.
9. Add every file to `ATTRIBUTION.md`. Extend `test/reference-audio.test.js` to the new folder.

## Done when
- ≥ 3 clips per call, each with license proof in the manifest.
- The test checks the owl manifest: every WAV listed, allowed license, no playback,
  mono 44.1 kHz 16-bit, every call definition cites a source.
- New audio < 15 MB.

## Gate
If a call has fewer than 3 usable clips, still merge what is legal, list the short calls at
the top of `docs/STATUS.md` and tell the orchestrator; Phase 8 keeps those calls locked.
Full stop (no hand-off) only if the two-phrase ("who cooks for you") hoot has fewer than 3 clips.
