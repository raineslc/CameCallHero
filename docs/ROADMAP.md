# Roadmap

The owner's plan after Phase 9 (turkey calling challenge). Each phase is one session and one PR,
following `AGENTS.md`. Progress is in `docs/STATUS.md`.

## Approved phases

| # | Phase | Output |
|---|---|---|
| 10 | Calling challenge for every species | `#/<species>/challenge` (turkey keeps `#/challenge`); split gap, recognition thresholds and rank titles per species as data (`src/challenge/rules.ts`), recomputed by the tests; own leaderboard per species; "Coming soon" while a species has no unlocked call |
| 11 | Mallard | Species phase (below) |
| 12 | Elk | Species phase |
| 13 | Great horned owl | Species phase |
| 14 | Wood duck | Species phase |
| 15 | Eastern screech-owl | Species phase |
| 16 | Scoring upgrade for trills, raspy and trending calls | New optional scorer features (pulse rate, raspiness, note level/length trend), default off; every locked call re-calibrated; brief `docs/phases/phase-16-scoring-upgrade.md` |

### What every species phase delivers

1. **Cited call list**: each call's meaning and when the animal uses it, every claim from a cited
   source (no invented facts, `AGENTS.md`).
2. **Free-licensed wild references**: 3+ clips per call where they exist, licence checked on each
   file's own page (CC0, CC-BY, CC-BY-SA, CC-BY-NC, CC-BY-NC-SA, US-government public domain; never
   ND, never Macaulay Library), each listed in `ATTRIBUTION.md`.
3. **Calibration** with the Phase 2/2b/8 rules: leave-one-out over each call's references must beat
   every negative (the species' other calls, the other species' references, the wrong-call and junk
   fixtures) by the same margin (15), analysed in the species' band.
4. **Failing calls locked**: a call that does not pass stays locked, with the reason on screen.
5. **Challenge**: no challenge code. Add the species' entry to `src/challenge/rules.ts`; the values
   come from `test/challenge.test.ts`, which fails and prints them when the entry is missing or wrong.

## Candidate later species (suggested to the owner, not approved)

- White-tailed deer (in the owner's original request: "elk, deer, ducks, owls", `docs/PLAN.md`)
- Canada goose
- Coyote
- American crow
- Moose
- Northern bobwhite

None of these is started until the owner approves it.
