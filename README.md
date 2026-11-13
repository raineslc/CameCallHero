# Game Call Hero

Practice hunting game calls like a rhythm game: hear a real wild turkey or barred owl, make the call
yourself, and get a score for how close you came. Free test build, Android phones first.

**Try it:** https://raineslc.github.io/GameCallHero/

## What works now — and what does not

- **Gobble and yelp can be practiced.** Gobble is scored against 6 clips of real wild
  gobblers (2 recording sessions by one recordist), yelp against 3 clips from one session,
  so the scorer has a narrow idea of a good call.
- **Cut, purr and kee kee run are listed but locked.** Cut and purr: "Recordings needed" (no
  usable free-licensed recordings found yet). Kee kee run: "Coming soon" (4 clips exist, but
  the scorer cannot yet tell it apart from a yelp).
- **Barred owl: only the hoo-wah can be practiced** (3 clips, 3 recordists). "Who cooks for
  you" and the ascending hoot are "Coming soon" (the scorer cannot yet tell them apart); the
  caterwaul is a two-owl duet and is not practicable. Pick the species at the top of the
  Calls screen.
- **Tested platform: Chrome on Android.** Other browsers and iPhone are untested. Even on
  Android, the automated tests use a simulated microphone; real-phone results are what this
  test round is for.
- No offline mode: the phone needs a connection to load the app.

## How to test on Android

1. Open https://raineslc.github.io/GameCallHero/ in **Chrome**.
2. Optional: Chrome menu (⋮) → **Add to Home screen** (on some phones **Install app**) to get an
   app icon.
3. Tap **Mic check**, then **Start mic** and allow the microphone. Make a call: the level bar
   should move and no clipping warning should show. If it clips, hold the phone further away.
4. Go to **Calls** → **Gobble** → **Practice**. Tap **Listen**, then **I'm ready**, wait for the
   3-2-1 count-in (stay quiet: it measures background noise) and make your call.
5. Read the score and the tip, try a few times, then
   [send feedback](https://github.com/raineslc/GameCallHero/issues/new?template=feedback.yml):
   phone, browser, call device (mouth, box, slate, voice), score, and whether it felt fair.
   A GitHub account is needed to post.

## Contribute turkey recordings

Own a recording of a **live wild turkey** — a hen yelping, cutting or purring, or poults
doing a kee kee run? You can make those calls practicable for everyone:

1. It must be your own recording of a real bird (no hunters' calls, no playback, no domestic birds).
2. You release it as **CC0** (public domain) or **CC BY 4.0** (you are credited by name in
   [ATTRIBUTION.md](ATTRIBUTION.md) and in the app).
3. Open a [recording issue](https://github.com/raineslc/GameCallHero/issues/new?template=recording.yml):
   say which call, hen or poult, state and month, and attach the file (zip it if GitHub refuses
   the file type) or give a download link.

Each recording is checked before use. GitHub issues are public, so the file is too.

## Privacy

Audio never leaves your phone. Recording and scoring happen in the browser; nothing is
uploaded. No analytics, no accounts, no backend. Your best scores and tap-test delay are kept
in the browser's local storage on your phone only.

The app is free and stays free: no ads, no purchases, no donations.

## For developers

```bash
npm ci
npm test        # unit tests (vitest)
npm run build   # typecheck + production build
npm run e2e     # Playwright, simulated mic (run after build)
npm run dev     # local server
```

Progress and known issues: [docs/STATUS.md](docs/STATUS.md). Plan: [docs/PLAN.md](docs/PLAN.md).
Agents working here: read [AGENTS.md](AGENTS.md).

## License and attribution

- **Code:** MIT, see [LICENSE](LICENSE).
- **Audio** (`public/audio/`, `test/fixtures/`): **not** covered by the MIT license.
  Each file keeps its own license (CC BY-SA, CC BY-NC-SA, CC0, ...), listed with its
  recordist in [ATTRIBUTION.md](ATTRIBUTION.md). Some clips are NonCommercial: if you
  reuse this project commercially, replace those clips.
