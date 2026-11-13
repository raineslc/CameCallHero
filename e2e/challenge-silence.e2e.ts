import { test } from '@playwright/test';
import { fakeMicArgs, noiseClip } from './fake-mic';
import { rejectedTake } from './challenge-helpers';

// Calling challenge with a fake mic that plays near silence: the take is not scored.
test.use({ viewport: { width: 360, height: 740 }, launchOptions: { args: fakeMicArgs(noiseClip('challenge-silence.wav', -100, 30)) } });

test('silence is rejected and cannot be saved or shared', async ({ page }) => {
  await rejectedTake(page, /^Not scored: Too quiet/);
});
