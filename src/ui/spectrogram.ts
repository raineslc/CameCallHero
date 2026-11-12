// Draws a log-mel spectrogram (Features.mel) on a canvas: time left to right, low
// frequencies at the bottom, colour from --bg (no energy) to --accent (loudest).

import type { Features } from '../audio/features';

/** Resolves a CSS colour token to [r, g, b] via the canvas colour parser. */
function tokenRgb(ctx: CanvasRenderingContext2D, name: string): [number, number, number] {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  ctx.fillStyle = value;
  const hex = /^#([0-9a-f]{6})$/i.exec(String(ctx.fillStyle));
  if (!hex) return [0, 0, 0];
  const n = parseInt(hex[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function drawSpectrogram(canvas: HTMLCanvasElement, f: Features): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const cols = Math.max(1, f.frameCount);
  const rows = Math.max(1, f.validBands);
  canvas.width = cols;
  canvas.height = rows;
  const lo = tokenRgb(ctx, '--bg');
  const hi = tokenRgb(ctx, '--accent');
  let max = 0;
  for (const m of f.mel) for (let b = 0; b < rows; b++) if (m[b] > max) max = m[b];
  const img = ctx.createImageData(cols, rows);
  for (let x = 0; x < f.frameCount; x++) {
    const m = f.mel[x];
    for (let b = 0; b < rows; b++) {
      const t = max > 0 ? Math.min(1, m[b] / max) : 0;
      const o = ((rows - 1 - b) * cols + x) * 4;
      for (let c = 0; c < 3; c++) img.data[o + c] = Math.round(lo[c] + (hi[c] - lo[c]) * t);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
