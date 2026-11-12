// Call detail, compact: what the call means, how many notes and how long (measured from the
// reference clips), spectrogram with a playhead, then Play and Practice within the first
// screen. When turkeys use it (cited) and the clip list with attribution are collapsible.
// Locked calls (no references) show "Recordings needed".

import type { Features } from '../audio/features';
import { TURKEY_CALLS, type CallDef } from '../calls/turkey';
import {
  assetUrl,
  clipInfo,
  describeMeasure,
  loadFeatures,
  loadManifest,
  loadSpectrogram,
  measure,
  playheadFraction,
  type ClipInfo,
} from '../library/references';
import { showSpectrogram } from '../ui/spectrogram';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children);
  return e;
}

const link = (href: string, text: string) => el('a', { href, textContent: text, rel: 'noopener', target: '_blank' });

function attribution(info: ClipInfo | undefined): HTMLElement {
  if (!info) return el('p', { className: 'error', textContent: 'Attribution missing for this clip.' });
  return el(
    'p',
    { className: 'attribution muted' },
    `${info.author}, `,
    link(info.sourceUrl, `xeno-canto ${info.sourceId}`),
    ` (${info.trimStartSec.toFixed(2)}–${info.trimEndSec.toFixed(2)} s, trimmed), `,
    link(info.licenseUrl, info.license),
  );
}

function sourcesLine(call: CallDef): HTMLElement {
  const p = el('p', { className: 'sources muted' }, 'Source: ');
  call.sources.forEach((s, i) => p.append(...(i ? ['; '] : []), link(s.url, s.title)));
  return p;
}

function notFound(root: HTMLElement): void {
  root.replaceChildren(el('h2', { textContent: 'Call not found' }), el('a', { className: 'btn', href: '#/', textContent: 'Back to calls' }));
}

export function callDetailScreen(root: HTMLElement, id: string): (() => void) | void {
  const call = TURKEY_CALLS.find((c) => c.id === id);
  if (!call) return notFound(root);

  const when = el(
    'details',
    { className: 'more' },
    el('summary', { textContent: 'When turkeys use it' }),
    el('p', { textContent: call.description.when }),
    sourcesLine(call),
  );

  root.replaceChildren(
    el('div', { className: 'title-row' }, el('h2', { textContent: call.name }), ...(call.locked ? [el('span', { className: 'badge', textContent: 'Recordings needed' })] : [])),
    el('p', { className: 'lead', textContent: call.description.meaning }),
  );

  if (call.locked) {
    root.append(
      el('p', {
        className: 'notice',
        textContent: 'Recordings needed: there are no reference recordings with an allowed license for this call yet, so it cannot be played or practiced.',
      }),
      el('div', { className: 'actions' }, el('button', { type: 'button', className: 'btn primary', disabled: true, textContent: 'Practice' })),
      when,
    );
    return;
  }

  const measureEl = el('p', { id: 'call-measure', className: 'facts', textContent: 'Measuring reference clips…' });
  const canvas = el('canvas', { className: 'spectrogram large', id: 'call-spectrogram' });
  canvas.setAttribute('role', 'img');
  const playhead = el('div', { className: 'playhead', hidden: true });
  const audio = el('audio', { id: 'clip-audio', preload: 'none' });
  const errorEl = el('p', { className: 'error', hidden: true });
  errorEl.setAttribute('role', 'alert');
  const list = el('ol', { className: 'clips' });
  const playMain = el('button', { type: 'button', className: 'btn', id: 'call-play', textContent: 'Play' });
  root.append(
    measureEl,
    el('div', { className: 'spectrogram-wrap' }, canvas, playhead),
    el('p', { className: 'caption muted', textContent: 'Low pitch at the bottom, time left to right. Bright orange is the loudest sound.' }),
    audio,
    errorEl,
    el('div', { className: 'actions' }, playMain, el('a', { className: 'btn primary', href: `#/practice/${call.id}`, textContent: 'Practice' })),
    when,
    el('details', { className: 'more' }, el('summary', { textContent: `Reference clips and licenses (${call.references.length})` }), list),
  );

  let alive = true;
  let current = -1;
  let raf = 0;
  const buttons: HTMLButtonElement[] = [];
  const features: (Features | undefined)[] = [];

  const showError = (msg: string) => {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  };

  const select = (i: number) => {
    canvas.setAttribute('aria-label', `Spectrogram of ${call.name.toLowerCase()} clip ${i + 1}`);
    loadSpectrogram(call.references[i])
      .then((img) => alive && current === i && showSpectrogram(canvas, img))
      .catch(() => alive && showError(`Could not load clip ${i + 1}.`));
  };

  const tick = () => {
    const f = features[current];
    if (f) playhead.style.left = `${(playheadFraction(audio.currentTime, f) * 100).toFixed(2)}%`;
    raf = requestAnimationFrame(tick);
  };

  const stopped = () => {
    cancelAnimationFrame(raf);
    playhead.hidden = true;
    buttons.forEach((b, i) => (b.textContent = `Play clip ${i + 1}`));
    playMain.textContent = 'Play';
  };
  audio.addEventListener('pause', stopped);
  audio.addEventListener('ended', stopped);
  audio.addEventListener('playing', () => {
    playhead.hidden = false;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  });
  audio.addEventListener('error', () => {
    if (alive && audio.getAttribute('src')) showError(`Could not play clip ${current + 1}.`);
  });

  /** Starts clip i, or stops it if it is the one playing. */
  const toggle = (i: number) => {
    if (current === i && !audio.paused) {
      audio.pause();
      return;
    }
    errorEl.hidden = true;
    audio.pause();
    current = i;
    select(i);
    audio.src = assetUrl(call.references[i]);
    audio.play().then(
      () => {
        if (!alive || current !== i) return;
        buttons[i].textContent = `Stop clip ${i + 1}`;
        playMain.textContent = 'Stop';
      },
      (err: unknown) => {
        // A newer click replaced this clip before it started: not an error.
        if (alive && current === i && !(err instanceof DOMException && err.name === 'AbortError')) showError(`Could not play clip ${i + 1}.`);
      },
    );
  };
  playMain.addEventListener('click', () => toggle(Math.max(current, 0)));

  call.references.forEach((path, i) => {
    const btn = el('button', { type: 'button', className: 'btn', textContent: `Play clip ${i + 1}` });
    btn.dataset.clip = String(i);
    buttons.push(btn);
    const item = el('li', { className: 'clip' }, btn);
    item.dataset.file = path;
    list.append(item);
    btn.addEventListener('click', () => toggle(i));
  });

  current = 0;
  select(0);

  loadManifest()
    .then((manifest) => {
      if (!alive) return;
      list.querySelectorAll<HTMLLIElement>('li').forEach((li) => li.append(attribution(clipInfo(manifest, li.dataset.file!))));
    })
    .catch(() => alive && showError('Could not load the clip attributions.'));

  Promise.all(call.references.map((p) => loadFeatures(p)))
    .then((fs) => {
      if (!alive) return;
      fs.forEach((f, i) => (features[i] = f));
      const m = measure(fs);
      measureEl.textContent = m ? describeMeasure(m) : 'No reference clips.';
    })
    .catch(() => alive && (measureEl.textContent = 'Could not measure the reference clips.'));

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  };
}
