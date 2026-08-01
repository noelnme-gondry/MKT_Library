// @vitest-environment jsdom
//
// Render-smoke for AhaMomentFinder (5-20, aha group). Regression net for the
// CampaignPvm-class crashes: a route component that throws during render or a
// mount effect. Golden tests (src/utils/*.test.js) cover the AHA_STATS engine;
// this asserts the component MOUNTS without throwing in the no-data and
// with-data states.
//
// AhaMomentFinder does NOT use csvData.mapping — it auto-detects column roles
// from csvData.headers/raw (ahaAutoMapColumns): an `id`/`user` column, a binary
// {0,1} `target`-named column, and feature columns named `<action>_d<window>`
// (ahaParseActionWindow) or plain single-window actions. So the seed needs:
//   • user_id            → role "id"
//   • retained           → role "target" (binary 0/1, name matches /retain/)
//   • share_d3, share_d7 → role "feature", action "share", windows 3 & 7
//   • invite_d7          → role "feature", action "invite", window 7
// Deterministic — NO Math.random (harness §3). mapping is a pass-through mirror
// of the real upload shape but is unused by this component's engine.
import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import AhaMomentFinder from "@/components/tools/AhaMomentFinder";

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "5-20",
    csvGroups: { ...useAppStore.getState().csvGroups, aha: EMPTY_CSV },
    csvData: EMPTY_CSV,
    decisionRecords: [],
    demoDisabled: true,
  });
}

function seedWithData(userCount = 120) {
  const headers = ["user_id", "retained", "share_d3", "share_d7", "invite_d7"];
  const mapping = {
    user_id: "user_id", retained: "retained",
    share_d3: "share_d3", share_d7: "share_d7", invite_d7: "invite_d7",
  };
  // `retained` correlates deterministically with early sharing so the
  // grid search produces a real leading-action signal (F1/lift), exercising the
  // full results table + drilldown + chart render. NO Math.random.
  const raw = [];
  for (let u = 0; u < userCount; u++) {
    const sharedEarly = u % 3 === 0 ? 1 : 0;        // ~1/3 share within d3
    const sharedLate = u % 3 === 0 || u % 5 === 0 ? 1 : 0; // superset by d7
    const invited = u % 4 === 0 ? 1 : 0;
    // retained if shared early OR (invited AND u even) — deterministic signal
    const retained = sharedEarly === 1 || (invited === 1 && u % 2 === 0) ? 1 : 0;
    raw.push({
      user_id: `u${u}`,
      retained,
      share_d3: sharedEarly,
      share_d7: sharedLate,
      invite_d7: invited,
    });
  }
  const slice = { raw, headers, mapping, fileName: "aha.csv" };
  useAppStore.setState({
    currentRouteId: "5-20",
    csvGroups: { ...useAppStore.getState().csvGroups, aha: slice },
    csvData: slice,
  });
}

function seedWithInverseSignal(userCount = 600) {
  const headers = ["user_id", "retained", "avoid_d3"];
  const mapping = { user_id: "user_id", retained: "retained", avoid_d3: "avoid_d3" };
  const raw = Array.from({ length: userCount }, (_, u) => {
    const retained = u % 2;
    return { user_id: `u${u}`, retained, avoid_d3: retained ? 0 : 1 };
  });
  const slice = { raw, headers, mapping, fileName: "inverse_aha.csv" };
  useAppStore.setState({
    currentRouteId: "5-20",
    csvGroups: { ...useAppStore.getState().csvGroups, aha: slice },
    csvData: slice,
  });
}

describe("AhaMomentFinder render smoke", () => {
  beforeEach(() => {
    seedNoData();
  });

  it("mounts without throwing in the no-data state", () => {
    expect(() => render(<AhaMomentFinder />)).not.toThrow();
    expect(document.body.querySelector("*")).toBeTruthy();
  });

  it("mounts without throwing with a valid event CSV (target + actions)", () => {
    seedWithData();
    expect(() => render(<AhaMomentFinder />)).not.toThrow();
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });

  it("prefills and stores one controlled action experiment under tool 5-20", async () => {
    // 600 users leave enough deterministic holdout support for a topAction.
    seedWithData(600);
    render(<AhaMomentFinder />);
    fireEvent.click(screen.getByRole("button", { name: /분석하기/ }));
    const reviewSummary = await screen.findByText(/다음 검토 약속 만들기/);
    fireEvent.click(reviewSummary);

    expect(screen.getByText(/관측 연관이 있지만 인과효과는 확정되지 않았습니다/)).toBeTruthy();
    expect(screen.getByLabelText("무엇을 바꿀까요?").value).toMatch(/share.*통제 실험 한 가지/);
    expect(screen.getByLabelText("검증 지표").value).toBe("타겟 달성률");
    expect(screen.getByLabelText("현재 기준값 (선택)").value).toBe("50.0% (관측 base rate)");
    expect(screen.getByLabelText("검토일에 답할 질문").value).toContain("Control보다 높고 관측 base rate 50.0%");

    fireEvent.click(screen.getByRole("button", { name: "다음 검토로 저장" }));
    expect(useAppStore.getState().decisionRecords[0]).toMatchObject({
      toolId: "5-20",
      metric: "타겟 달성률",
      baseline: "50.0% (관측 base rate)",
      hypothesis: "",
      sourcePeriod: "",
    });
    expect(useAppStore.getState().decisionRecords[0].action).toMatch(/Control.*share.*통제 실험 한 가지/);
  });

  it("provides the same association-safe controlled-experiment prefill in English", async () => {
    seedWithData(600);
    render(<AhaMomentFinder locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "▶ Analyze" }));
    const reviewSummary = await screen.findByText(/Schedule the next review/);
    fireEvent.click(reviewSummary);

    expect(screen.getByText(/observed association.*causation is not established/)).toBeTruthy();
    expect(screen.getByLabelText("What will change?").value).toMatch(/one controlled experiment.*Control.*share/);
    expect(screen.getByLabelText("Metric to review").value).toBe("Target attainment rate");
    expect(screen.getByLabelText("Current baseline (optional)").value).toBe("50.0% (observed base rate)");
  });

  it("does not recommend nudging an action whose observed lift is not positive", async () => {
    seedWithInverseSignal();
    render(<AhaMomentFinder />);
    fireEvent.click(screen.getByRole("button", { name: /분석하기/ }));
    await screen.findByText(/선행 행동 결론/);

    expect(screen.queryByText(/다음 검토 약속 만들기/)).toBeNull();
  });
});
