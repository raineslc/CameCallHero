# Status

## Owner: next steps (Phase 6, feedback release, 2026-11-12)

All six phases are done. Nothing more is planned; the next work depends on your decisions.

1. **Check the release on your phone** (not verified by any test): open
   https://raineslc.github.io/CameCallHero/ in Chrome, ⋮ → Add to Home screen / Install app,
   confirm the orange turkey-track icon appears and the app opens full screen. Do one gobble
   practice take.
2. **Share the link** with testers: https://raineslc.github.io/CameCallHero/ (or the README:
   https://github.com/raineslc/CameCallHero#readme, which has the test steps). Tell them only
   gobble can be practiced and that feedback needs a GitHub account.
3. **Collect issues**: feedback arrives through the "Tester feedback" form
   (`.github/ISSUE_TEMPLATE/feedback.yml`, linked from the README and the app footer); recording
   offers through "Contribute a turkey recording" (`recording.yml`, CC0 or CC BY 4.0 only).
   The forms apply the labels `feedback` and `recording` (both created). Before using a contributed recording: check it is a
   wild bird, classify the call, and add it to `ATTRIBUTION.md` and the manifest.
4. **Decide on Google Play** (not started). Before any app-store release, write to each NC
   recordist (AGENTS.md hard rule). Play also needs a developer account and a privacy
   policy URL. Wrapping the web app (Trusted Web Activity) needs Digital Asset Links and
   probably an offline page (service worker). Not researched in detail.
5. **Open decisions from earlier phases** (below): scoring phase for yelp / kee kee run; cut and
   purr recordings; listening check of the yelp and kee kee run clips.

### Known limits (testers will hit these)

- Only gobble is practicable; references are 6 clips, 2 sessions, 1 recordist.
- Yelp, kee kee run: locked (scorer cannot separate them yet). Cut, purr: no recordings.
- Tested only in Chromium with a simulated mic; on a real phone only the Phase 3 mic check
  was run (owner, Android Chrome). Practice, lane frame rate, tap test and scores of real calls
  on a phone: not verified.
- Noise floor on the owner's phone was high (-39 dBFS); cause unknown.
- Rhythm score ignores per-note spacing (Phase 2 open issue).
- No offline mode (no service worker). Other browsers and iPhone untested.
- Feedback needs a GitHub account; there is no in-app form (no backend by design).

## Phase 6 notes

- README: what it is, link, current limits, Android test steps, recording contributions,
  privacy, developer commands, license and attribution.
- Issue forms: `feedback.yml` (phone, browser, call device, call, score, fair?, notes) and
  `recording.yml` (call, bird, place and month, equipment, license CC0 / CC BY 4.0, credit,
  file, confirmation). Footer "Send feedback" link opens the feedback form.
- Web app manifest (`public/manifest.webmanifest`, standalone, start URL and scope the Pages
  path) and icons 192 / 512 PNG (also maskable; the track stays inside the safe circle), SVG,
  180 px Apple touch icon. Icons drawn by `scripts/make-icons.mjs` from the theme tokens. The
  manifest repeats `--bg` as a literal colour (JSON cannot read CSS tokens).
- `e2e/manifest.e2e.ts`: manifest and every icon load, PNG sizes match, Chromium parses the
  manifest without errors. shortcut: headless Chromium's installability check returns no errors
  even with no manifest, so install itself is not tested; check it on a phone.
- `e2e/a11y.e2e.ts` design pass at 360 px on home, mic check (idle, live, after a take), all five
  call pages, all five practice pages and gobble practice results: text contrast >= 4.5:1
  against the nearest opaque background, no text whose nearest opaque background is `.camo`,
  every link and button >= 44 px tall, no horizontal scroll. A self-test injects bad elements
  to prove the check catches them. Found nothing to fix. Limits: text drawn on canvases (lane,
  spectrograms) and disabled buttons are not checked.
- Playwright: 37 tests, run 3x in a row (1 worker) and 2x with 4 workers: no failures.

## Phase 3 phone result (owner, Android, Chrome, 2026-11-12)

- Settings table: echo cancellation, noise suppression and auto gain all **off** as
  requested; 1 channel; track and AudioContext both 48000 Hz. The phone honoured every request.
- One 5 s take, a yelp made by mouth (owner's words): `test/fixtures/phone/yelp-mouth-1.wav`, CC0 (owner decision).
  Measured with `extractFeatures`: peak -10.6 dBFS (74% of full scale, no clipping),
  noise floor -39.4 dBFS, 12 notes over 3.51 s: one 0.29 s note, then ten notes of
  0.08-0.10 s about 0.3 s apart. Scorer accepts it (about 29 dB above the floor).
  Yelp is still locked (no free-licensed references), so it cannot be scored yet.
- Open: the noise floor is high (CI fake-mic take: -62 dBFS). With auto gain off this is
  real background or mic noise; the cause is not known.
- Still wanted from the owner: one WAV of each other call they can make, named by call.
  Owner recordings are practice takes for tuning, not references (references are wild-turkey recordings, see `docs/PLAN.md`).

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
| 1 | Reference audio | partial — gobble, yelp, kee kee run; cut and purr missing | [#1](https://github.com/raineslc/CameCallHero/pull/1), re-run: [#5](https://github.com/raineslc/CameCallHero/pull/5) |
| 2 | Scoring engine | done — gobble calibrated, other calls locked | [#2](https://github.com/raineslc/CameCallHero/pull/2) |
| 3 | Mic check | done — fake-mic test in CI; real phone not tested | [#3](https://github.com/raineslc/CameCallHero/pull/3) |
| 4 | Library | done — gobble playable; 4 calls listed as "Recordings needed" | [#4](https://github.com/raineslc/CameCallHero/pull/4) |
| 5 | Practice | done — gobble playable; locked calls keep Practice disabled; real phone not tested | [#8](https://github.com/raineslc/CameCallHero/pull/8) |
| 6 | Feedback release | done — README, issue forms, manifest + icons, design pass; install not verified on a phone | [#9](https://github.com/raineslc/CameCallHero/pull/9) |

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

## Phase 5 notes

- Practice at `#/practice/<id>`: Listen (reference clip 1, with spectrogram) → **I'm ready** →
  3-2-1 count-in (noise floor measured, passed to the scorer) → perform against a silent lane →
  Results. The timeline runs on the mic's own sample count; the mic opens per take and is
  released as soon as the take ends (and on Cancel / leaving the screen).
- Lane: reference notes (grey, orange outline while active) scroll down to the hit line; pitch
  on a log axis from the references' own 10th–90th percentile dominant frequency, widened by an
  octave each side; the live dominant frequency (same measure as the scorer's) is the orange
  trail, drawn only when the chunk is 10 dB above the count-in floor. `Lane.draw` allocates
  nothing (preallocated trail buffers, colours read once). Checked by reading the code, not by
  a profiler.
- Take length: 0.5 s lead + longest reference call + 1.5 s tail (about 3.2 s for gobble).
- Results: score, rhythm / pitch / tone, overlay of your notes vs. the closest reference's
  notes, one tip from the weakest sub-score (states measured lengths / note counts / semitone
  offset only), Try again, Listen again. Rejected takes show the scorer's reason, no score.
- Best score per call in `localStorage` (`camecallhero.best.<id>`), shown on home cards.
- Tap test (4 clicks, 1 s apart) stores `camecallhero.latencyMs`; used only to shift the
  trail and the overlay. shortcut: it measures speaker + touch delay, not mic input delay;
  scoring does not use it.
- Playwright (fake mic): files built at test time from `gobble-1.wav` and `putt-3.wav`
  (count-in background noise at the clip's own noise floor + clip + tail; written to the
  git-ignored `e2e/.fake-mic/`, not shipped). Gobble take scored 95.6–96.6 (it is one of the
  six references, so this checks the plumbing, not calibration); same-call level (lowest
  leave-one-out, computed in the test) 73.4; putt take 46.5. Also: mic released after the
  take, on Cancel and when leaving during the count-in; locked call never opens the mic;
  permission denied message; tap test stores a latency; 360 px, no horizontal scroll, 44 px
  targets.
- Not verified: anything on a real phone (lane frame rate, trail offset, tap-test values,
  whether a real gobble call from a person or a box call scores like the references).

## Notes
- Live site: https://raineslc.github.io/CameCallHero/ (Pages deploy from `main` works; owner confirmed it loads on their phone).
- Project environment `camecallhero` allows: xeno-canto.org, commons.wikimedia.org,
  upload.wikimedia.org, freesound.org, cdn.freesound.org, www.nps.gov, digitalmedia.fws.gov.
- Wikimedia rate-limits this environment heavily (HTTP 429); expect slow downloads.
- Junk clips for the calibration test are synthesized (`scripts/make-junk-clips.mjs`):
  silence, white noise, wind, claps, pink noise, tone sweep. No speech clip yet.
- Wrong-call negatives: `test/fixtures/turkey-other/putt-*.wav` (Jongsma, CC BY-SA), test-only.
