import { expect, test } from '@playwright/test';
import { fakeMicArgs, paddedClip } from './fake-mic';
import { takeOnce } from './practice-helpers';

// Chromium's fake mic plays the reference yelp shown on the lane (launch options are per file).
test.use({
  viewport: { width: 360, height: 740 },
  launchOptions: { args: fakeMicArgs(paddedClip('public/audio/turkey/yelp-1.wav', 'yelp-1.wav')) },
});

test('a reference yelp hits notes on the lane and in the results', async ({ page }) => {
  await page.goto('#/practice/yelp');
  await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled({ timeout: 10_000 });
  const score = await takeOnce(page);
  expect(score).not.toBeNull();
  const hits = page.locator('#practice-hits');
  const live = Number(await hits.getAttribute('data-hits'));
  const missed = Number(await hits.getAttribute('data-misses'));
  console.log(`yelp take: ${score}, lane ${await hits.textContent()}, results ${await page.locator('#practice-hit-count').textContent()}`);
  expect(live).toBeGreaterThan(0);
  // Every lane note is decided once the take ends.
  expect(live + missed).toBe(Number((await hits.textContent())!.match(/of (\d+) hit/)![1]));
  expect(Number(await page.locator('#practice-hit-count').getAttribute('data-hit'))).toBeGreaterThan(0);
});
