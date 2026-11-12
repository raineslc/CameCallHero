# Phase 3 — Mic check screen

## Goal
Prove the microphone path on a real phone and show the owner what their phone does.

## Do
- `src/audio/capture.ts`: `getUserMedia` with `echoCancellation`, `noiseSuppression`,
  `autoGainControl` all `false`, mono; AudioWorklet that hands PCM chunks to the
  app; `stop()` that releases the track and closes the AudioContext.
- Screen "Mic check": live level meter, clipping warning, measured noise floor,
  table of requested vs. actual `track.getSettings()`, sample rate.
- "Record 5 s" → shows the take's spectrogram and offers a WAV download, so the
  owner can send real phone takes back for tuning.
- Clear messages for: permission denied, no mic, insecure context.
- Simple hash routing (`#/mic`) added to the app shell.

## Done when
- Playwright test in CI using Chromium fake mic
  (`--use-fake-ui-for-media-stream --use-fake-device-for-media-stream
  --use-file-for-fake-audio-capture=<wav>`) shows a level above zero and
  finishes a 5 s recording.
- Leaving the screen stops the mic (test checks track `readyState === "ended"`).

## Owner action (do not block on it)
Add to STATUS.md: "Open the Pages link on your Android phone → Mic check →
send a screenshot of the settings table and one WAV of each call you can make."
Continue to the hand-off.
