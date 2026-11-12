// Library home: one card per wild turkey call (name, meaning, small spectrogram of the
// first reference clip, or "Recordings needed" when the call has none yet), and the best
// practice score saved on this device.

import { TURKEY_CALLS } from '../calls/turkey';
import { loadSpectrogram } from '../library/references';
import { loadBest } from '../practice/storage';
import { showSpectrogram } from '../ui/spectrogram';

export function homeScreen(root: HTMLElement): () => void {
  root.innerHTML = `
    <h2>Wild turkey</h2>
    <ul class="cards">
      ${TURKEY_CALLS.map(
        (c) => `
        <li>
          <a class="card" href="#/call/${c.id}" data-call="${c.id}">
            <span class="card-name">${c.name}</span>
            <span class="card-meaning">${c.description.meaning}</span>
            ${
              c.locked
                ? '<span class="badge">Recordings needed</span>'
                : `<canvas class="spectrogram small" role="img" aria-label="Spectrogram of a ${c.name.toLowerCase()}"></canvas>`
            }
            ${!c.locked && loadBest(c.id) !== null ? `<span class="card-best">Best: <span class="accent">${loadBest(c.id)}</span> / 100</span>` : ''}
          </a>
        </li>`,
      ).join('')}
    </ul>
    <p class="muted">Before practicing, check what your phone's microphone does:</p>
    <a class="btn" href="#/mic">Mic check</a>
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
