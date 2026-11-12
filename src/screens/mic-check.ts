// Mic check screen: live level, clipping warning, noise floor, the phone's actual
// mic settings, and a 5 s test recording with spectrogram and WAV download.

import { classifyMicError, compareSettings, startCapture, type Capture } from '../audio/capture';
import { HOP_SEC } from '../audio/features';
import { analyzeTake, chunkLevel, liveStatus, RollingBuffer, TakeRecorder } from '../audio/monitor';
import { encodeWav } from '../audio/wav';
import { drawSpectrogram } from '../ui/spectrogram';

const TAKE_SECONDS = 5;
const WINDOW_SECONDS = 3;
const STATUS_INTERVAL_MS = 500;
/** Meter scale, dBFS. */
const METER_MIN_DB = -60;

const LABELS: Record<string, string> = {
  echoCancellation: 'Echo cancellation',
  noiseSuppression: 'Noise suppression',
  autoGainControl: 'Auto gain',
  channelCount: 'Channels',
};

const fmtDb = (db: number) => `${db.toFixed(1)} dBFS`;
const fmtValue = (v: unknown) => (v === undefined ? 'not reported' : v === true ? 'on' : v === false ? 'off' : String(v));

export function micCheckScreen(root: HTMLElement): () => void {
  root.innerHTML = `
    <h2>Mic check</h2>
    <p class="muted">See what your phone's microphone does before you practice. Audio stays on this phone.</p>
    <button type="button" class="btn primary" id="mic-start">Start mic</button>
    <p class="error" id="mic-error" role="alert" hidden></p>
    <section id="mic-live" hidden>
      <h3>Level</h3>
      <div class="meter" aria-hidden="true"><div class="meter-bar" id="mic-meter-bar"></div></div>
      <p id="mic-level" data-peak="0" aria-live="off">—</p>
      <p class="warn" id="mic-clip" role="status" hidden>Clipping: too loud. Back off the mic.</p>
      <dl class="stats">
        <dt>Noise floor</dt><dd id="mic-floor">measuring…</dd>
        <dt>Sample rate</dt><dd id="mic-rate"></dd>
      </dl>
      <h3>Phone audio processing</h3>
      <table class="settings">
        <thead><tr><th scope="col">Setting</th><th scope="col">Asked for</th><th scope="col">Phone gave</th></tr></thead>
        <tbody id="mic-settings"></tbody>
      </table>
      <p class="muted" id="mic-track-rate"></p>
      <h3>Test recording</h3>
      <button type="button" class="btn primary" id="mic-record">Record ${TAKE_SECONDS} s</button>
      <p id="mic-record-status" role="status"></p>
      <div id="mic-take" hidden>
        <canvas class="spectrogram" id="mic-spectrogram" role="img" aria-label="Spectrogram of the test recording"></canvas>
        <p class="muted">Spectrogram as the scorer hears it: sound above the background, low pitch at the bottom.</p>
        <dl class="stats">
          <dt>Loudest</dt><dd id="take-peak"></dd>
          <dt>Noise floor</dt><dd id="take-floor"></dd>
          <dt>Notes found</dt><dd id="take-notes"></dd>
          <dt>Scorer says</dt><dd id="take-verdict"></dd>
        </dl>
        <a class="btn" id="mic-download" download>Download WAV</a>
      </div>
      <button type="button" class="btn" id="mic-stop">Stop mic</button>
    </section>
  `;
  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const startBtn = $<HTMLButtonElement>('mic-start');
  const errorEl = $('mic-error');
  const live = $('mic-live');
  const meterBar = $('mic-meter-bar');
  const levelEl = $('mic-level');
  const clipEl = $('mic-clip');
  const floorEl = $('mic-floor');
  const recordBtn = $<HTMLButtonElement>('mic-record');
  const recordStatus = $('mic-record-status');
  const takeEl = $('mic-take');
  const download = $<HTMLAnchorElement>('mic-download');

  let alive = true;
  let capture: Capture | null = null;
  let window3s: RollingBuffer | null = null;
  let recorder: TakeRecorder | null = null;
  let rmsDb = -120;
  let peak = 0;
  let raf = 0;
  let timer = 0;
  let downloadUrl = '';

  const showError = (message: string) => {
    errorEl.textContent = message;
    errorEl.hidden = false;
  };

  const stopMic = () => {
    capture?.stop();
    capture = null;
    if (recorder) recordStatus.textContent = 'Recording stopped.';
    recorder = null;
    recordBtn.disabled = false;
    cancelAnimationFrame(raf);
    clearInterval(timer);
    live.hidden = true;
    startBtn.hidden = false;
    startBtn.disabled = false;
  };

  const draw = () => {
    const pct = Math.max(0, Math.min(100, ((rmsDb - METER_MIN_DB) / -METER_MIN_DB) * 100));
    meterBar.style.width = `${pct}%`;
    levelEl.textContent = `Level ${fmtDb(rmsDb)}, peak ${(peak * 100).toFixed(0)}% of full scale`;
    levelEl.dataset.peak = String(peak);
    raf = requestAnimationFrame(draw);
  };

  const finishTake = (samples: Float32Array, sampleRate: number) => {
    const { features: f, rejection } = analyzeTake(samples, sampleRate);
    drawSpectrogram($<HTMLCanvasElement>('mic-spectrogram'), f);
    $('take-peak').textContent = `${fmtDb(f.peakDb)}, peak sample ${(f.peakSample * 100).toFixed(0)}%`;
    $('take-floor').textContent = fmtDb(f.noiseFloorDb);
    $('take-notes').textContent = `${f.notes.length}, spanning ${(f.span ? (f.span.end - f.span.start) * HOP_SEC : 0).toFixed(2)} s`;
    $('take-verdict').textContent = rejection ? rejection.message : 'OK: clear enough to score.';
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(new Blob([encodeWav(samples, sampleRate)], { type: 'audio/wav' }));
    download.href = downloadUrl;
    download.download = `mic-check-${new Date().toISOString().replace(/[:.]/g, '-')}.wav`;
    takeEl.hidden = false;
    recordStatus.textContent = `Recorded ${TAKE_SECONDS} s at ${sampleRate} Hz.`;
    recordBtn.disabled = false;
  };

  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    errorEl.hidden = true;
    try {
      let rate = 0;
      const c = await startCapture((chunk) => {
        const lv = chunkLevel(chunk);
        rmsDb = lv.rmsDb;
        peak = lv.peak;
        window3s?.push(chunk);
        if (recorder) {
          const elapsed = recorder.recorded / rate;
          if (recorder.push(chunk)) {
            const take = recorder.samples.slice();
            recorder = null;
            finishTake(take, rate);
          } else recordStatus.textContent = `Recording… ${elapsed.toFixed(1)} s`;
        }
      });
      if (!alive) {
        c.stop();
        return;
      }
      capture = c;
      rate = c.sampleRate;
      window3s = new RollingBuffer(WINDOW_SECONDS * rate);
      $('mic-rate').textContent = `${rate} Hz`;
      const trackRate = c.settings.sampleRate;
      $('mic-track-rate').textContent = `Mic track sample rate: ${trackRate ? `${trackRate} Hz` : 'not reported'}.`;
      const tbody = $('mic-settings');
      tbody.replaceChildren(
        ...compareSettings(c.settings).map((row) => {
          const tr = document.createElement('tr');
          tr.dataset.key = row.key;
          for (const text of [LABELS[row.key], fmtValue(row.requested), fmtValue(row.actual)]) {
            const td = document.createElement('td');
            td.textContent = text;
            tr.append(td);
          }
          const got = tr.lastElementChild as HTMLElement;
          if (!row.ok) {
            got.classList.add('warn');
            got.textContent += row.actual === undefined ? '' : ' (phone ignored the request)';
          }
          return tr;
        }),
      );
      startBtn.hidden = true;
      live.hidden = false;
      raf = requestAnimationFrame(draw);
      timer = window.setInterval(() => {
        if (!window3s || window3s.length === 0) return;
        const s = liveStatus(window3s.toArray(), rate);
        floorEl.textContent = s.noiseFloorDb === null ? 'measuring…' : fmtDb(s.noiseFloorDb);
        clipEl.hidden = !s.clipped;
      }, STATUS_INTERVAL_MS);
    } catch (err) {
      startBtn.disabled = false;
      if (alive) showError(classifyMicError(err).message);
    }
  });

  recordBtn.addEventListener('click', () => {
    if (!capture) return;
    recordBtn.disabled = true;
    takeEl.hidden = true;
    recordStatus.textContent = 'Recording… 0.0 s';
    recorder = new TakeRecorder(TAKE_SECONDS * capture.sampleRate);
  });

  $('mic-stop').addEventListener('click', stopMic);

  return () => {
    alive = false;
    stopMic();
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  };
}
