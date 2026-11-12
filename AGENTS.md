# Agent instructions — CameCallHero

Read this whole file before doing anything. It applies to every agent:
Claude builder sessions and the Codex PR reviewer.

Project plan: `docs/PLAN.md`. Current progress: `docs/STATUS.md`.
Your phase brief: `docs/phases/phase-N-*.md`.

## Roles

| Agent | Does | Does not |
|---|---|---|
| **Builder** (Claude, one session per phase) | Implements one phase on a branch, opens the PR, fixes review findings, merges, hands off | Work on more than one phase; push to `main` directly |
| **Reviewer** (Codex, GitHub integration) | Reviews every PR against "Review guidelines" below; suggests fixes and improvements | Push commits |

## Builder workflow

1. `git fetch origin main` and branch from it: `phase-N-short-name`.
   GitHub is the source of truth — never rely on files from another session's container.
2. Read `docs/STATUS.md`. If the previous phase is not merged, stop and report.
3. Do the phase brief. Keep the change to what the brief asks.
4. Before every push: `npm ci && npm test && npm run build` all pass.
5. Push and open a PR titled `Phase N: <name>`. Body: what changed, how it was
   verified, anything not verified. Open it **ready for review** (not draft),
   so Codex automatic review triggers.
6. Subscribe to the PR's activity. If no Codex review arrives within ~20 minutes,
   comment `@codex review` once.
7. For each Codex finding: fix it, or reply with the reason it is wrong.
   Push fixes, then request review again with `@codex review`.
   Repeat until no open P0/P1 findings remain (max 3 rounds; then list what is
   left in the PR and stop).
8. **Merge policy** (owner asked agents to proceed without waiting on them):
   squash-merge when CI is green, no P0/P1 Codex findings are open, and the
   phase's "Done when" list is met. Never merge with a failing check.
   Never force-push `main`. The owner can revoke this by editing this section.
9. Update `docs/STATUS.md` in the PR (before merge): phase done, PR link,
   open issues, anything the owner must do.
10. Hand off: start the next phase in a **new** session (`create_session` on
    `https://github.com/raineslc/CameCallHero`, same environment) with the prompt:
    > Read AGENTS.md and docs/STATUS.md in this repo, then do Phase N+1 from docs/phases/.
    If you cannot create sessions, write that prompt as the last line of
    `docs/STATUS.md` and stop.
11. **Stop instead of handing off** if the phase brief's gate fails, or if anything
    needs the owner (a phone test, a decision, a credential). Put the question at
    the top of `docs/STATUS.md`.

## Hard rules

- Reference audio: only CC0, CC-BY, CC-BY-SA or US-government public domain,
  checked on each file's own page. Never NC/ND licenses, never Macaulay Library
  (needs a paid license for apps). Every file listed in `ATTRIBUTION.md`.
- No audio leaves the device. No analytics, no backend, no accounts.
- Do not add a dependency for something under ~30 lines of code.
- Do not put model names, API keys or personal emails in the repo.
- Do not invent facts about turkey calls; measure from reference recordings or
  cite a source.
- Shortcuts with a known limit get a comment: `shortcut: <limit>, <when to upgrade>`.

## Design

Hunting look, phone first (360 px wide up).

- Base: near-black and dark grey (`--bg`, `--surface` in `src/styles/theme.css`).
- Accent: hunter orange (`--accent`) for the primary action, active note, score.
- Texture: woodland camo pattern (`.camo`) on header and section bands only —
  never behind text that must be read.
- Use the CSS tokens; do not hard-code colours.
- Text contrast at least WCAG AA (4.5:1). Touch targets at least 44 px.

## Commands

```bash
npm ci
npm test        # vitest
npm run build   # typecheck + production build
npm run dev     # local server
```

## Review guidelines

For Codex. Report P0/P1 issues; suggestions for clear improvements are welcome
as lower priority.

- **P0** Audio sent off the device; secrets or personal data committed; reference
  audio with a missing or non-allowed license; code that crashes on load.
- **P1** Microphone stream or AudioContext not released when leaving a screen;
  scoring that can be NaN, negative or above 100; scoring on absolute loudness;
  playback while recording; clipping or noise-floor checks bypassed;
  calibration test weakened or skipped to make it pass; missing error handling
  when mic permission is denied or no mic exists; untested new scoring logic.
- **P2** Hard-coded colours instead of theme tokens; text contrast below AA;
  touch targets under 44 px; code or dependencies the phase did not need;
  docs (`STATUS.md`, `ATTRIBUTION.md`) not updated.
