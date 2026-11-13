import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { SPECIES } from '../src/calls/species';
import { fakeMicArgs, noiseClip, paddedClip, sequenceClip } from './fake-mic';

// UX review screenshots of every screen and state (docs/UX-REVIEW.md). Skipped unless
// UX_SHOTS=<output dir> is set. The fake mic file is fixed per run, so run it once per UX_MIC:
//   for m in default yelp noise sequence; do UX_MIC=$m UX_SHOTS=docs/screenshots/ux/after npm run e2e -- ux-shots; done
const dir = process.env.UX_SHOTS ?? '';
test.skip(!dir, 'set UX_SHOTS=<dir> to write the UX review screenshots');
if (dir) mkdirSync(dir, { recursive: true });

const mic = process.env.UX_MIC ?? 'default';
const MICS: Record<string, () => string> = {
  yelp: () => paddedClip('public/audio/turkey/yelp-1.wav', 'yelp-1.wav'),
  noise: () => noiseClip('loud-noise.wav', -20),
  sequence: () => sequenceClip(['public/audio/turkey/yelp-1.wav', 'public/audio/turkey/gobble-1.wav'], 'yelp-gobble.wav'),
};
if (dir && MICS[mic]) test.use({ launchOptions: { args: fakeMicArgs(MICS[mic]()) } });

const SIZES = [
  { tag: '360', viewport: { width: 360, height: 740 } },
  { tag: '412', viewport: { width: 412, height: 915 } },
  { tag: 'land', viewport: { width: 740, height: 360 } },
];

const shot = (page: Page, tag: string, name: string, fullPage = true) => page.screenshot({ path: `${dir}/${name}-${tag}.png`, fullPage });
const settle = async (page: Page) => {
  await page.locator('main h2').first().waitFor();
  await page.waitForLoadState('networkidle');
};

for (const { tag, viewport } of SIZES) {
  test.describe(`static screens ${tag}`, () => {
    test.skip(mic !== 'default');
    test.use({ viewport });
    test('home, species, call pages, intro screens, unknown route', async ({ page }) => {
      for (const s of SPECIES) {
        const prefix = s.id === 'turkey' ? '' : `/${s.id}`;
        await page.goto(`#${prefix || '/'}`);
        await settle(page);
        await shot(page, tag, `home-${s.id}`);
        if (tag === 'land' && s.id !== 'turkey') continue;
        const open = s.calls.find((c) => !c.locked);
        const locked = s.calls.find((c) => c.locked);
        for (const c of [open, locked]) {
          if (!c) continue;
          await page.goto(`#${prefix}/call/${c.id}`);
          await settle(page);
          await shot(page, tag, `call-${s.id}-${c.id}`);
        }
        await page.goto(`#${prefix}/challenge`);
        await settle(page);
        if (s.id === 'turkey' || !open) await shot(page, tag, `challenge-intro-${s.id}`);
      }
      await page.goto('#/practice/gobble');
      await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled({ timeout: 10_000 });
      await shot(page, tag, 'practice-listen');
      await page.goto('#/practice/cut');
      await settle(page);
      await shot(page, tag, 'practice-locked');
      await page.goto('#/mic');
      await settle(page);
      await shot(page, tag, 'mic-idle');
      await page.goto('#/no-such-page');
      await settle(page);
      await shot(page, tag, 'unknown-route');
      await page.goto('#/call/no-such-call');
      await settle(page);
      await shot(page, tag, 'unknown-call');
    });

    test('mic permission denied', async ({ page }) => {
      await page.addInitScript(() => {
        navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('fake', 'NotAllowedError'));
      });
      await page.goto('#/mic');
      await page.getByRole('button', { name: /Start mic/ }).click();
      await expect(page.getByRole('alert').first()).toBeVisible();
      await shot(page, tag, 'mic-denied');
      await page.goto('#/practice/gobble');
      await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled({ timeout: 10_000 });
      await page.getByRole('button', { name: "I'm ready" }).click();
      await expect(page.locator('#practice-error')).toBeVisible();
      await shot(page, tag, 'practice-denied');
    });

    test('mic check live and after a take', async ({ page }) => {
      await page.goto('#/mic');
      await page.getByRole('button', { name: /Start mic/ }).click();
      await expect(page.locator('#mic-record')).toBeVisible();
      await page.waitForFunction(() => document.querySelector('#mic-meter')?.getAttribute('data-zone') === 'good', null, { polling: 'raf', timeout: 15_000 });
      await shot(page, tag, 'mic-live');
      await page.locator('#mic-record').click();
      await expect(page.locator('#mic-download')).toBeVisible({ timeout: 15_000 });
      await shot(page, tag, 'mic-after-take');
    });

    test('practice tap test', async ({ page }) => {
      await page.goto('#/practice/gobble');
      await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled({ timeout: 10_000 });
      await page.locator('#practice-calibrate').click();
      await expect(page.locator('#practice-tap')).toBeEnabled();
      await page.locator('#practice-tap').scrollIntoViewIfNeeded();
      await shot(page, tag, 'practice-tap-test', false);
    });
  });

  test.describe(`practice take ${tag}`, () => {
    test.skip(mic !== 'yelp');
    test.use({ viewport });
    test('count-in, lane, results', async ({ page }) => {
      await page.goto('#/practice/yelp');
      await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled({ timeout: 10_000 });
      await page.getByRole('button', { name: "I'm ready" }).click();
      await expect(page.locator('#practice-quiet')).toHaveAttribute('data-state', 'ok', { timeout: 10_000 });
      await shot(page, tag, 'practice-count-in', false);
      await page.waitForFunction(() => Number(document.querySelector('#practice-hits')?.getAttribute('data-hits')) >= 3, null, { polling: 'raf', timeout: 15_000 });
      await shot(page, tag, 'practice-lane', false);
      await expect(page.locator('#practice-results')).toBeVisible({ timeout: 20_000 });
      await shot(page, tag, 'practice-results');
      await shot(page, tag, 'practice-results-fold', false);
    });
  });

  test.describe(`noisy and silent takes ${tag}`, () => {
    test.skip(mic !== 'noise');
    test.use({ viewport });
    test('red quiet light and rejected take', async ({ page }) => {
      await page.goto('#/practice/gobble');
      await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled({ timeout: 10_000 });
      await page.getByRole('button', { name: "I'm ready" }).click();
      await expect(page.locator('#practice-quiet')).toHaveAttribute('data-state', 'bad', { timeout: 10_000 });
      await shot(page, tag, 'practice-count-in-noisy', false);
      await expect(page.locator('#practice-results')).toBeVisible({ timeout: 20_000 });
      await shot(page, tag, 'practice-rejected');
    });
  });

  test.describe(`challenge ${tag}`, () => {
    test.skip(mic !== 'sequence');
    test.use({ viewport });
    test('recording, results, leaderboard, share', async ({ page }) => {
      await page.goto('#/challenge');
      await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled({ timeout: 10_000 });
      await page.getByRole('button', { name: "I'm ready" }).click();
      await expect(page.locator('#challenge-quiet')).toHaveAttribute('data-state', 'ok', { timeout: 10_000 });
      await shot(page, tag, 'challenge-count-in', false);
      const stop = page.getByRole('button', { name: /Stop/ });
      await expect(stop).toBeVisible({ timeout: 10_000 });
      await page.waitForFunction(() => Number.parseInt(document.querySelector('#challenge-time')?.textContent ?? '0', 10) >= 4, null, { timeout: 20_000 });
      await shot(page, tag, 'challenge-recording', false);
      await page.waitForFunction(() => Number.parseInt(document.querySelector('#challenge-time')?.textContent ?? '0', 10) >= 8, null, { timeout: 20_000 });
      await stop.click();
      await expect(page.locator('#challenge-results')).toBeVisible({ timeout: 20_000 });
      await shot(page, tag, 'challenge-results');
      await page.getByLabel('Your name').fill('Tom');
      await page.getByRole('button', { name: 'Save score' }).click();
      await expect(page.locator('#challenge-save-status')).toHaveText(/Place 1/);
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: /Share score card/ }).click();
      await download;
      await expect(page.locator('#challenge-card')).toBeVisible();
      await shot(page, tag, 'challenge-saved-shared');
    });
  });
}
