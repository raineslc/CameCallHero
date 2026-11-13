import { expect, test } from '@playwright/test';
import { lockInfo } from '../src/calls/call';
import { BARRED_OWL } from '../src/calls/species';
import { noHorizontalScroll, tapTargets } from './practice-helpers';

// Phase 8: species picker on home and the barred owl call pages, at phone width.
test.use({ viewport: { width: 360, height: 740 } });

const hoo = BARRED_OWL.calls.find((c) => c.id === 'inspection-call')!;

test('species picker switches between wild turkey and barred owl', async ({ page }) => {
  await page.goto('');
  const picker = page.getByRole('group', { name: 'Species' });
  await expect(picker.getByRole('link', { name: 'Wild turkey' })).toHaveAttribute('aria-current', 'true');
  await expect(picker.getByRole('link', { name: 'Barred owl' })).not.toHaveAttribute('aria-current', 'true');
  await picker.getByRole('link', { name: 'Barred owl' }).click();
  await expect(page).toHaveURL(/#\/barred-owl$/);
  await expect(page.getByRole('heading', { name: 'Barred owl', level: 2 })).toBeVisible();
  await expect(picker.getByRole('link', { name: 'Barred owl' })).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.card')).toHaveCount(BARRED_OWL.calls.length);
  for (const c of BARRED_OWL.calls) {
    const card = page.locator(`.card[data-call="${c.id}"]`);
    await expect(card).toContainText(c.name);
    await expect(card).toHaveAttribute('href', `#/barred-owl/call/${c.id}`);
    if (c.locked) await expect(card.locator('.badge')).toHaveText(lockInfo(c).label);
    else await expect.poll(() => card.locator('canvas').evaluate((el) => (el as HTMLCanvasElement).width)).toBeGreaterThan(1);
  }
  await expect(page.locator('main .cards')).not.toContainText(/turkey/i);
  await noHorizontalScroll(page);
  await tapTargets(page);
  await picker.getByRole('link', { name: 'Wild turkey' }).click();
  await expect(page.getByRole('heading', { name: 'Wild turkey', level: 2 })).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(5);
});

test('owl hoo-wah page: plays a clip, owl wording, links to owl practice, back to owl home', async ({ page }) => {
  const bad: string[] = [];
  page.on('response', (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url()}`));
  await page.goto('#/barred-owl/call/inspection-call');
  await expect(page.getByRole('heading', { name: hoo.name, level: 2 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveAttribute('href', '#/barred-owl');
  await expect(page.locator('#call-measure')).toHaveText(/^1 note, .* s long/);
  await page.getByText('When owls use it').click();
  await expect(page.getByText(hoo.description.when)).toBeVisible();
  for (const s of hoo.sources) await expect(page.getByRole('link', { name: s.title })).toHaveAttribute('href', s.url);
  await page.locator('#call-play').click();
  await expect(page.locator('#call-play')).toHaveText('Stop');
  await page.locator('#call-play').click();
  await page.getByText('Reference clips and licenses').click();
  await expect(page.locator('.clip')).toHaveCount(hoo.references.length);
  await expect(page.locator('.clip .attribution').first()).toContainText(/xeno-canto XC\d+/);
  await expect(page.getByRole('link', { name: 'Practice' })).toHaveAttribute('href', '#/barred-owl/practice/inspection-call');
  await expect(page.locator('main')).not.toContainText(/turkey/i);
  await noHorizontalScroll(page);
  await tapTargets(page);
  await page.getByRole('link', { name: 'Practice' }).click();
  await expect(page.getByRole('heading', { name: `Practice: ${hoo.name}` })).toBeVisible();
  await expect(page.getByRole('button', { name: "I'm ready" })).toBeEnabled({ timeout: 10_000 });
  await expect(page.locator('#practice-play-ref')).toHaveText('Play owl');
  await expect(page.locator('main')).not.toContainText(/turkey/i);
  await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveAttribute('href', '#/barred-owl/call/inspection-call');
  expect(bad).toEqual([]);
});

for (const c of BARRED_OWL.calls.filter((x) => x.locked)) {
  test(`locked owl call ${c.id} shows its reason; practice stays disabled`, async ({ page }) => {
    await page.goto(`#/barred-owl/call/${c.id}`);
    await expect(page.locator('#call-lock-reason')).toHaveText(`${lockInfo(c).label}: ${lockInfo(c).reason}`);
    await expect(page.getByRole('button', { name: 'Practice' })).toBeDisabled();
    await page.goto(`#/barred-owl/practice/${c.id}`);
    await expect(page.getByRole('button', { name: "I'm ready" })).toBeDisabled();
  });
}

test('new-style turkey link and unknown species call', async ({ page }) => {
  await page.goto('#/turkey/call/gobble');
  await expect(page.getByRole('heading', { name: 'Gobble', level: 2 })).toBeVisible();
  await page.goto('#/barred-owl/call/gobble');
  await expect(page.getByRole('heading', { name: 'Call not found' })).toBeVisible();
});
