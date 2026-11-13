// Calling challenge (wild turkey): one free take of up to 20 s that can hold a whole sequence
// of calls. Ready → 3-2-1 count-in (noise floor, quiet light) → record with the loudness meter
// until Stop or 20 s → the take is split into calls and scored (src/challenge/analyze.ts) →
// results (timeline, score, stars, rank, next step, Play yours) → save to the pass-the-phone
// leaderboard and share a score card image. The mic is opened per take and released before
// scoring. The take stays in memory for "Play yours" and is dropped on the next take or when
// leaving. Nothing plays while the mic records, and no audio leaves the device.

import { classifyMicError, startCapture, type Capture } from '../audio/capture';
import { extractFeatures, LiveFloor } from '../audio/features';
import { quietCheck } from '../audio/meter';
import { chunkFrameDb, chunkLevel, TakeRecorder } from '../audio/monitor';
import { analyzeChallenge, CHALLENGE_SECONDS, nextStep, RECOGNIZE_MIN, SEGMENT_GAP_SEC, type CallRefs, type ChallengeResult } from '../challenge/analyze';
import { CARD_FILE, cardBlob, drawCard, shareCard } from '../challenge/card';
import { addEntry, BOARD_SIZE, cleanName, clearBoard, loadBoard, NAME_MAX, today, type BoardEntry } from '../challenge/leaderboard';
import { practiceHref, TURKEY } from '../calls/species';
import { loadFeatures } from '../library/references';
import { COUNT_IN_SEC } from '../practice/plan';
import { LevelMeter } from '../ui/meter';

const STARS = 5;
/** The quiet light waits for this many count-in frames (0.5 s) before it judges. */
const QUIET_MIN_FRAMES = 50;
/** No mic sample this long means the mic is not delivering audio. */
const NO_AUDIO_TIMEOUT_MS = 3000;
const WATCHDOG_INTERVAL_MS = 500;
const COUNT_TEXT = ['Call now', '1', '2', '3'];

/** "a, b and c" */
const listText = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

export function challengeScreen(root: HTMLElement): () => void {
  const species = TURKEY;
  const scorable = species.calls.filter((c) => !c.locked && c.references.length > 0 && RECOGNIZE_MIN[c.id] !== undefined);
  const locked = species.calls.filter((c) => !scorable.includes(c));
  const callNames = listText(scorable.map((c) => c.name.toLowerCase()));
  const lockedNames = listText(locked.map((c) => c.name.toLowerCase()));
  const thresholds = listText(scorable.map((c) => `${c.name.toLowerCase()} ${RECOGNIZE_MIN[c.id]} or more`));

  root.innerHTML = `
    <h2>Calling challenge</h2>
    <p class="error" id="challenge-error" role="alert" hidden></p>

    <section id="challenge-intro">
      <p>Make your best turkey calling: one call or a whole sequence, up to ${CHALLENGE_SECONDS} seconds.
        Each call is rated against recordings of wild turkeys. Then pass the phone.</p>
      <div class="actions">
        <button type="button" class="btn primary" id="challenge-ready" disabled>I'm ready</button>
      </div>
      <p class="muted" id="challenge-loading" role="status">Loading reference clips…</p>
    </section>

    <section id="challenge-run" hidden>
      <p class="quiet-light" id="challenge-quiet" data-state="checking" role="status"><span class="light" aria-hidden="true"></span><span id="challenge-quiet-text">Stay quiet: checking background noise…</span></p>
      <div class="challenge-stage">
        <p class="challenge-count" id="challenge-count" aria-live="assertive"></p>
        <p class="challenge-time" id="challenge-time"></p>
        <div class="challenge-progress" aria-hidden="true"><span id="challenge-progress"></span></div>
      </div>
      <div id="challenge-meter-slot"></div>
      <p class="muted" id="challenge-run-status" role="status">Starting the microphone…</p>
      <div class="actions">
        <button type="button" class="btn primary" id="challenge-stop" hidden>Stop</button>
        <button type="button" class="btn" id="challenge-cancel">Cancel</button>
      </div>
    </section>

    <section id="challenge-results" hidden>
      <p class="error" id="challenge-rejected" role="alert" hidden></p>
      <div id="challenge-scored" hidden>
        <div class="result-head">
          <p class="stars" id="challenge-stars" role="img"></p>
          <p class="score"><span id="challenge-score" class="accent"></span><span class="muted"> / 100</span></p>
        </div>
        <p class="rank" id="challenge-rank"></p>
        <div class="timeline" id="challenge-timeline" aria-hidden="true"></div>
        <p class="muted timeline-axis" aria-hidden="true"><span>0 s</span><span id="challenge-length"></span></p>
        <ol class="segments" id="challenge-segments" aria-label="Your calls in order"></ol>
        <p class="next" id="challenge-next"></p>
        <a class="btn" id="challenge-practice" hidden></a>
        <p class="muted" id="challenge-locked"></p>
      </div>
      <div class="actions">
        <button type="button" class="btn" id="challenge-play">Play yours</button>
        <button type="button" class="btn primary" id="challenge-again">Try again</button>
      </div>
      <form class="save" id="challenge-save" hidden>
        <label for="challenge-name">Your name</label>
        <div class="save-row">
          <input id="challenge-name" name="name" type="text" maxlength="${NAME_MAX}" autocomplete="off" autocapitalize="words" enterkeyhint="done" required>
          <button type="submit" class="btn primary">Save score</button>
        </div>
        <p class="muted" id="challenge-save-status" role="status"></p>
      </form>
      <div id="challenge-share-box" hidden>
        <button type="button" class="btn" id="challenge-share">Share score card</button>
        <p class="muted" id="challenge-share-status" role="status"></p>
        <canvas class="card-preview" id="challenge-card" role="img" aria-label="Score card image" hidden></canvas>
      </div>
    </section>

    <section class="board" id="challenge-board" aria-labelledby="challenge-board-title">
      <h3 id="challenge-board-title">Leaderboard on this phone</h3>
      <ol class="board-list" id="challenge-board-list"></ol>
      <p class="muted" id="challenge-board-empty">No scores yet. Be the first.</p>
      <div id="challenge-clear-box">
        <button type="button" class="btn" id="challenge-clear">Clear leaderboard</button>
        <div class="confirm" id="challenge-confirm" hidden>
          <p>Delete every score on this phone's leaderboard?</p>
          <div class="actions">
            <button type="button" class="btn primary" id="challenge-clear-yes">Yes, clear</button>
            <button type="button" class="btn" id="challenge-clear-no">Keep them</button>
          </div>
        </div>
      </div>
    </section>

    <section class="help" id="challenge-help" aria-labelledby="challenge-help-title">
      <h3 id="challenge-help-title">How the score works</h3>
      <ul>
        <li>Your take is split into calls wherever you pause for ${SEGMENT_GAP_SEC} s or more.</li>
        <li>Each call is compared with recordings of wild turkeys for every call the app can score (${callNames}), with the same scorer as practice. The best match names it.</li>
        <li>A call counts as recognized when it scores higher than any wrong sound did in our tests (putts, noise, the other call): ${thresholds}. Otherwise it shows as Not recognized.</li>
        <li>Score = the average of the recognized calls' scores, weighted by how long each call lasts. Time spent on calls that were not recognized counts as 0. Pauses do not count. Example: a 3 s yelp scoring 80 and a 1 s sound that was not recognized give 80 × 3 / 4 = 60.</li>
        <li>Stars and rank go by the score: Poult under 20, Jake 20, Gobbler 40, Longbeard 60, Boss gobbler 80 and up.</li>
        <li>${lockedNames.charAt(0).toUpperCase()}${lockedNames.slice(1)} cannot be recognized yet.</li>
        <li>Scores and names stay on this phone. The score card is a picture only, with no sound.</li>
      </ul>
    </section>
  `;
  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const errorEl = $('challenge-error');
  const intro = $('challenge-intro');
  const run = $('challenge-run');
  const results = $('challenge-results');
  const readyBtn = $<HTMLButtonElement>('challenge-ready');
  const stopBtn = $<HTMLButtonElement>('challenge-stop');
  const countEl = $('challenge-count');
  const timeEl = $('challenge-time');
  const progressEl = $('challenge-progress');
  const runStatus = $('challenge-run-status');
  const quietEl = $('challenge-quiet');
  const quietText = $('challenge-quiet-text');
  const playBtn = $<HTMLButtonElement>('challenge-play');
  const saveForm = $<HTMLFormElement>('challenge-save');
  const nameInput = $<HTMLInputElement>('challenge-name');
  const saveStatus = $('challenge-save-status');
  const shareBox = $('challenge-share-box');
  const shareBtn = $<HTMLButtonElement>('challenge-share');
  const shareStatus = $('challenge-share-status');
  const cardCanvas = $<HTMLCanvasElement>('challenge-card');
  const meter = new LevelMeter('challenge-meter');
  $('challenge-meter-slot').replaceWith(meter.el);
  $('challenge-locked').textContent = `${lockedNames.charAt(0).toUpperCase()}${lockedNames.slice(1)} cannot be recognized yet: they show as Not recognized. A kee kee run may show as a yelp.`;

  let alive = true;
  let calls: CallRefs[] = [];
  let takeId = 0;
  let capture: Capture | null = null;
  let recorder: TakeRecorder | null = null;
  let liveFloor: LiveFloor | null = null;
  let floorDb: number | null = null;
  let countInSamples = 0;
  let rate = 0;
  let lastChunkPerf = 0;
  let watchdog = 0;
  let shown = '';
  let shownQuiet = '';
  let lastTake: { samples: Float32Array<ArrayBuffer>; rate: number } | null = null;
  let result: ChallengeResult | null = null;
  /** Name the current result was saved under, or null. */
  let savedName: string | null = null;
  let playCtx: AudioContext | null = null;
  let sharing = false;

  const showError = (msg: string) => {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  };
  const show = (section: 'intro' | 'run' | 'results') => {
    intro.hidden = section !== 'intro';
    run.hidden = section !== 'run';
    results.hidden = section !== 'results';
    // The leaderboard and help stay out of the way while recording.
    $('challenge-board').hidden = section === 'run';
    $('challenge-help').hidden = section === 'run';
  };

  // --- Leaderboard ------------------------------------------------------------------------
  const renderBoard = (board: BoardEntry[], highlight = -1) => {
    $('challenge-board-list').replaceChildren(
      ...board.map((e, i) => {
        const li = document.createElement('li');
        if (i === highlight) li.dataset.new = 'true';
        const place = Object.assign(document.createElement('span'), { className: 'board-place', textContent: `${i + 1}.` });
        const name = Object.assign(document.createElement('span'), { className: 'board-name', textContent: e.name });
        const score = Object.assign(document.createElement('span'), { className: 'board-score', textContent: String(e.score) });
        const date = Object.assign(document.createElement('span'), { className: 'board-date muted', textContent: e.date });
        li.append(place, name, score, date);
        return li;
      }),
    );
    $('challenge-board-empty').hidden = board.length > 0;
    $('challenge-clear-box').hidden = board.length === 0;
    $('challenge-confirm').hidden = true;
    $('challenge-clear').hidden = false;
  };
  renderBoard(loadBoard());
  $('challenge-clear').addEventListener('click', () => {
    $('challenge-clear').hidden = true;
    $('challenge-confirm').hidden = false;
    $('challenge-clear-no').focus();
  });
  $('challenge-clear-no').addEventListener('click', () => {
    renderBoard(loadBoard());
    $('challenge-clear').focus();
  });
  $('challenge-clear-yes').addEventListener('click', () => {
    if (!clearBoard()) showError('This browser would not clear the leaderboard.');
    renderBoard(loadBoard());
  });

  saveForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!result || result.rejected || savedName !== null) return;
    const name = cleanName(nameInput.value);
    if (!name) {
      saveStatus.textContent = 'Enter a name first.';
      nameInput.focus();
      return;
    }
    const added = addEntry(name, result.score);
    if (!added) {
      saveStatus.textContent = 'Could not save this score.';
      return;
    }
    savedName = name;
    nameInput.value = name;
    nameInput.disabled = true;
    saveForm.querySelector('button')!.disabled = true;
    renderBoard(added.board, added.place);
    const place = added.place >= 0 ? `Place ${added.place + 1} of ${added.board.length}.` : `Not in the top ${BOARD_SIZE} this time.`;
    saveStatus.textContent = added.saved ? `Saved. ${place}` : `${place} This browser would not store it, so it is gone when you leave.`;
  });

  // --- Share ------------------------------------------------------------------------------
  shareBtn.addEventListener('click', async () => {
    if (!result || result.rejected || sharing) return;
    const name = savedName ?? cleanName(nameInput.value);
    if (!name) {
      shareStatus.textContent = 'Enter your name above first: it goes on the card.';
      nameInput.focus();
      return;
    }
    sharing = true;
    shareBtn.disabled = true;
    shareStatus.textContent = 'Making the card…';
    try {
      await drawCard(cardCanvas, { name, date: today(), result });
      if (!alive) return;
      cardCanvas.hidden = false;
      cardCanvas.setAttribute('aria-label', `Score card: ${name}, ${Math.round(result.score)} of 100, ${result.stars} of ${STARS} stars, rank ${result.rank}`);
      const how = await shareCard(await cardBlob(cardCanvas), `${name} scored ${Math.round(result.score)} in the Game Call Hero turkey calling challenge.`);
      if (!alive) return;
      shareStatus.textContent =
        how === 'shared' ? 'Shared.' : how === 'downloaded' ? `Saved the card as an image (${CARD_FILE}).` : 'Not shared.';
      shareStatus.dataset.how = how;
    } catch {
      if (alive) shareStatus.textContent = 'Could not make the score card on this browser.';
    } finally {
      sharing = false;
      shareBtn.disabled = false;
    }
  });

  // --- Playback of your take --------------------------------------------------------------
  const stopPlay = () => {
    if (playCtx) {
      const c = playCtx;
      playCtx = null;
      void c.close().catch(() => undefined);
    }
    playBtn.textContent = 'Play yours';
  };
  playBtn.addEventListener('click', async () => {
    if (playCtx) return stopPlay();
    const take = lastTake;
    if (capture || !take || take.samples.length === 0) return; // never while recording
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
      playCtx = ctx;
      playBtn.textContent = 'Stop';
      const buf = ctx.createBuffer(1, take.samples.length, take.rate);
      buf.copyToChannel(take.samples, 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.onended = () => {
        if (playCtx === ctx) stopPlay();
      };
      await ctx.resume();
      if (playCtx !== ctx) return;
      src.start();
    } catch {
      if (ctx && playCtx === ctx) stopPlay();
      else if (ctx) void ctx.close().catch(() => undefined);
      if (alive) showError('Could not play your recording on this browser.');
    }
  });

  // --- References -------------------------------------------------------------------------
  Promise.all(scorable.map(async (call) => ({ call, refs: await Promise.all(call.references.map((p) => loadFeatures(p, species.band))) })))
    .then((loaded) => {
      if (!alive) return;
      calls = loaded;
      $('challenge-loading').hidden = true;
      readyBtn.disabled = false;
    })
    .catch(() => {
      if (alive) $('challenge-loading').textContent = 'Could not load the reference clips. Check your connection and reload.';
    });

  // --- Take -------------------------------------------------------------------------------
  const stopTake = () => {
    takeId++;
    capture?.stop();
    capture = null;
    recorder = null;
    liveFloor = null;
    floorDb = null;
    clearInterval(watchdog);
  };

  const showQuiet = (state: 'checking' | 'ok' | 'bad', text: string) => {
    if (state + text === shownQuiet) return;
    shownQuiet = state + text;
    quietEl.dataset.state = state;
    quietText.textContent = text;
  };

  const fillStars = (n: number) => {
    const el = $('challenge-stars');
    el.setAttribute('aria-label', `${n} of ${STARS} stars`);
    el.dataset.stars = String(n);
    el.replaceChildren(
      ...Array.from({ length: STARS }, (_, k) => Object.assign(document.createElement('span'), { className: k < n ? 'star on' : 'star', textContent: k < n ? '★' : '☆' })),
    );
  };

  const showResult = (r: ChallengeResult) => {
    result = r;
    savedName = null;
    show('results');
    playBtn.disabled = !lastTake;
    const rejected = $('challenge-rejected');
    const scored = $('challenge-scored');
    nameInput.disabled = false;
    saveForm.querySelector('button')!.disabled = false;
    saveStatus.textContent = '';
    shareStatus.textContent = '';
    delete shareStatus.dataset.how;
    cardCanvas.hidden = true;
    if (r.rejected) {
      rejected.textContent = `Not scored: ${r.rejected.message}`;
      rejected.hidden = false;
      scored.hidden = true;
      saveForm.hidden = true;
      shareBox.hidden = true;
      return;
    }
    rejected.hidden = true;
    scored.hidden = false;
    saveForm.hidden = false;
    shareBox.hidden = false;
    const scoreEl = $('challenge-score');
    scoreEl.textContent = String(Math.round(r.score));
    scoreEl.dataset.score = String(r.score);
    fillStars(r.stars);
    $('challenge-rank').textContent = `Rank: ${r.rank}`;
    const total = Math.max(0.1, r.seconds);
    $('challenge-length').textContent = `${r.seconds.toFixed(1)} s`;
    $('challenge-timeline').replaceChildren(
      ...r.segments.map((s) => {
        const block = document.createElement('span');
        block.className = s.recognized ? 'seg on' : 'seg';
        block.style.left = `${Math.min(100, (s.start / total) * 100)}%`;
        block.style.width = `${Math.max(0.5, Math.min(100, ((s.end - s.start) / total) * 100))}%`;
        return block;
      }),
    );
    $('challenge-segments').replaceChildren(
      ...r.segments.map((s) => {
        const li = document.createElement('li');
        li.dataset.recognized = String(s.recognized);
        if (s.call) li.dataset.call = s.call.id;
        li.dataset.score = String(s.score);
        const label = document.createElement('strong');
        label.textContent = s.recognized && s.call ? `${s.call.name} ${Math.round(s.score)}` : 'Not recognized';
        const detail = document.createElement('span');
        detail.className = 'muted';
        const closest = !s.recognized && s.call ? `, closest: ${s.call.name.toLowerCase()} ${Math.round(s.score)}` : '';
        detail.textContent = ` ${s.start.toFixed(1)}–${s.end.toFixed(1)} s${closest}`;
        li.append(label, detail);
        return li;
      }),
    );
    const step = nextStep(r, callNames);
    $('challenge-next').textContent = `Next try: ${step.text.charAt(0).toLowerCase()}${step.text.slice(1)}`;
    const practice = $<HTMLAnchorElement>('challenge-practice');
    practice.hidden = !step.practice;
    if (step.practice) {
      practice.href = practiceHref(species, step.practice);
      practice.textContent = `Practice the ${step.practice.name.toLowerCase()}`;
    }
  };

  const finishTake = () => {
    if (!recorder) return;
    const all = recorder.samples;
    const sr = rate;
    const floor = floorDb ?? undefined;
    const start = countInSamples;
    stopTake(); // releases the mic before scoring
    countEl.textContent = '';
    stopBtn.hidden = true;
    runStatus.textContent = 'Scoring…';
    const id = takeId;
    // Let the status paint before the scoring work.
    window.setTimeout(() => {
      if (!alive || id !== takeId) return;
      const take = all.slice(start);
      lastTake = { samples: take, rate: sr };
      showResult(analyzeChallenge({ samples: take, sampleRate: sr }, calls, floor, species.band));
    }, 30);
  };

  const showRun = (text: string, count: string, recordedSec: number) => {
    const key = `${text}|${count}|${Math.floor(recordedSec)}`;
    if (key === shown) return;
    shown = key;
    runStatus.textContent = text;
    countEl.textContent = count;
    const sec = Math.max(0, Math.floor(recordedSec));
    timeEl.textContent = floorDb === null ? '' : `${sec} s of ${CHALLENGE_SECONDS} s`;
    progressEl.style.width = `${Math.min(100, (recordedSec / CHALLENGE_SECONDS) * 100)}%`;
  };

  const onChunk = (chunk: Float32Array) => {
    if (!recorder || !liveFloor) return;
    const done = recorder.push(chunk);
    lastChunkPerf = performance.now();
    const t = recorder.recorded / rate;
    meter.set(chunkFrameDb(chunk, rate), chunkLevel(chunk).peak, t);
    if (floorDb === null) {
      liveFloor.update(recorder.buffer, recorder.recorded);
      const live = liveFloor.value();
      if (live !== null && liveFloor.frameCount >= QUIET_MIN_FRAMES) {
        const q = quietCheck(live);
        showQuiet(q.ok ? 'ok' : 'bad', q.text);
        meter.setFloor(live);
      }
      if (recorder.recorded >= countInSamples) {
        // The count-in floor by the scorer's own measure, as in practice.
        floorDb = live ?? extractFeatures({ samples: recorder.samples.subarray(0, countInSamples), sampleRate: rate }).noiseFloorDb;
        const q = quietCheck(floorDb);
        showQuiet(q.ok ? 'ok' : 'bad', q.text);
        quietEl.hidden = q.ok; // a red light stays up during the take
        meter.setFloor(floorDb);
        stopBtn.hidden = false;
      }
    }
    if (floorDb === null) {
      showRun('Stay quiet: measuring background noise.', COUNT_TEXT[Math.min(3, Math.max(1, Math.ceil(COUNT_IN_SEC - t)))], 0);
    } else {
      const rec = (recorder.recorded - countInSamples) / rate;
      showRun('Recording. Tap Stop when you are done.', rec < 1 ? COUNT_TEXT[0] : 'Recording', rec);
    }
    if (done) finishTake();
  };

  const startTake = async () => {
    if (calls.length === 0) return;
    stopPlay();
    stopTake();
    lastTake = null;
    const id = takeId;
    errorEl.hidden = true;
    show('run');
    shown = '';
    shownQuiet = '';
    countEl.textContent = '';
    timeEl.textContent = '';
    progressEl.style.width = '0%';
    stopBtn.hidden = true;
    quietEl.hidden = false;
    showQuiet('checking', 'Stay quiet: checking background noise…');
    meter.setFloor(null);
    meter.reset();
    runStatus.textContent = 'Starting the microphone…';
    try {
      const c = await startCapture(onChunk);
      if (!alive || id !== takeId) {
        c.stop();
        return;
      }
      capture = c;
      rate = c.sampleRate;
      countInSamples = Math.round(COUNT_IN_SEC * rate);
      recorder = new TakeRecorder(countInSamples + Math.round(CHALLENGE_SECONDS * rate));
      liveFloor = new LiveFloor(rate, countInSamples);
      lastChunkPerf = performance.now();
      watchdog = window.setInterval(() => {
        if (id !== takeId || !recorder || performance.now() - lastChunkPerf < NO_AUDIO_TIMEOUT_MS) return;
        const none = recorder.recorded === 0;
        stopTake();
        show('intro');
        showError(none ? 'The microphone sent no sound. Close other apps that use it, then try again.' : 'The microphone stopped sending sound during the take. Try again.');
      }, WATCHDOG_INTERVAL_MS);
    } catch (err) {
      if (!alive || id !== takeId) return;
      show('intro');
      showError(classifyMicError(err).message);
    }
  };

  readyBtn.addEventListener('click', () => void startTake());
  $('challenge-again').addEventListener('click', () => void startTake());
  stopBtn.addEventListener('click', () => {
    if (recorder && floorDb !== null) finishTake();
  });
  $('challenge-cancel').addEventListener('click', () => {
    stopTake();
    show('intro');
  });

  return () => {
    alive = false;
    stopTake();
    stopPlay();
    lastTake = null;
    result = null;
  };
}
