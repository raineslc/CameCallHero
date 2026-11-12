// Library home: one compact row per wild turkey call (name, one-line meaning, small
// spectrogram of the first reference clip or a lock badge ("Recordings needed" / "Coming soon"), and the best
// practice score saved on this device).

import { lockInfo, TURKEY_CALLS } from '../calls/turkey';
import { loadSpectrogram } from '../library/references';
import { loadBest } from '../practice/storage';
import { showSpectrogram } from '../ui/spectrogram';

export function homeScreen(root: HTMLElement): () => void {
  root.innerHTML = `
    <h2>Wild turkey</h2>
    <ul class="cards">
      ${TURKEY_CALLS.map((c) => {
        const best = c.locked ? null : loadBest(c.id);
        return `
        <li>
          <a class="card" href="#/call/${c.id}" data-call="${c.id}">
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
      }).join('')}
    </ul>
    <div class="inline-cta">
      <p class="muted">Before practicing, check what your phone's microphone does.</p>
      <a class="btn" href="#/mic">Mic check</a>
    </div>
  `;
  let alive = true;
  for (const c of TURKEY_CALLS) {
    const canvas = root.querySelector<HTMLCanvasElement>(`[data-call="${c.id}"] canvas`);
    if (!canvas || !c.references[0]) continue;
    loadSpectrogram(c.references[0])
      .then((img) => alive && showSpectrogram(canvas, img))
      .catch(() => {
        if (alive) canvas.replaceWith(Object.assign(document.createElement('span'), { className: 'muted', textContent: 'Spectrogram unavailable' }));
      });
  }
  return () => {
    alive = false;
  };
}
