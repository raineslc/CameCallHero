# Status

## Owner action (Phase 3, not blocking)

Open the Pages link on your Android phone → **Mic check** → tap **Start mic** → send a
screenshot of the "Phone audio processing" table and one WAV (Record 5 s → Download WAV)
of each call you can make.

## Phase 1 re-run with NC licenses (2026-11-12) — cut and purr still missing

**Owner decision:** reference audio may now be CC BY-NC or CC BY-NC-SA (never ND), because
the app stays free and open source: no ads, purchases or donations (AGENTS.md "Hard
rules"). Code is MIT (`LICENSE`); audio keeps its own licenses (`ATTRIBUTION.md`).

**New clips** (all Richard E. Webster, CC BY-NC-SA 4.0, Arizona, bird seen, no playback):

| Call | Clips | Sessions | Usable? |
|---|---|---|---|
| yelp | `yelp-1..3` | 1 (XC779658) | yes, 3 clips; all from one session |
| kee kee run | `kee-kee-run-1..4` | 2 (XC614092, XC779655) | yes |
| cut | 0 | | **missing** |
| purr | 0 | | **missing** |

Classified by spectrogram measurement against cited descriptions (manifest `notes`), not by
an expert: **owner, please listen** to the seven files in `public/audio/turkey/` (after
merge also e.g. https://raineslc.github.io/CameCallHero/audio/turkey/yelp-1.wav) and say if
any is wrong. No xeno-canto recordist labels a yelp, cut,
purr or kee kee run; candidates for cut/purr (XC377125, XC700666, XC778473) were not clear
enough to classify.

**Yelp and kee kee run stay `locked`.** Unlocking them with the current scorer
(uncalibrated equal weights) fails the calibration test, so they need scoring work before
the app can use them. Measured with both unlocked (not committed):

| Check | Result (needs >= 15) |
|---|---|
| yelp leave-one-out vs worst negative (putt-4) | yelp-1 3.8, yelp-2 12.5, yelp-3 20.6 |
| kee kee run leave-one-out | passes |
| matrix: kee kee run takes scored as yelp | -5.7 |
| matrix: yelp takes scored as kee kee run | 0.6 |
| matrix: gobble takes scored as yelp | 5.2 |

Likely cause: the open Phase 2 issue below (rhythm ignores per-note spacing), and yelp-like
notes inside every kee kee run.

**Next (owner picks):**
1. A scoring phase to calibrate yelp and kee kee run (per-note rhythm, weights), then unlock.
2. Cut and purr: owner field recordings (CC0), or permission from recordists.
3. Both.

## Earlier decision (Phase 2): proceed with gobble only

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
| 1 | Reference audio | partial — gobble, yelp, kee kee run; cut and purr missing | [#1](https://github.com/raineslc/CameCallHero/pull/1), re-run: this branch `phase-1-nc-references` |
| 2 | Scoring engine | done — gobble calibrated, other calls locked | [#2](https://github.com/raineslc/CameCallHero/pull/2) |
| 3 | Mic check | done — fake-mic test in CI; real phone not tested | [#3](https://github.com/raineslc/CameCallHero/pull/3) |
| 4 | Library | | |
| 5 | Practice | | |
| 6 | Feedback release | | |

## Phase 1 search log (2026-11-12)

| Source | Result |
|---|---|
| xeno-canto (website search; API v3 needs a key) | 141 recordings. Licenses: 102 BY-NC-SA 4.0, 12 BY-NC-SA 3.0, 17 BY-NC-ND 2.5, 4 BY-NC-ND 4.0, 5 BY-SA 3.0, 1 BY-SA 4.0. Used: XC136045, XC134155 (gobble). Checked, not used: XC104532, XC104533, XC134744, XC320490 (putts; juvenile whistles at XC104532 ~79–82 s are a possible kee kee candidate but not a full run). |
| Wikimedia Commons | Audio: only mirrors of the same xeno-canto files, plus `Gobbler.ogg` (pdsounds.org "public domain" by user "bod", tagged poultry — not a US-government work and probably domestic: rejected). Videos whose sound track may hold calls were **not checked**: Wikimedia answered every download with HTTP 429 for 30+ min. Candidates: `Wild Turkey (Meleagris gallopavo).webm` (USFWS, public domain), `Wild Turkeys in North bay.webm`, `Wild Turkey Red Hill Valley 1.webm` / `2.webm`, `20260428 wild tom turkey matthaei botanical gardens wm.webm` (all CC BY-SA 4.0). |
| xeno-canto, NC re-run (2026-11-12) | 120 non-ND recordings downloaded; US/Canada hen and flock recordings checked on spectrograms. Used: XC779658 (yelp), XC614092 and XC779655 (kee kee run). Not used: XC786182 (high whistles, other birds over them), XC1140501 (regular notes without a clear yelp break), XC778473 (descending pulsed notes, unclassified), XC377125 (low repeated notes, unclassified), XC700666 (soft calls masked by stream). Recordings outside the US and Canada skipped (France, Italy, Cyprus, Colombia: introduced or domestic birds; 3 Mexico files not checked). |
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

## Notes
- Live site: https://raineslc.github.io/CameCallHero/ (Pages deploy from `main` works; owner confirmed it loads on their phone).
- Project environment `camecallhero` allows: xeno-canto.org, commons.wikimedia.org,
  upload.wikimedia.org, freesound.org, cdn.freesound.org, www.nps.gov, digitalmedia.fws.gov.
- Wikimedia rate-limits this environment heavily (HTTP 429); expect slow downloads.
- Junk clips for the calibration test are synthesized (`scripts/make-junk-clips.mjs`):
  silence, white noise, wind, claps, pink noise, tone sweep. No speech clip yet.
- Wrong-call negatives: `test/fixtures/turkey-other/putt-*.wav` (Jongsma, CC BY-SA), test-only.
