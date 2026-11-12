import { expect, test, type Page } from '@playwright/test';
import { TURKEY_CALLS } from '../src/calls/turkey';

/** Fails the test on any HTTP error response (e.g. a 404 clip). */
function noHttpErrors(page: Page): string[] {
  const bad: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
  });
  return bad;
}

async function noHorizontalScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
}

/** Every link and button in the screen is at least 44 px tall (AGENTS.md design rule). */
async function tapTargets(page: Page) {
  const small = await page.locator('main a, main button').evaluateAll((els) =>
    els.map((e) => [e.textContent, e.getBoundingClientRect().height] as const).filter(([, h]) => h < 44),
  );
  expect(small).toEqual([]);
}

test.use({ viewport: { width: 360, height: 740 } });

test('home lists all five calls, spectrograms for calls with clips, mic check reachable', async ({ page }) => {
  const bad = noHttpErrors(page);
  await page.goto('');
  await expect(page.locator('.card')).toHaveCount(TURKEY_CALLS.length);
  for (const c of TURKEY_CALLS) {
    const card = page.locator(`.card[data-call="${c.id}"]`);
    await expect(card).toContainText(c.name);
    await expect(card).toContainText(c.description.meaning);
    if (c.locked) await expect(card).toContainText('Recordings needed');
    else await expect.poll(() => card.locator('canvas').evaluate((el) => (el as HTMLCanvasElement).width)).toBeGreaterThan(1);
  }
  await expect(page.locator('footer')).toContainText("Check your state's rules on electronic calls.");
  await expect(page.locator('footer').getByRole('link', { name: 'Send feedback' })).toHaveAttribute(
    'href',
    'https://github.com/raineslc/CameCallHero/issues/new?template=feedback.yml',
  );
  await noHorizontalScroll(page);
  await page.locator('main').getByRole('link', { name: 'Mic check' }).click();
  await expect(page.getByRole('heading', { name: 'Mic check' })).toBeVisible();
  expect(bad).toEqual([]);
});

for (const c of TURKEY_CALLS) {
  test(`${c.name} page`, async ({ page }) => {
    const bad = noHttpErrors(page);
    await page.goto(`#/call/${c.id}`);
    await expect(page.getByRole('heading', { name: c.name, level: 2 })).toBeVisible();
    await expect(page.getByText(c.description.when)).toBeVisible();
    for (const s of c.sources) await expect(page.getByRole('link', { name: s.title })).toHaveAttribute('href', s.url);

    if (c.locked) {
      await expect(page.locator('main')).toContainText('Recordings needed');
      await expect(page.getByRole('button', { name: 'Practice' })).toBeDisabled();
      await expect(page.getByRole('button', { name: /^Play/ })).toHaveCount(0);
      await expect(page.locator('#call-measure')).toHaveCount(0);
      await noHorizontalScroll(page);
      await tapTargets(page);
      expect(bad).toEqual([]);
      return;
    }

    await expect(page.locator('#call-measure')).toHaveText(/^\d+(–\d+)? notes?, .* s long/);
    const clips = page.locator('.clip');
    await expect(clips).toHaveCount(c.references.length);
    for (let i = 0; i < c.references.length; i++) {
      const clip = clips.nth(i);
      await expect(clip.locator('.attribution')).toContainText(/xeno-canto XC\d+/);
      await expect(clip.locator('.attribution')).toContainText(/CC BY(-SA)? \d/);
      const clipResponse = page.waitForResponse((r) => r.url().endsWith(c.references[i]));
      await clip.getByRole('button', { name: `Play clip ${i + 1}` }).click();
      expect((await clipResponse).status()).toBeLessThan(400);
      await expect
        .poll(() => page.locator('#clip-audio').evaluate((a: HTMLAudioElement) => a.currentTime > 0 && a.error === null), { timeout: 10_000 })
        .toBe(true);
      await expect(page.getByRole('alert')).toBeHidden();
    }
    await expect(page.getByRole('link', { name: 'Practice' })).toHaveAttribute('href', `#/practice/${c.id}`);
    await noHorizontalScroll(page);
    await tapTargets(page);

    // Leaving the screen stops playback and drops the source.
    await page.evaluate(() => ((window as unknown as { __a: Element | null }).__a = document.querySelector('#clip-audio')));
    await page.getByRole('link', { name: 'Calls', exact: true }).click();
    await expect(page.locator('#clip-audio')).toHaveCount(0);
    expect(
      await page.evaluate(() => {
        const a = (window as unknown as { __a: HTMLAudioElement }).__a;
        return { paused: a.paused, src: a.getAttribute('src') };
      }),
    ).toEqual({ paused: true, src: null });
    expect(bad).toEqual([]);
  });
}

test('unknown call shows not found', async ({ page }) => {
  await page.goto('#/call/nope');
  await expect(page.getByRole('heading', { name: 'Call not found' })).toBeVisible();
});
