import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import OperationsFlowNav from "./OperationsFlowNav";
import OperationsDetailLinks from "@/components/tools/OperationsDetailLinks";
import { OPERATIONS_FLOW_STEPS, operationsDetailLinks, operationsFlowStep } from "@/lib/operationsFlow";
import { NEXT_TOOL_IDS } from "@/lib/toolConnections";
import { absorbedToolIds, analysisToolIds, idToPath, publishedToolIds, resolveBudgetView } from "@/lib/routeMap";
import { useAppStore } from "@/store/useDataStore";
import { buildToolDemo } from "@/lib/toolDemo";
import { groupForRoute } from "@/lib/toolGroups";
import { isDemoData } from "@/lib/dataOrigin";

// 운영 플래너가 출발점이고, 같은 광고 성과 파일을 쓰는 도구는 그 단계의 상세다(product-ssot §5.1·§4.2a).
describe("operations flow table", () => {
  it("names only live analyses, puts every detail tool in exactly one step and links the planner to them", () => {
    const ids = OPERATIONS_FLOW_STEPS.flatMap((step) => step.tools);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => analysisToolIds().includes(id))).toBe(true);
    expect(operationsFlowStep("5-31")).toBeNull();
    // 증액 여력(5-22)은 예산 단계이고, 링크는 5-3 페이지의 보기로 간다.
    expect(operationsFlowStep("5-22").id).toBe("budget");
    expect(idToPath("5-22")).toBe("/tools/budget-allocation?view=headroom");
    expect(absorbedToolIds()).toEqual(["5-22"]);
    expect(publishedToolIds()).not.toContain("5-22");
    expect(resolveBudgetView("headroom")).toBe("headroom");
    expect(resolveBudgetView("<x>")).toBe("allocation");
    expect(operationsDetailLinks("budget", "en").map((link) => link.href)).toEqual(["/en/tools/budget-allocation", "/en/tools/budget-allocation?view=headroom"]);
    // 플래너의 다음 단계도 같은 상세 도구를 가리킨다(연결 표와 흐름 표가 갈리지 않게).
    expect(NEXT_TOOL_IDS["5-31"]).toEqual(expect.arrayContaining(["5-3", "5-21", "9-6"]));
  });
});

describe("OperationsFlowNav", () => {
  it.each(["ko", "en"])("tells a detail tool which planner step it belongs to and links back (%s)", (locale) => {
    const en = locale === "en";
    const { container, rerender } = render(<OperationsFlowNav toolId="5-21" locale={locale} />);
    const nav = screen.getByRole("navigation", { name: en ? "Operations planner step" : "운영 플래너 단계" });
    expect(within(nav).getByRole("link", { name: en ? "Operations planner" : "운영 플래너" }).getAttribute("href")).toBe(en ? "/en/tools/operations-planner" : "/tools/operations-planner");
    expect(nav.textContent).toContain(en ? "Performance changes detail" : "성과 변화 상세");
    // 저장·Pro 조건은 저장 행동 옆에 있다 — 길 안내 줄에 떠 있지 않는다.
    expect(nav.textContent).not.toContain("Pro");
    // 보기 고르기는 예산 상세 설계에만 있다.
    expect(container.querySelector(".ops-flow-nav__views")).toBeNull();
    rerender(<OperationsFlowNav toolId="5-3" view="headroom" locale={locale} />);
    const views = within(container.querySelector(".ops-flow-nav__views")).getAllByRole("link");
    expect(views.map((link) => link.textContent)).toEqual(en ? ["Allocation", "Headroom"] : ["예산 배분", "증액 여력"]);
    expect(views[1].getAttribute("aria-current")).toBe("page");
    expect(views[0].getAttribute("aria-current")).toBeNull();
    expect(views[1].getAttribute("href")).toBe(`${en ? "/en" : ""}/tools/budget-allocation?view=headroom`);
    if (en) expect(/[가-힣]/.test(container.textContent)).toBe(false);
  });

  it("renders nothing outside the planner flow", () => {
    const { container } = render(<OperationsFlowNav toolId="5-4" />);
    expect(container.innerHTML).toBe("");
  });
});

describe("OperationsDetailLinks", () => {
  afterEach(() => useAppStore.setState(useAppStore.getInitialState()));

  it("links each planner step to its detail tools and explains why budget amounts can differ", () => {
    const { container, rerender } = render(<OperationsDetailLinks step="budget" />);
    expect([...container.querySelectorAll("a")].map((link) => link.getAttribute("href"))).toEqual(["/tools/budget-allocation", "/tools/budget-allocation?view=headroom"]);
    expect(container.textContent).toContain("금액이 다를 수 있습니다");
    rerender(<OperationsDetailLinks step="changes" locale="en" />);
    expect([...container.querySelectorAll("a")].map((link) => link.getAttribute("href"))).toEqual(["/en/dashboard", "/en/tools/campaign-variance"]);
    expect(container.textContent).not.toContain("differ");
  });

  it("hands the planner file to creative analysis without overwriting a creative file the user uploaded", () => {
    const demo = buildToolDemo("5-31", "ko");
    useAppStore.getState().setCurrentRouteId("5-31");
    useAppStore.getState().setCsvData(demo);
    const creativeGroup = groupForRoute("9-6");
    const { container } = render(<OperationsDetailLinks step="creative" />);
    const link = container.querySelector("a");
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    const handed = useAppStore.getState().csvGroups[creativeGroup];
    expect(handed.raw).toBe(demo.raw);
    expect(Object.values(handed.mapping)).toContain("creative_id");
    // 예시는 예시로 남는다 — 넘긴 파일로 결정 기록이 실제 데이터처럼 저장되면 안 된다.
    expect(isDemoData(demo)).toBe(true);
    expect(isDemoData(handed)).toBe(true);
    // 분석 완료 표시는 하지 않는다: 소재 분석 화면의 매핑 안내가 먼저 보인다.
    expect(useAppStore.getState().analyzedByGroup[creativeGroup]).toBeNull();

    const uploaded = { ...handed, raw: [{ creative_id: "mine" }], importSource: "upload", fileName: "my_creatives.csv" };
    useAppStore.setState({ csvGroups: { ...useAppStore.getState().csvGroups, [creativeGroup]: uploaded } });
    fireEvent.click(link);
    expect(useAppStore.getState().csvGroups[creativeGroup]).toBe(uploaded);
  });
});
