# Attribution

Audio used in CameCallHero. Machine-readable source of truth:
`public/audio/turkey/manifest.json` (trim times, quality notes) and
`test/fixtures/junk/manifest.json`.

## Wild turkey reference recordings

All clips were trimmed from the original and converted to mono 44.1 kHz 16-bit
WAV. No filtering or gain change. Clips are shared under the same license as the
original (CC BY-SA requires this).

| File | Call | Original | Recordist | License |
|---|---|---|---|---|
| `public/audio/turkey/gobble-1.wav` | gobble | [XC136045](https://xeno-canto.org/136045), 2.15–4.08 s | Jonathon Jongsma | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `public/audio/turkey/gobble-2.wav` | gobble | [XC136045](https://xeno-canto.org/136045), 118.49–120.43 s | Jonathon Jongsma | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `public/audio/turkey/gobble-3.wav` | gobble | [XC136045](https://xeno-canto.org/136045), 149.33–151.26 s | Jonathon Jongsma | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `public/audio/turkey/gobble-4.wav` | gobble | [XC134155](https://xeno-canto.org/134155), 185.16–187.21 s | Jonathon Jongsma | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `public/audio/turkey/gobble-5.wav` | gobble | [XC134155](https://xeno-canto.org/134155), 220.73–222.78 s | Jonathon Jongsma | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `public/audio/turkey/gobble-6.wav` | gobble | [XC134155](https://xeno-canto.org/134155), 250.73–252.73 s | Jonathon Jongsma | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |

Citation form requested by xeno-canto: "Jonathon Jongsma, XC136045. Accessible at
www.xeno-canto.org/136045." (same for XC134155).

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
