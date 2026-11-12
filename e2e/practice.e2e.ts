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

    // Note target from the shown reference, and the always-visible help.
    await expect(page.locator('#practice-target')).toHaveText(/^Your goal: Make (1 note lasting|\d+ notes in) about \d+\.\d seconds\.$/);
    const help = page.locator('#practice-help');
    await expect(help.getByRole('heading', { name: 'How it works' })).toBeVisible();
    await expect(help).toContainText("Grey blocks are the turkey's notes. They slide down to the white line.");
    await expect(help).toContainText('Your call draws an orange line. Further right = higher');
    await expect(help.locator('.legend-item')).toHaveText(['Turkey note', 'Call now', 'Hit', 'Missed', 'The line', 'You']);

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
      const dd = page.locator(`#practice-subs dd[data-sub="${k}"]`);
      const v = Number(await dd.getAttribute('data-value'));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
      await expect(dd.locator('.num')).toHaveText(String(v));
      expect(await dd.locator('.fill').evaluate((e) => (e as HTMLElement).style.width)).toBe(`${v}%`);
    }
    // Stars from the total score, one next step, notes marked hit.
    const stars = Number(await page.locator('#practice-stars').getAttribute('data-stars'));
    expect(stars).toBe(score! >= 80 ? 5 : score! >= 60 ? 4 : score! >= 40 ? 3 : score! >= 20 ? 2 : 1);
    await expect(page.locator('#practice-stars')).toHaveAttribute('aria-label', `${stars} of 5 stars`);
    await expect(page.locator('#practice-stars .star.on')).toHaveCount(stars);
    await expect(page.locator('#practice-next')).toHaveText(/^Next try: \S.+$/);
    // The reference gobble hits the lane's notes, live and in the results.
    expect(Number(await page.locator('#practice-hits').getAttribute('data-hits'))).toBeGreaterThan(0);
    await expect(page.locator('#practice-hits')).toHaveText(/^\d+ of \d+ hit · Streak \d+$/);
    expect(Number(await page.locator('#practice-hit-count').getAttribute('data-hit'))).toBeGreaterThan(0);
    await expect(page.locator('#practice-subs dt')).toHaveText(['Timing & notes', 'High/low', 'Sound']);
    const tips = page.locator('#practice-tips li');
    await expect(tips).toHaveCount(3);
    await expect(tips.locator('strong')).toHaveText([
      /^Timing & notes: (Good|Close|Needs work)\.$/,
      /^High\/low: (Good|Close|Needs work)\.$/,
      /^Sound: (Good|Close|Needs work)\.$/,
    ]);
    await expect(tips.first()).toContainText(/You made \d+ notes? (in|lasting) \d+\.\d seconds\./);
    await expect(page.locator('#practice-tips-note')).toBeVisible();
    // The last live note count is the scorer's count for the same take.
    const scored = (await page.locator('#practice-overlay').getAttribute('aria-label'))!.match(/^Your (\d+) notes/)![1];
    await expect(page.locator('#practice-notes')).toHaveAttribute('data-count', scored);
    await expect(page.locator('#practice-notes')).toHaveText(new RegExp(`^Notes so far: ${scored} of \\d+$`));
    await expect(help).toBeVisible();
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

  test('count-in shows a green quiet light and a loudness meter; results play your take and the turkey without the mic', async ({ page }) => {
    await spy(page);
    await page.goto('#/practice/gobble');
    await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled({ timeout: 10_000 });
    await page.getByRole('button', { name: "I'm ready" }).click();
    // The fake mic's count-in is background at the gobble clip's own floor (about -62 dBFS): quiet enough.
    await expect(page.locator('#practice-quiet')).toHaveAttribute('data-state', 'ok', { timeout: 10_000 });
    await expect(page.locator('#practice-quiet-text')).toHaveText('Quiet enough');
    await expect(page.locator('#practice-meter .lmeter-label')).toHaveText(/^(Move closer|Good|Back off)$/);
    // While the gobble plays into the mic, the meter reaches Good.
    await expect(page.locator('#practice-meter')).toHaveAttribute('data-zone', 'good', { timeout: 10_000 });
    // No result buttons while recording.
    await expect(page.getByRole('button', { name: 'Play yours' })).toBeHidden();
    await expect(page.locator('#practice-results')).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => micState(page)).toEqual({ streams: 1, live: 0, contexts: ['closed'] });

    // Play yours: plays the take from memory through a new AudioContext; the mic stays closed.
    const yours = page.getByRole('button', { name: 'Play yours' });
    await yours.click();
    await expect(page.locator('#practice-play-take')).toHaveAttribute('data-playing', 'true');
    await expect(page.locator('#practice-play-take')).toHaveText('Stop');
    await expect.poll(() => micState(page)).toEqual({ streams: 1, live: 0, contexts: ['closed', 'running'] });
    // It stops by itself at the end of the take (about 3 s) and closes its AudioContext.
    await expect(page.locator('#practice-play-take')).toHaveText('Play yours', { timeout: 10_000 });
    await expect.poll(() => micState(page)).toEqual({ streams: 1, live: 0, contexts: ['closed', 'closed'] });

    // Play turkey: the closest reference clip.
    await page.getByRole('button', { name: 'Play turkey' }).click();
    await expect(page.locator('#practice-play-ref')).toHaveText('Stop');
    await expect.poll(() => page.locator('#practice-audio').evaluate((a: HTMLAudioElement) => a.currentTime > 0), { timeout: 10_000 }).toBe(true);
    expect(await page.locator('#practice-audio').getAttribute('data-path')).toMatch(/^audio\/turkey\/gobble-\d\.wav$/);
    // Play yours stops the turkey; Try again stops everything before the mic opens.
    await yours.click();
    expect(await page.locator('#practice-audio').evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
    await expect(page.locator('#practice-play-ref')).toHaveText('Play turkey');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('#practice-run')).toBeVisible();
    expect(await page.locator('#practice-audio').evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
    await expect.poll(async () => (await micState(page)).contexts.slice(0, 3)).toEqual(['closed', 'closed', 'closed']);
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect.poll(() => micState(page)).toEqual({ streams: 2, live: 0, contexts: ['closed', 'closed', 'closed', 'closed'] });
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
  await page.goto('#/practice/kee-kee-run');
  await expect(page.getByText('Coming soon', { exact: true })).toBeVisible();
  await expect(page.locator('main')).toContainText('cannot yet tell it apart from a yelp');
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

test('Ready stays disabled while the tap test runs, even when the references finish loading', async ({ page }) => {
  // Hold the reference WAVs until the tap test has started.
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route('**/audio/turkey/gobble-*.wav', async (route) => {
    await held;
    await route.continue();
  });
  await page.goto('#/practice/gobble');
  const ready = page.getByRole('button', { name: "I'm ready" });
  await expect(ready).toBeDisabled();
  await page.getByRole('button', { name: 'Tap test' }).click();
  release();
  await expect(page.locator('#practice-loading')).toBeHidden({ timeout: 10_000 });
  await expect(ready).toBeDisabled();
  await expect(page.locator('#practice-calib-status')).not.toHaveText('Tap when you hear each click.', { timeout: 10_000 });
  await expect(ready).toBeEnabled();
});

test('a mic that stops mid-take is reported and released', async ({ page }) => {
  await spy(page);
  await page.goto('#/practice/gobble');
  await page.getByRole('button', { name: "I'm ready" }).click();
  await expect(page.locator('#practice-count')).toHaveText(/^[21]$/, { timeout: 10_000 });
  // Suspending the capture context stops the chunks after some have arrived.
  await page.evaluate(() => window.__contexts[0].suspend());
  await expect(page.locator('#practice-error')).toHaveText('The microphone stopped sending sound during the take. Try again.', { timeout: 10_000 });
  await expect(page.getByRole('button', { name: "I'm ready" })).toBeVisible();
  await expect.poll(() => micState(page)).toEqual({ streams: 1, live: 0, contexts: ['closed'] });
});
