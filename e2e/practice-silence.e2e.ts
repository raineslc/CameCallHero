import { expect, test } from '@playwright/test';
import { fakeMicArgs, paddedClip } from './fake-mic';
import { takeOnce } from './practice-helpers';
import { micState, spy } from './spy';

// Chromium's fake mic plays silence (launch options are per file).
test.use({
  viewport: { width: 360, height: 740 },
  launchOptions: { args: fakeMicArgs(paddedClip('test/fixtures/junk/silence.wav', 'silence.wav')) },
});

test('silence: green quiet light (the floor is low), every note missed, take not scored', async ({ page }) => {
  await spy(page);
  await page.goto('#/practice/gobble');
  await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled({ timeout: 10_000 });
  const ready = takeOnce(page);
  await expect(page.locator('#practice-quiet')).toHaveAttribute('data-state', 'ok', { timeout: 10_000 });
  await expect(page.locator('#practice-meter .lmeter-label')).toHaveText('Move closer');
  expect(await ready).toBeNull();
  await expect(page.locator('#practice-rejected')).toContainText('Too quiet');
  const hits = page.locator('#practice-hits');
  await expect(hits).toHaveAttribute('data-hits', '0');
  expect(Number(await hits.getAttribute('data-misses'))).toBeGreaterThan(0);
  // A rejected take can still be heard back, without the mic.
  await page.getByRole('button', { name: 'Play yours' }).click();
  await expect(page.locator('#practice-play-take')).toHaveAttribute('data-playing', 'true');
  expect((await micState(page)).live).toBe(0);
});
