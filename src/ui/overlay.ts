// Results overlay: the take's notes against the closest reference's notes on one time axis
// (the perform part of the timeline). Reference row on top, user row below.

import { HOP_SEC, type Features } from '../audio/features';
import { notesOf, type PracticePlan } from '../practice/plan';

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** User notes on the timeline: take frames start at plan.performStart, shifted back by the tap latency. */
export function takeNotes(take: Features, plan: PracticePlan, latencySec: number): { start: number; end: number }[] {
  return take.notes.map((n) => ({
    start: plan.performStart + n.start * HOP_SEC - latencySec,
    end: plan.performStart + n.end * HOP_SEC - latencySec,
  }));
}

export function drawOverlay(canvas: HTMLCanvasElement, plan: PracticePlan, ref: Features, take: Features, latencySec: number): void {
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
  const bar = (notes: { start: number; end: number }[], y: number, color: string) => {
    ctx.fillStyle = color;
    for (const n of notes) ctx.fillRect(x(n.start), y + pad, Math.max(2 * dpr, x(n.end) - x(n.start)), row - 2 * pad);
  };
  bar(
    notesOf(ref).map((n) => ({ start: n.start + plan.callAt, end: n.end + plan.callAt })),
    0,
    token('--text-muted'),
  );
  bar(takeNotes(take, plan, latencySec), row, token('--accent'));
  ctx.fillStyle = token('--surface-2');
  ctx.fillRect(0, row - dpr / 2, w, dpr);
}
