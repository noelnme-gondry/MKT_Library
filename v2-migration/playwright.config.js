import { defineConfig } from "@playwright/test";

const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: isCi ? 2 : undefined,
  reporter: isCi ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    browserName: "chromium",
    colorScheme: "dark",
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  expect: { timeout: 10_000 },
  timeout: 60_000,
  projects: [
    { name: "mobile-320", grepInvert: /@light-en/, use: { viewport: { width: 320, height: 800 } } },
    { name: "tablet-768", grepInvert: /@light-en/, use: { viewport: { width: 768, height: 1024 } } },
    { name: "desktop-1440", grepInvert: /@light-en/, use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "desktop-light-en",
      grep: /@light-en/,
      use: { colorScheme: "light", viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/start",
    reuseExistingServer: !isCi,
    timeout: 120_000,
  },
});
