import { expect, test } from '@playwright/test';

// "Add to Home Screen": the manifest loads, every icon resolves with its stated size, and
// Chromium parses the manifest without errors. No service worker on purpose (no offline cache yet).
// shortcut: Page.getInstallabilityErrors returns [] even with no manifest in headless Chromium, so
// install itself is not checked here; check "Add to Home Screen" on a real Android phone.

test('web app manifest and icons', async ({ page, baseURL }) => {
  await page.goto('');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifestUrl = new URL(href!, baseURL);
  const res = await page.request.get(manifestUrl.href);
  expect(res.status()).toBe(200);
  const manifest = await res.json();
  expect(manifest.display).toBe('standalone');
  expect(new URL(manifest.start_url, manifestUrl).href).toBe(baseURL);
  const sizes = new Set<string>();
  for (const icon of manifest.icons) {
    const url = new URL(icon.src, manifestUrl).href;
    expect((await page.request.get(url)).status(), url).toBe(200);
    if (icon.type === 'image/png') {
      const [w, h] = await page.evaluate(async (u) => {
        const img = new Image();
        img.src = u;
        await img.decode();
        return [img.naturalWidth, img.naturalHeight];
      }, url);
      expect(`${w}x${h}`).toBe(icon.sizes);
      sizes.add(icon.sizes);
    }
  }
  expect([...sizes].sort()).toEqual(['192x192', '512x512']);

  const cdp = await page.context().newCDPSession(page);
  const parsed = await cdp.send('Page.getAppManifest');
  expect(parsed.url).toBe(manifestUrl.href);
  expect(parsed.errors).toEqual([]);
  expect(parsed.data).toBeTruthy();
});
