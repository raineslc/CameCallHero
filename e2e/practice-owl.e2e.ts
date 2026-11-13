import { expect, test } from '@playwright/test';
import { fakeMicArgs, paddedClip } from './fake-mic';
import { takeOnce } from './practice-helpers';

// Chromium's fake mic plays reference hoo-wah 1 (the clip shown on the lane).
test.use({
  viewport: { width: 360, height: 740 },
  launchOptions: { args: fakeMicArgs(paddedClip('public/audio/barred-owl/inspection-call-1.wav', 'inspection-call-1.wav')) },
});

test('a reference hoo-wah is scored, saved under the owl key, with owl wording', async ({ page }) => {
  await page.goto('#/barred-owl/practice/inspection-call');
  await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled({ timeout: 10_000 });
  const score = await takeOnce(page);
  console.log(`hoo-wah take: ${score}`);
  expect(score).not.toBeNull();
  // Leave-one-out level of the hoo-wah references is 69.4 (test/calibration-owl.test.ts); a
  // clip scored against itself and the others must reach at least that.
  expect(score!).toBeGreaterThanOrEqual(69);
  await expect(page.locator('#practice-results')).not.toContainText(/turkey/i);
  await expect(page.locator('#practice-overlay-ref')).toHaveText(/^Owl, clip \d/);
  const stored = await page.evaluate(() => ({
    owl: localStorage.getItem('camecallhero.best.barred-owl.inspection-call'),
    bare: localStorage.getItem('camecallhero.best.inspection-call'),
  }));
  expect(stored.owl).toBe(String(Math.round(score!)));
  expect(stored.bare).toBeNull();
});
