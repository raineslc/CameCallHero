# Game Call Hero — Plan

A phone app that teaches hunting game calls the way a rhythm game teaches songs.
Browse an animal's sounds (like Merlin), then practice each one: the app records
your call and scores it against real animal recordings.

**Phase scope:** wild turkey only — yelp, cut, purr, gobble, kee kee run.
Other species (elk, deer, ducks, owls) come after the turkey version is proven.

## Decisions (made with the owner)

| Topic | Decision |
|---|---|
| Delivery | Web app on GitHub Pages. No app-store publishing until feedback is in. |
| Test device | Android, Chrome. |
| Reference audio | Free-licensed recordings only (CC0, CC-BY, CC-BY-SA, CC-BY-NC, CC-BY-NC-SA, US-government public domain). NC allowed since 2026-11-12 because the app stays free; ND never. |
| Money | The app is free and open source: no ads, no purchases, no donations. Code: MIT (`LICENSE`); audio keeps each file's own license (`ATTRIBUTION.md`). |
| Repo | https://github.com/raineslc/CameCallHero — all work goes through it. |
| Review | Codex reviews every PR. Claude agents build and fix. See `AGENTS.md`. |
| Sessions | One phase = one new agent session, to keep context small. |
| Look | Near-black/dark grey base, woodland camo texture, hunter orange accents. |
| Budget | Phase work costs $0. Keep the $50: $25 for a Google Play account later. Apple ($99/yr) does not fit. |

## Stack

Vite + TypeScript, no UI framework, Canvas for visuals, Web Audio API for the
microphone, Vitest for tests. Everything runs on the phone: no backend, no
accounts, no audio uploaded.

## Recording problems and how we handle them

| Problem | Handling |
|---|---|
| Phone voice processing (auto gain, noise suppression, echo cancel) | Request all three off in `getUserMedia`; read back `track.getSettings()`; warn if the phone refused. Browsers do not guarantee it — must be checked on a real phone. |
| Clipping | Detect samples near full scale; ask the user to back off; do not score the take. |
| Background noise, wind | Measure noise floor during the count-in; refuse to score if the call is not clearly above it. |
| Speaker bleed | Listen first, then perform against a silent lane. No playback while recording. |
| Android audio latency | Score after alignment, so latency does not change the score. Live visual gets a one-time tap calibration. |
| Different mics | Normalize level and average spectrum per recording; never score absolute loudness. |
| Bluetooth headsets | Unsupported; built-in mic only. |
| Distant, noisy field references | Several clean examples per call; score against the closest one. |
| Unpitched calls (purr, gobble, raspy yelps) | Score rhythm, pitch shape and tone separately, weighted per call. |

## How a take is scored

1. Split the take into notes by onsets in the loudness envelope.
2. **Rhythm** — note count, lengths, gaps vs. reference (purr: roll rate).
3. **Pitch shape** — dominant frequency over time per note (yelp break, kee kee whistle).
4. **Tone** — log-mel frames compared with dynamic time warping, after normalization.
5. Score 0–100 = weighted mix, weights per call. Sub-scores shown to the user.

**Calibration rule:** real turkey vs. a different real turkey doing the same
call must score clearly above wrong-call, speech, claps and silence. If it does
not, the method is not working — stop and report before building screens.

No reliable published Hz/timing figures were found for these calls; all targets
are measured from the reference recordings.

Rejected: raw waveform matching (breaks on any timing/tone change); bird-ID
neural nets such as BirdNET (answer "which species", not "how good").

## Phases

Each phase is one session and one PR. Details in `docs/phases/`.

| # | Phase | Output |
|---|---|---|
| 0 | Bootstrap | Plan, agent instructions, scaffold, theme, CI, Pages deploy |
| 1 | Reference audio | 3+ free-licensed clips per call, `ATTRIBUTION.md`. **Gate.** |
| 2 | Scoring engine | `src/audio/*`, calibration test that fails the build if scoring is not meaningful |
| 3 | Mic check screen | Level meter, clipping, noise floor, processing readout |
| 4 | Library screen | The five calls: meaning, spectrogram, play, attribution |
| 5 | Practice screen | Scrolling lane, count-in, record, score, best score saved |
| 6 | Feedback release | End-to-end fake-mic test, README, issue template, tester instructions |

Progress is tracked in `docs/STATUS.md`.

## Not in this phase set

Other species, app stores, offline install, accounts, leaderboards, Bluetooth,
iPhone testing.

## Risks

- Free-licensed recordings may not exist for every call (purr, kee kee run most at risk).
- Scoring quality on a real phone cannot be proven by agents; it needs owner recordings.
- Electronic calls are restricted for hunting in some places (not researched). App is a practice tool; the library screen says so.
