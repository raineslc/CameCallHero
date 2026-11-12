# Phase 1 — Reference audio

## Goal
Real wild turkey recordings for the five calls, legally usable in the app.

## Do
1. Search sources reachable from the project environment:
   xeno-canto.org (API v3; species *Meleagris gallopavo*), Wikimedia Commons,
   Freesound, NPS sound gallery (www.nps.gov), USFWS digital media (digitalmedia.fws.gov).
2. Check every file's license on its own page. Allowed: CC0, CC-BY, CC-BY-SA,
   CC-BY-NC, CC-BY-NC-SA, US-government public domain. Reject ND,
   "all rights reserved", unknown. (NC allowed since 2026-11-12; see AGENTS.md.)
3. Prefer real birds. Recordings of a human using a call are **not** references —
   reject them unless the page clearly says it is a live bird.
4. Listen-check by analysis: trim to the call, cut long silence, keep ≥ 0.3 s
   of lead-in for the noise floor. Convert to mono 44.1 kHz 16-bit WAV
   (ffmpeg if installed; otherwise a small Node script).
5. Save as `public/audio/turkey/<call>-<n>.wav` (`yelp-1.wav`, `kee-kee-run-2.wav`, ...).
6. `public/audio/turkey/manifest.json`: per file — call, source URL, author,
   license, license URL, trim start/end in the original, notes on quality.
7. `ATTRIBUTION.md` at repo root: human-readable list from the manifest.
8. Collect 3–5 junk clips for the calibration test (speech, clap, wind, silence)
   under the same license rules — or synthesize them (silence, white noise,
   claps from code) and say so.

## Done when
- ≥ 3 clips per call, each with license proof in the manifest.
- A test checks the manifest: every WAV listed, every entry has an allowed license.
- Total audio < 15 MB.

## Gate
If any call has fewer than 3 usable clips, still merge what is legal, then
**stop** (no hand-off). At the top of `docs/STATUS.md` write which calls are
short and options: owner field recordings, asking recordists for permission
(name them), or proceeding with fewer examples.

Note: classifying a clip as "yelp" vs "cut" etc. from the recordist's label
can be wrong. Record your own reasoning per clip in the manifest `notes`.
