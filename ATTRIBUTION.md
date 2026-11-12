# Attribution

Audio used in CameCallHero. Machine-readable source of truth:
`public/audio/turkey/manifest.json` (trim times, quality notes),
`test/fixtures/junk/manifest.json` and `test/fixtures/phone/manifest.json`.

## Wild turkey reference recordings

All clips were trimmed from the original and converted to mono 44.1 kHz 16-bit
WAV (the stereo XC779658 and XC779655 originals: channels averaged). No filtering or gain change. Clips are
shared under the same license as the original (CC BY-SA and CC BY-NC-SA require this).
NonCommercial (NC) clips may only be used non-commercially; CameCallHero is free, with
no ads, purchases or donations.

| File | Call | Original | Recordist | License |
|---|---|---|---|---|
| `public/audio/turkey/gobble-1.wav` | gobble | [XC136045](https://xeno-canto.org/136045), 2.15–4.08 s | Jonathon Jongsma | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `public/audio/turkey/gobble-2.wav` | gobble | [XC136045](https://xeno-canto.org/136045), 118.49–120.43 s | Jonathon Jongsma | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `public/audio/turkey/gobble-3.wav` | gobble | [XC136045](https://xeno-canto.org/136045), 149.33–151.26 s | Jonathon Jongsma | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `public/audio/turkey/gobble-4.wav` | gobble | [XC134155](https://xeno-canto.org/134155), 185.16–187.21 s | Jonathon Jongsma | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `public/audio/turkey/gobble-5.wav` | gobble | [XC134155](https://xeno-canto.org/134155), 220.73–222.78 s | Jonathon Jongsma | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `public/audio/turkey/gobble-6.wav` | gobble | [XC134155](https://xeno-canto.org/134155), 250.73–252.73 s | Jonathon Jongsma | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `public/audio/turkey/yelp-1.wav` | yelp | [XC779658](https://xeno-canto.org/779658), 63.03–66.55 s | Richard E. Webster | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) |
| `public/audio/turkey/yelp-2.wav` | yelp | [XC779658](https://xeno-canto.org/779658), 14.10–17.45 s | Richard E. Webster | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) |
| `public/audio/turkey/yelp-3.wav` | yelp | [XC779658](https://xeno-canto.org/779658), 0.35–3.25 s | Richard E. Webster | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) |
| `public/audio/turkey/kee-kee-run-1.wav` | kee kee run | [XC614092](https://xeno-canto.org/614092), 62.15–67.08 s | Richard E. Webster | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) |
| `public/audio/turkey/kee-kee-run-2.wav` | kee kee run | [XC614092](https://xeno-canto.org/614092), 96.95–101.28 s | Richard E. Webster | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) |
| `public/audio/turkey/kee-kee-run-3.wav` | kee kee run | [XC779655](https://xeno-canto.org/779655), 70.05–75.62 s | Richard E. Webster | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) |
| `public/audio/turkey/kee-kee-run-4.wav` | kee kee run | [XC779655](https://xeno-canto.org/779655), 85.70–89.85 s | Richard E. Webster | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) |

Citation form requested by xeno-canto: "Jonathon Jongsma, XC136045. Accessible at
www.xeno-canto.org/136045." (same for XC134155).
Same form for the others, e.g. "Richard E. Webster, XC779658. Accessible at
www.xeno-canto.org/779658." (also XC779655, XC614092).

Yelp and kee kee run were classified by measurement (notes in the manifest), not
confirmed by the recordists or an expert.

## Test fixtures

`test/fixtures/junk/*.wav` (silence, white noise, wind, claps, pink noise, tone
sweep) are synthesized by `scripts/make-junk-clips.mjs`. Not recordings. Released under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

`test/fixtures/turkey-other/*.wav` are non-gobble wild turkey sounds (short
putt-like clicks) used only as wrong-call negatives in the calibration test; not
shipped in the app. Trimmed from the original and converted to mono 44.1 kHz 16-bit
WAV (the 48 kHz originals were resampled). No filtering or gain change. Shared under
the same license as the original. Details: `test/fixtures/turkey-other/manifest.json`.

| File | Original | Recordist | License |
|---|---|---|---|
| `test/fixtures/turkey-other/putt-1.wav` | [XC104532](https://xeno-canto.org/104532), 25.8–27.8 s | Jonathon Jongsma | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `test/fixtures/turkey-other/putt-2.wav` | [XC104533](https://xeno-canto.org/104533), 15.1–17.1 s | Jonathon Jongsma | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `test/fixtures/turkey-other/putt-3.wav` | [XC134744](https://xeno-canto.org/134744), 4.5–6.5 s | Jonathon Jongsma | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `test/fixtures/turkey-other/putt-4.wav` | [XC320490](https://xeno-canto.org/320490), 32.6–35.2 s | Jonathon Jongsma | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

Citation form requested by xeno-canto: "Jonathon Jongsma, XC104532. Accessible at
www.xeno-canto.org/104532." (same for the other numbers).

`test/fixtures/phone/*.wav` are real phone takes by the project owner, recorded with the
Mic check screen and committed unedited (mono 48 kHz 16-bit). Human practice calls, not
turkey recordings; test-only, not shipped in the app. Released under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
Details: `test/fixtures/phone/manifest.json`.

| File | What | Recorded by | License |
|---|---|---|---|
| `test/fixtures/phone/yelp-mouth-1.wav` | yelp, mouth call, Android phone, 2026-11-12 | project owner | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
