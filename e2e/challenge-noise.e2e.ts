import { expect, test } from '@playwright/test';
import { fakeMicArgs, noiseClip } from './fake-mic';
import { rejectedTake } from './challenge-helpers';

// Calling challenge with a fake mic that only plays steady loud noise: the take is not scored.
test.use({ viewport: { width: 360, height: 740 }, launchOptions: { args: fakeMicArgs(noiseClip('challenge-noise.wav', -18, 30)) } });

test('steady noise is rejected and cannot be saved or shared', async ({ page }) => {
  await rejectedTake(page, /^Not scored: Too noisy/);
  await expect(page.locator('#challenge-quiet')).toHaveAttribute('data-state', 'bad');
});
