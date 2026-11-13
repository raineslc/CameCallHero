import { expect, test } from '@playwright/test';
import { WOOD_DUCK } from '../src/calls/species';
import { fakeMicArgs, paddedClip } from './fake-mic';
import { noHorizontalScroll, takeOnce, tapTargets } from './practice-helpers';

// Phase 14: Chromium's fake mic plays wood duck drake whistle 1 (a reference).
test.use({
  viewport: { width: 360, height: 740 },
  launchOptions: { args: fakeMicArgs(paddedClip('public/audio/wood-duck/drake-whistle-1.wav', 'drake-whistle-1.wav')) },
});

test('the picker lists the wood duck; the hen flush call is locked, the drake whistle is not', async ({ page }) => {
  await page.goto('');
  const picker = page.getByRole('group', { name: 'Species' });
  await picker.getByRole('link', { name: 'Wood duck' }).click();
  await expect(page).toHaveURL(/#\/wood-duck$/);
  await expect(page.getByRole('heading', { name: 'Wood duck', level: 2 })).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(WOOD_DUCK.calls.length);
  await expect(page.locator('.card[data-call="hen-flush"] .badge')).toHaveText('Coming soon');
  await expect(page.locator('.card[data-call="drake-whistle"]')).toHaveAttribute('href', '#/wood-duck/call/drake-whistle');
  await expect(page.locator('main .cards')).not.toContainText(/turkey|owl/i);
  await noHorizontalScroll(page);
  await tapTargets(page);
});

test('a reference drake whistle is scored and saved under the wood duck key', async ({ page }) => {
  await page.goto('#/wood-duck/practice/drake-whistle');
  await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled({ timeout: 10_000 });
  const score = await takeOnce(page);
  console.log(`drake whistle take: ${score}`);
  expect(score).not.toBeNull();
  // Lowest leave-one-out score of the references is 66.5 (test/calibration-wood-duck.test.ts);
  // a clip scored against itself and the others must reach at least that.
  expect(score!).toBeGreaterThanOrEqual(66);
  await expect(page.locator('#practice-results')).not.toContainText(/turkey|owl/i);
  const stored = await page.evaluate(() => ({
    duck: localStorage.getItem('camecallhero.best.wood-duck.drake-whistle'),
    bare: localStorage.getItem('camecallhero.best.drake-whistle'),
  }));
  expect(stored.duck).toBe(String(Math.round(score!)));
  expect(stored.bare).toBeNull();
});
