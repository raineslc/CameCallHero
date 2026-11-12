import { expect, test } from '@playwright/test';
import { fakeMicArgs, paddedClip } from './fake-mic';
import { noHorizontalScroll, sameCallLevel, takeOnce, tapTargets } from './practice-helpers';
import { micState, spy } from './spy';

test.use({ viewport: { width: 360, height: 740 } });

// Chromium's fake mic plays a reference gobble (launch options are per file).
test.use({ launchOptions: { args: fakeMicArgs(paddedClip('public/audio/turkey/gobble-1.wav', 'gobble-1.wav')) } });

test.describe('practice with a reference gobble', () => {
  test(`scores at least the engine's same-call level (${sameCallLevel.toFixed(1)}), mic released, best saved`, async ({ page }) => {
    await spy(page);
    await page.goto('#/practice/gobble');
    await expect(page.getByRole('heading', { name: 'Practice: Gobble' })).toBeVisible();
    await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled({ timeout: 10_000 });
    await noHorizontalScroll(page);
    await tapTargets(page);

    // Listen plays the reference; Ready stops it before the mic opens.
    await page.getByRole('button', { name: 'Listen' }).click();
    await expect.poll(() => page.locator('#practice-audio').evaluate((a: HTMLAudioElement) => a.currentTime > 0), { timeout: 10_000 }).toBe(true);

    const score = await takeOnce(page);
    console.log(`gobble take: ${score}, same-call level ${sameCallLevel.toFixed(1)}`);
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThanOrEqual(sameCallLevel);
    expect(score!).toBeLessThanOrEqual(100);
    await expect(page.locator('#practice-subs dd')).toHaveCount(3);
    for (const k of ['rhythm', 'pitch', 'tone']) {
      const v = Number(await page.locator(`#practice-subs dd[data-sub="${k}"]`).textContent());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    await expect(page.locator('#practice-tip')).toHaveText(/weakest part/);
    await expect(page.locator('#practice-best')).toHaveText('New best!');
    expect(await page.locator('#practice-overlay').evaluate((c: HTMLCanvasElement) => c.width)).toBeGreaterThan(1);
    await noHorizontalScroll(page);
    await tapTargets(page);

    // The mic is released as soon as the take ends.
    await expect.poll(() => micState(page)).toEqual({ streams: 1, live: 0, contexts: ['closed'] });

    await page.getByRole('link', { name: 'Calls', exact: true }).click();
    await expect(page.locator('.card[data-call="gobble"] .card-best')).toHaveText(`Best: ${Math.round(score!)} / 100`);
    await expect(page.locator('.card[data-call="yelp"] .card-best')).toHaveCount(0);
  });

  test('leaving during the count-in releases the mic', async ({ page }) => {
    await spy(page);
    await page.goto('#/practice/gobble');
    await page.getByRole('button', { name: "I'm ready" }).click();
    await expect(page.locator('#practice-count')).toHaveText(/^[321]$/, { timeout: 10_000 });
    await page.getByRole('link', { name: 'Calls', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Wild turkey' })).toBeVisible();
    await expect.poll(() => micState(page)).toEqual({ streams: 1, live: 0, contexts: ['closed'] });
  });

  test('Cancel stops the take and releases the mic', async ({ page }) => {
    await spy(page);
    await page.goto('#/practice/gobble');
    await page.getByRole('button', { name: "I'm ready" }).click();
    await expect(page.locator('#practice-count')).toHaveText(/^[321]$/, { timeout: 10_000 });
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: "I'm ready" })).toBeVisible();
    await expect.poll(() => micState(page)).toEqual({ streams: 1, live: 0, contexts: ['closed'] });
  });

  test('tap test stores a latency', async ({ page }) => {
    await page.goto('#/practice/gobble');
    await expect(page.locator('#practice-timing-text')).toContainText('One-time timing check');
    await page.getByRole('button', { name: 'Tap test' }).click();
    for (let k = 1; k <= 4; k++) {
      // Poll every frame: expect()'s back-off (up to 1 s) would make the taps late.
      await page.waitForFunction((n) => document.querySelector('#practice-beat')?.getAttribute('data-beat') === String(n), k, {
        polling: 'raf',
        timeout: 5_000,
      });
      await page.getByRole('button', { name: 'Tap', exact: true }).click();
    }
    await expect(page.locator('#practice-calib-status')).toHaveText(/^Done: \d+ ms\.$/, { timeout: 5_000 });
    const stored = await page.evaluate(() => localStorage.getItem('camecallhero.latencyMs'));
    expect(Number(stored)).toBeGreaterThanOrEqual(0);
    expect(Number(stored)).toBeLessThanOrEqual(400);
    await expect(page.locator('#practice-timing-text')).toHaveText(`Timing offset: ${stored} ms (from your tap test).`);
    await page.reload();
    await expect(page.locator('#practice-timing-text')).toHaveText(`Timing offset: ${stored} ms (from your tap test).`);
  });
});

test('locked call: Practice stays disabled and the mic is never opened', async ({ page }) => {
  await spy(page);
  await page.goto('#/practice/yelp');
  await expect(page.getByText('Recordings needed', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: "I'm ready" })).toBeDisabled();
  expect((await micState(page)).streams).toBe(0);
});

test('unknown call shows not found', async ({ page }) => {
  await page.goto('#/practice/nope');
  await expect(page.getByRole('heading', { name: 'Call not found' })).toBeVisible();
});

test('mic permission denied shows a clear message', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('fake', 'NotAllowedError'));
  });
  await page.goto('#/practice/gobble');
  await page.getByRole('button', { name: "I'm ready" }).click();
  await expect(page.locator('#practice-error')).toContainText('permission was denied');
  await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled();
});
