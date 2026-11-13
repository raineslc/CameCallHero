import { expect, test, type Page } from '@playwright/test';
import { BARRED_OWL, ELK, MALLARD } from '../src/calls/species';
import { TURKEY_CALLS } from '../src/calls/turkey';
import { audit } from './design-audit';
import { takeOnce } from './practice-helpers';

// Design pass (AGENTS.md "Design"): every screen at 360 px has no horizontal scroll, every
// link and button is at least 44 px tall, readable text has WCAG AA contrast (4.5:1) against
// its own solid background, and no text sits directly on the camo pattern.

test.use({ viewport: { width: 360, height: 740 } });

const screens = ['', '#/mic', ...TURKEY_CALLS.map((c) => `#/call/${c.id}`), ...TURKEY_CALLS.map((c) => `#/practice/${c.id}`)];
// Phase 8: the barred owl home, call pages and practice pages.
// Phase 9: the calling challenge (intro and leaderboard; results are checked in challenge.e2e.ts).
screens.push('#/challenge');
// Phase 10: the owl calling challenge.
screens.push('#/barred-owl/challenge');
screens.push('#/barred-owl', ...BARRED_OWL.calls.flatMap((c) => [`#/barred-owl/call/${c.id}`, `#/barred-owl/practice/${c.id}`]));
// Phase 12: the elk home, call pages and practice pages.
screens.push('#/elk', '#/elk/challenge', ...ELK.calls.flatMap((c) => [`#/elk/call/${c.id}`, `#/elk/practice/${c.id}`]));
// Phase 11: the mallard home and call pages (all mallard calls are locked, so no practice pages).
screens.push('#/mallard', '#/mallard/challenge', ...MALLARD.calls.map((c) => `#/mallard/call/${c.id}`));

async function settle(page: Page) {
  await page.locator('main h2').first().waitFor();
  await page.waitForLoadState('networkidle');
}

for (const s of screens) {
  test(`design pass: ${s || 'home'}`, async ({ page }) => {
    await page.goto(s);
    await settle(page);
    expect(await page.evaluate(audit)).toEqual([]);
  });
}

test('design pass: mic check while live and after a take', async ({ page }) => {
  await page.goto('#/mic');
  await page.getByRole('button', { name: 'Start mic' }).click();
  await expect(page.locator('#mic-record')).toBeVisible();
  expect(await page.evaluate(audit)).toEqual([]);
  await page.locator('#mic-record').click();
  await expect(page.locator('#mic-download')).toBeVisible({ timeout: 15_000 });
  expect(await page.evaluate(audit)).toEqual([]);
});

test('design pass: practice count-in and take (quiet light, hits, meter)', async ({ page }) => {
  await page.goto('#/practice/gobble');
  await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole('button', { name: "I'm ready" }).click();
  await expect(page.locator('#practice-quiet')).toHaveAttribute('data-state', 'ok', { timeout: 10_000 });
  expect(await page.evaluate(audit)).toEqual([]);
  await expect(page.locator('#practice-hits')).toBeVisible({ timeout: 10_000 });
  expect(await page.evaluate(audit)).toEqual([]);
  await page.getByRole('button', { name: 'Cancel' }).click();
});

test('design pass: practice results', async ({ page }) => {
  await page.goto('#/practice/gobble');
  await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled({ timeout: 10_000 });
  expect(await takeOnce(page)).not.toBeNull();
  expect(await page.evaluate(audit)).toEqual([]);
});

test('the design check itself catches low contrast, text on camo, small targets and overflow', async ({ page }) => {
  await page.goto('');
  await settle(page);
  await page.evaluate(() => {
    const main = document.querySelector('main')!;
    main.insertAdjacentHTML(
      'beforeend',
      '<p id="grey" style="color: rgb(60, 60, 60)">grey on black</p><button id="tiny" style="height: 20px">tiny</button>' +
        '<div style="width: 900px">wide</div>',
    );
    document.querySelector('header')!.insertAdjacentHTML('beforeend', '<span>on camo</span>');
  });
  const issues = (await page.evaluate(audit)).map((p) => `${p.text}: ${p.issue.split(' ')[0]}`);
  expect(issues).toEqual(expect.arrayContaining(['grey on black: contrast', 'on camo: text', 'tiny: tap', '(page): horizontal']));
});
