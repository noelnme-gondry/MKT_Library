// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ trackProductEvent: track }));

import SourceSurveyPopup, { SOURCE_SURVEY_COPY } from "@/components/assistant/SourceSurveyPopup";
import { setWelcomeOpen } from "@/lib/assistant/overlayPresence";
import {
  SOURCE_SURVEY_ANSWERED_KEY,
  SOURCE_SURVEY_DWELL_MS,
  SOURCE_SURVEY_SESSION_KEY,
  resetSourceSurveySnapshot,
} from "@/lib/survey/sourceSurvey";

// 문구는 컴포넌트에서 파생한다 — 테스트에 옮겨 적으면 계약이 아니라 사본이 된다.
const KO = SOURCE_SURVEY_COPY.ko;
const EN = SOURCE_SURVEY_COPY.en;

const dwell = () => act(() => { vi.advanceTimersByTime(SOURCE_SURVEY_DWELL_MS + 10); });
const answerBox = () => screen.getByPlaceholderText(KO.placeholder);

beforeEach(() => {
  vi.useFakeTimers();
  track.mockClear();
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetSourceSurveySnapshot();
  setWelcomeOpen(false);
  vi.stubGlobal("crypto", { ...globalThis.crypto, randomUUID: () => "3f2504e0-4f89-41d3-9a0c-0305e82c3301" });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setWelcomeOpen(false);
});

describe("노출 타이밍", () => {
  it("진입 직후에는 뜨지 않고 체류 예산이 지난 뒤에 뜬다", () => {
    render(<SourceSurveyPopup />);
    expect(screen.queryByText(KO.heading)).toBeNull();
    dwell();
    expect(screen.getByText(KO.heading)).toBeTruthy();
  });

  it("도치 인사가 떠 있는 동안에는 뜨지 않고, 닫힌 뒤에 뜬다", () => {
    setWelcomeOpen(true);
    render(<SourceSurveyPopup />);
    dwell();
    // 모달 두 겹 금지 — 예산이 지나도 인사가 떠 있으면 기다린다.
    expect(screen.queryByText(KO.heading)).toBeNull();
    act(() => { setWelcomeOpen(false); });
    expect(screen.getByText(KO.heading)).toBeTruthy();
  });

  it("이미 답한 브라우저에는 예산이 지나도 뜨지 않는다", () => {
    window.localStorage.setItem(SOURCE_SURVEY_ANSWERED_KEY, "1");
    resetSourceSurveySnapshot();
    render(<SourceSurveyPopup />);
    dwell();
    expect(screen.queryByText(KO.heading)).toBeNull();
  });

  it("같은 세션에서 이미 본 사람에게는 다시 뜨지 않는다", () => {
    window.sessionStorage.setItem(SOURCE_SURVEY_SESSION_KEY, "1");
    resetSourceSurveySnapshot();
    render(<SourceSurveyPopup />);
    dwell();
    expect(screen.queryByText(KO.heading)).toBeNull();
  });

  it("뜬 순간 세션 표식을 남긴다", () => {
    render(<SourceSurveyPopup />);
    dwell();
    // 셋업이 아니라 컴포넌트가 상태를 바꿨다는 사실 자체를 단언한다(§7).
    expect(window.sessionStorage.getItem(SOURCE_SURVEY_SESSION_KEY)).toBe("1");
  });
});

describe("제출", () => {
  it("빈 답변으로는 보낼 수 없다", () => {
    render(<SourceSurveyPopup />);
    dwell();
    expect(screen.getByRole("button", { name: KO.submit }).disabled).toBe(true);
    fireEvent.change(answerBox(), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: KO.submit }).disabled).toBe(true);
  });

  it("답변을 서버로 보내고 감사 문구로 바뀐다", async () => {
    render(<SourceSurveyPopup />);
    dwell();
    fireEvent.change(answerBox(), { target: { value: "  네이버에서  검색  " } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: KO.submit })); });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/survey/source");
    const body = JSON.parse(init.body);
    // 정규화는 lib 하나가 소유한다 — 화면이 보낸 값도 정규화를 거친다.
    expect(body).toMatchObject({ answer: "네이버에서 검색", locale: "ko" });
    expect(screen.getByText(KO.thanks)).toBeTruthy();
    expect(window.localStorage.getItem(SOURCE_SURVEY_ANSWERED_KEY)).toBe("1");
  });

  it("답변 원문은 GA4 이벤트에 실리지 않는다", async () => {
    render(<SourceSurveyPopup />);
    dwell();
    fireEvent.change(answerBox(), { target: { value: "비밀 커뮤니티 이름" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: KO.submit })); });
    // 계측은 범주형만 싣는다(lib/analytics.js 최상단 규칙).
    expect(JSON.stringify(track.mock.calls)).not.toContain("비밀 커뮤니티 이름");
    expect(track).toHaveBeenCalledWith("source_survey_submitted", expect.objectContaining({ state: "sent" }));
  });

  it("전송이 실패하면 실패를 말하고 답변을 지우지 않는다", async () => {
    fetch.mockResolvedValue({ ok: false });
    render(<SourceSurveyPopup />);
    dwell();
    fireEvent.change(answerBox(), { target: { value: "뉴스레터" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: KO.submit })); });

    expect(screen.getByText(KO.failed)).toBeTruthy();
    // 실패를 성공으로 접지 않는다 — 다시 누를 수 있어야 하고, 답한 것으로 치면 안 된다.
    expect(answerBox().value).toBe("뉴스레터");
    expect(screen.getByRole("button", { name: KO.submit }).disabled).toBe(false);
    expect(window.localStorage.getItem(SOURCE_SURVEY_ANSWERED_KEY)).toBeNull();
  });
});

describe("닫기", () => {
  it("'나중에'는 이번 세션만 막는다(영구 표식을 남기지 않는다)", () => {
    render(<SourceSurveyPopup />);
    dwell();
    fireEvent.click(screen.getByRole("button", { name: KO.skip }));
    expect(screen.queryByText(KO.heading)).toBeNull();
    expect(window.localStorage.getItem(SOURCE_SURVEY_ANSWERED_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(SOURCE_SURVEY_SESSION_KEY)).toBe("1");
  });

  it("'다시 묻지 않기'를 고른 뒤 닫으면 영구히 막는다", () => {
    render(<SourceSurveyPopup />);
    dwell();
    fireEvent.click(screen.getByLabelText(KO.dontAsk));
    fireEvent.click(screen.getByRole("button", { name: KO.skip }));
    expect(window.localStorage.getItem(SOURCE_SURVEY_ANSWERED_KEY)).toBe("1");
  });
});

describe("KR/EN 동등", () => {
  it("EN 화면도 같은 질문·같은 안내를 낸다", () => {
    render(<SourceSurveyPopup locale="en" />);
    dwell();
    expect(screen.getByText(EN.heading)).toBeTruthy();
    expect(screen.getByText(EN.privacy)).toBeTruthy();
    expect(screen.getByRole("button", { name: EN.submit })).toBeTruthy();
  });

  it("두 로케일의 문구 키가 정확히 같다", () => {
    expect(Object.keys(SOURCE_SURVEY_COPY.ko).sort()).toEqual(Object.keys(SOURCE_SURVEY_COPY.en).sort());
  });

  it("EN 답변도 locale=en 으로 전송된다", async () => {
    render(<SourceSurveyPopup locale="en" />);
    dwell();
    fireEvent.change(screen.getByPlaceholderText(EN.placeholder), { target: { value: "a coworker" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: EN.submit })); });
    expect(JSON.parse(fetch.mock.calls[0][1].body).locale).toBe("en");
  });
});

describe("화면에 실제로 보인다", () => {
  // jsdom은 레이아웃을 못 재므로 클래스가 CSS에서 위치를 받는지 소스에서 파생해 본다
  // (§7 — 규칙이 없으면 클래스를 안 붙인 것과 결과가 같다).
  it("카드 클래스가 CSS에 정의돼 있고 화면에 고정된다", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const rule = /\.source-survey\s*\{([^}]*)\}/.exec(css);
    expect(rule).not.toBeNull();
    expect(rule[1]).toMatch(/position:\s*fixed/);
  });

  it("뒤 콘텐츠를 덮는 전면 오버레이가 아니다", () => {
    // 전면 모달은 모바일 인터스티셜 판정에 걸린다(§12.29b). 카드는 구석에 붙는다.
    const css = readFileSync("src/app/globals.css", "utf8");
    const rule = /\.source-survey\s*\{([^}]*)\}/.exec(css)[1];
    expect(rule).not.toMatch(/inset:\s*0/);
    expect(rule).toMatch(/bottom:/);
  });
});
