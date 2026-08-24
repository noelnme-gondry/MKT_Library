import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stripSourceComments } from "@/test-utils/stripSourceComments";

const CSS = stripSourceComments(readFileSync(new URL("./globals.css", import.meta.url), "utf8"));

function ruleFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return CSS.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] || "";
}

describe("dashboard KPI strip layout", () => {
  it("lets every KPI selector and sparkline fill its grid column", () => {
    expect(ruleFor(".kpi-grid--overview .kpi-card--explorer")).toMatch(/width\s*:\s*100%/);
    expect(ruleFor(".kpi-sparkline")).toMatch(/width\s*:\s*100%/);
  });

  it("keeps the selected state inside the existing card dimensions", () => {
    expect(ruleFor(".kpi-grid--overview .kpi-card--explorer.is-selected")).toMatch(/box-shadow\s*:\s*inset/);
  });
});
