# Status

## Owner decision needed — Phase 1 gate failed (stopped, no hand-off)

Only **gobble** has 3+ legally usable clips (6 clips, two males). **Yelp, cut,
purr and kee kee run have 0 usable clips.** Phase 2 has not been started.

Why: of 141 wild turkey recordings on xeno-canto, 135 are NonCommercial and/or
NoDerivatives. The 6 CC BY-SA recordings (all by Jonathon Jongsma) are two gobbling
males and four "nervous/agitated" family groups. Measured on spectrograms, the
agitated ones are mostly putts (single broadband clicks), plus some high juvenile
whistles and pulsed trills I could not tie to one of the five calls with confidence.
Other sources: see "Phase 1 search log" below.

Options (pick one or combine):
1. **Owner field recordings** of real hens/poults (spring, roost or feeding areas),
   phone voice memo is enough to start. You would license them CC0 to the project.
2. **Ask xeno-canto recordists for permission** (NC/ND are not on the allowed
   list, so this needs written permission or a relicense to CC BY / CC BY-SA). Candidates whose own descriptions mention the
   missing calls:
   - Valerie Heemstra — XC767336, XC769323 (clucks, "yelp ending"), CC BY-NC-SA 4.0
   - Paul Driver — XC70534 ("3 birds inc purring"), CC BY-NC-ND 2.5
   - Richard E. Webster — XC700666 (clucks, soft tremulous calls), CC BY-NC-SA 4.0
   - Thomas G. Graves — XC377125 (hen with chicks, clucking), CC BY-NC-SA 4.0
   - Allen T. Chartier — XC30895, XC30896 (clucking), CC BY-NC-SA 3.0
   Jonathon Jongsma (CC BY-SA, already used) may also have unpublished hen recordings.
3. **Proceed with fewer examples**: Phase 2 builds and calibrates the scorer on
   gobble only (rhythm/tone are testable; pitch-shape scoring for yelp and kee kee
   cannot be calibrated without real examples). The other four calls stay locked
   in the app until references exist.
4. Allow more sources in the environment: Freesound (returns 403 to this
   environment), fws.gov (USFWS media now redirects there; blocked by the proxy).
   Unknown whether they hold usable turkey audio.

Reply in the PR or edit this section, then start Phase 1 again (option 1/2/4)
or Phase 2 (option 3).

## Phases

| # | Phase | State | PR |
|---|---|---|---|
| 0 | Bootstrap | done | pushed to `main` (empty repo had no base branch) |
| 1 | Reference audio | partial — gate failed (gobble only) | [#1](https://github.com/raineslc/CameCallHero/pull/1) |
| 2 | Scoring engine | blocked on owner decision | |
| 3 | Mic check | | |
| 4 | Library | | |
| 5 | Practice | | |
| 6 | Feedback release | | |

## Phase 1 search log (2026-11-12)

| Source | Result |
|---|---|
| xeno-canto (website search; API v3 needs a key) | 141 recordings. Licenses: 102 BY-NC-SA 4.0, 12 BY-NC-SA 3.0, 17 BY-NC-ND 2.5, 4 BY-NC-ND 4.0, 5 BY-SA 3.0, 1 BY-SA 4.0. Used: XC136045, XC134155 (gobble). Checked, not used: XC104532, XC104533, XC134744, XC320490 (putts; juvenile whistles at XC104532 ~79–82 s are a possible kee kee candidate but not a full run). |
| Wikimedia Commons | Audio: only mirrors of the same xeno-canto files, plus `Gobbler.ogg` (pdsounds.org "public domain" by user "bod", tagged poultry — not a US-government work and probably domestic: rejected). Videos with possible call audio checked separately (see PR). |
| Freesound | HTTP 403 from this environment; not searched. |
| NPS sound gallery | No turkey recordings listed. |
| USFWS digital media | digitalmedia.fws.gov redirects to fws.gov, which the environment blocks. |

## Notes
- Live site: https://raineslc.github.io/CameCallHero/ (Pages deploy from `main` works; owner confirmed it loads on their phone).
- Project environment `camecallhero` allows: xeno-canto.org, commons.wikimedia.org,
  upload.wikimedia.org, freesound.org, cdn.freesound.org, www.nps.gov, digitalmedia.fws.gov.
- Wikimedia rate-limits this environment heavily (HTTP 429); expect slow downloads.
- Junk clips for the calibration test are synthesized (`scripts/make-junk-clips.mjs`):
  silence, white noise, wind, claps. No speech clip yet.
