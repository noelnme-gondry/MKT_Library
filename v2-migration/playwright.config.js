import { defineConfig } from "@playwright/test";
import { SOURCE_SURVEY_ANSWERED_KEY } from "./e2e/support/sourceSurvey.js";

const isCi = Boolean(process.env.CI);
// CI는 빌드 결과물(next start)로 돈다 — dev 서버는 페이지를 처음 열 때마다 컴파일해서
// 브라우저 테스트가 40분 가까이 걸렸다(2026-09-24). 로컬 기본은 여전히 dev(수정이 바로 반영).
// 빌드본으로 돌리려면 먼저 `npm run build` 후 E2E_SERVER=production.
const useProductionServer = process.env.E2E_SERVER === "production";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  // GitHub ubuntu-latest 러너는 4코어다. 빌드본은 요청당 CPU가 적어 4개가 버틴다.
  workers: isCi ? 4 : undefined,
  reporter: isCi ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    // 유입 경로 서베이를 기본으로 끈다(사유·계약은 e2e/support/sourceSurvey.js).
    // 이 시드를 지우면 e2e/source-survey.spec.js가 먼저 빨개진다.
    storageState: {
      cookies: [],
      origins: [{
        origin: "http://127.0.0.1:3100",
        localStorage: [
          { name: SOURCE_SURVEY_ANSWERED_KEY, value: "1" },
        ],
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
    // `npm start`는 결제 마이그레이션(DB 필요)을 먼저 돌리므로 쓰지 않는다.
    command: useProductionServer ? "npx next start --hostname 127.0.0.1 --port 3100" : "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/start",
    reuseExistingServer: !isCi,
    timeout: 120_000,
  },
});
