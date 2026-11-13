import { expect, type Page } from '@playwright/test';

/** Records a 2 s challenge take, stops it, and checks it was rejected with `reason`. */
export async function rejectedTake(page: Page, reason: RegExp) {
  await page.goto('#/challenge');
  await page.getByRole('button', { name: "I'm ready" }).click();
  const stop = page.getByRole('button', { name: 'Stop' });
  await expect(stop).toBeVisible({ timeout: 10_000 });
  await page.waitForFunction(() => Number.parseInt(document.querySelector('#challenge-time')?.textContent ?? '0', 10) >= 2, null, { timeout: 10_000 });
  await stop.click();
  await expect(page.locator('#challenge-rejected')).toHaveText(reason, { timeout: 20_000 });
  await expect(page.locator('#challenge-scored')).toBeHidden();
  await expect(page.locator('#challenge-save')).toBeHidden();
  await expect(page.locator('#challenge-share-box')).toBeHidden();
}
