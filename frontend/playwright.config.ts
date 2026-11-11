import { defineConfig } from '@playwright/test';

const viewports = {
  'mobile-320': { width: 320, height: 640 },
  'mobile-375': { width: 375, height: 667 },
  'tablet-768': { width: 768, height: 1024 },
  'desktop-1280': { width: 1280, height: 800 },
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: Object.entries(viewports).map(([name, viewport]) => ({
    name,
    use: { browserName: 'chromium', viewport, hasTouch: viewport.width < 1024 },
  })),
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
