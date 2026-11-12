import { expect, test } from '@playwright/test';
import { otherPort, otherPrefix } from './servers';

// The build has no fixed path (Vite base './'): the same files work under /CameCallHero/
// (every other test) and under a different, nested prefix here, as after a repo rename.
// Every request the app makes must stay under the prefix and succeed.

const base = `http://localhost:${otherPort}${otherPrefix}`;

test.use({ viewport: { width: 360, height: 740 } });

test('app works under another path prefix', async ({ page }) => {
  const outside: string[] = [];
  const failed: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.origin === new URL(base).origin && !u.pathname.startsWith(otherPrefix)) outside.push(u.pathname);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });

  // Home: styles, camo tile and spectrogram thumbnails (fetched clips) load.
  await page.goto(base);
  await expect(page.locator('.card')).toHaveCount(5);
  const camo = await page.locator('header').evaluate((h) => getComputedStyle(h).backgroundImage);
  expect(camo).toContain(`${otherPrefix}camo.png`);
  await expect.poll(() => page.locator('.card[data-call="gobble"] canvas').evaluate((c) => (c as HTMLCanvasElement).width)).toBeGreaterThan(1);

  // Call detail: a clip plays from the prefixed path.
  await page.goto(`${base}#/call/gobble`);
  const clip = page.waitForResponse((r) => r.url().startsWith(`${base}audio/turkey/gobble-1.wav`));
  await page.locator('#call-play').click();
  expect((await clip).status()).toBeLessThan(400);
  await expect.poll(() => page.locator('#clip-audio').evaluate((a: HTMLAudioElement) => a.currentTime > 0)).toBe(true);

  // Manifest: start URL and scope resolve to the prefix; icons load.
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifestUrl = new URL(href!, base);
  const manifest = await (await page.request.get(manifestUrl.href)).json();
  expect(new URL(manifest.start_url, manifestUrl).href).toBe(base);
  expect(new URL(manifest.scope, manifestUrl).href).toBe(base);
  for (const icon of manifest.icons) expect((await page.request.get(new URL(icon.src, manifestUrl).href)).status()).toBe(200);

  expect(outside).toEqual([]);
  expect(failed).toEqual([]);
});
