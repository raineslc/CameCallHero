// The practice lane: reference notes scroll down toward a hit line (time vertical, pitch
// horizontal on a log axis); the user's live dominant frequency is drawn as a hunter-orange
// trail. Each note is a block slanted from its measured start frequency (bottom) to its end
// frequency (top), so a downward break shows as a block leaning left toward its top.
// Hit notes turn hunter orange and missed notes hollow; the newest decision flashes "Hit" or "Miss".
// draw() runs every animation frame and allocates nothing: buffers, sizes, colours, fonts
// and label widths are set up front.

import { AHEAD_SEC, BEHIND_SEC, laneY, pitchX, type PracticePlan } from '../practice/plan';
import { HIT, MISS, type HitTracker } from '../practice/hits';

/** Trail points kept: one per mic chunk (~43 ms), enough for 40 s. */
const TRAIL_CAPACITY = 1024;
const NOTE_WIDTH_CSS = 28;
const MIN_NOTE_HEIGHT_CSS = 8;
const TRAIL_WIDTH_CSS = 4;
/** Dark edge under the trail, so it stays visible over an orange (hit) block. */
const TRAIL_EDGE_CSS = 3;
const SIDE_PAD_CSS = 18;
const ACTIVE_OUTLINE_CSS = 3;
const MISS_OUTLINE_CSS = 2;
/** "Hit" / "Miss" stays on screen this long after the note is decided (s). */
const FLASH_SEC = 0.8;
const LABEL_FONT_CSS = 16;
const LABEL_PAD_CSS = 6;
const LABEL_GAP_CSS = 8;
const HIT_TEXT = 'Hit';
const MISS_TEXT = 'Miss';

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export class Lane {
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly trailT = new Float32Array(TRAIL_CAPACITY);
  private readonly trailHz = new Float32Array(TRAIL_CAPACITY);
  private trailN = 0;
  private readonly colors = { bg: '', grid: '', note: '', active: '', trail: '', hit: '', line: '', plate: '', label: '' };
  private w = 1;
  private h = 1;
  private dpr = 1;
  private hitY = 1;
  private pxPerSec = 1;
  private font = '';
  private hitTextW = 0;
  private missTextW = 0;
  private hits: HitTracker | null = null;

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
    this.colors.hit = token('--accent');
    this.colors.line = token('--text');
    this.colors.plate = token('--bg');
    this.colors.label = token('--text');
    this.resize();
  }

  /** The tracker whose hit / miss state colours the notes (same note order as plan.notes). */
  setHits(tracker: HitTracker | null): void {
    this.hits = tracker;
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
    this.font = `700 ${LABEL_FONT_CSS * this.dpr}px system-ui, sans-serif`;
    if (this.ctx) {
      this.ctx.font = this.font;
      this.hitTextW = this.ctx.measureText(HIT_TEXT).width;
      this.missTextW = this.ctx.measureText(MISS_TEXT).width;
    }
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

  /** Path of a block from (xb, bottom) to (xt, top), noteW wide. */
  private block(ctx: CanvasRenderingContext2D, xb: number, bottom: number, xt: number, top: number, noteW: number, grow: number): void {
    const half = noteW / 2 + grow;
    ctx.beginPath();
    ctx.moveTo(xb - half, bottom + grow);
    ctx.lineTo(xb + half, bottom + grow);
    ctx.lineTo(xt + half, top - grow);
    ctx.lineTo(xt - half, top - grow);
    ctx.closePath();
  }

  /** A "Hit" / "Miss" label on a solid plate beside x, on the hit line. */
  private label(ctx: CanvasRenderingContext2D, text: string, textW: number, x: number, noteW: number, color: string): void {
    const pad = LABEL_PAD_CSS * this.dpr;
    const gap = LABEL_GAP_CSS * this.dpr;
    const boxW = textW + 2 * pad;
    const boxH = LABEL_FONT_CSS * this.dpr + 2 * pad;
    // Right of the block, or left of it when there is no room.
    let left = x + noteW / 2 + gap;
    if (left + boxW > this.w) left = x - noteW / 2 - gap - boxW;
    const top = this.hitY - boxH - gap;
    ctx.fillStyle = this.colors.plate;
    ctx.fillRect(left, top, boxW, boxH);
    ctx.fillStyle = color;
    ctx.fillText(text, left + pad, top + boxH / 2);
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
    const state = this.hits?.state;
    for (let i = 0; i < this.plan.notes.length; i++) {
      const n = this.plan.notes[i];
      const bottom = laneY(n.start, now, hitY, pxPerSec);
      const top = Math.min(laneY(n.end, now, hitY, pxPerSec), bottom - minH);
      if (bottom < 0 || top > h) continue;
      const xb = this.x(n.hzStart);
      const xt = this.x(n.hzEnd);
      const s = state ? state[i] : 0;
      if (s === MISS) {
        // Missed: hollow block.
        ctx.strokeStyle = colors.note;
        ctx.lineWidth = MISS_OUTLINE_CSS * dpr;
        this.block(ctx, xb, bottom, xt, top, noteW, -ctx.lineWidth / 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = s === HIT ? colors.hit : colors.note;
        this.block(ctx, xb, bottom, xt, top, noteW, 0);
        ctx.fill();
      }
      // Active note: orange outline, so it stays distinct from the orange trail drawn on top.
      if (s !== HIT && now >= n.start && now <= n.end) {
        ctx.strokeStyle = colors.active;
        ctx.lineWidth = ACTIVE_OUTLINE_CSS * dpr;
        this.block(ctx, xb, bottom, xt, top, noteW, ctx.lineWidth / 2);
        ctx.stroke();
      }
    }

    // Trail: a dark edge first, then the orange line on top.
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
    ctx.strokeStyle = colors.plate;
    ctx.lineWidth = (TRAIL_WIDTH_CSS + 2 * TRAIL_EDGE_CSS) * dpr;
    ctx.stroke();
    ctx.strokeStyle = colors.trail;
    ctx.lineWidth = TRAIL_WIDTH_CSS * dpr;
    ctx.stroke();

    ctx.fillStyle = colors.line;
    ctx.fillRect(0, hitY - dpr, w, 2 * dpr);

    // Hit / Miss flash of the newest decided note only (labels of close notes would overlap).
    if (state && this.hits) {
      let newest = -1;
      for (let i = 0; i < state.length; i++) {
        const age = now - this.hits.decidedAt[i];
        if (state[i] !== 0 && age >= 0 && age < FLASH_SEC && (newest < 0 || this.hits.decidedAt[i] >= this.hits.decidedAt[newest])) newest = i;
      }
      if (newest >= 0) {
        ctx.font = this.font;
        ctx.textBaseline = 'middle';
        const x = this.x(this.plan.notes[newest].hzStart);
        if (state[newest] === HIT) this.label(ctx, HIT_TEXT, this.hitTextW, x, noteW, colors.hit);
        else this.label(ctx, MISS_TEXT, this.missTextW, x, noteW, colors.label);
      }
    }
  }
}
