import { expect, test } from '@playwright/test';
import { CHALLENGE_RULES } from '../src/challenge/rules';
import { audit } from './design-audit';
import { fakeMicArgs, sequenceClip } from './fake-mic';
import { noHorizontalScroll } from './practice-helpers';

// Phase 10: barred owl calling challenge with a fake mic that plays a reference two-phrase hoot,
// a 2 s pause (the owl split gap is 1.3 s) and a reference hoo-wah. Owl rank titles, its own
// leaderboard (the turkey board is untouched) and the back link to the owl home.
test.use({
  viewport: { width: 360, height: 740 },
  launchOptions: {
    args: fakeMicArgs(sequenceClip(['public/audio/barred-owl/two-phrase-hoot-1.wav', 'public/audio/barred-owl/inspection-call-1.wav'], 'owl-hoot-hoowah.wav', 2)),
  },
});

const ranks = CHALLENGE_RULES['barred-owl'].ranks;

test('owl challenge: a two-phrase hoot and a hoo-wah are recognized, owl ranks, own leaderboard', async ({ page }) => {
  await page.goto('#/barred-owl');
  await page.getByRole('link', { name: 'Calling challenge' }).click();
  await expect(page).toHaveURL(/#\/barred-owl\/challenge$/);
  await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveAttribute('href', '#/barred-owl');
  await expect(page.locator('#challenge-intro')).toContainText('wild owls');
  await expect(page.locator('main')).not.toContainText(/turkey|kee kee/i);
  await expect(page.locator('#challenge-help')).toContainText('1.3 s');
  await expect(page.locator('#challenge-help')).toContainText('who cooks for you 48 or more');
  await expect(page.locator('#challenge-help')).toContainText('hoo-wah 52 or more');
  await expect(page.locator('#challenge-help')).toContainText('The rank titles are just names.');
  const ready = page.getByRole('button', { name: "I'm ready" });
  await expect(ready).toBeEnabled({ timeout: 10_000 });
  expect(await page.evaluate(audit)).toEqual([]);

  await ready.click();
  const stop = page.getByRole('button', { name: 'Stop' });
  await expect(stop).toBeVisible({ timeout: 10_000 });
  await page.waitForFunction(() => Number.parseInt(document.querySelector('#challenge-time')?.textContent ?? '0', 10) >= 10, null, { timeout: 25_000 });
  await stop.click();

  await expect(page.locator('#challenge-results')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#challenge-rejected')).toBeHidden();
  const rows = await page.locator('#challenge-segments li').evaluateAll((els) => els.map((e) => [(e as HTMLElement).dataset.call, (e as HTMLElement).dataset.recognized, e.textContent]));
  console.log(`owl challenge take: ${await page.locator('#challenge-score').textContent()} ${await page.locator('#challenge-rank').textContent()} | ${rows.map((r) => r[2]).join(' | ')}`);
  expect(rows.filter((r) => r[1] === 'true').map((r) => r[0])).toEqual(['two-phrase-hoot', 'inspection-call']);
  const rank = (await page.locator('#challenge-rank').textContent())!.replace(/^Rank: /, '');
  expect(ranks).toContain(rank);
  await noHorizontalScroll(page);
  expect(await page.evaluate(audit)).toEqual([]);

  await page.getByLabel('Your name').fill('Night Owl');
  await page.getByRole('button', { name: 'Save score' }).click();
  await expect(page.locator('#challenge-save-status')).toHaveText(/^Saved\. Place 1 of 1\./);
  await expect(page.locator('#challenge-board-list li')).toHaveCount(1);

  // The turkey board is a different board; the owl board survives a reload.
  await page.goto('#/challenge');
  await expect(page.locator('#challenge-board-empty')).toBeVisible();
  await expect(page.locator('#challenge-board-list li')).toHaveCount(0);
  await page.goto('#/barred-owl/challenge');
  await page.reload();
  await expect(page.locator('#challenge-board-list li .board-name')).toHaveText(['Night Owl']);
});

test('an unknown species in the challenge link shows a plain message', async ({ page }) => {
  await page.goto('#/challenge/no-such-bird');
  await expect(page.locator('main')).toContainText('There is no such species here.');
  expect(await page.evaluate(audit)).toEqual([]);
});
