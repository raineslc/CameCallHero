# Phase 16 — Scoring upgrade for trills, raspy and trending calls

## Goal
Unlock more locked calls across all species by adding measured features that the species
phases (11 mallard, 12 elk, 13 great horned owl, 14 wood duck, 15 eastern screech-owl) found
missing, instead of one-off per-species fixes. Every currently unlocked call keeps exactly the
scores it has today.

## Do
1. **Features** (each measured on the references; keep only what helps):
   - **Trill / pulse rate**: rate and strength of amplitude modulation inside the call, from a
     fine loudness envelope's autocorrelation, so a trill compares as a trill whether the note
     finder splits it into pulses or not (screech-owl trill and whinny).
   - **Raspiness**: spectral flatness inside notes, measured above each recording's own noise
     (mallard hen quack vs drake raeb; wood duck flush call vs mallard drake and elk).
   - **Note level and length trend** across a call, relative to the call's own loudest and
     longest note, never absolute loudness (mallard hail call: notes fall in level and length).
2. Add each as an optional weight like `structure` (`src/audio/score.ts`). Absent or 0 means the
   scorer runs exactly the code it runs today. Distance-to-score scales are set once, before
   calibration, and not tuned afterwards.
3. **Unit-test** each feature (synthetic signals with known rate, flatness and trend; range
   0–100, never NaN) and prove that every currently unlocked call (turkey yelp and gobble, barred
   owl two-phrase hoot and hoo-wah, great horned owl territorial hoot, elk calf call) scores
   byte-identically with the new code (test plus a diff of calibration and challenge output
   against `main`).
4. **Calibrate every locked call that has clips** (turkey kee kee run; barred owl ascending hoot
   and caterwaul; elk bugle, glug, cow mew; mallard hail call, hen quack, drake raeb; wood duck
   hen flush call and drake whistle; screech-owl monotone trill and whinny. Turkey cut and purr
   have no clips: skipped) with the unchanged rules: margin 15, leave-one-out, matrix rule over
   the species' calls, negatives = every other clip of every species plus the turkey wrong-call
   fixtures and junk, each analysed in the target species' band. Grid over the existing weights
   plus the new ones. Never drop or exclude a reference clip, never loosen a rule after seeing
   results.
5. **Unlock** only a call that passes both the practice calibration and the challenge split
   test (`test/challenge.test.ts`); add its `CHALLENGE_RULES` entry with the printed values.
6. **Practice lane**: raise the pitch axis cap above 8 kHz only if an unlocked call needs it
   (wood duck drake whistle reaches ~9 kHz).
7. Record before/after best margin per locked call in a table in `STATUS.md` and the PR.

## Done when
- New features unit-tested; weight 0 proven byte-identical for every unlocked call.
- Before/after table for every locked call with clips, in STATUS.md and the PR.
- Unlocked calls (if any) pass the species calibration test and the challenge test, and have
  challenge rules; all other calls stay locked with their reason on screen.
- `npm ci && npm test && npm run build` pass; e2e pass.

## Gate
If no call passes, merge the features with weight 0 everywhere (no behaviour change), the
measurements and the table, and report the numbers.
