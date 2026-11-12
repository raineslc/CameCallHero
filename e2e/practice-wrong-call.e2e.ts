import { expect, test } from '@playwright/test';
import { fakeMicArgs, paddedClip } from './fake-mic';
import { sameCallLevel, takeOnce } from './practice-helpers';

// Chromium's fake mic plays a putt: a wrong call for gobble practice (launch options are per file).
test.use({
  viewport: { width: 360, height: 740 },
  launchOptions: { args: fakeMicArgs(paddedClip('test/fixtures/turkey-other/putt-3.wav', 'putt-3.wav')) },
});

test('wrong call (putt) for gobble scores lower than the same-call level', async ({ page }) => {
  await page.goto('#/practice/gobble');
  await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled({ timeout: 10_000 });
  const score = await takeOnce(page);
  console.log(`putt take: ${score}, same-call level ${sameCallLevel.toFixed(1)}`);
  // Scored (not rejected), so the comparison is about the score itself.
  expect(score).not.toBeNull();
  expect(score!).toBeLessThan(sameCallLevel);
  expect(score!).toBeGreaterThanOrEqual(0);
});
