# UX review (2026-11-13)

A full pass over every screen and state, judged as a first-time hunter opening the app on a
phone. Screens were captured with Playwright at 360×740, 412×915 and landscape 740×360, with the
fake microphone used to reach the live states (`e2e/ux-shots.e2e.ts`, run with
`UX_SHOTS=<dir> UX_MIC=<default|yelp|noise|sequence>`). The live site
(https://raineslc.github.io/GameCallHero/) was loaded once and serves the current build.

Screenshots: `docs/screenshots/ux/before/` and `docs/screenshots/ux/after/` (same file names).

Not touched, by instruction: scoring and calibration (`src/audio/score.ts`, `src/audio/features.ts`,
the calibration tests) — Phase 16 is changing those in parallel.

## What I found, worst first

1. **Nothing told a first-time user what the app is or what to do.** The home screen opened on a
   species picker and a list of calls, with no line saying "listen, then call into your phone".
   (Matches tester feedback in issue #11.)
2. **Most calls are locked, and a locked call was a dead end.** 15 of the 21 calls across the 7
   species are locked. Opening one showed a reason and a greyed-out Practice button — nothing to do,
   no way on. Two whole species (mallard, eastern screech-owl) had nothing to do at all, although
   the repo holds legally cleared recordings of those calls.
3. **A greyed-out button is the wrong control.** "Practice (disabled)" and "I'm ready (disabled)"
   look tappable and say nothing. The same pattern was on the practice screen of a locked call.
4. **The mic check read like an instrument panel.** dBFS numbers, sample rates and a three-column
   settings table were the first thing on screen; what a hunter needs ("are you loud enough, is it
   quiet enough, can the app score you") was mixed in among them.
5. **A refused take said what was wrong but not what to do.** "Too noisy: the call is not clearly
   louder than the background." — and nothing else.
6. **The practice screen led with a wall of help.** A three-sentence run-on instruction, the
   one-time tap test shown as a prominent box with its own button, and the whole "How it works"
   legend always open — on every take, forever.
7. **After a take you had to scroll past everything to reach Try again.**
8. **Screen changes were silent.** The page title never changed, focus never moved: a screen reader
   user hears nothing after tapping a call, and after a take the results replaced the screen with no
   announcement.
9. **Wording that assumes our vocabulary**: "reference clips", "as the scorer measures 3 reference
   clips", "Reference clips and licenses", "Recorded 5 s at 44100 Hz".
10. **Small things**: the app name in the header was not a link home; the challenge card on the home
    screen took four lines for one sentence; the `<meta>` description and the install manifest still
    said "wild turkey calls" only; no message when JavaScript is off; in landscape the new sticky
    action bar covered a results row (found and fixed in the same pass).

## What I fixed

All in this PR, with before/after screenshots. Every existing unit, e2e and design-audit test still
passes, plus the new ones listed.

| # | Fix | Where |
|---|---|---|
| 1 | First-run line on the home screen ("Listen to a real call, then call into your phone for a score."), shown until a best score is saved | `src/screens/home.ts` |
| 2 | **Locked calls can be listened to** where the recordings allow it: 10 of the 15 locked calls now play their recordings with the spectrogram and full credits, marked "Listen only for now". Mallard and eastern screech-owl are worth opening again | `src/calls/listen.ts`, `src/screens/call-detail.ts`, `test/listen.test.ts`, `e2e/library.e2e.ts` |
| 3 | No more disabled buttons: a locked call offers "Other &lt;species&gt; calls", a locked practice URL offers "Back to &lt;call&gt;" | `src/screens/call-detail.ts`, `src/screens/practice.ts` |
| 4 | Home says how many calls are ready ("2 of 5 calls ready to practice. 1 more to listen to."); locked rows get a grey edge and a ▶ marker when they can be played | `src/screens/home.ts`, `src/styles/theme.css` |
| 5 | Mic check rebuilt as four numbered checks: how loud you are, background noise (with the same green/red light as practice), your phone (one plain sentence instead of the table), test recording with a plain verdict. Every number moved into a collapsed "Technical details" | `src/screens/mic-check.ts`, `src/audio/capture.ts` (`processingSummary`), `test/mic.test.ts`, `e2e/mic-check.e2e.ts` |
| 6 | A refused take now says what to do next, per reason | `src/practice/reject-help.ts`, both record screens, `e2e/practice-noisy.e2e.ts`, `e2e/challenge-noise.e2e.ts` |
| 7 | Practice and challenge open with three numbered steps; the tap test is a collapsed "Optional: timing check"; "How it works" is open on a first visit and folded afterwards and under the results | `src/screens/practice.ts`, `src/screens/challenge.ts` |
| 8 | Try again stays on screen under the results (sticky, and plain scrolling on short/landscape screens) | `src/styles/theme.css` |
| 9 | Every screen sets the page title and moves focus to its heading on navigation; the results sections have a heading that takes focus when a take is scored | `src/router.ts`, both record screens, `e2e/library.e2e.ts` |
| 10 | Plainer wording: "Recordings and credits", "7–10 notes, 2.1–3.0 s long in our 3 recordings", "Loading the turkey recordings…", "Save recording (WAV)", "Recorded 5 seconds.", a mic-permission message that points at the lock icon in the address bar | several files |
| 11 | The app name in the header is a link to all animals; the challenge card on the home screen is one compact row | `src/main.ts`, `src/screens/home.ts`, `src/styles/theme.css` |
| 12 | `<meta name="description">` and the install manifest now name turkey, elk, duck and owl calls; a `<noscript>` message | `index.html`, `public/manifest.webmanifest` |
| 13 | Active state on buttons (`:active`), so a tap is visibly registered outdoors | `src/styles/theme.css` |
| 14 | `ATTRIBUTION.md` intro listed only 5 of the 7 manifests | `ATTRIBUTION.md` |

### Which locked calls can now be listened to

Only clips that the species manifest does **not** mark `uncertain`, so nothing is presented as a
call we are not sure about. `test/listen.test.ts` checks each path exists, is in the manifest, has a
license on the allowed list and an author, and is not uncertain.

Playable: barred owl ascending hoot (5 clips); eastern screech-owl monotone trill (10) and
descending whinny (9); elk bugle (7) and glug (3); mallard quack (6), hail call (8) and drake raeb
(7); wood duck hen flush (9) and drake whistle (4).

Deliberately left silent: turkey cut and purr (no recordings at all); turkey kee kee run (the
manifest says the clips were classified by measurement, not confirmed); barred owl caterwaul and elk
cow mew (manifest notes mark them uncertain); barred owl ascending-hoot-5 (the recordist labels it
as a different call).

## What I did not change, and why

- **Scoring, calibration, lock decisions.** Out of scope for this PR (Phase 16 is on them).
- **Dark-only theme.** Sunlight readability would be better with a light theme, but that is a design
  decision against `AGENTS.md` ("near-black and dark grey base") — owner call, below.
- **The practice lane itself** (block shapes, colours, motion). It is the part a tester complained
  about least and the part most likely to break scoring alignment. `prefers-reduced-motion` is not
  honoured for the lane because the moving lane *is* the exercise; there is no other animation in the
  app to reduce.
- **An unknown route (`#/no-such-page`) silently shows the home screen.** Harmless for a typo, and a
  wrong call id does show "Call not found". Left alone.
- **The 7-species picker taking two rows at 360 px.** Any smaller and the labels do not fit; any
  grouping (birds/mammals) is a content decision.

## Needs the owner

1. **A phone test, on your Android in daylight.** None of this was tested on real hardware: tap
   sizes and contrast pass the automated check (AA, 44 px), but glare, one-handed reach and the
   sticky Try again bar need a real phone. Please run: home → a locked call (mallard hen quack) →
   Play → mic check end to end → one practice take → one challenge take.
2. **Is "Listen only" right for locked calls?** It presents recordings we cannot score. If you would
   rather a locked call stayed closed, say so and I will revert fix #2.
3. **Sunlight / light theme.** Do you want a light (high-contrast) theme for daylight, or a
   brightness note in the app? This changes `AGENTS.md`'s design rule, so it is your call.
4. **Wording check by a hunter.** I wrote plain-English replacements, but I am not a turkey hunter:
   please read the home first-run line, the three practice steps, the four mic-check headings and the
   four refused-take hints (`src/practice/reject-help.ts`). Anything that sounds wrong to a hunter is
   worth changing.
5. **Install on the phone.** "Add to Home Screen" has still never been verified on a device
   (standing item since Phase 6). The manifest description changed in this PR, so it is worth one
   check.
6. **Content only you can provide**: recordings for the turkey cut and purr, and a decision on the
   kee kee run clips (classified by measurement only — should they be listenable?).
7. **Nothing was decided about the uncertain clips.** The mallard hail call, drake raeb, wood duck
   drake whistle and eastern screech-owl whinny each have one clip marked uncertain; those single
   clips stay unplayable. If you want them included, that is a content call.
