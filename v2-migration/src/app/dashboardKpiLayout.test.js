import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stripSourceComments } from "@/test-utils/stripSourceComments";

const CSS = stripSourceComments(readFileSync(new URL("./globals.css", import.meta.url), "utf8"));

function ruleFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return CSS.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] || "";
}

describe("dashboard KPI strip layout", () => {
  it("lets every KPI selector fill its grid column", () => {
    expect(ruleFor(".kpi-grid--overview .kpi-card--explorer")).toMatch(/width\s*:\s*100%/);
  });

  // 2026-11-09 재설계: 카드 안 미니 차트는 뺐다(추세 모양은 아래 탐색 차트가 축과 함께 보여 준다).
  it("draws no sparkline inside KPI cards", () => {
    expect(CSS).not.toMatch(/\.kpi-sparkline/);
    expect(readFileSync(new URL("../components/dashboard/VizTab.jsx", import.meta.url), "utf8")).not.toMatch(/kpi-sparkline/);
  });

  it("keeps the selected state inside the existing card dimensions", () => {
    expect(ruleFor(".kpi-grid--overview .kpi-card--explorer.is-selected")).toMatch(/box-shadow\s*:\s*inset/);
  });
});
