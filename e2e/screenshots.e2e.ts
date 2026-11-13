import { expect, test } from '@playwright/test';
import { fakeMicArgs, paddedClip } from './fake-mic';

// PR screenshots at 360 px (run with SCREENSHOTS=1; skipped otherwise). The fake mic plays the
// reference yelp shown on the lane, so the slanted blocks and hits are visible.
test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to write docs/screenshots/');
test.use({
  viewport: { width: 360, height: 740 },
  deviceScaleFactor: 2,
  launchOptions: { args: fakeMicArgs(paddedClip('public/audio/turkey/yelp-1.wav', 'yelp-1.wav')) },
});

const out = (name: string) => `docs/screenshots/${name}-360.png`;

test('practice: count-in, lane mid-take, results', async ({ page }) => {
  await page.goto('#/practice/yelp');
  await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole('button', { name: "I'm ready" }).click();
  await expect(page.locator('#practice-quiet')).toHaveAttribute('data-state', 'ok', { timeout: 10_000 });
  await expect(page.locator('#practice-count')).toHaveText('2', { timeout: 10_000 });
  await page.screenshot({ path: out('practice-count-in') });
  await page.waitForFunction(() => Number(document.querySelector('#practice-hits')?.getAttribute('data-hits')) >= 4, null, {
    polling: 'raf',
    timeout: 15_000,
  });
  await page.screenshot({ path: out('practice-lane-hits') });
  await expect(page.locator('#practice-results')).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: out('practice-results'), fullPage: true });
});

test('mic check meter', async ({ page }) => {
  await page.goto('#/mic');
  await page.getByRole('button', { name: 'Start mic' }).click();
  await expect(page.locator('#mic-floor')).toContainText('dBFS', { timeout: 10_000 });
  await page.waitForFunction(() => document.querySelector('#mic-meter')?.getAttribute('data-zone') === 'good', null, { polling: 'raf', timeout: 15_000 });
  await page.screenshot({ path: out('mic-check-meter') });
});

test('species picker and barred owl pages', async ({ page }) => {
  await page.goto('#/barred-owl');
  await expect.poll(() => page.locator('.card canvas').first().evaluate((el) => (el as HTMLCanvasElement).width)).toBeGreaterThan(1);
  await page.screenshot({ path: out('home-owl') });
  await page.goto('#/barred-owl/call/inspection-call');
  await expect(page.locator('#call-measure')).toHaveText(/note/);
  await page.screenshot({ path: out('call-owl-hoo-wah') });
});
