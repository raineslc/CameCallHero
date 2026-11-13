import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { audit } from './design-audit';
import { fakeMicArgs, sequenceClip } from './fake-mic';
import { noHorizontalScroll } from './practice-helpers';

// Calling challenge with a fake mic that plays a reference yelp, a 1 s pause and a reference
// gobble. Also the design pass on the results, the leaderboard and the score card fallback.
// SCREENSHOTS=1 also writes the PR screenshots (docs/screenshots/challenge-*-360.png).
test.use({
  viewport: { width: 360, height: 740 },
  deviceScaleFactor: process.env.SCREENSHOTS ? 2 : 1,
  launchOptions: { args: fakeMicArgs(sequenceClip(['public/audio/turkey/yelp-1.wav', 'public/audio/turkey/gobble-1.wav'], 'yelp-gobble.wav')) },
});

const shot = async (page: Page, name: string, fullPage = false) => {
  if (process.env.SCREENSHOTS) await page.screenshot({ path: `docs/screenshots/challenge-${name}-360.png`, fullPage });
};

/** Records until the take holds `seconds` after the count-in, then taps Stop. */
async function record(page: Page, seconds: number) {
  await page.getByRole('button', { name: "I'm ready" }).click();
  await expect(page.locator('#challenge-run')).toBeVisible();
  await expect(page.locator('#challenge-quiet')).toHaveAttribute('data-state', 'ok', { timeout: 10_000 });
  const stop = page.getByRole('button', { name: 'Stop' });
  await expect(stop).toBeVisible({ timeout: 10_000 });
  await page.waitForFunction((s) => Number.parseInt(document.querySelector('#challenge-time')?.textContent ?? '0', 10) >= s, seconds, { timeout: 20_000 });
  return stop;
}

test('a yelp and a gobble in one take: two recognized calls, saved to the leaderboard, card downloaded', async ({ page }) => {
  await page.goto('');
  await page.getByRole('link', { name: 'Calling challenge' }).click();
  await expect(page).toHaveURL(/#\/challenge$/);
  await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled({ timeout: 10_000 });
  await expect(page.locator('#challenge-board-empty')).toBeVisible();

  const stop = await record(page, 4);
  await shot(page, 'recording');
  expect(await page.evaluate(audit)).toEqual([]);
  await page.waitForFunction(() => Number.parseInt(document.querySelector('#challenge-time')?.textContent ?? '0', 10) >= 8, null, { timeout: 20_000 });
  await stop.click();

  await expect(page.locator('#challenge-results')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#challenge-rejected')).toBeHidden();
  const segs = page.locator('#challenge-segments li');
  const rows = await segs.evaluateAll((els) => els.map((e) => [(e as HTMLElement).dataset.call, (e as HTMLElement).dataset.recognized, e.textContent]));
  console.log(`challenge take: ${await page.locator('#challenge-score').textContent()} ${await page.locator('#challenge-rank').textContent()} | ${rows.map((r) => r[2]).join(' | ')}`);
  expect(rows.filter((r) => r[1] === 'true').map((r) => r[0])).toEqual(['yelp', 'gobble']);
  await expect(page.locator('#challenge-timeline .seg.on')).toHaveCount(2);
  const score = Number(await page.locator('#challenge-score').getAttribute('data-score'));
  expect(score).toBeGreaterThan(0);
  expect(score).toBeLessThanOrEqual(100);
  await expect(page.locator('#challenge-rank')).toHaveText(/^Rank: (Poult|Jake|Gobbler|Longbeard|Boss gobbler)$/);
  await expect(page.locator('#challenge-stars')).toHaveAttribute('aria-label', /^[1-5] of 5 stars$/);
  await expect(page.locator('#challenge-next')).toHaveText(/^Next try: /);
  await expect(page.getByRole('button', { name: 'Play yours' })).toBeEnabled();
  await noHorizontalScroll(page);
  expect(await page.evaluate(audit)).toEqual([]);
  await shot(page, 'results', true);

  // Leaderboard: the name is plain text, never HTML.
  await page.getByLabel('Your name').fill('  <b>Tom</b>  ');
  await page.getByRole('button', { name: 'Save score' }).click();
  await expect(page.locator('#challenge-save-status')).toHaveText(/^Saved\. Place 1 of 1\./);
  const first = page.locator('#challenge-board-list li').first();
  await expect(first.locator('.board-name')).toHaveText('<b>Tom</b>');
  await expect(first.locator('b')).toHaveCount(0);
  await expect(first.locator('.board-score')).toHaveText(String(Math.round(score)));
  expect(await page.evaluate(audit)).toEqual([]);

  // Share: headless Chromium on Linux has no file sharing, so the card is downloaded.
  const canShare = await page.evaluate(() => {
    const file = new File([new Uint8Array(1)], 'x.png', { type: 'image/png' });
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  });
  expect(canShare).toBe(false);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Share score card' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('game-call-hero-score.png');
  const png = readFileSync(await file.path());
  expect(Array.from(png.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]); // PNG signature
  await expect(page.locator('#challenge-share-status')).toHaveAttribute('data-how', 'downloaded');
  await expect(page.locator('#challenge-card')).toBeVisible();
  expect(await page.evaluate(audit)).toEqual([]);
  if (process.env.SCREENSHOTS) {
    await page.locator('#challenge-board').scrollIntoViewIfNeeded();
    await shot(page, 'leaderboard');
    await file.saveAs('docs/screenshots/challenge-card.png');
  }

  // The board survives a reload; clearing asks first.
  await page.reload();
  await expect(page.locator('#challenge-board-list li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear leaderboard' }).click();
  expect(await page.evaluate(audit)).toEqual([]);
  await page.getByRole('button', { name: 'Keep them' }).click();
  await expect(page.locator('#challenge-board-list li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear leaderboard' }).click();
  await page.getByRole('button', { name: 'Yes, clear' }).click();
  await expect(page.locator('#challenge-board-list li')).toHaveCount(0);
  await expect(page.locator('#challenge-board-empty')).toBeVisible();
});
