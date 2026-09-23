// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import ToolIndex from "@/components/ds/ToolIndex";
import { allToolIndexEntries, PUBLISHED_TOOL_IDS } from "@/lib/toolIndex";
import { TOOL_JOURNEY } from "@/lib/toolConnections";

describe("ToolIndex", () => {
  it("발행 도구를 하나도 빠뜨리지 않고 그린다", () => {
    // 목록에 없는 도구는 사용자가 존재를 알 방법이 없다 — 이 검사가 그 구멍을 막는다.
    const { container } = render(<ToolIndex />);
    const links = [...container.querySelectorAll(".tool-index__link")];
    expect(links).toHaveLength(PUBLISHED_TOOL_IDS.length);
    for (const entry of allToolIndexEntries()) {
      expect(container.textContent, entry.id).toContain(entry.name);
      expect(container.textContent, entry.id).toContain(entry.question);
    }
  });

  it("모든 링크가 실제 경로를 가리킨다", () => {
    const { container } = render(<ToolIndex />);
    for (const link of container.querySelectorAll(".tool-index__link")) {
      expect(link.getAttribute("href")).toMatch(/^\/[a-z]/);
    }
  });

  it("compact는 질문·결과를 우선하고 full은 답·필요 데이터까지 편다", () => {
    const compact = render(<ToolIndex density="compact" />);
    expect(compact.container.querySelector(".tool-index__needs")).toBeNull();
    expect(compact.container.querySelector(".tool-index__answer")).toBeNull();
    expect(compact.container.querySelector(".tool-index__outputs")).toBeTruthy();
    expect(compact.container.querySelector(".tool-index__link").firstElementChild.classList.contains("tool-index__q")).toBe(true);
    compact.unmount();
    const full = render(<ToolIndex density="full" />);
    expect(full.container.querySelector(".tool-index__needs")).toBeTruthy();
    expect(full.container.querySelector(".tool-index__answer")).toBeTruthy();
    expect(full.container.querySelector(".tool-index__outputs")).toBeTruthy();
  });

  it("지금 못 쓰는 도구는 숨기지 않고 흐리게 둔다", () => {
    // 숨기면 "무엇이 있는지" 자체를 못 본다 — 지금 문제가 정확히 그것이다.
    const { container } = render(<ToolIndex eligibleIds={["5-2"]} />);
    expect(container.querySelectorAll(".tool-index__link")).toHaveLength(PUBLISHED_TOOL_IDS.length);
    expect(container.querySelectorAll(".tool-index__item.is-dim").length).toBe(PUBLISHED_TOOL_IDS.length - 1);
  });

  it("grid는 도구마다 버튼 하나를 내고 상세는 누르기 전까지 없다", () => {
    const { container } = render(<ToolIndex density="grid" />);
    expect(container.querySelectorAll(".tool-index__chip")).toHaveLength(PUBLISHED_TOOL_IDS.length);
    expect(container.querySelector(".tool-index__panel")).toBeNull();
    // 세로로 쌓지 않는다 — 이 화면을 4,600px로 만들던 목록이 격자로 바뀐 이유다.
    expect(container.querySelectorAll(".tool-index__grid").length).toBe(TOOL_JOURNEY.length);
  });

  it("grid에서 버튼을 누르면 '누른 버튼 바로 다음'에 상세가 하나만 열린다", () => {
    // 격자 맨 아래에 두면 15개짜리 묶음에서 다섯 줄 밑에 열려 화면 밖으로 나간다.
    // 줄 전체를 쓰는 칸으로 바로 뒤에 끼우면 누른 버튼은 제자리에 있다.
    const { container } = render(<ToolIndex density="grid" eligibleIds={["5-2"]} />);
    const cells = [...container.querySelectorAll(".tool-index__stage--blocked .tool-index__cell")];
    const chip = cells[0].querySelector(".tool-index__chip");
    fireEvent.click(chip);
    const panels = container.querySelectorAll(".tool-index__panel");
    expect(panels).toHaveLength(1);
    expect(chip.getAttribute("aria-expanded")).toBe("true");
    expect(chip.getAttribute("aria-controls")).toBe(panels[0].id);
    // 누른 칸의 바로 다음 형제가 상세 줄이다 — 사이에 다른 버튼이 끼지 않는다.
    const row = cells[0].nextElementSibling;
    expect(row.classList.contains("tool-index__panel-row")).toBe(true);
    expect(row.contains(panels[0])).toBe(true);
    // 상세도 격자 안에 있어야 줄 전체를 차지할 수 있다.
    expect(row.parentElement.classList.contains("tool-index__grid")).toBe(true);
    fireEvent.click(chip);
    expect(container.querySelector(".tool-index__panel")).toBeNull();
  });

  it("두 번째 줄의 버튼을 눌러도 그 앞 버튼들의 순서는 그대로다", () => {
    const { container } = render(<ToolIndex density="grid" eligibleIds={["5-2"]} />);
    const before = [...container.querySelectorAll(".tool-index__chip")].map((chip) => chip.textContent);
    fireEvent.click(container.querySelectorAll(".tool-index__stage--blocked .tool-index__chip")[4]);
    const after = [...container.querySelectorAll(".tool-index__chip")].map((chip) => chip.textContent);
    expect(after).toEqual(before);
  });

  it("파일을 올렸으면 되는 분석을 위에, 안 되는 분석을 아래에 묶는다", () => {
    // "할 수 있는 분석"은 우리가 제공하는 목록이 아니라 지금 이 CSV로 되는 것이다.
    const { container } = render(<ToolIndex density="grid" eligibleIds={["5-2", "5-3"]} />);
    const groups = [...container.querySelectorAll(".tool-index__stage")];
    expect(groups).toHaveLength(2);
    expect(groups[0].classList.contains("tool-index__stage--ready")).toBe(true);
    expect(groups[1].classList.contains("tool-index__stage--blocked")).toBe(true);
    expect(groups[0].querySelectorAll(".tool-index__chip")).toHaveLength(2);
    expect(groups[1].querySelectorAll(".tool-index__chip")).toHaveLength(PUBLISHED_TOOL_IDS.length - 2);
    // 개수를 화면이 직접 말한다 — 세어 보게 하지 않는다.
    expect(groups[0].querySelector(".tool-index__count").textContent).toBe("2");
    expect(groups[0].textContent).toContain("지금 이 파일로 되는 분석");
    expect(groups[1].textContent).toContain("추가 데이터·설정이 필요한 분석");
    // 어느 쪽도 빠뜨리지 않는다.
    expect(container.querySelectorAll(".tool-index__chip")).toHaveLength(PUBLISHED_TOOL_IDS.length);
  });

  it("파일이 없으면 자격을 모르므로 갈래가 다시 정렬 축이 된다", () => {
    const { container } = render(<ToolIndex density="grid" />);
    expect(container.querySelectorAll(".tool-index__stage")).toHaveLength(TOOL_JOURNEY.length);
    expect(container.querySelector(".tool-index__count")).toBeNull();
    expect(container.querySelector(".tool-index__stage--ready")).toBeNull();
  });

  it("안 되는 분석에는 브릿지를 여러 갈래로 준다 — 빠진 컬럼·템플릿·그래도 열기", () => {
    // "안 됩니다"만 말하면 사용자가 할 수 있는 일이 없다. 컬럼을 직접 채울 사람,
    // 템플릿부터 받을 사람, 일단 도구를 보고 판단할 사람이 각각 있다.
    const blocked = PUBLISHED_TOOL_IDS.find((id) => id !== "5-2");
    const { container } = render(
      <ToolIndex
        density="grid"
        eligibleIds={["5-2"]}
        blockedInfo={{ [blocked]: { fields: ["소재 ID"], hint: "필요: 소재 ID" } }}
      />,
    );
    // ① 빠진 컬럼은 누르지 않아도 버튼에서 읽힌다.
    const cell = [...container.querySelectorAll(".tool-index__cell")]
      .find((item) => item.querySelector(".tool-index__q").textContent === allToolIndexEntries().find(tool => tool.id === blocked).name);
    expect(cell.textContent).not.toContain("소재 ID");
    fireEvent.click(cell.querySelector(".tool-index__chip"));
    const panel = container.querySelector(".tool-index__stage--blocked .tool-index__panel");
    // ② 판정이 준 구체적인 이유가 일반 문구를 이긴다.
    expect(panel.querySelector(".tool-index__blocked-note").textContent).toBe("필요: 소재 ID");
    // ③ 템플릿과 ④ 그래도 열기 — 길은 여러 개다.
    expect(panel.querySelector(".tool-index__template")).toBeTruthy();
    expect(panel.querySelector(".tool-index__link").textContent).toBe("그래도 열어 보기");
  });

  it("안 되는 분석도 길을 막지 않고, 무엇이 없어서 안 되는지 말한다", () => {
    // 막으면 도구를 구경조차 못 한다 — "숨기지 말 것"과 같은 이유다.
    const { container } = render(<ToolIndex density="grid" eligibleIds={["5-2"]} />);
    const blocked = container.querySelector(".tool-index__stage--blocked");
    fireEvent.click(blocked.querySelector(".tool-index__chip"));
    const panel = blocked.querySelector(".tool-index__panel");
    expect(panel.querySelector(".tool-index__needs")).toBeTruthy();
    expect(panel.querySelector(".tool-index__blocked-note")).toBeTruthy();
    expect(panel.querySelector(".tool-index__link").textContent).toBe("그래도 열어 보기");
  });

  it.each(["ko", "en"])("connects each open grid button to its actual panel without uploaded data (%s)", locale => {
    const { container } = render(<ToolIndex density="grid" locale={locale} />);
    for (const button of container.querySelectorAll(".tool-index__chip")) {
      fireEvent.click(button);
      const target = button.getAttribute("aria-controls");
      expect(target).toBeTruthy();
      expect(document.getElementById(target)?.getAttribute("role")).toBe("region");
    }
  });

  it("EN은 한글 없이 그린다", () => {
    const { container } = render(<ToolIndex locale="en" />);
    expect(container.textContent).not.toMatch(/[가-힣]/);
    expect(container.querySelector(".tool-index__link").getAttribute("href")).toMatch(/^\/en\//);
    expect(container.textContent).toContain("You get");
  });

  it("스테이지 번호를 여정 순서대로 빠짐없이 낸다", () => {
    // 번호를 손으로 적으면 갈래가 늘 때 이 줄만 고치게 된다 — 레지스트리에서 파생한다.
    const { container } = render(<ToolIndex />);
    const numbers = [...container.querySelectorAll(".tool-index__stage-no")].map((n) => n.textContent);
    expect(numbers).toEqual(TOOL_JOURNEY.map((_, index) => String(index + 1).padStart(2, "0")));
  });

  it("갈래를 접지 않는다 — 펼 때마다 위치가 달라지면 방금 본 도구를 다시 찾게 된다", () => {
    const { container } = render(<ToolIndex />);
    expect(container.querySelector("[data-information-section]")).toBeNull();
    expect(container.querySelectorAll(".tool-index__stage")).toHaveLength(TOOL_JOURNEY.length);
  });
});
