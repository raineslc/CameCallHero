// Library home: a species picker, then one compact row per call of the picked species (name,
// one-line meaning, small spectrogram of the first reference clip or a lock badge
// ("Recordings needed" / "Coming soon"), and the best practice score saved on this device).
// The species comes from the route (#/ = wild turkey, #/<species>). Each species links to its
// calling challenge, or shows it as "Coming soon" while no call can be recognized.

import { lockInfo } from '../calls/call';
import { bestId, callHref, DEFAULT_SPECIES, homeHref, SPECIES, speciesById } from '../calls/species';
import { challengeHref, scorableCalls } from '../challenge/rules';
import { loadSpectrogram } from '../library/references';
import { loadBest } from '../practice/storage';
import { showSpectrogram } from '../ui/spectrogram';

export function homeScreen(root: HTMLElement, param = ''): () => void {
  const species = speciesById(param) ?? DEFAULT_SPECIES;
  root.innerHTML = `
    <div class="species-picker" role="group" aria-label="Species">
      ${SPECIES.map(
        (s) =>
          `<a class="species-option" href="${homeHref(s)}" data-species="${s.id}"${s === species ? ' aria-current="true"' : ''}>${s.name}</a>`,
      ).join('')}
    </div>
    <h2>${species.name}</h2>
    ${
      scorableCalls(species).length > 0
        ? `<div class="challenge-cta">
      <p>Who calls best? Record a whole sequence and get rated against wild ${species.nounPlural}.</p>
      <a class="btn primary" href="${challengeHref(species)}">Calling challenge</a>
    </div>`
        : `<div class="challenge-cta" id="challenge-soon">
      <p>Calling challenge: <span class="badge">Coming soon</span></p>
      <p class="muted">It opens once the app can recognize at least one ${species.noun} call.</p>
    </div>`
    }
    <ul class="cards">
      ${species.calls
        .map((c) => {
          const best = c.locked ? null : loadBest(bestId(species, c));
          return `
        <li>
          <a class="card" href="${callHref(species, c)}" data-call="${c.id}">
            <span class="card-text">
              <span class="card-head">
                <span class="card-name">${c.name}</span>
                ${best !== null ? `<span class="card-best">Best: <span class="accent">${best}</span> / 100</span>` : ''}
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
      <p class="muted">Before practicing, check what your phone's microphone does.</p>
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
