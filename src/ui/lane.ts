// The practice lane: reference notes scroll down toward a hit line (time vertical, pitch
// horizontal on a log axis); the user's live dominant frequency is drawn as a hunter-orange
// trail. draw() runs every animation frame and allocates nothing: buffers, sizes and colours
// are set up front.

import { AHEAD_SEC, BEHIND_SEC, laneY, pitchX, type PracticePlan } from '../practice/plan';

/** Trail points kept: one per mic chunk (~43 ms), enough for 40 s. */
const TRAIL_CAPACITY = 1024;
const NOTE_WIDTH_CSS = 28;
const MIN_NOTE_HEIGHT_CSS = 8;
const TRAIL_WIDTH_CSS = 4;
const SIDE_PAD_CSS = 18;
const ACTIVE_OUTLINE_CSS = 3;

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export class Lane {
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly trailT = new Float32Array(TRAIL_CAPACITY);
  private readonly trailHz = new Float32Array(TRAIL_CAPACITY);
  private trailN = 0;
  private readonly colors = { bg: '', grid: '', note: '', active: '', trail: '', hit: '' };
  private w = 1;
  private h = 1;
  private dpr = 1;
  private hitY = 1;
  private pxPerSec = 1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly plan: PracticePlan,
  ) {
    this.ctx = canvas.getContext('2d');
    this.colors.bg = token('--surface');
    this.colors.grid = token('--surface-2');
    this.colors.note = token('--text-muted');
    this.colors.active = token('--accent');
    this.colors.trail = token('--accent');
    this.colors.hit = token('--text');
    this.resize();
  }

  /** Matches the backing store to the canvas's CSS size. Call on layout changes, not per frame. */
  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    this.w = Math.max(1, Math.round(r.width * this.dpr));
    this.h = Math.max(1, Math.round(r.height * this.dpr));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.hitY = (this.h * AHEAD_SEC) / (AHEAD_SEC + BEHIND_SEC);
    this.pxPerSec = this.hitY / AHEAD_SEC;
  }

  clearTrail(): void {
    this.trailN = 0;
  }

  /** Adds a trail point at timeline time t (s); hz 0 marks silence (a break in the trail). */
  addPitch(t: number, hz: number): void {
    if (this.trailN === TRAIL_CAPACITY) {
      this.trailT.copyWithin(0, 1);
      this.trailHz.copyWithin(0, 1);
      this.trailN--;
    }
    this.trailT[this.trailN] = t;
    this.trailHz[this.trailN] = hz > 0 && Number.isFinite(hz) ? hz : 0;
    this.trailN++;
  }

  private x(hz: number): number {
    const pad = SIDE_PAD_CSS * this.dpr;
    return pad + pitchX(hz, this.plan.loHz, this.plan.hiHz) * (this.w - 2 * pad);
  }

  /** Draws the lane with timeline time `now` (s) at the hit line. */
  draw(now: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const { w, h, dpr, hitY, pxPerSec, colors } = this;
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    // Beat grid: one line per second of the timeline.
    ctx.fillStyle = colors.grid;
    for (let s = Math.ceil(now - BEHIND_SEC); s <= now + AHEAD_SEC; s++) ctx.fillRect(0, laneY(s, now, hitY, pxPerSec), w, dpr);

    const noteW = NOTE_WIDTH_CSS * dpr;
    const minH = MIN_NOTE_HEIGHT_CSS * dpr;
    for (let i = 0; i < this.plan.notes.length; i++) {
      const n = this.plan.notes[i];
      const top = laneY(n.end, now, hitY, pxPerSec);
      const bottom = laneY(n.start, now, hitY, pxPerSec);
      if (bottom < 0 || top > h) continue;
      const height = Math.max(minH, bottom - top);
      const left = this.x(n.hz) - noteW / 2;
      ctx.fillStyle = colors.note;
      ctx.fillRect(left, bottom - height, noteW, height);
      // Active note: orange outline, so it stays distinct from the orange trail drawn on top.
      if (now >= n.start && now <= n.end) {
        ctx.strokeStyle = colors.active;
        ctx.lineWidth = ACTIVE_OUTLINE_CSS * dpr;
        ctx.strokeRect(left - ctx.lineWidth / 2, bottom - height - ctx.lineWidth / 2, noteW + ctx.lineWidth, height + ctx.lineWidth);
      }
    }

    ctx.strokeStyle = colors.trail;
    ctx.lineWidth = TRAIL_WIDTH_CSS * dpr;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let open = false;
    for (let i = 0; i < this.trailN; i++) {
      const hz = this.trailHz[i];
      const y = laneY(this.trailT[i], now, hitY, pxPerSec);
      if (hz === 0 || y > h + pxPerSec || y < -pxPerSec) {
        open = false;
        continue;
      }
      const x = this.x(hz);
      if (open) ctx.lineTo(x, y);
      else {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y); // a lone point still shows as a dot (round cap)
        open = true;
      }
    }
    ctx.stroke();

    ctx.fillStyle = colors.hit;
    ctx.fillRect(0, hitY - dpr, w, 2 * dpr);
  }
}
