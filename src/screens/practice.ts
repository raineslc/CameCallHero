// Practice screen (the game): Listen to a reference → Ready (3-2-1 count-in, noise floor
// measured) → Perform against a silent scrolling lane while the mic records → Results.
// The timeline runs on the mic's own sample count, so count-in and take length do not drift
// with timers. The mic is opened per take and released as soon as the take ends.

import { classifyMicError, startCapture, type Capture } from '../audio/capture';
import { extractFeatures, LiveNoteCounter, type Features } from '../audio/features';
import { chunkLevel, TakeRecorder } from '../audio/monitor';
import { LivePitch } from '../audio/pitch';
import { scoreTake, type ScoreResult, type SubScores } from '../audio/score';
import { TURKEY_CALLS, type CallDef } from '../calls/turkey';
import { assetUrl, loadFeatures, loadSpectrogram } from '../library/references';
import { CLICK_INTERVAL_SEC, CLICKS, FIRST_CLICK_SEC, latencyFromTaps, MATCH_WINDOW_MS } from '../practice/latency';
import { makePlan, noteTarget, targetText, type PracticePlan } from '../practice/plan';
import { loadBest, loadLatency, saveBest, saveLatency } from '../practice/storage';
import { PART_LABELS, PARTS, referenceLevels, tipsFor } from '../practice/tips';
import { Lane } from '../ui/lane';
import { drawOverlay } from '../ui/overlay';
import { showSpectrogram } from '../ui/spectrogram';

/** The live trail shows a pitch only when the chunk is this far above the count-in floor (dB). */
const TRAIL_ABOVE_FLOOR_DB = 10;
/** No mic sample this long after the mic opened means the mic is not delivering audio. */
const NO_AUDIO_TIMEOUT_MS = 3000;
const WATCHDOG_INTERVAL_MS = 500;
/** The lane's clock may run ahead of the last mic chunk by at most this much (s). */
const MAX_EXTRAPOLATE_SEC = 0.1;
/** Count-in text by whole seconds left; index 0 once the count-in is over. */
const COUNT_TEXT = ['Call now', '1', '2', '3'];
const CLICK_HZ = 1000;
const CLICK_SEC = 0.03;

function notFound(root: HTMLElement): void {
  root.innerHTML = `<h2>Call not found</h2><a class="btn" href="#/">Back to calls</a>`;
}

function lockedScreen(root: HTMLElement, call: CallDef): void {
  root.innerHTML = `
    <a class="back" href="#/call/${call.id}">← ${call.name}</a>
    <h2>Practice: ${call.name}</h2>
    <span class="badge">Recordings needed</span>
    <p class="notice">There are no reference recordings with an allowed license for this call yet, so it cannot be practiced.</p>
    <button type="button" class="btn primary" disabled>I'm ready</button>
  `;
}

export function practiceScreen(root: HTMLElement, id: string): (() => void) | void {
  const call = TURKEY_CALLS.find((c) => c.id === id);
  if (!call) return notFound(root);
  if (call.locked || call.references.length === 0) return lockedScreen(root, call);

  root.innerHTML = `
    <a class="back" href="#/call/${call.id}">← ${call.name}</a>
    <h2>Practice: ${call.name}</h2>
    <p class="error" id="practice-error" role="alert" hidden></p>

    <section id="practice-intro">
      <p>1. Listen to the call. 2. Tap <strong>I'm ready</strong> and stay quiet during the 3-2-1.
        3. Call when the notes reach the line. Nothing plays while you record.</p>
      <p class="target" id="practice-target" hidden></p>
      <canvas class="spectrogram" id="practice-spectrogram" role="img" aria-label="Spectrogram of the reference ${call.name.toLowerCase()}"></canvas>
      <div class="actions">
        <button type="button" class="btn" id="practice-listen">Listen</button>
        <button type="button" class="btn primary" id="practice-ready" disabled>I'm ready</button>
      </div>
      <p class="muted" id="practice-loading" role="status">Loading reference clips…</p>
      <div class="notice" id="practice-timing">
        <p id="practice-timing-text"></p>
        <button type="button" class="btn" id="practice-calibrate">Tap test</button>
        <div id="practice-calib" hidden>
          <p class="beat" id="practice-beat" data-beat="0" aria-hidden="true"></p>
          <button type="button" class="btn primary tap" id="practice-tap">Tap</button>
          <p id="practice-calib-status" role="status"></p>
        </div>
      </div>
    </section>

    <section id="practice-run" hidden>
      <p class="target" id="practice-notes"></p>
      <div class="lane-wrap">
        <canvas class="lane" id="practice-lane" role="img" aria-label="Practice lane: the turkey's notes are grey blocks that slide down to the white line; your call draws an orange line"></canvas>
        <p class="count" id="practice-count" aria-live="assertive"></p>
      </div>
      <p class="muted" id="practice-run-status" role="status">Starting the microphone…</p>
      <button type="button" class="btn" id="practice-cancel">Cancel</button>
    </section>

    <section id="practice-results" hidden>
      <p class="error" id="practice-rejected" role="alert" hidden></p>
      <div id="practice-scored" hidden>
        <p class="score"><span id="practice-score" class="accent"></span><span class="muted"> / 100</span></p>
        <p id="practice-best"></p>
        <dl class="stats" id="practice-subs"></dl>
        <h3>Your notes vs. the reference</h3>
        <canvas class="overlay" id="practice-overlay" role="img"></canvas>
        <p class="muted legend"><span class="key ref"></span> <span id="practice-overlay-ref"></span> <span class="key you"></span> You</p>
        <h3>How to improve</h3>
        <ul class="tips" id="practice-tips"></ul>
        <p class="muted" id="practice-tips-note" hidden>“Good” means as close to the turkey recording as the turkey recordings are to each other.</p>
      </div>
      <div class="actions">
        <button type="button" class="btn primary" id="practice-again">Try again</button>
        <button type="button" class="btn" id="practice-relisten">Listen again</button>
      </div>
    </section>
    <section class="help" id="practice-help" aria-labelledby="practice-help-title">
      <h3 id="practice-help-title">How it works</h3>
      <ul>
        <li>Grey blocks are the turkey's notes. They slide down to the white line.</li>
        <li>Call when a block reaches the line, and hold the note while the block crosses it. Taller block = longer note.</li>
        <li>Your call draws an orange line. Further right = higher, further left = deeper.</li>
        <li>Try to keep your orange line on the grey blocks.</li>
      </ul>
      <p class="legend help-legend">
        <span class="legend-item"><span class="key ref"></span> Turkey note</span>
        <span class="legend-item"><span class="key now"></span> Call now</span>
        <span class="legend-item"><span class="key line"></span> The line</span>
        <span class="legend-item"><span class="key trail"></span> You</span>
      </p>
    </section>
    <audio id="practice-audio" preload="none"></audio>
  `;
  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const errorEl = $('practice-error');
  const intro = $('practice-intro');
  const run = $('practice-run');
  const results = $('practice-results');
  const listenBtn = $<HTMLButtonElement>('practice-listen');
  const readyBtn = $<HTMLButtonElement>('practice-ready');
  const audio = $<HTMLAudioElement>('practice-audio');
  const countEl = $('practice-count');
  const runStatus = $('practice-run-status');
  const calibBtn = $<HTMLButtonElement>('practice-calibrate');
  const calibPanel = $('practice-calib');
  const beatEl = $('practice-beat');
  const tapBtn = $<HTMLButtonElement>('practice-tap');
  const calibStatus = $('practice-calib-status');
  const shownRef = call.references[0];
  const targetEl = $('practice-target');
  const notesEl = $('practice-notes');

  let alive = true;
  let refs: Features[] = [];
  let plan: PracticePlan | null = null;
  let lane: Lane | null = null;
  let latencyMs = loadLatency() ?? 0;
  let target = { notes: 0, seconds: 0 };
  /** Reference levels for the verdicts; computed at the first result. */
  let levels: SubScores | null | undefined;

  // Take state. `takeId` invalidates callbacks of an abandoned take.
  let takeId = 0;
  let capture: Capture | null = null;
  let recorder: TakeRecorder | null = null;
  let pitch: LivePitch | null = null;
  let noteCounter: LiveNoteCounter | null = null;
  let shownNotes = -1;
  let rate = 0;
  let floorDb: number | null = null;
  let lastChunkT = 0;
  let lastChunkPerf = 0;
  let shownCount = -1;
  let raf = 0;
  let watchdog = 0;

  // Calibration state.
  let calibCtx: AudioContext | null = null;
  /** True from the Tap test button until the test ends; Ready stays disabled meanwhile. */
  let calibrating = false;
  let calibTimers: number[] = [];
  let taps: number[] = [];
  let clicks: number[] = [];

  const showError = (msg: string) => {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  };
  const show = (section: 'intro' | 'run' | 'results') => {
    intro.hidden = section !== 'intro';
    run.hidden = section !== 'run';
    results.hidden = section !== 'results';
  };

  const updateTiming = () => {
    const stored = loadLatency();
    $('practice-timing-text').textContent =
      stored === null
        ? 'One-time timing check: tap along to 4 clicks so the orange trail lines up on this phone. You can skip it.'
        : `Timing offset: ${stored} ms (from your tap test).`;
    calibBtn.textContent = stored === null ? 'Tap test' : 'Redo tap test';
  };
  updateTiming();

  // --- Listen -------------------------------------------------------------------------
  const stopAudio = () => {
    audio.pause();
    if (audio.getAttribute('src')) audio.currentTime = 0;
    listenBtn.textContent = 'Listen';
  };
  audio.addEventListener('pause', () => (listenBtn.textContent = 'Listen'));
  audio.addEventListener('ended', () => (listenBtn.textContent = 'Listen'));
  listenBtn.addEventListener('click', () => {
    if (!audio.paused) return stopAudio();
    errorEl.hidden = true;
    if (!audio.getAttribute('src')) audio.src = assetUrl(shownRef);
    audio.currentTime = 0;
    audio.play().then(
      () => alive && (listenBtn.textContent = 'Stop'),
      (err: unknown) => {
        if (alive && !(err instanceof DOMException && err.name === 'AbortError')) showError('Could not play the reference clip.');
      },
    );
  });

  loadSpectrogram(shownRef)
    .then((img) => alive && showSpectrogram($<HTMLCanvasElement>('practice-spectrogram'), img))
    .catch(() => undefined); // the features load below reports the failure
  Promise.all(call.references.map((p) => loadFeatures(p)))
    .then((fs) => {
      if (!alive) return;
      refs = fs;
      plan = makePlan(fs[0], fs);
      lane = new Lane($<HTMLCanvasElement>('practice-lane'), plan);
      target = noteTarget(fs[0]);
      targetEl.textContent = `Your goal: ${targetText(target)}`;
      targetEl.hidden = false;
      $('practice-loading').hidden = true;
      readyBtn.disabled = calibrating;
    })
    .catch(() => {
      if (alive) $('practice-loading').textContent = 'Could not load the reference clips. Check your connection and reload.';
    });

  // --- Tap calibration ----------------------------------------------------------------
  const endCalibration = () => {
    calibrating = false;
    calibTimers.forEach((t) => clearTimeout(t));
    calibTimers = [];
    if (calibCtx && calibCtx.state !== 'closed') void calibCtx.close().catch(() => undefined);
    calibCtx = null;
    tapBtn.disabled = true;
    calibBtn.disabled = false;
    readyBtn.disabled = plan === null;
    listenBtn.disabled = false;
  };
  const recordTap = (t: number) => {
    if (calibCtx) taps.push(t);
  };
  tapBtn.addEventListener('pointerdown', (e) => recordTap(e.timeStamp));
  tapBtn.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) recordTap(performance.now());
  });

  calibBtn.addEventListener('click', async () => {
    stopAudio();
    calibrating = true;
    calibBtn.disabled = true;
    readyBtn.disabled = true;
    listenBtn.disabled = true;
    calibPanel.hidden = false;
    calibStatus.textContent = 'Tap when you hear each click.';
    beatEl.dataset.beat = '0';
    beatEl.textContent = '○'.repeat(CLICKS);
    taps = [];
    clicks = [];
    try {
      const ctx = new AudioContext();
      calibCtx = ctx;
      await ctx.resume();
      if (!alive || calibCtx !== ctx || !calibrating) return;
      tapBtn.disabled = false;
      const ctxNow = ctx.currentTime;
      const perfNow = performance.now();
      for (let k = 0; k < CLICKS; k++) {
        const dt = FIRST_CLICK_SEC + k * CLICK_INTERVAL_SEC;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = CLICK_HZ;
        gain.gain.setValueAtTime(0.5, ctxNow + dt);
        gain.gain.exponentialRampToValueAtTime(0.001, ctxNow + dt + CLICK_SEC);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctxNow + dt);
        osc.stop(ctxNow + dt + CLICK_SEC);
        // The time the app starts the click, on the clock of event.timeStamp / performance.now().
        clicks.push(perfNow + dt * 1000);
        calibTimers.push(
          window.setTimeout(() => {
            beatEl.dataset.beat = String(k + 1);
            beatEl.textContent = '●'.repeat(k + 1) + '○'.repeat(CLICKS - k - 1);
          }, dt * 1000),
        );
      }
      const lastMs = (FIRST_CLICK_SEC + (CLICKS - 1) * CLICK_INTERVAL_SEC) * 1000 + MATCH_WINDOW_MS + 100;
      calibTimers.push(
        window.setTimeout(() => {
          if (!alive) return;
          const ms = latencyFromTaps(clicks, taps);
          endCalibration();
          if (ms === null) {
            calibStatus.textContent = 'Your taps did not line up with the clicks. Try the tap test again.';
            return;
          }
          if (saveLatency(ms)) calibStatus.textContent = `Done: ${ms} ms.`;
          else calibStatus.textContent = `Measured ${ms} ms, but this browser would not save it; it is used until you leave.`;
          latencyMs = ms;
          updateTiming();
        }, lastMs),
      );
    } catch {
      if (!alive) return;
      endCalibration();
      calibStatus.textContent = 'Could not play the clicks on this browser. You can practice without the tap test.';
    }
  });

  // --- Take ---------------------------------------------------------------------------
  const stopTake = () => {
    takeId++;
    capture?.stop();
    capture = null;
    recorder = null;
    pitch = null;
    noteCounter = null;
    floorDb = null;
    cancelAnimationFrame(raf);
    clearInterval(watchdog);
  };

  const frame = (ts: number) => {
    if (!lane || !plan) return;
    const now = recorder && recorder.recorded > 0 ? Math.min(plan.end, lastChunkT + Math.min(MAX_EXTRAPOLATE_SEC, Math.max(0, (ts - lastChunkPerf) / 1000))) : 0;
    lane.draw(now);
    const left = Math.max(0, Math.ceil(plan.performStart - now));
    const count = recorder && recorder.recorded > 0 ? Math.min(COUNT_TEXT.length - 1, left) : -1;
    if (count !== shownCount) {
      shownCount = count;
      countEl.textContent = count < 0 ? '' : COUNT_TEXT[count];
      runStatus.textContent = count < 0 ? 'Starting the microphone…' : count > 0 ? 'Stay quiet: measuring background noise.' : 'Recording.';
    }
    raf = requestAnimationFrame(frame);
  };

  const showResult = (result: ScoreResult, take: Features) => {
    show('results');
    const rejected = $('practice-rejected');
    const scored = $('practice-scored');
    if (result.rejected || !plan) {
      rejected.textContent = `Not scored: ${result.rejected?.message ?? 'no result.'}`;
      rejected.hidden = false;
      scored.hidden = true;
      return;
    }
    rejected.hidden = true;
    scored.hidden = false;
    const scoreEl = $('practice-score');
    scoreEl.textContent = String(Math.round(result.score));
    scoreEl.dataset.score = String(result.score);
    const isBest = saveBest(call.id, result.score);
    const best = loadBest(call.id);
    $('practice-best').textContent = isBest ? 'New best!' : best !== null ? `Best: ${best}` : '';
    $('practice-subs').replaceChildren(
      ...PARTS.flatMap((k) => {
        const dt = document.createElement('dt');
        dt.textContent = PART_LABELS[k];
        const dd = document.createElement('dd');
        dd.textContent = String(Math.round(result[k]));
        dd.dataset.sub = k;
        return [dt, dd];
      }),
    );
    const ref = refs[result.bestReference];
    $('practice-overlay-ref').textContent = `Reference clip ${result.bestReference + 1} (closest match)`;
    const overlay = $<HTMLCanvasElement>('practice-overlay');
    overlay.setAttribute('aria-label', `Your ${take.notes.length} notes against the ${ref.notes.length} notes of reference clip ${result.bestReference + 1}`);
    drawOverlay(overlay, plan, ref, take, latencyMs / 1000);
    if (levels === undefined) levels = referenceLevels(refs, call.weights);
    $('practice-tips').replaceChildren(
      ...tipsFor(result, take, ref, levels).map((t) => {
        const li = document.createElement('li');
        li.dataset.part = t.part;
        if (t.verdict) li.dataset.verdict = t.verdict;
        const head = document.createElement('strong');
        head.textContent = t.verdict ? `${t.label}: ${t.verdict}.` : `${t.label}:`;
        li.append(head, ` ${t.text}`);
        return li;
      }),
    );
    $('practice-tips-note').hidden = levels === null;
  };

  const finishTake = () => {
    if (!recorder || !plan) return;
    const samples = recorder.samples;
    const sr = rate;
    const floor = floorDb ?? undefined;
    const p = plan;
    stopTake(); // releases the mic before scoring
    countEl.textContent = '';
    runStatus.textContent = 'Scoring…';
    const id = takeId;
    // Let the status paint before the (short) scoring work.
    window.setTimeout(() => {
      if (!alive || id !== takeId) return;
      const take = samples.slice(Math.round(p.performStart * sr));
      const f = extractFeatures({ samples: take, sampleRate: sr }, { noiseFloorDb: floor });
      showResult(scoreTake(f, refs, call.weights, { noiseFloorDb: floor }), f);
    }, 0);
  };

  const onChunk = (chunk: Float32Array) => {
    if (!recorder || !pitch || !plan || !lane) return;
    const done = recorder.push(chunk);
    lastChunkT = recorder.recorded / rate;
    lastChunkPerf = performance.now();
    pitch.push(chunk);
    if (floorDb === null && lastChunkT >= plan.performStart) {
      const countIn = recorder.samples.subarray(0, Math.round(plan.performStart * rate));
      floorDb = extractFeatures({ samples: countIn, sampleRate: rate }).noiseFloorDb;
      // Same take start, length and floor as finishTake, so the last count is the scored count.
      noteCounter = new LiveNoteCounter(rate, recorder.target - Math.round(plan.performStart * rate), floorDb);
    }
    if (noteCounter) {
      const n = noteCounter.update(recorder.buffer, Math.round(plan.performStart * rate), recorder.recorded);
      if (n !== shownNotes) {
        shownNotes = n;
        notesEl.textContent = `Notes so far: ${n} of ${target.notes}`;
        notesEl.dataset.count = String(n);
      }
    }
    if (floorDb !== null) {
      const loud = chunkLevel(chunk).rmsDb > floorDb + TRAIL_ABOVE_FLOOR_DB;
      // The pitch window ends at the chunk's end; place it at the window centre, minus the device latency.
      const t = lastChunkT - pitch.size / 2 / rate - latencyMs / 1000;
      lane.addPitch(t, loud ? pitch.dominantHz() : 0);
    }
    if (done) finishTake();
  };

  const startTake = async () => {
    if (!plan || !lane || calibrating) return;
    stopAudio();
    stopTake();
    const id = takeId;
    errorEl.hidden = true;
    show('run');
    shownCount = -1;
    shownNotes = -1;
    countEl.textContent = '';
    notesEl.textContent = targetText(target);
    delete notesEl.dataset.count;
    runStatus.textContent = 'Starting the microphone…';
    lane.resize();
    lane.clearTrail();
    lane.draw(0);
    try {
      const c = await startCapture(onChunk);
      if (!alive || id !== takeId) {
        c.stop();
        return;
      }
      capture = c;
      rate = c.sampleRate;
      recorder = new TakeRecorder(Math.ceil(plan.end * rate));
      pitch = new LivePitch(rate);
      lastChunkT = 0;
      lastChunkPerf = performance.now();
      raf = requestAnimationFrame(frame);
      // Fails the take if the mic stops delivering audio, before or after the first chunk.
      watchdog = window.setInterval(() => {
        if (id !== takeId || !recorder || performance.now() - lastChunkPerf < NO_AUDIO_TIMEOUT_MS) return;
        const none = recorder.recorded === 0;
        stopTake();
        show('intro');
        showError(
          none
            ? 'The microphone sent no sound. Close other apps that use it, then try again.'
            : 'The microphone stopped sending sound during the take. Try again.',
        );
      }, WATCHDOG_INTERVAL_MS);
    } catch (err) {
      if (!alive || id !== takeId) return;
      show('intro');
      showError(classifyMicError(err).message);
    }
  };

  readyBtn.addEventListener('click', () => void startTake());
  $('practice-again').addEventListener('click', () => void startTake());
  $('practice-cancel').addEventListener('click', () => {
    stopTake();
    show('intro');
  });
  $('practice-relisten').addEventListener('click', () => show('intro'));

  return () => {
    alive = false;
    stopTake();
    endCalibration();
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  };
}
