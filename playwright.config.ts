import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { otherPort, otherPrefix, port } from './e2e/servers';

// Chromium's fake mic plays this file in a loop.
const fakeMic = fileURLToPath(new URL('./public/audio/turkey/gobble-1.wav', import.meta.url));

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}/GameCallHero/`,
    trace: 'off',
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${fakeMic}`,
      ],
    },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  // Serves the production build: run `npm run build` first.
  webServer: [
    {
      command: `npx vite preview --port ${port} --strictPort --base /GameCallHero/`,
      url: `http://localhost:${port}/GameCallHero/`,
      reuseExistingServer: false,
    },
    {
      command: `npx vite preview --port ${otherPort} --strictPort --base ${otherPrefix}`,
      url: `http://localhost:${otherPort}${otherPrefix}`,
      reuseExistingServer: false,
    },
  ],
});
