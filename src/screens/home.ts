// Library home: a species picker, then one compact row per call of the picked species (name,
// one-line meaning, small spectrogram of the first reference clip or a lock badge
// ("Recordings needed" / "Coming soon"), and the best practice score saved on this device).
// The species comes from the route (#/ = wild turkey, #/<species>). Each species links to its
// calling challenge, or shows it as "Coming soon" while no call can be recognized.
// A first-time visitor (no best score saved yet) gets one line on what to do; a line under the
// species name says how many calls can be practiced, and locked calls that can still be
// listened to say so.

import { lockInfo } from '../calls/call';
import { playableClips } from '../calls/listen';
import { bestId, callHref, DEFAULT_SPECIES, homeHref, SPECIES, speciesById } from '../calls/species';
import { challengeHref, scorableCalls } from '../challenge/rules';
import { loadSpectrogram } from '../library/references';
import { loadBest } from '../practice/storage';
import { showSpectrogram } from '../ui/spectrogram';

export function homeScreen(root: HTMLElement, param = ''): () => void {
  const species = speciesById(param) ?? DEFAULT_SPECIES;
  const firstVisit = !SPECIES.some((s) => s.calls.some((c) => !c.locked && loadBest(bestId(s, c)) !== null));
  const ready = species.calls.filter((c) => !c.locked).length;
  const listenOnly = species.calls.filter((c) => c.locked && playableClips(species, c).length > 0).length;
  const count = (n: number) => `${n} ${n === 1 ? 'call' : 'calls'}`;
  const summary =
    (ready > 0 ? `${ready} of ${count(species.calls.length)} ready to practice.` : 'No calls to practice yet.') +
    (listenOnly > 0 ? ` ${ready > 0 ? `${listenOnly} more` : count(listenOnly)} to listen to.` : '');
  root.innerHTML = `
    ${firstVisit ? `<p class="first-run" id="home-intro">Listen to a real call, then call into your phone for a score.</p>` : ''}
    <div class="species-picker" role="group" aria-label="Species">
      ${SPECIES.map(
        (s) =>
          `<a class="species-option" href="${homeHref(s)}" data-species="${s.id}"${s === species ? ' aria-current="true"' : ''}>${s.name}</a>`,
      ).join('')}
    </div>
    <div class="home-head"><h2>${species.name}</h2><p class="muted" id="home-summary">${summary}</p></div>
    ${
      scorableCalls(species).length > 0
        ? `<div class="challenge-cta">
      <p>Who calls best?</p>
      <a class="btn primary" href="${challengeHref(species)}">Calling challenge</a>
    </div>`
        : `<div class="challenge-cta" id="challenge-soon">
      <p>Calling challenge <span class="badge">Coming soon</span><br><span class="muted">Opens when the app can score a ${species.noun} call.</span></p>
    </div>`
    }
    <ul class="cards">
      ${species.calls
        .map((c) => {
          const best = c.locked ? null : loadBest(bestId(species, c));
          const listen = c.locked && playableClips(species, c).length > 0;
          return `
        <li>
          <a class="card${c.locked ? ' locked' : ''}" href="${callHref(species, c)}" data-call="${c.id}">
            <span class="card-text">
              <span class="card-head">
                <span class="card-name">${c.name}</span>
                ${best !== null ? `<span class="card-best">Best: <span class="accent">${best}</span> / 100</span>` : ''}${listen ? '<span class="card-best accent" role="img" aria-label="Has recordings to listen to">▶</span>' : ''}
              </span>
              <span class="card-meaning">${c.description.meaning}</span>
            </span>
            ${
              c.locked
                ? `<span class="badge card-side">${lockInfo(c).label}</span>`
                : `<canvas class="spectrogram thumb card-side" role="img" aria-label="Spectrogram of a ${c.name.toLowerCase()}"></canvas>`
            }
          </a>
        </li>`;
        })
        .join('')}
    </ul>
    <div class="inline-cta">
      <p class="muted">First time? Check that your phone hears your calls well.</p>
      <a class="btn" href="#/mic">Mic check</a>
    </div>
  `;
  let alive = true;
  for (const c of species.calls) {
    const canvas = root.querySelector<HTMLCanvasElement>(`[data-call="${c.id}"] canvas`);
    if (!canvas || !c.references[0]) continue;
    loadSpectrogram(c.references[0], species.band)
      .then((img) => alive && showSpectrogram(canvas, img))
      .catch(() => {
        if (alive) canvas.replaceWith(Object.assign(document.createElement('span'), { className: 'muted', textContent: 'Spectrogram unavailable' }));
      });
  }
  return () => {
    alive = false;
  };
}
