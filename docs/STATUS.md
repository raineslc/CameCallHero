# Status

## Owner action (Phase 3, not blocking)

Open the Pages link on your Android phone → **Mic check** → tap **Start mic** → send a
screenshot of the "Phone audio processing" table and one WAV (Record 5 s → Download WAV)
of each call you can make.

## Owner decision (answers the Phase 1 gate)

Proceed with **gobble only**. Only `public/audio/turkey/gobble-*.wav` exist (6 clips,
CC BY-SA). The engine is built for all five calls; yelp, cut, purr and kee kee run are
`locked: true` in `src/calls/turkey.ts` with no references, and the 5x5 cross-call
matrix test activates by itself once 2+ calls have 3+ references.

**Missing references: yelp, cut, purr, kee kee run.** Options for getting them are in
the Phase 1 search log below and in [PR #1](https://github.com/raineslc/CameCallHero/pull/1).

## Phases

| # | Phase | State | PR |
|---|---|---|---|
| 0 | Bootstrap | done | pushed to `main` (empty repo had no base branch) |
| 1 | Reference audio | partial — gate failed (gobble only) | [#1](https://github.com/raineslc/CameCallHero/pull/1) |
| 2 | Scoring engine | done — gobble calibrated, other calls locked | [#2](https://github.com/raineslc/CameCallHero/pull/2) |
| 3 | Mic check | done — fake-mic test in CI; real phone not tested | [#3](https://github.com/raineslc/CameCallHero/pull/3) |
| 4 | Library | done — gobble playable; 4 calls listed as "Recordings needed" | [#4](https://github.com/raineslc/CameCallHero/pull/4) |
| 5 | Practice | | |
| 6 | Feedback release | | |

## Phase 1 search log (2026-11-12)

| Source | Result |
|---|---|
| xeno-canto (website search; API v3 needs a key) | 141 recordings. Licenses: 102 BY-NC-SA 4.0, 12 BY-NC-SA 3.0, 17 BY-NC-ND 2.5, 4 BY-NC-ND 4.0, 5 BY-SA 3.0, 1 BY-SA 4.0. Used: XC136045, XC134155 (gobble). Checked, not used: XC104532, XC104533, XC134744, XC320490 (putts; juvenile whistles at XC104532 ~79–82 s are a possible kee kee candidate but not a full run). |
| Wikimedia Commons | Audio: only mirrors of the same xeno-canto files, plus `Gobbler.ogg` (pdsounds.org "public domain" by user "bod", tagged poultry — not a US-government work and probably domestic: rejected). Videos whose sound track may hold calls were **not checked**: Wikimedia answered every download with HTTP 429 for 30+ min. Candidates: `Wild Turkey (Meleagris gallopavo).webm` (USFWS, public domain), `Wild Turkeys in North bay.webm`, `Wild Turkey Red Hill Valley 1.webm` / `2.webm`, `20260428 wild tom turkey matthaei botanical gardens wm.webm` (all CC BY-SA 4.0). |
| Freesound | HTTP 403 from this environment; not searched. |
| NPS sound gallery | No turkey recordings listed. |
| USFWS digital media | digitalmedia.fws.gov redirects to fws.gov, which the environment blocks. |

## Phase 2 calibration (gobble, leave-one-out)

Same-call score vs. the worst negative (4 putt-like turkey clips, claps, tone sweep,
silence, white/pink noise, wind), required margin 15:

| Take | Same call | Other session only | Worst negative | Margin |
|---|---|---|---|---|
| gobble-1 | 76.8 | 74.1 | putt-3 45.3 | 31.5 |
| gobble-2 | 76.8 | 72.9 | putt-3 44.7 | 32.1 |
| gobble-3 | 73.4 | 69.7 | putt-3 45.3 | 28.1 |
| gobble-4 | 81.5 | 74.1 | putt-3 45.3 | 36.3 |
| gobble-5 | 80.2 | 67.3 | putt-3 45.3 | 35.0 |
| gobble-6 | 81.5 | 70.7 | putt-3 45.3 | 36.3 |

Limits: only two birds/sessions; no speech junk clip; real phone recordings not tested
(needs the owner, Phase 3+). Gobble weights rhythm 1, pitch 0.5, tone 1.5 (equal weights
gave a 18.1 minimum margin before the review fixes).

Open issues (from Codex review of #2, P2):
- Rhythm compares only call length, note count and voiced fraction, not per-note
  lengths and gaps; DTW can also absorb spacing differences. Notes with the same
  totals but different spacing score the same. Fix with per-note alignment once a
  multi-note call (yelp, cut, kee kee run) has references to calibrate against.

## Phase 3 notes

- Mic check at `#/mic`: live level, clipping warning and noise floor (both from the Phase 2
  `extractFeatures` / `checkTake` gates on the last 3 s), requested vs. actual
  `track.getSettings()`, AudioContext sample rate, 5 s take with spectrogram, scorer
  verdict and WAV download.
- Playwright (`npm run e2e`, runs in CI after the build) uses Chromium's fake mic fed with
  `gobble-1.wav`: level above zero, 5 s WAV of the right size, tracks `ended` and
  AudioContext `closed` after leaving the screen; denied / no-mic messages.
- Chromium's fake device reports 2 channels although 1 was requested; the worklet
  down-mixes to mono either way. What real Android phones report is unknown until the
  owner's screenshot.
- Not verified: anything on a real phone (voice processing actually off, sample rate,
  level of a real call, behaviour when another app holds the mic).

## Phase 4 notes

- Home (`#/`) lists the five calls as cards: name, one-line meaning, small spectrogram
  (gobble) or a "Recordings needed" badge (yelp, cut, purr, kee kee run). Mic check stays in
  the nav and as a button on home.
- Call detail (`#/call/<id>`): meaning, when turkeys use it, source links, measured length,
  large spectrogram with playhead, one play button and attribution line per clip (from
  `manifest.json`), Practice button (`#/practice/<id>`, placeholder until Phase 5). Locked
  calls: no play buttons, no measurements, Practice disabled.
- Descriptions cite South Carolina DNR "Wild Turkey sounds" and Oklahoma ODWC "Wild Turkey
  Sounds" (comments in `src/calls/turkey.ts`). Both hosts are blocked from this build
  environment, so the page text was read through web-search excerpts, not loaded directly.
  Owner may want to skim both pages against the wording in the app.
- Gobble length is the scorer's own measurement: 1–2 notes, 0.63–1.15 s over 6 clips.
  The manifest notes describe each clip as one ~0.95 s burst; segmentation splits gobble-3
  in two and measures gobble-2 at 0.63 s. Revisit with the per-note rhythm fix above.
- Spectrograms and features are computed once per clip and kept in memory for the visit.
- Playwright at 360 px: every call page loads, every gobble clip plays with no HTTP error,
  attribution shown, no horizontal scroll, audio paused and source dropped on leaving.
- Not verified: playback on a real phone.

## Notes
- Live site: https://raineslc.github.io/CameCallHero/ (Pages deploy from `main` works; owner confirmed it loads on their phone).
- Project environment `camecallhero` allows: xeno-canto.org, commons.wikimedia.org,
  upload.wikimedia.org, freesound.org, cdn.freesound.org, www.nps.gov, digitalmedia.fws.gov.
- Wikimedia rate-limits this environment heavily (HTTP 429); expect slow downloads.
- Junk clips for the calibration test are synthesized (`scripts/make-junk-clips.mjs`):
  silence, white noise, wind, claps, pink noise, tone sweep. No speech clip yet.
- Wrong-call negatives: `test/fixtures/turkey-other/putt-*.wav` (Jongsma, CC BY-SA), test-only.
