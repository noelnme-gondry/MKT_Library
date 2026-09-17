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
    // 유입 경로 서베이는 첫 방문에 화면 가운데 뜬다. 브라우저 테스트는 전부 첫
    // 방문이라 모든 스펙에서 카드가 클릭을 가로채므로(실제로 4건이 그렇게 깨졌다)
    // 기본 상태를 "이미 답함"으로 두고, 서베이 자체는 전용 스펙이 키를 지우고 본다.
    // 이 시드를 지우려면 e2e/source-survey.spec.js가 먼저 빨개진다.
    storageState: {
      cookies: [],
      origins: [{
        origin: "http://127.0.0.1:3100",
        localStorage: [{ name: "mkt-library-source-survey-answered", value: "1" }],
      }],
    },
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
