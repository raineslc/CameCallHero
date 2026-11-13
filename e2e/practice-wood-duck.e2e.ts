import { expect, test } from '@playwright/test';
import { WOOD_DUCK } from '../src/calls/species';
import { noHorizontalScroll, tapTargets } from './practice-helpers';

// Phase 14: both wood duck calls are locked (neither passes calibration), so the species shows
// its calls with "Coming soon" and no practice or challenge.
test.use({ viewport: { width: 360, height: 740 } });

test('the picker lists the wood duck; both calls are locked and the challenge is "Coming soon"', async ({ page }) => {
  await page.goto('');
  const picker = page.getByRole('group', { name: 'Species' });
  await picker.getByRole('link', { name: 'Wood duck' }).click();
  await expect(page).toHaveURL(/#\/wood-duck$/);
  await expect(page.getByRole('heading', { name: 'Wood duck', level: 2 })).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(WOOD_DUCK.calls.length);
  for (const c of WOOD_DUCK.calls) {
    await expect(page.locator(`.card[data-call="${c.id}"] .badge`)).toHaveText('Coming soon');
    await expect(page.locator(`.card[data-call="${c.id}"]`)).toHaveAttribute('href', `#/wood-duck/call/${c.id}`);
  }
  await expect(page.locator('#challenge-soon')).toContainText('Coming soon');
  await expect(page.locator('main .cards')).not.toContainText(/turkey|owl/i);
  await noHorizontalScroll(page);
  await tapTargets(page);
});
