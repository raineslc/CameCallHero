// Score card: a PNG drawn on a canvas (camo band, app name, player name, score, stars, rank,
// call breakdown), shared with the Web Share API when the browser can share files, otherwise
// downloaded. The card is an image only: no audio is ever attached. Colours are the theme
// tokens; text sits on solid fills, never on the camo.

import { assetUrl } from '../library/references';
import type { ChallengeResult } from './analyze';

export const CARD_W = 1080;
export const CARD_H = 1350;
export const CARD_FILE = 'game-call-hero-score.png';
const FONT = 'system-ui, sans-serif';
const BAND = 200;
const MAX_LINES = 5;

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function loadCamo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = assetUrl('camo.png');
  });
}

/** `text`, shortened with an ellipsis until it fits `max` pixels in the current font. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  const chars = Array.from(text);
  while (chars.length > 1 && ctx.measureText(`${chars.join('')}…`).width > max) chars.pop();
  return `${chars.join('')}…`;
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
  }
  ctx.closePath();
}

export interface CardData {
  /** Heading under the app name, e.g. "Turkey calling challenge". */
  title: string;
  name: string;
  date: string;
  result: Pick<ChallengeResult, 'score' | 'stars' | 'rank' | 'segments'>;
}

/** The text lines of the call breakdown, as on the results screen. */
export function breakdownLines(segments: ChallengeResult['segments'], max = MAX_LINES): string[] {
  const lines = segments.map((s) => (s.recognized && s.call ? `${s.call.name} ${Math.round(s.score)}` : 'Not recognized'));
  return lines.length > max ? [...lines.slice(0, max - 1), `+${lines.length - max + 1} more`] : lines;
}

export async function drawCard(canvas: HTMLCanvasElement, data: CardData): Promise<void> {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  const camo = await loadCamo();
  const c = { bg: token('--bg'), surface: token('--surface'), text: token('--text'), muted: token('--text-muted'), accent: token('--accent'), camo: token('--camo-1') };

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const band = (y: number, h: number) => {
    ctx.fillStyle = (camo && ctx.createPattern(camo, 'repeat')) || c.camo;
    ctx.fillRect(0, y, CARD_W, h);
  };
  band(0, BAND);
  band(CARD_H - 60, 60);
  ctx.fillStyle = c.accent;
  ctx.fillRect(0, BAND, CARD_W, 8);
  ctx.fillRect(0, CARD_H - 68, CARD_W, 8);

  // App name on a solid plate over the camo.
  ctx.textBaseline = 'middle';
  ctx.font = `800 64px ${FONT}`;
  const parts: [string, string][] = [['Game ', c.text], ['Call', c.accent], [' Hero', c.text]];
  const nameW = parts.reduce((w, [t]) => w + ctx.measureText(t).width, 0);
  ctx.fillStyle = c.bg;
  ctx.beginPath();
  ctx.roundRect(60, 50, nameW + 64, 100, 18);
  ctx.fill();
  let x = 92;
  for (const [t, col] of parts) {
    ctx.fillStyle = col;
    ctx.fillText(t, x, 100);
    x += ctx.measureText(t).width;
  }

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = c.muted;
  ctx.font = `600 40px ${FONT}`;
  ctx.fillText(fit(ctx, data.title, CARD_W - 144), 72, 300);
  ctx.fillStyle = c.text;
  ctx.font = `800 80px ${FONT}`;
  ctx.fillText(fit(ctx, data.name, CARD_W - 144), 72, 400);
  ctx.fillStyle = c.muted;
  ctx.font = `500 36px ${FONT}`;
  ctx.fillText(data.date, 72, 456);

  const score = String(Math.round(data.result.score));
  ctx.fillStyle = c.accent;
  ctx.font = `800 200px ${FONT}`;
  ctx.fillText(score, 64, 680);
  const sw = ctx.measureText(score).width;
  ctx.fillStyle = c.muted;
  ctx.font = `600 56px ${FONT}`;
  ctx.fillText('/ 100', 64 + sw + 20, 680);

  for (let k = 0; k < 5; k++) {
    star(ctx, 112 + k * 96, 760, 40);
    if (k < data.result.stars) {
      ctx.fillStyle = c.accent;
      ctx.fill();
    } else {
      ctx.strokeStyle = c.muted;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  }

  ctx.fillStyle = c.text;
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText(fit(ctx, `Rank: ${data.result.rank}`, CARD_W - 144), 72, 900);

  const lines = breakdownLines(data.result.segments);
  const top = 950;
  const lineH = 58;
  ctx.fillStyle = c.surface;
  ctx.beginPath();
  ctx.roundRect(60, top, CARD_W - 120, Math.max(1, lines.length) * lineH + 40, 18);
  ctx.fill();
  ctx.fillStyle = c.accent;
  ctx.fillRect(60, top, 10, Math.max(1, lines.length) * lineH + 40);
  ctx.font = `700 44px ${FONT}`;
  lines.forEach((t, i) => {
    ctx.fillStyle = t === 'Not recognized' ? c.muted : c.text;
    ctx.fillText(fit(ctx, t, CARD_W - 220), 100, top + 20 + (i + 1) * lineH - 12);
  });
}

export const cardBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no image'))), 'image/png'));

/**
 * Shares the PNG with the system share sheet when the browser can share files; otherwise
 * downloads it. 'cancelled' when the user closed the share sheet.
 */
export async function shareCard(blob: Blob, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], CARD_FILE, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Game Call Hero', text });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // Any other failure (not allowed, no share target): fall back to a download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = CARD_FILE;
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
