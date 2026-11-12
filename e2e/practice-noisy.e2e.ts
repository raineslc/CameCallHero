import { expect, test } from '@playwright/test';
import { MAX_QUIET_FLOOR_DB } from '../src/audio/meter';
import { fakeMicArgs, noiseClip } from './fake-mic';

// Chromium's fake mic plays steady noise 6 dB above the highest floor the scorer can work with.
test.use({
  viewport: { width: 360, height: 740 },
  launchOptions: { args: fakeMicArgs(noiseClip('noise.wav', MAX_QUIET_FLOOR_DB + 6)) },
});

test('loud background: red quiet light with a plain reason, and the scorer refuses the take', async ({ page }) => {
  await page.goto('#/practice/gobble');
  await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole('button', { name: "I'm ready" }).click();
  await expect(page.locator('#practice-quiet')).toHaveAttribute('data-state', 'bad', { timeout: 10_000 });
  await expect(page.locator('#practice-quiet-text')).toHaveText('Too much background noise. Move away from fans, wind or traffic.');
  // The red light stays up during the take.
  await expect(page.locator('#practice-count')).toHaveText('Call now', { timeout: 10_000 });
  await expect(page.locator('#practice-quiet')).toBeVisible();
  await expect(page.locator('#practice-results')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#practice-rejected')).toContainText(/Too noisy|no call/i);
});
