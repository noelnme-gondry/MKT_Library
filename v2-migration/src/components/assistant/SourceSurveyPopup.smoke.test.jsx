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
  SOURCE_SURVEY_OPEN_DELAY_MS,
  SOURCE_SURVEY_SESSION_KEY,
  resetSourceSurveySnapshot,
} from "@/lib/survey/sourceSurvey";

// 문구는 컴포넌트에서 파생한다 — 테스트에 옮겨 적으면 계약이 아니라 사본이 된다.
const KO = SOURCE_SURVEY_COPY.ko;
const EN = SOURCE_SURVEY_COPY.en;

// 지연은 0이지만 타이머 한 틱은 여전히 지나야 한다(마운트 이펙트 이후에 판정된다).
const settle = () => act(() => { vi.advanceTimersByTime(SOURCE_SURVEY_OPEN_DELAY_MS + 1); });
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
  it("기다리지 않는다 — 타이머 한 틱 만에 뜬다", () => {
    render(<SourceSurveyPopup />);
    // 첫 렌더에는 아직 없다(인사가 자기 존재를 선언할 틈을 준다).
    expect(screen.queryByText(KO.heading)).toBeNull();
    settle();
    expect(screen.getByText(KO.heading)).toBeTruthy();
  });

  it("지연 예산은 0이다 — 체류를 요구하지 않는다", () => {
    // 값이 아니라 근거를 고정한다: 인사를 닫으면 바로 물어야 한다(§7).
    expect(SOURCE_SURVEY_OPEN_DELAY_MS).toBe(0);
  });

  it("도치 인사가 떠 있는 동안에는 뜨지 않고, 닫는 즉시 뜬다", () => {
    setWelcomeOpen(true);
    render(<SourceSurveyPopup />);
    settle();
    // 모달 두 겹 금지 — 틱이 지나도 인사가 떠 있으면 기다린다.
    expect(screen.queryByText(KO.heading)).toBeNull();
    // 닫는 즉시. 추가 대기 없이 같은 동기 블록에서 떠 있어야 한다.
    act(() => { setWelcomeOpen(false); });
    expect(screen.getByText(KO.heading)).toBeTruthy();
  });

  it("이미 답한 브라우저에는 예산이 지나도 뜨지 않는다", () => {
    window.localStorage.setItem(SOURCE_SURVEY_ANSWERED_KEY, "1");
    resetSourceSurveySnapshot();
    render(<SourceSurveyPopup />);
    settle();
    expect(screen.queryByText(KO.heading)).toBeNull();
  });

  it("같은 세션에서 이미 본 사람에게는 다시 뜨지 않는다", () => {
    window.sessionStorage.setItem(SOURCE_SURVEY_SESSION_KEY, "1");
    resetSourceSurveySnapshot();
    render(<SourceSurveyPopup />);
    settle();
    expect(screen.queryByText(KO.heading)).toBeNull();
  });

  it("뜬 순간 세션 표식을 남긴다", () => {
    render(<SourceSurveyPopup />);
    settle();
    // 셋업이 아니라 컴포넌트가 상태를 바꿨다는 사실 자체를 단언한다(§7).
    expect(window.sessionStorage.getItem(SOURCE_SURVEY_SESSION_KEY)).toBe("1");
  });
});

describe("제출", () => {
  it("reuses the submission ID when retrying the same answer after response loss", async () => {
    let id = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `submission-${++id}` });
    fetch.mockRejectedValueOnce(new TypeError("response lost")).mockResolvedValue({ ok: true });
    render(<SourceSurveyPopup />);
    settle();
    fireEvent.change(answerBox(), { target: { value: "coworker" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: KO.submit })); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: KO.submit })); });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetch.mock.calls[1][1].body).id).toBe(JSON.parse(fetch.mock.calls[0][1].body).id);
  });
  it("빈 답변으로는 보낼 수 없다", () => {
    render(<SourceSurveyPopup />);
    settle();
    expect(screen.getByRole("button", { name: KO.submit }).disabled).toBe(true);
    fireEvent.change(answerBox(), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: KO.submit }).disabled).toBe(true);
  });

  it("답변을 서버로 보내고 감사 문구로 바뀐다", async () => {
    render(<SourceSurveyPopup />);
    settle();
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
    settle();
    fireEvent.change(answerBox(), { target: { value: "비밀 커뮤니티 이름" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: KO.submit })); });
    // 계측은 범주형만 싣는다(lib/analytics.js 최상단 규칙).
    expect(JSON.stringify(track.mock.calls)).not.toContain("비밀 커뮤니티 이름");
    expect(track).toHaveBeenCalledWith("source_survey_submitted", expect.objectContaining({ state: "sent" }));
  });

  it("전송이 실패하면 실패를 말하고 답변을 지우지 않는다", async () => {
    fetch.mockResolvedValue({ ok: false });
    render(<SourceSurveyPopup />);
    settle();
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
    settle();
    fireEvent.click(screen.getByRole("button", { name: KO.skip }));
    expect(screen.queryByText(KO.heading)).toBeNull();
    expect(window.localStorage.getItem(SOURCE_SURVEY_ANSWERED_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(SOURCE_SURVEY_SESSION_KEY)).toBe("1");
  });

  it("'다시 묻지 않기'를 고른 뒤 닫으면 영구히 막는다", () => {
    render(<SourceSurveyPopup />);
    settle();
    fireEvent.click(screen.getByLabelText(KO.dontAsk));
    fireEvent.click(screen.getByRole("button", { name: KO.skip }));
    expect(window.localStorage.getItem(SOURCE_SURVEY_ANSWERED_KEY)).toBe("1");
  });
});

describe("KR/EN 동등", () => {
  it("EN 화면도 같은 질문·같은 안내를 낸다", () => {
    render(<SourceSurveyPopup locale="en" />);
    settle();
    expect(screen.getByText(EN.heading)).toBeTruthy();
    expect(screen.getByText(EN.privacy)).toBeTruthy();
    expect(screen.getByRole("button", { name: EN.submit })).toBeTruthy();
  });

  it("두 로케일의 문구 키가 정확히 같다", () => {
    expect(Object.keys(SOURCE_SURVEY_COPY.ko).sort()).toEqual(Object.keys(SOURCE_SURVEY_COPY.en).sort());
  });

  it("EN 답변도 locale=en 으로 전송된다", async () => {
    render(<SourceSurveyPopup locale="en" />);
    settle();
    fireEvent.change(screen.getByPlaceholderText(EN.placeholder), { target: { value: "a coworker" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: EN.submit })); });
    expect(JSON.parse(fetch.mock.calls[0][1].body).locale).toBe("en");
  });
});

describe("화면에 실제로 보인다", () => {
  // jsdom은 레이아웃을 못 재므로 클래스가 CSS에서 위치를 받는지 소스에서 파생해 본다
  // (§7 — 규칙이 없으면 클래스를 안 붙인 것과 결과가 같다).
  const cardRule = () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const rule = /\.source-survey\s*\{([^}]*)\}/.exec(css);
    expect(rule).not.toBeNull();
    return rule[1];
  };

  it("카드가 화면에 고정되고 가운데 정렬된다", () => {
    const rule = cardRule();
    expect(rule).toMatch(/position:\s*fixed/);
    expect(rule).toMatch(/left:\s*50%/);
    expect(rule).toMatch(/top:\s*50%/);
    expect(rule).toMatch(/transform:\s*translate\(-50%,\s*-50%\)/);
  });

  it("뒤를 덮는 백드롭이 없다", () => {
    // 전면 오버레이는 모바일 인터스티셜 판정에 걸린다(§12.29b).
    // 가운데에 뜨더라도 바깥은 살아 있어야 한다.
    expect(cardRule()).not.toMatch(/inset:\s*0/);
  });

  it("등장 모션이 중앙 정렬을 덮지 않는다", () => {
    // `translateY`만 쓰면 중앙 정렬 transform이 통째로 덮여 카드가 튄다.
    const css = readFileSync("src/app/globals.css", "utf8");
    const frames = /@keyframes source-survey-rise\s*\{([^@]*?)\}\s*$/m.exec(css)
      || /@keyframes source-survey-rise\s*\{(.*)\}/.exec(css);
    expect(frames).not.toBeNull();
    expect(frames[1]).toMatch(/translate\(-50%/);
    expect(frames[1]).not.toMatch(/transform:\s*translateY/);
  });
});
