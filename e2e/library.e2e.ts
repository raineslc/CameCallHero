import { expect, test, type Page } from '@playwright/test';
import { lockInfo, TURKEY_CALLS } from '../src/calls/turkey';

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
    if (c.locked) await expect(card.locator('.badge')).toHaveText(lockInfo(c).label);
    else await expect.poll(() => card.locator('canvas').evaluate((el) => (el as HTMLCanvasElement).width)).toBeGreaterThan(1);
    // Compact rows: every call fits on the first 360 x 740 screen.
    await expect(card).toBeInViewport({ ratio: 1 });
  }
  await expect(page.getByRole('link', { name: 'Back', exact: true })).toBeHidden();
  await expect(page.locator('footer')).toContainText("Check your state's rules on electronic calls.");
  await expect(page.locator('footer').getByRole('link', { name: 'Send feedback' })).toHaveAttribute(
    'href',
    'https://github.com/raineslc/GameCallHero/issues/new?template=feedback.yml',
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
    // Back button in the header returns to the call list.
    await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveAttribute('href', '#/');
    // "When turkeys use it" is collapsed until tapped.
    await expect(page.getByText(c.description.when)).toBeHidden();
    await page.getByText('When turkeys use it').click();
    await expect(page.getByText(c.description.when)).toBeVisible();
    for (const s of c.sources) await expect(page.getByRole('link', { name: s.title })).toHaveAttribute('href', s.url);

    if (c.locked) {
      await expect(page.locator('.title-row .badge')).toHaveText(lockInfo(c).label);
      await expect(page.locator('#call-lock-reason')).toHaveText(`${lockInfo(c).label}: ${lockInfo(c).reason}`);
      // No Practice for a locked call; none of the locked turkey calls has listen-only clips.
      await expect(page.getByRole('link', { name: 'Practice' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Practice' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Play/ })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Other turkey calls' })).toHaveAttribute('href', '#/');
      await expect(page.locator('#call-measure')).toHaveCount(0);
      await noHorizontalScroll(page);
      await tapTargets(page);
      expect(bad).toEqual([]);
      return;
    }

    await expect(page.locator('#call-measure')).toHaveText(/^\d+(–\d+)? notes?, .* s long/);
    // Play and Practice are on the first screen (360 x 740) without scrolling.
    await expect(page.locator('#call-play')).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('link', { name: 'Practice' })).toBeInViewport({ ratio: 1 });
    // The main Play button plays clip 1 and turns into Stop.
    await page.locator('#call-play').click();
    await expect(page.locator('#call-play')).toHaveText('Stop');
    await page.locator('#call-play').click();
    await expect(page.locator('#call-play')).toHaveText('Play');
    // Clip list with attribution is collapsed until tapped.
    await page.getByText('Recordings and credits').click();
    const clips = page.locator('.clip');
    await expect(clips).toHaveCount(c.references.length);
    for (let i = 0; i < c.references.length; i++) {
      const clip = clips.nth(i);
      await expect(clip.locator('.attribution')).toContainText(/xeno-canto XC\d+/);
      await expect(clip.locator('.attribution')).toContainText(/CC BY(-NC)?(-SA)? \d/);
      await clip.getByRole('button', { name: `Play clip ${i + 1}` }).click();
      // HTTP errors are caught by noHttpErrors (clip 1 may come from the cache after Play).
      await expect
        .poll(
          () => page.locator('#clip-audio').evaluate((a: HTMLAudioElement, path) => a.src.endsWith(path) && a.currentTime > 0 && a.error === null, c.references[i]),
          { timeout: 10_000 },
        )
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

// UX review: a locked call with listen-only clips (src/calls/listen.ts) can still be played.
test('locked call with listen-only clips: plays, credits each clip, offers no practice', async ({ page }) => {
  const bad = noHttpErrors(page);
  await page.goto('#/mallard/call/quack');
  await expect(page.locator('#call-lock-reason')).toContainText('Coming soon');
  await expect(page.locator('#call-listen-only')).toContainText('Listen only for now');
  // No scorer numbers for a call the scorer cannot score.
  await expect(page.locator('#call-measure')).toBeHidden();
  await expect(page.getByRole('link', { name: 'Practice' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Practice' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
  await expect.poll(() => page.locator('#clip-audio').evaluate((a: HTMLAudioElement) => a.currentTime > 0), { timeout: 10_000 }).toBe(true);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('#clip-audio').evaluate((a: HTMLAudioElement) => a.paused)).resolves.toBe(true);

  await page.getByText('Recordings and credits').click();
  const clips = page.locator('.clip');
  await expect(clips).toHaveCount(6);
  for (const li of await clips.all()) {
    await expect(li.locator('.attribution')).toContainText(/, .* \(\d+\.\d+–\d+\.\d+ s, trimmed\), CC/);
    await expect(li.locator('.error')).toHaveCount(0);
  }
  // Practice is unreachable even by URL.
  await page.goto('#/mallard/practice/quack');
  await expect(page.getByRole('button', { name: "I'm ready" })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to Hen quack' })).toBeVisible();
  expect(bad).toEqual([]);
});

// UX review: what a first-time user is told on the home screen, and the page title per screen.
test('home: first-run line, how many calls are ready, page titles and heading focus', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('#home-intro')).toContainText('Listen to a real call');
  await expect(page.locator('#home-summary')).toHaveText('2 of 5 calls ready to practice.');
  await expect(page).toHaveTitle('Wild turkey · Game Call Hero');

  await page.goto('#/mallard');
  await expect(page.locator('#home-summary')).toHaveText('No calls to practice yet. 3 calls to listen to.');

  // Each screen names itself in the tab title and takes focus, so a screen reader announces it.
  await page.getByRole('link', { name: 'Mic check' }).first().click();
  await expect(page).toHaveTitle('Mic check · Game Call Hero');
  await expect(page.locator('main h2')).toBeFocused();
  // The app name in the header goes home.
  await page.getByRole('link', { name: 'Game Call Hero: all animals' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('heading', { name: 'Wild turkey' })).toBeVisible();
});
