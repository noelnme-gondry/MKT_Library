import { describe, it, expect } from "vitest";
import {
  CUSTOM_OPS, customMetricCompute, customMetricToDescriptor,
  customMetricFormula, isValidCustomMetricDef, defToTerms, evalTerms,
} from "./customMetric.js";

const AGG = { cost: 100000, revenue: 130000, clicks: 8000, impressions: 2000000, installs: 0 };
const field = (value) => ({ type: "field", value });
const term = (op, value) => ({ op, type: "field", value });
const konst = (op, value) => ({ op, type: "const", value });

describe("customMetric · 2항 compute (기본)", () => {
  it("나누기 정상", () => {
    expect(customMetricCompute({ terms: [field("revenue"), term("div", "cost")] })(AGG)).toBe(1.3);
  });
  it("나누기 분모 0 → null(§8.6)", () => {
    expect(customMetricCompute({ terms: [field("cost"), term("div", "installs")] })(AGG)).toBe(null);
  });
  it("빼기 — 이익", () => {
    expect(customMetricCompute({ terms: [field("revenue"), term("sub", "cost")] })(AGG)).toBe(30000);
  });
  it("비수치 필드 → null", () => {
    expect(customMetricCompute({ terms: [field("revenue"), term("div", "ghost")] })(AGG)).toBe(null);
  });
});

describe("customMetric · N항 좌→우 체인", () => {
  it("A ÷ B × 1000 = ((A÷B)×1000) — 상수 항", () => {
    const def = { terms: [field("cost"), term("div", "impressions"), konst("mul", 1000)] };
    expect(customMetricCompute(def)(AGG)).toBe((100000 / 2000000) * 1000); // = 50 (CPM)
  });
  it("A − B + 컬럼 (3필드 체인)", () => {
    const def = { terms: [field("revenue"), term("sub", "cost"), term("add", "clicks")] };
    expect(customMetricCompute(def)(AGG)).toBe(130000 - 100000 + 8000);
  });
  it("중간 분모 0 → 전체 null", () => {
    const def = { terms: [field("revenue"), term("div", "installs"), konst("mul", 2)] };
    expect(customMetricCompute(def)(AGG)).toBe(null);
  });
  it("상수만으로도 계산(예: 매출 × 0.7 순수익 가정)", () => {
    const def = { terms: [field("revenue"), konst("mul", 0.7)] };
    expect(customMetricCompute(def)(AGG)).toBeCloseTo(91000, 6);
  });
});

describe("customMetric · 하위호환 (구 {op,a,b})", () => {
  it("구 스키마 → terms 변환·계산", () => {
    const legacy = { id: "cm_old", name: "ROAS", op: "div", a: "revenue", b: "cost" };
    expect(defToTerms(legacy)).toEqual([
      { type: "field", value: "revenue" },
      { op: "div", type: "field", value: "cost" },
    ]);
    expect(customMetricCompute(legacy)(AGG)).toBe(1.3);
  });
});

describe("customMetric · descriptor deps", () => {
  it("deps=필드만(상수 제외)", () => {
    const def = { id: "cm_1", name: "eCPM", terms: [field("cost"), term("div", "impressions"), konst("mul", 1000)] };
    const d = customMetricToDescriptor(def);
    expect(d.deps).toEqual(["cost", "impressions"]);
    expect(d.source).toBe("custom");
    expect(d.compute(AGG)).toBe(50);
  });
});

describe("customMetric · 미리보기·검증", () => {
  it("수식 문자열(상수 포함)", () => {
    const label = (k) => ({ cost: "비용", impressions: "노출수" }[k] || k);
    const def = { terms: [field("cost"), term("div", "impressions"), konst("mul", 1000)] };
    expect(customMetricFormula(def, label)).toBe("비용 ÷ 노출수 × 1000");
  });
  it("isValid — 첫 항 유효 + 이후 op·피연산자 유효", () => {
    expect(isValidCustomMetricDef({ name: "x", terms: [field("revenue"), term("div", "cost")] })).toBe(true);
    expect(isValidCustomMetricDef({ name: "x", terms: [field("revenue"), konst("mul", 1000)] })).toBe(true);
    expect(isValidCustomMetricDef({ name: "", terms: [field("revenue")] })).toBe(false);
    expect(isValidCustomMetricDef({ name: "x", terms: [field("revenue"), { op: "bad", type: "field", value: "cost" }] })).toBe(false);
    expect(isValidCustomMetricDef({ name: "x", terms: [field("revenue"), { op: "mul", type: "const", value: "" }] })).toBe(false);
  });
  it("빈 terms → invalid", () => {
    expect(isValidCustomMetricDef({ name: "x", terms: [] })).toBe(false);
  });
  it("evalTerms 빈배열 → null", () => {
    expect(evalTerms([], AGG)).toBe(null);
  });
  it("CUSTOM_OPS 4종", () => {
    expect(CUSTOM_OPS.map((o) => o.id)).toEqual(["div", "mul", "add", "sub"]);
  });
});
