# Status

## Owner action needed
- Enable Codex code review for this repo (Codex settings → Code review →
  turn on for `raineslc/CameCallHero`, and turn on **Automatic reviews**).
  Until then agents fall back to commenting `@codex review`, which also needs
  the Codex GitHub app installed on the repo.
- Turn on GitHub Pages: repo Settings → Pages → Source: **GitHub Actions**.
  (Agents cannot do this through the session proxy.) Until then the `deploy`
  job on `main` fails; PR checks are unaffected.

## Phases

| # | Phase | State | PR |
|---|---|---|---|
| 0 | Bootstrap | done | pushed to `main` (empty repo had no base branch) |
| 1 | Reference audio | next | |
| 2 | Scoring engine | | |
| 3 | Mic check | | |
| 4 | Library | | |
| 5 | Practice | | |
| 6 | Feedback release | | |

## Notes
- Live site: https://raineslc.github.io/CameCallHero/ (after the first Pages deploy).
- Project environment `camecallhero` allows: xeno-canto.org, commons.wikimedia.org,
  upload.wikimedia.org, freesound.org, cdn.freesound.org, www.nps.gov, digitalmedia.fws.gov.
