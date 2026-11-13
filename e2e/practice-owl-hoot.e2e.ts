import { expect, test } from '@playwright/test';
import { fakeMicArgs, paddedClip } from './fake-mic';
import { takeOnce } from './practice-helpers';

// Chromium's fake mic plays reference two-phrase hoot 1: a ~3.5 s call, much longer than the
// hoo-wah, so this checks the whole call fits the take and is scored.
test.use({
  viewport: { width: 360, height: 740 },
  launchOptions: { args: fakeMicArgs(paddedClip('public/audio/barred-owl/two-phrase-hoot-1.wav', 'two-phrase-hoot-1.wav')) },
});

test('a reference two-phrase hoot is scored and saved under the owl key', async ({ page }) => {
  await page.goto('#/barred-owl/practice/two-phrase-hoot');
  await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled({ timeout: 10_000 });
  const score = await takeOnce(page);
  console.log(`two-phrase hoot take: ${score}`);
  expect(score).not.toBeNull();
  // Lowest leave-one-out score of the two-phrase references is 62.8 (test/calibration-owl.test.ts).
  expect(score!).toBeGreaterThanOrEqual(62.8);
  await expect(page.locator('#practice-results')).not.toContainText(/turkey/i);
  expect(await page.evaluate(() => localStorage.getItem('camecallhero.best.barred-owl.two-phrase-hoot'))).toBe(String(Math.round(score!)));
});
