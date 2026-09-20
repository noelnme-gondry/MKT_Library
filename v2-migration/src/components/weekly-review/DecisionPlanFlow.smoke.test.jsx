// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import DecisionPlanFields from "../ds/DecisionPlanFields";
import DecisionPlanReview from "./DecisionPlanReview";
import EvidenceCompatibility from "./EvidenceCompatibility";
import { serializeDecisionPlan } from "@/lib/decisionPlan";
import { decisionClosureLabel } from "@/lib/decisionClosure";
import { scoreDecision } from "@/lib/weekly-review/decisionScore";

afterEach(cleanup);
const plan = { method: "holdout", target: "Brand search", control: "Control regions", window: "Oct 1–14", mode: "increase_percent", baseline: "5000", value: "10", unit: "people", metric: "Organic users" };
function Flow({ locale }) {
  const [value, setValue] = useState(plan);
  const [actual, setActual] = useState("");
  return <><DecisionPlanFields value={value} onChange={setValue} locale={locale} /><DecisionPlanReview record={{ id: "x", action: "Hold out search", reviewPlan: serializeDecisionPlan(value), targetActual: actual }} onChange={setActual} locale={locale} /></>;
}
it.each(["ko", "en"])("shows a partial recovery below the operating target, without an effect-free claim (%s)", locale => {
  const en = locale === "en";
  render(<Flow locale={locale} />);
  expect(screen.getByLabelText(en ? "Comparison group" : "비교군").value).toBe("Control regions");
  fireEvent.change(screen.getByLabelText(en ? "Target observation — Hold out search" : "목표 관측값 — Hold out search"), { target: { value: "5300" } });
  expect(document.body.textContent).toContain("+300 people (+6%)");
  expect(document.body.textContent).toContain(en ? "this does not mean no effect" : "효과 없음");
  expect(document.querySelector("details")).toBeNull();
});
it.each(["ko", "en"])("makes missing or differing evidence explicit (%s)", locale => {
  render(<EvidenceCompatibility locale={locale} match={{ rows: [{ label: "Channel", expected: "Search", actual: "Social", state: "different" }, { label: "Window", expected: "", actual: "", state: "unknown" }] }} />);
  expect(document.body.textContent).toContain(locale === "en" ? "Different — check" : "다름 · 확인 필요");
  expect(document.body.textContent).toContain(locale === "en" ? "Unverified" : "미확인");
});
it("keeps cancellation separate from an effect verdict", () => {
  for (const reason of ["cancelled", "stopped", "invalid_design"]) {
    expect(decisionClosureLabel(reason, "ko")).not.toBe("");
    expect(decisionClosureLabel(reason, "en")).not.toBe("");
    expect(scoreDecision({ decision: { closureReason: reason, goalMetric: "cpa", goalDirection: "down" } }).outcome).toBe("UNSCORED");
  }
});
