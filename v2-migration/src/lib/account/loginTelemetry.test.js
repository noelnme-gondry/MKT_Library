import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { sanitizeProductEventParams } from "@/lib/analytics";

// 로컬 호스트에서 trackProductEvent는 no-op으로 false를 돌려준다. 그래서
// 반환값만 보면 "중복 차단"과 "전송 안 함"을 구분할 수 없다 — 호출을 센다.
const sent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", async (importActual) => ({ ...(await importActual()), trackProductEvent: (...args) => { sent(...args); return true; } }));
import { ACCOUNT_READY_MESSAGE, LOGIN_METHODS, accountReadyListener, trackLoginCompleted, trackLoginStarted } from "./loginTelemetry";

const SOURCES = globSync("src/**/*.{js,jsx}", { cwd: process.cwd() })
  .filter((file) => !/\.test\.|loginTelemetry/.test(file))
  .map((file) => ({ file, code: readFileSync(file, "utf8") }));

describe("login telemetry", () => {
  afterEach(() => { delete globalThis.window?.gtag; });

  it("keeps the method enum in step with what analytics will accept", () => {
    for (const method of [...LOGIN_METHODS, "unknown"]) {
      expect(sanitizeProductEventParams({ method }, "login_started").method, method).toBe(method);
    }
    // 열거형 밖은 버린다 — 자유 문자열이 들어오면 GA 탐색이 쪼개진다.
    expect(sanitizeProductEventParams({ method: "kakao" }, "login_started").method).toBeUndefined();
  });

  it("labels an unrecognised method rather than sending it through", () => {
    sent.mockClear();
    trackLoginStarted("kakao", { locale: "ko" });
    expect(LOGIN_METHODS).not.toContain("kakao");
    expect(sent).toHaveBeenLastCalledWith("login_started", expect.objectContaining({ method: "unknown" }));
    trackLoginStarted("email_link", { locale: "ko", source: "account_archive" });
    expect(sent).toHaveBeenLastCalledWith("login_started", expect.objectContaining({ method: "email_link", source: "account_archive" }));
  });

  it("counts one completion per message, so a re-login still counts", () => {
    sent.mockClear();
    const first = { origin: "x", data: { type: ACCOUNT_READY_MESSAGE } };
    trackLoginCompleted(first, { locale: "ko" });
    expect(sent).toHaveBeenCalledTimes(1);
    expect(sent).toHaveBeenLastCalledWith("login_completed", expect.objectContaining({ method: "google", locale: "ko" }));

    // 같은 이벤트 객체는 두 번 세지 않는다.
    trackLoginCompleted(first, { locale: "ko" });
    expect(sent).toHaveBeenCalledTimes(1);

    // 다른 이벤트(로그아웃 후 다시 로그인)는 막지 않는다 — 세션 단위로 잠그면 놓친다.
    trackLoginCompleted({ origin: "x", data: { type: ACCOUNT_READY_MESSAGE } }, { locale: "ko" });
    expect(sent).toHaveBeenCalledTimes(2);
  });

  it("ignores messages from another origin or another type", () => {
    const onReady = vi.fn();
    globalThis.window = Object.assign(globalThis.window || {}, { location: { origin: "https://a.example", hostname: "a.example" } });
    const listener = accountReadyListener(onReady, {});
    listener({ origin: "https://evil.example", data: { type: ACCOUNT_READY_MESSAGE } });
    listener({ origin: "https://a.example", data: { type: "gop-account-failed" } });
    expect(onReady).not.toHaveBeenCalled();
    listener({ origin: "https://a.example", data: { type: ACCOUNT_READY_MESSAGE } });
    expect(onReady).toHaveBeenCalledOnce();
  });

  // 이 검사가 막는 사고: 완료 신호를 받는 화면이 계측 없이 늘어나는 것.
  // 실제로 4곳 중 2곳(결제·업로더)이 세지 않아 그 로그인은 영영 안 세어졌다.
  it("every surface that receives the ready message also counts it", () => {
    const receivers = SOURCES.filter(({ code }) => code.includes(ACCOUNT_READY_MESSAGE));
    expect(receivers.length).toBeGreaterThan(2);
    for (const { file, code } of receivers) {
      // 완료 HTML을 만들어 보내는 서버 쪽은 수신자가 아니다.
      if (code.includes("window.opener")) continue;
      // 호출을 찾는다 — 식별자만 세면 import 줄이 통과시킨다(§16).
      // 실제로 그렇게 적었다가 가드를 부러뜨려 보고서야 드러났다.
      expect(code, `${file} receives ${ACCOUNT_READY_MESSAGE} without calling trackLoginCompleted`).toMatch(/trackLoginCompleted\s*\(/);
    }
  });

  it("no surface re-declares the login events by hand", () => {
    const offenders = SOURCES
      .filter(({ code }) => /trackProductEvent\(\s*"login_(started|completed)"/.test(code))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
