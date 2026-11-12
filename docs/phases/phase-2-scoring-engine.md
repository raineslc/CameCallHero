# Phase 2 — Scoring engine

## Goal
Given a recorded take (Float32Array, sample rate) and a call type, return a
score 0–100 with rhythm, pitch and tone sub-scores. No UI.

## Do
- `src/audio/features.ts`: RMS envelope, onset/note segmentation, log-mel
  spectrogram, dominant-frequency track, per-recording normalization.
- `src/audio/score.ts`: DTW on mel frames, rhythm compare, pitch-shape compare,
  per-call weights, score vs. each reference clip → best match.
  Also returns `rejected` with a reason (too quiet, clipped, too noisy).
- `src/calls/turkey.ts`: the five calls — id, name, reference files, weights,
  short description fields (filled in Phase 4).
- Tests decode WAVs from `public/audio/turkey/` in Node (write a tiny WAV
  reader; do not add a dependency for it).
- An FFT: write one (radix-2, ~40 lines) or use one small dependency. Justify in the PR.

## Calibration test (required)
`test/calibration.test.ts`, leave-one-out over the reference clips:
- Same call, different clip: score must beat every wrong-call pairing for that
  clip by a clear margin (start at 15 points; record the actual margins).
- Junk clips (silence, noise, speech, claps) score below every same-call pairing.
- Print the 5×5 confusion matrix in the test output and paste it in the PR.

## Done when
- Calibration test passes without loosening it after seeing results — tune
  features/weights, not the threshold. Changing the margin needs a written reason in the PR.
- Score is always finite and within 0–100 (property test with random input).

## Gate
If calibration cannot pass, merge the engine with the failing test marked
`.skip` **and** a STATUS.md entry explaining the numbers, then stop — no hand-off.
