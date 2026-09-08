// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import WeeklyReviewScreen from "@/components/weekly-review/WeeklyReviewScreen";
import { HANDOVER_DISMISS_KEY, HANDOVER_SESSION_KEY, resetHandoverSnapshot } from "@/lib/weeklyReviewHandover";
import { useAppStore } from "@/store/useDataStore";

/** 이번 주(08-31~09-06)와 지난주(08-24~08-30)를 담은 매핑 완료 행. */
function rowsFor({ worsen = true } = {}) {
  const week = (start, rows) =>
    rows.flatMap((row) =>
      Array.from({ length: 7 }, (_, day) => ({
        date: new Date(Date.UTC(2026, 7, start + day)).toISOString().slice(0, 10),
        campaign: row.campaign,
        channel: row.channel,
        cost: row.cost / 7,
        actions: row.actions / 7,
        clicks: row.clicks / 7,
        impressions: row.impressions / 7,
      })),
    );

  const previous = week(24, [
    { channel: "Google", campaign: "UAC A", cost: 30_000, actions: 3_600, clicks: 60_000, impressions: 3_000_000 },
    { channel: "Meta", campaign: "AAP", cost: 36_000, actions: 5_000, clicks: 70_000, impressions: 3_500_000 },
  ]);
  const current = week(31, worsen
    ? [
      { channel: "Google", campaign: "UAC A", cost: 44_000, actions: 3_650, clicks: 58_000, impressions: 3_100_000 },
      { channel: "Meta", campaign: "AAP", cost: 37_000, actions: 5_050, clicks: 69_000, impressions: 3_500_000 },
    ]
    : [
      { channel: "Google", campaign: "UAC A", cost: 30_200, actions: 3_610, clicks: 60_100, impressions: 3_000_000 },
      { channel: "Meta", campaign: "AAP", cost: 36_200, actions: 5_010, clicks: 70_100, impressions: 3_500_000 },
    ]);
  return [...previous, ...current];
}

function setData(rows) {
  useAppStore.setState({ csvData: { raw: rows, mapping: {}, mappedRows: rows, headers: [] } });
}

describe("WeeklyReviewScreen", () => {
  beforeEach(() => {
    useAppStore.setState({ csvData: {}, decisionRecords: [], findingsByGroup: {} });
    window.localStorage.clear();
    window.sessionStorage.clear();
    resetHandoverSnapshot(); // 스냅샷은 모듈에 굳으므로 저장소를 비운 뒤 캐시도 비운다
    window.gtag = vi.fn();
  });

  it("데이터가 없으면 결론을 지어내지 않고 업로드를 안내한다", () => {
    render(<WeeklyReviewScreen />);
    expect(screen.getByRole("heading", { name: "이번 주 데이터를 올려주세요." })).toBeTruthy();
    expect(screen.getByRole("link", { name: "데이터 올리기" }).getAttribute("href")).toBe("/start");
    expect(screen.queryByText(/이번 주 결론/)).toBeNull();
  });

  it("비교 기간을 화면에 명시한다 — 자동 판정이 틀리면 전체를 못 믿는다", () => {
    setData(rowsFor());
    render(<WeeklyReviewScreen />);
    expect(screen.getByText("2026-08-31 ~ 2026-09-06")).toBeTruthy();
    expect(screen.getByText("2026-08-24 ~ 2026-08-30")).toBeTruthy();
  });

  it("신호가 있으면 결론·원인·행동 카드를 편다", () => {
    setData(rowsFor({ worsen: true }));
    render(<WeeklyReviewScreen />);
    expect(screen.getByRole("heading", { name: "이번 주 결론" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "왜 그랬나" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "이번 주에 할 것" })).toBeTruthy();
    // 원인은 캠페인 수준까지 좁혀야 한다(추천 블록과 표에 각각 나온다).
    expect(screen.getAllByText("Google / UAC A").length).toBeGreaterThan(0);
  });

  it("변화가 평소 범위면 원인·행동 카드를 접는다 — 그게 정상 경로다", () => {
    setData(rowsFor({ worsen: false }));
    render(<WeeklyReviewScreen />);
    expect(screen.getByText("성과는 사실상 유지됐습니다.")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "왜 그랬나" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "이번 주에 할 것" })).toBeNull();
  });

  it("결과 비중이 비용 비중으로 오독되지 않게 라벨을 단다", () => {
    setData(rowsFor());
    render(<WeeklyReviewScreen />);
    expect(screen.getByText(/“결과 비중”은 비용이 아니라 전환 건수의 비중입니다/)).toBeTruthy();
  });

  it("추천과 내 결정을 나눠 그리고, 저장되는 것은 사용자가 고른 값이다", () => {
    setData(rowsFor());
    render(<WeeklyReviewScreen />);
    expect(screen.getByText("Growth Opt 추천")).toBeTruthy();
    expect(screen.getByText("내 결정")).toBeTruthy();

    const decrease = screen.getByRole("button", { name: "감액" });
    fireEvent.click(decrease);
    expect(decrease.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "이 결정 저장" }));
    expect(screen.getByRole("status").textContent).toMatch(/다음 주에 이 결정의 결과를 확인/);
  });

  it("보고서에 기간과 성과가 자동으로 들어간다", () => {
    setData(rowsFor());
    render(<WeeklyReviewScreen />);
    const report = document.querySelector(".wr-report").textContent;
    expect(report).toMatch(/Weekly Performance Review/);
    expect(report).toMatch(/2026-08-31 ~ 2026-09-06/);
    expect(report).toMatch(/■ 성과/);
  });

  it("결정 이력은 지우지 않고 접기 안으로 넣는다", () => {
    setData(rowsFor());
    useAppStore.setState({ decisionRecords: [] });
    render(<WeeklyReviewScreen />);
    const summary = screen.getByText(/지난 결정 전체 보기/);
    expect(summary).toBeTruthy();
    // 안에 기존 결정 검토함이 실제로 들어 있어야 한다(기능을 지운 게 아니라 위계를 내린 것).
    expect(screen.getByRole("heading", { name: "이번 주 결정 인박스" })).toBeTruthy();
    // 흡수된 화면은 자기 h1을 벗는다 — 한 화면에 h1이 둘이면 안 된다.
    expect(document.querySelectorAll("h1")).toHaveLength(1);
  });

  it("EN도 같은 구조로 렌더된다", () => {
    setData(rowsFor());
    render(<WeeklyReviewScreen locale="en" />);
    expect(screen.getByRole("heading", { name: "Weekly Review" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Why" })).toBeTruthy();
    expect(screen.getByText(/“Result share” is the share of conversions/)).toBeTruthy();
  });
});

describe("도치 인수인계 안내", () => {
  beforeEach(() => {
    useAppStore.setState({ csvData: {}, decisionRecords: [], findingsByGroup: {} });
    window.localStorage.clear();
    window.sessionStorage.clear();
    resetHandoverSnapshot(); // 스냅샷은 모듈에 굳으므로 저장소를 비운 뒤 캐시도 비운다
    window.gtag = vi.fn();
  });

  it("결정이 없는 새 사용자에게는 뜨지 않는다 — 없어진 화면을 설명하는 건 소음이다", () => {
    render(<WeeklyReviewScreen />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("결정이 있으면 한 번 뜨고, 몇 건이 남아 있는지 말한다", () => {
    useAppStore.setState({ decisionRecords: [{ id: "a" }, { id: "b" }] });
    render(<WeeklyReviewScreen />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toMatch(/결정 검토함이 여기로 들어왔어요/);
    expect(dialog.textContent).toMatch(/결정 2건은 그대로 있습니다/);
  });

  it("같은 방문 중에는 다시 뜨지 않는다", () => {
    useAppStore.setState({ decisionRecords: [{ id: "a" }] });
    const first = render(<WeeklyReviewScreen />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    first.unmount();
    resetHandoverSnapshot(); // 새 마운트는 저장소를 다시 읽는다
    render(<WeeklyReviewScreen />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("‘알겠어요’는 영구적으로 끈다", () => {
    useAppStore.setState({ decisionRecords: [{ id: "a" }] });
    const first = render(<WeeklyReviewScreen />);
    fireEvent.click(screen.getByRole("button", { name: "알겠어요" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.localStorage.getItem(HANDOVER_DISMISS_KEY)).toBe("1");

    first.unmount();
    window.sessionStorage.removeItem(HANDOVER_SESSION_KEY); // 새 방문
    resetHandoverSnapshot();
    render(<WeeklyReviewScreen />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ESC로 닫히고, 세션 표식만 남아 영구 끄기와 구분된다", () => {
    useAppStore.setState({ decisionRecords: [{ id: "a" }] });
    render(<WeeklyReviewScreen />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.localStorage.getItem(HANDOVER_DISMISS_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(HANDOVER_SESSION_KEY)).toBe("1");
  });
});
