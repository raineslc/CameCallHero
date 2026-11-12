import type { Page } from '@playwright/test';

declare global {
  interface Window {
    __streams: MediaStream[];
    __contexts: AudioContext[];
  }
}

/** Records every mic stream and AudioContext the app opens, so a test can check they are released. */
export async function spy(page: Page) {
  await page.addInitScript(() => {
    window.__streams = [];
    window.__contexts = [];
    const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
      const s = await gum(c);
      window.__streams.push(s);
      return s;
    };
    const Ctx = window.AudioContext;
    window.AudioContext = class extends Ctx {
      constructor(o?: AudioContextOptions) {
        super(o);
        window.__contexts.push(this);
      }
    };
  });
}

/** Mic streams opened, tracks still live, and the state of every AudioContext. */
export const micState = (page: Page) =>
  page.evaluate(() => ({
    streams: window.__streams.length,
    live: window.__streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState !== 'ended').length,
    contexts: window.__contexts.map((c) => c.state),
  }));
