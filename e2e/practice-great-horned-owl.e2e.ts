import { expect, test } from '@playwright/test';
import { GREAT_HORNED_OWL } from '../src/calls/species';
import { fakeMicArgs, paddedClip } from './fake-mic';
import { noHorizontalScroll, takeOnce, tapTargets } from './practice-helpers';

// Phase 13: Chromium's fake mic plays great horned owl territorial hoot 8 (a female reference).
test.use({
  viewport: { width: 360, height: 740 },
  launchOptions: { args: fakeMicArgs(paddedClip('public/audio/great-horned-owl/territorial-hoot-8.wav', 'territorial-hoot-8.wav')) },
});

test('the picker lists the great horned owl and its call page', async ({ page }) => {
  await page.goto('');
  const picker = page.getByRole('group', { name: 'Species' });
  await picker.getByRole('link', { name: 'Great horned owl' }).click();
  await expect(page).toHaveURL(/#\/great-horned-owl$/);
  await expect(page.getByRole('heading', { name: 'Great horned owl', level: 2 })).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(GREAT_HORNED_OWL.calls.length);
  await expect(page.locator('.card[data-call="territorial-hoot"]')).toHaveAttribute('href', '#/great-horned-owl/call/territorial-hoot');
  await expect(page.locator('main .cards')).not.toContainText(/turkey/i);
  await noHorizontalScroll(page);
  await tapTargets(page);
});

test('a reference territorial hoot is scored and saved under the great horned owl key', async ({ page }) => {
  await page.goto('#/great-horned-owl/practice/territorial-hoot');
  await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled({ timeout: 10_000 });
  const score = await takeOnce(page);
  console.log(`territorial hoot take: ${score}`);
  expect(score).not.toBeNull();
  // Lowest leave-one-out score of the references is 74.9 (test/calibration-great-horned-owl.test.ts);
  // a clip scored against itself and the others must reach at least that.
  expect(score!).toBeGreaterThanOrEqual(74);
  await expect(page.locator('#practice-results')).not.toContainText(/turkey/i);
  const stored = await page.evaluate(() => ({
    gho: localStorage.getItem('camecallhero.best.great-horned-owl.territorial-hoot'),
    bare: localStorage.getItem('camecallhero.best.territorial-hoot'),
  }));
  expect(stored.gho).toBe(String(Math.round(score!)));
  expect(stored.bare).toBeNull();
});
