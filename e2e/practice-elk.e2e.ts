import { expect, test } from '@playwright/test';
import { fakeMicArgs, paddedClip } from './fake-mic';
import { takeOnce } from './practice-helpers';

// Chromium's fake mic plays reference calf call 1 (the clip shown on the lane).
test.use({
  viewport: { width: 360, height: 740 },
  launchOptions: { args: fakeMicArgs(paddedClip('public/audio/elk/calf-call-1.wav', 'calf-call-1.wav')) },
});

test('a reference calf call is scored, saved under the elk key, with elk wording', async ({ page }) => {
  await page.goto('#/elk/practice/calf-call');
  await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled({ timeout: 10_000 });
  const score = await takeOnce(page);
  console.log(`calf call take: ${score}`);
  expect(score).not.toBeNull();
  // Lowest leave-one-out score of the calf call references is 77.2 (test/calibration-elk.test.ts);
  // a clip scored against itself and the others must reach at least that.
  expect(score!).toBeGreaterThanOrEqual(77);
  await expect(page.locator('#practice-results')).not.toContainText(/turkey|owl/i);
  await expect(page.locator('#practice-overlay-ref')).toHaveText(/^Elk, clip \d/);
  const stored = await page.evaluate(() => ({
    elk: localStorage.getItem('camecallhero.best.elk.calf-call'),
    bare: localStorage.getItem('camecallhero.best.calf-call'),
  }));
  expect(stored.elk).toBe(String(Math.round(score!)));
  expect(stored.bare).toBeNull();
});

test('calf call clips name the NPS library and public-domain license, not xeno-canto', async ({ page }) => {
  await page.goto('#/elk/call/calf-call');
  await page.getByText('Reference clips and licenses').click();
  const attr = page.locator('.clip .attribution');
  await expect(attr).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    await expect(attr.nth(i)).toContainText('NPS / Shan Burson, National Park Service sound library: Elk Calf');
    await expect(attr.nth(i)).toContainText('Public domain (US government work)');
    await expect(attr.nth(i)).not.toContainText(/xeno-canto|undefined/);
  }
});
