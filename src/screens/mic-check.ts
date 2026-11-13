// Mic check screen: live level on a meter with the scorer's zones (Move closer / Good /
// Back off), clipping warning, a quiet light for the background noise, one plain line on the
// phone's voice processing, and a 5 s test recording with the scorer's verdict, spectrogram
// and WAV download. The numbers (dBFS, sample rate, settings table) sit in collapsed
// "Technical details" for whoever reports a problem.

import { classifyMicError, compareSettings, processingSummary, startCapture, type Capture } from '../audio/capture';
import { quietCheck } from '../audio/meter';
import { HOP_SEC } from '../audio/features';
import { analyzeTake, chunkFrameDb, chunkLevel, liveStatus, RollingBuffer, TakeRecorder } from '../audio/monitor';
import { encodeWav } from '../audio/wav';
import { LevelMeter } from '../ui/meter';
import { drawSpectrogram } from '../ui/spectrogram';

const TAKE_SECONDS = 5;
const WINDOW_SECONDS = 3;
const STATUS_INTERVAL_MS = 500;

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
    <p class="muted">Check that your phone hears your calls well before you practice. The sound stays on this phone.</p>
    <button type="button" class="btn primary" id="mic-start">Start mic</button>
    <p class="muted" id="mic-start-hint">Your phone will ask to use the microphone: tap Allow.</p>
    <p class="error" id="mic-error" role="alert" hidden></p>
    <section id="mic-live" hidden>
      <h3>1. How loud you are</h3>
      <div id="mic-meter-slot"></div>
      <p class="muted caption">Call into the phone. Move it closer or further until the bar says Good.</p>
      <p class="warn" id="mic-clip" role="status" hidden>Too loud: the sound is distorting. Hold the phone further away.</p>
      <h3>2. Background noise</h3>
      <p class="quiet-light" id="mic-quiet" data-state="checking" role="status"><span class="light" aria-hidden="true"></span><span id="mic-quiet-text">Stay quiet for a moment: checking…</span></p>
      <h3>3. Your phone</h3>
      <p id="mic-summary"></p>
      <h3>4. Test recording</h3>
      <p class="muted caption">Tap, then make one call. The app tells you if it could score it.</p>
      <button type="button" class="btn primary" id="mic-record">Record ${TAKE_SECONDS} s</button>
      <p id="mic-record-status" role="status"></p>
      <div id="mic-take" hidden>
        <p class="next" id="take-verdict"></p>
        <canvas class="spectrogram" id="mic-spectrogram" role="img" aria-label="Picture of the test recording"></canvas>
        <p class="muted caption">Your recording as the app hears it: low sounds at the bottom, time left to right.</p>
        <a class="btn" id="mic-download" download>Save recording (WAV)</a>
      </div>
      <details class="more" id="mic-details">
        <summary>Technical details</summary>
        <p id="mic-level" data-peak="0" aria-live="off">—</p>
        <dl class="stats">
          <dt>Noise floor</dt><dd id="mic-floor">measuring…</dd>
          <dt>Sample rate</dt><dd id="mic-rate"></dd>
        </dl>
        <table class="settings">
          <thead><tr><th scope="col">Setting</th><th scope="col">Asked for</th><th scope="col">Phone gave</th></tr></thead>
          <tbody id="mic-settings"></tbody>
        </table>
        <p class="muted" id="mic-track-rate"></p>
        <dl class="stats" id="take-stats" hidden>
          <dt>Test: loudest</dt><dd id="take-peak"></dd>
          <dt>Test: noise floor</dt><dd id="take-floor"></dd>
          <dt>Test: notes found</dt><dd id="take-notes"></dd>
        </dl>
      </details>
      <button type="button" class="btn" id="mic-stop">Stop mic</button>
    </section>
  `;
  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const startBtn = $<HTMLButtonElement>('mic-start');
  const errorEl = $('mic-error');
  const live = $('mic-live');
  const meter = new LevelMeter('mic-meter');
  $('mic-meter-slot').replaceWith(meter.el);
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
  let chunkT = 0;
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
    $('mic-start-hint').hidden = false;
  };

  const draw = () => {
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
    $('take-verdict').textContent = rejection ? `Not good enough to score. ${rejection.message}` : 'Good: the app can score a call like this.';
    $('take-stats').hidden = false;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(new Blob([encodeWav(samples, sampleRate)], { type: 'audio/wav' }));
    download.href = downloadUrl;
    download.download = `mic-check-${new Date().toISOString().replace(/[:.]/g, '-')}.wav`;
    takeEl.hidden = false;
    recordStatus.textContent = `Recorded ${TAKE_SECONDS} seconds.`;
    recordBtn.disabled = false;
  };

  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    errorEl.hidden = true;
    chunkT = 0;
    meter.setFloor(null);
    meter.reset();
    try {
      let rate = 0;
      const c = await startCapture((chunk) => {
        const lv = chunkLevel(chunk);
        rmsDb = lv.rmsDb;
        peak = lv.peak;
        if (rate > 0) {
          // The first chunks can arrive before startCapture returns the rate.
          chunkT += chunk.length / rate;
          meter.set(chunkFrameDb(chunk, rate), peak, chunkT);
        }
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
      $('mic-summary').textContent = processingSummary(compareSettings(c.settings), LABELS).text;
      const quiet = $('mic-quiet');
      quiet.dataset.state = 'checking';
      $('mic-quiet-text').textContent = 'Stay quiet for a moment: checking…';
      startBtn.hidden = true;
      $('mic-start-hint').hidden = true;
      live.hidden = false;
      raf = requestAnimationFrame(draw);
      timer = window.setInterval(() => {
        if (!window3s || window3s.length === 0) return;
        const s = liveStatus(window3s.toArray(), rate);
        floorEl.textContent = s.noiseFloorDb === null ? 'measuring…' : fmtDb(s.noiseFloorDb);
        meter.setFloor(s.noiseFloorDb);
        if (s.noiseFloorDb !== null) {
          const q = quietCheck(s.noiseFloorDb);
          $('mic-quiet').dataset.state = q.ok ? 'ok' : 'bad';
          $('mic-quiet-text').textContent = q.text;
        }
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
