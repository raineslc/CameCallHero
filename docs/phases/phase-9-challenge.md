# Phase 9 — Turkey calling challenge

## Goal
Owner request: "Gamify it. Hunters like to see who can call the best: do your best turkey
call and rate it based on calls heard in the wild. It can be a whole sequence of calls, not
just the yelp."

Owner decisions: competition is a **pass-the-phone leaderboard on the device + a shared score
card image**. No server, no accounts, no audio leaves the phone (AGENTS.md rules stand).
An AI wild-bird recognizer (BirdNET) is researched in a separate session: do NOT add it here,
but design the result so an optional extra rating can be added later (one clearly named hook,
no unused code).

## Do
1. **Challenge mode** for wild turkey: entry on the turkey home screen ("Calling challenge").
   Free recording up to 20 s (stop early button), using the existing capture, count-in quiet
   light, loudness meter, clipping/noise gates. No reference playback while recording.
2. **Split the take into calls**: group notes into segments by gaps (measure a gap threshold
   from the reference clips and justify it). Score each segment against every *unlocked*
   turkey call with the existing scorer and pick the best match. A segment counts as
   recognized only if its best score is above a threshold derived from the calibration data
   (above the worst wrong-call/negative score for that call); otherwise "Not recognized".
   Locked calls (cut, purr, kee kee run) cannot be recognized yet: say so plainly.
3. **Challenge score 0–100** with a clear, documented formula (code comment + help text):
   duration-weighted mean of recognized segment scores, reduced by the share of the take that
   was not recognized. No invented bonuses. Stars as on the practice results. Hunting-themed
   rank titles for score bands (rank names only, not claims about turkeys).
4. **Results**: timeline of the take with labelled segments ("Yelp 78", "Gobble 64",
   "Not recognized"), total score, stars, rank title, one plain next step, Play yours.
5. **Pass-the-phone leaderboard**: player name field (trimmed, length-limited, treated as
   text, never HTML), top 10 per device in localStorage with try/catch, date, score;
   clear-leaderboard with confirm.
6. **Share score card**: draw a card on canvas (camo band, Game Call Hero, player name,
   score, stars, rank, call breakdown) and share via the Web Share API with a PNG file when
   supported, else download. Never include audio.

Theme tokens, AA contrast, 44 px targets, compact layout at 360–412 px; a11y e2e must pass.

## Tests
- Unit: segmentation, recognition threshold (recomputed from the calibration fixtures),
  score formula, leaderboard storage (bad/corrupt storage, name cleaning).
- E2E with fake mic: reference yelp + gobble clips concatenated give two recognized segments;
  silence and noise are rejected; a leaderboard entry is saved; share falls back to download
  in headless Chromium.
- 360 px screenshots in the PR: challenge recording, results, leaderboard, score card.

## Done when
- All of the above, `npm ci && npm test && npm run build` and the e2e suite pass.
- STATUS.md updated. When merged, message the parent session with the PR link, a summary and
  what the owner should try. Do not start other work.

## Gate
If the e2e sequence (reference yelp + gobble) cannot be split and recognized as two calls,
stop and report the numbers in STATUS.md instead of merging.
