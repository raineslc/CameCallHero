// Shared helpers for the practice e2e tests.
import { expect, type Page } from '@playwright/test';
import { extractFeatures } from '../src/audio/features';
import { scoreTake } from '../src/audio/score';
import { callById } from '../src/calls/turkey';
import { readWav } from '../test/wav';

const gobble = callById('gobble');

/**
 * The engine's same-call level: the lowest leave-one-out score of a reference gobble against
 * the other references (the Phase 2 calibration measure), computed here from the same files.
 */
export const sameCallLevel = (() => {
  const refs = gobble.references.map((p) => extractFeatures(readWav(new URL(`../public/${p}`, import.meta.url))));
  return Math.min(...refs.map((f, i) => scoreTake(f, refs.filter((_, j) => j !== i), gobble.weights).score));
})();

export async function noHorizontalScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
}

export async function tapTargets(page: Page) {
  const small = await page
    .locator('main a:visible, main button:visible')
    .evaluateAll((els) => els.map((e) => [e.textContent, e.getBoundingClientRect().height] as const).filter(([, h]) => h < 44));
  expect(small).toEqual([]);
}

/** Runs one take from the practice screen and returns the shown score (null if rejected). */
export async function takeOnce(page: Page): Promise<number | null> {
  await page.getByRole('button', { name: "I'm ready" }).click();
  await expect(page.locator('#practice-run')).toBeVisible();
  // Nothing plays while recording.
  expect(await page.locator('#practice-audio').evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
  await expect(page.locator('#practice-count')).toHaveText('3', { timeout: 10_000 });
  // Count-in: the note target is shown above the lane; while recording, the live note count.
  await expect(page.locator('#practice-notes')).toHaveText(/^Make (1 note lasting|\d+ notes in) about \d+\.\d seconds\.$/);
  await expect(page.locator('#practice-notes')).toHaveText(/^Notes so far: \d+ of \d+$/, { timeout: 10_000 });
  await expect(page.locator('#practice-results')).toBeVisible({ timeout: 20_000 });
  if (await page.locator('#practice-rejected').isVisible()) return null;
  return Number(await page.locator('#practice-score').getAttribute('data-score'));
}

