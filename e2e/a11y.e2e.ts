import { expect, test, type Page } from '@playwright/test';
import { TURKEY_CALLS } from '../src/calls/turkey';
import { takeOnce } from './practice-helpers';

// Design pass (AGENTS.md "Design"): every screen at 360 px has no horizontal scroll, every
// link and button is at least 44 px tall, readable text has WCAG AA contrast (4.5:1) against
// its own solid background, and no text sits directly on the camo pattern.

test.use({ viewport: { width: 360, height: 740 } });

const screens = ['', '#/mic', ...TURKEY_CALLS.map((c) => `#/call/${c.id}`), ...TURKEY_CALLS.map((c) => `#/practice/${c.id}`)];

interface Problem { text: string; issue: string }

/** Runs in the page: checks every visible element that holds its own text. */
function audit(): Problem[] {
  const parse = (c: string): [number, number, number, number] => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0, 0];
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };
  const lum = ([r, g, b]: number[]) => {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const problems: Problem[] = [];
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
    const ownText = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim() !== '');
    if (!ownText || el.closest('[hidden], [disabled], [aria-hidden="true"]')) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const text = el.textContent!.trim().slice(0, 40);
    // First ancestor (or self) with an opaque background decides what the text sits on.
    let bgEl: HTMLElement | null = el;
    while (bgEl && parse(getComputedStyle(bgEl).backgroundColor)[3] < 1) bgEl = bgEl.parentElement;
    if (bgEl?.classList.contains('camo')) {
      problems.push({ text, issue: 'text on camo' });
      continue;
    }
    const bg = parse(getComputedStyle(bgEl ?? document.body).backgroundColor);
    const fg = parse(getComputedStyle(el).color);
    const [a, b] = [lum(fg) + 0.05, lum(bg) + 0.05];
    const ratio = Math.max(a, b) / Math.min(a, b);
    if (ratio < 4.5) problems.push({ text, issue: `contrast ${ratio.toFixed(2)}` });
  }
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('a, button'))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height < 44) problems.push({ text: el.textContent!.trim(), issue: `tap height ${r.height}` });
  }
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth) {
    problems.push({ text: '(page)', issue: 'horizontal scroll' });
  }
  return problems;
}

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
