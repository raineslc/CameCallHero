# Phase 5 — Practice screen (the game)

## Goal
Guitar-Hero-style practice of one call, scored by the Phase 2 engine.

## Do
- Flow: Listen (plays a reference) → Ready (measures noise floor in a 3-2-1
  count-in) → Perform (silent lane, mic recording) → Results.
- Lane: reference notes scroll toward a hit line; time vertical, pitch
  horizontal; the user's live dominant frequency drawn as a hunter-orange trail.
  No reference audio plays while recording.
- One-time latency calibration (tap along to 4 clicks) stored in `localStorage`;
  wrap storage in try/catch.
- Results: total score, three sub-scores, overlay of user notes vs. reference
  notes, one plain tip from the weakest sub-score, "Try again".
- Rejected takes (clipped, too quiet, too noisy) show the reason and are not scored.
- Best score per call saved on device and shown on library cards.

## Done when
- Playwright with fake mic fed a reference WAV scores ≥ the engine's same-call
  level; fed a wrong call, scores lower.
- Mic released on leaving the screen.
- 60 fps target on the lane: no allocation per animation frame in the draw loop.
