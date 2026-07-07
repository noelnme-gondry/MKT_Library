import { describe, it, expect } from "vitest";
import {
  CUSTOM_OPS, customMetricCompute, customMetricToDescriptor,
  customMetricFormula, isValidCustomMetricDef,
} from "./customMetric.js";

const AGG = { cost: 100000, revenue: 130000, clicks: 8000, impressions: 2000000, installs: 0 };

describe("customMetric · compute (eval 없는 안전 조립)", () => {
  it("나누기 — 분모 정상", () => {
    const f = customMetricCompute({ op: "div", a: "revenue", b: "cost" });
    expect(f(AGG)).toBe(1.3);
  });
  it("나누기 — 분모 0 → null(§8.6)", () => {
    const f = customMetricCompute({ op: "div", a: "cost", b: "installs" });
    expect(f(AGG)).toBe(null);
  });
  it("빼기 — 이익", () => {
    const f = customMetricCompute({ op: "sub", a: "revenue", b: "cost" });
    expect(f(AGG)).toBe(30000);
  });
  it("곱하기·더하기", () => {
    expect(customMetricCompute({ op: "mul", a: "cost", b: "installs" })(AGG)).toBe(0);
    expect(customMetricCompute({ op: "add", a: "revenue", b: "cost" })(AGG)).toBe(230000);
  });
  it("비수치 필드 → null", () => {
    expect(customMetricCompute({ op: "div", a: "revenue", b: "ghost" })(AGG)).toBe(null);
  });
  it("잘못된 op → null", () => {
    expect(customMetricCompute({ op: "pow", a: "revenue", b: "cost" })(AGG)).toBe(null);
  });
  it("agg 없음 → null(방어)", () => {
    expect(customMetricCompute({ op: "div", a: "a", b: "b" })(null)).toBe(null);
  });
});

describe("customMetric · descriptor", () => {
  it("registry 서술자 형태로 변환(deps·source·compute)", () => {
    const d = customMetricToDescriptor({ id: "cm_1", name: "이익", op: "sub", a: "revenue", b: "cost" });
    expect(d.id).toBe("cm_1");
    expect(d.label).toBe("이익");
    expect(d.source).toBe("custom");
    expect(d.deps).toEqual(["revenue", "cost"]);
    expect(d.compute(AGG)).toBe(30000);
  });
});

describe("customMetric · 미리보기·검증", () => {
  it("수식 문자열(라벨 주입)", () => {
    const label = (k) => ({ revenue: "매출", cost: "비용" }[k] || k);
    expect(customMetricFormula({ op: "div", a: "revenue", b: "cost" }, label)).toBe("매출 ÷ 비용");
  });
  it("isValid — 이름·op·a·b 필수", () => {
    expect(isValidCustomMetricDef({ name: "x", op: "div", a: "revenue", b: "cost" })).toBe(true);
    expect(isValidCustomMetricDef({ name: "", op: "div", a: "revenue", b: "cost" })).toBe(false);
    expect(isValidCustomMetricDef({ name: "x", op: "div", a: "revenue" })).toBe(false);
    expect(isValidCustomMetricDef({ name: "x", op: "bad", a: "revenue", b: "cost" })).toBe(false);
  });
  it("CUSTOM_OPS 4종", () => {
    expect(CUSTOM_OPS.map((o) => o.id)).toEqual(["div", "mul", "add", "sub"]);
  });
});
