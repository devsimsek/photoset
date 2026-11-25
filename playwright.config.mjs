import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

// Port 5179 keeps the suite clear of a manual `npm run serve:web` on 5178.
const PORT = 5179;

const testDir = defineBddConfig({
  features: 'features/*.feature',
  steps: 'features/steps/*.js',
  outputDir: '.tmp',
});

export default defineConfig({
  testDir,
  fullyParallel: false,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  },
  webServer: {
    // web-dist/ is gitignored, so the server command builds it first.
    command: 'node build/build-web.js && node build/serve-web.js',
    url: `http://127.0.0.1:${PORT}`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
  },
});
