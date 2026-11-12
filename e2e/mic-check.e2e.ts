import { expect, test } from '@playwright/test';
import { spy } from './spy';

test('fake mic: level above zero, 5 s recording, mic released on leaving', async ({ page }) => {
  await spy(page);
  await page.goto('#/mic');
  await page.getByRole('button', { name: 'Start mic' }).click();

  const level = page.locator('#mic-level');
  await expect.poll(async () => Number(await level.getAttribute('data-peak')), { timeout: 10_000 }).toBeGreaterThan(0);
  await expect(page.locator('#mic-settings tr')).toHaveCount(4);
  await expect(page.locator('#mic-floor')).toContainText('dBFS');
  // Zoned meter: the gobble playing into the fake mic reaches Good; zones are set from the floor.
  await expect(page.locator('#mic-meter .lmeter-label')).toHaveText(/^(Move closer|Good|Back off)$/);
  await expect(page.locator('#mic-meter')).toHaveAttribute('data-zone', 'good', { timeout: 10_000 });
  const widths = await page.locator('#mic-meter .lmeter-zone').evaluateAll((els) => els.map((e) => parseFloat((e as HTMLElement).style.width)));
  expect(widths).toHaveLength(3);
  for (const w of widths) expect(w).toBeGreaterThan(0);
  expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 0);

  await page.getByRole('button', { name: 'Record 5 s' }).click();
  await expect(page.locator('#mic-take')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#take-verdict')).not.toBeEmpty();

  const rate = await page.evaluate(() => window.__contexts[0].sampleRate);
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#mic-download').click()]);
  expect(download.suggestedFilename()).toMatch(/^mic-check-.*\.wav$/);
  const stream = await download.createReadStream();
  let size = 0;
  for await (const chunk of stream) size += (chunk as Uint8Array).length;
  expect(size).toBe(44 + 2 * 5 * rate);

  await page.getByRole('link', { name: 'Calls' }).click();
  await expect(page.getByRole('heading', { name: 'Wild turkey' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        streams: window.__streams.length,
        live: window.__streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState !== 'ended').length,
        contexts: window.__contexts.map((c) => c.state),
      })),
    )
    .toEqual({ streams: 1, live: 0, contexts: ['closed'] });
});

test('Stop mic button releases the mic', async ({ page }) => {
  await spy(page);
  await page.goto('#/mic');
  await page.getByRole('button', { name: 'Start mic' }).click();
  await page.getByRole('button', { name: 'Stop mic' }).click();
  await expect(page.getByRole('button', { name: 'Start mic' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__streams.flatMap((s) => s.getTracks()).map((t) => t.readyState)))
    .toEqual(['ended']);
});

for (const [name, kind, text] of [
  ['NotAllowedError', 'denied', 'permission was denied'],
  ['NotFoundError', 'no mic', 'No microphone was found'],
] as const) {
  test(`shows a clear message when getUserMedia fails: ${kind}`, async ({ page }) => {
    await page.addInitScript((n) => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('fake', n));
    }, name);
    await page.goto('#/mic');
    await page.getByRole('button', { name: 'Start mic' }).click();
    await expect(page.getByRole('alert')).toContainText(text);
    await expect(page.getByRole('button', { name: 'Start mic' })).toBeEnabled();
  });
}
