// Results overlay: the take's notes against the closest reference's notes on one time axis
// (the perform part of the timeline). Reference row on top, user row below. Filled = hit
// (a turkey note your call reached, or your note that reached one); hollow = missed or extra.

import { HOP_SEC, type Features } from '../audio/features';
import { notesOf, type PracticePlan } from '../practice/plan';
import type { Span } from '../practice/hits';

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** User notes on the timeline: take frames start at plan.performStart, shifted back by the tap latency. */
export function takeNotes(take: Features, plan: PracticePlan, latencySec: number): Span[] {
  return take.notes.map((n) => ({
    start: plan.performStart + n.start * HOP_SEC - latencySec,
    end: plan.performStart + n.end * HOP_SEC - latencySec,
  }));
}

/** Notes of a reference as the lane would place them on the timeline. */
export const refNotes = (ref: Features, plan: PracticePlan): Span[] =>
  notesOf(ref).map((n) => ({ start: n.start + plan.callAt, end: n.end + plan.callAt }));

export function drawOverlay(
  canvas: HTMLCanvasElement,
  plan: PracticePlan,
  ref: Span[],
  take: Span[],
  marks: { refHit: boolean[]; takeHit: boolean[] },
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const r = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const w = (canvas.width = Math.max(1, Math.round(r.width * dpr)));
  const h = (canvas.height = Math.max(1, Math.round(r.height * dpr)));
  const t0 = plan.performStart;
  const span = Math.max(0.1, plan.end - t0);
  const x = (t: number) => Math.max(0, Math.min(w, ((t - t0) / span) * w));
  ctx.fillStyle = token('--surface');
  ctx.fillRect(0, 0, w, h);
  const row = h / 2;
  const pad = 6 * dpr;
  const line = 2 * dpr;
  const bar = (notes: Span[], hit: boolean[], y: number, color: string) => {
    notes.forEach((n, i) => {
      const left = x(n.start);
      const width = Math.max(2 * dpr, x(n.end) - left);
      if (hit[i]) {
        ctx.fillStyle = color;
        ctx.fillRect(left, y + pad, width, row - 2 * pad);
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = line;
        ctx.strokeRect(left + line / 2, y + pad + line / 2, Math.max(line, width - line), row - 2 * pad - line);
      }
    });
  };
  bar(ref, marks.refHit, 0, token('--text-muted'));
  bar(take, marks.takeHit, row, token('--accent'));
  ctx.fillStyle = token('--surface-2');
  ctx.fillRect(0, row - dpr / 2, w, dpr);
}
