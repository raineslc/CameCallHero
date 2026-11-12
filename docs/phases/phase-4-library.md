# Phase 4 — Library screen

## Goal
Merlin-style browsing: see and hear each turkey call before practicing it.

## Do
- Home lists the five calls as cards (name, one-line meaning, small spectrogram).
- Call detail: what it means and when turkeys use it, how many notes and how
  long (measured from Phase 1 clips, not invented), large spectrogram with a
  playhead, play buttons for each reference clip, attribution line per clip,
  "Practice" button (links to Phase 5 route; placeholder until then).
- Descriptive text: cite a source in a code comment for every factual claim
  (e.g. NWTF, state wildlife agency pages). If you cannot cite it, leave it out.
- Footer note: "Practice tool. Check your state's rules on electronic calls."
- Spectrograms rendered once and cached in memory.

## Done when
- Playwright: every call page loads, every clip plays (no 404), attribution shown.
- Works at 360 px wide without horizontal scroll.
- Colours only from theme tokens.
