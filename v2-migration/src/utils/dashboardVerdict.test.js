import { describe, it, expect } from "vitest";
import { buildDashboardVerdict } from "./dashboardVerdict";

// 14일치(직전주 7 + 최근주 7) 합성 데이터. 표준키로 직접 키잉하고 mapping은
// identity — getMappedRows가 그대로 통과시킨다.
function makeCsv({ recentInstalls, prevInstalls, cost = 1000, withRetention = false }) {
  const raw = [];
  for (let i = 0; i < 14; i++) {
    const day = String(i + 1).padStart(2, "0");
    const recent = i >= 7;
    const row = { date: `2024-01-${day}`, cost, installs: recent ? recentInstalls : prevInstalls };
    if (withRetention) row.ret_d7 = recent ? 0.4 : 0.3; // 비율 컬럼
    raw.push(row);
  }
  const mapping = { date: "date", cost: "cost", installs: "installs" };
  if (withRetention) mapping.ret_d7 = "ret_d7";
  return { raw, headers: Object.keys(mapping), mapping };
}

describe("buildDashboardVerdict", () => {
  it("데이터 없음 → insufficient", () => {
    const v = buildDashboardVerdict({ csvData: { raw: [], headers: [], mapping: {} } });
    expect(v.insufficient).toBe(true);
  });

  it("직전 비교주가 없으면(7일 미만) insufficient", () => {
    const csv = makeCsv({ recentInstalls: 20, prevInstalls: 10 });
    csv.raw = csv.raw.slice(-5); // 최근 5일만
    const v = buildDashboardVerdict({ csvData: csv });
    expect(v.insufficient).toBe(true);
  });

  it("CPI 하락(효율 개선) → tone good", () => {
    // 비용 동일, 설치 10→20 ⇒ CPI 100→50 (−50%) 개선.
    const v = buildDashboardVerdict({ csvData: makeCsv({ recentInstalls: 20, prevInstalls: 10 }) });
    expect(v.insufficient).toBe(false);
    expect(v.tone).toBe("good");
    expect(v.stats.length).toBeGreaterThan(0);
    expect(typeof v.export.csv).toBe("string");
    expect(v.export.csv.startsWith("﻿")).toBe(true); // BOM
    expect(v.export.csv).toContain("\r\n"); // CRLF
  });

  it("CPI 상승(효율 악화) → tone bad", () => {
    // 설치 20→10 ⇒ CPI 50→100 (+100%) 악화.
    const v = buildDashboardVerdict({ csvData: makeCsv({ recentInstalls: 10, prevInstalls: 20 }) });
    expect(v.tone).toBe("bad");
  });

  it("변화 미미 → tone neutral", () => {
    // 설치 100→101 ⇒ CPI 변화 <5%.
    const v = buildDashboardVerdict({ csvData: makeCsv({ recentInstalls: 101, prevInstalls: 100 }) });
    expect(v.tone).toBe("neutral");
  });

  it("locale en → 영문 헤드라인", () => {
    const v = buildDashboardVerdict({ csvData: makeCsv({ recentInstalls: 20, prevInstalls: 10 }), locale: "en" });
    expect(v.headline).toMatch(/efficiency is improving/i);
  });

  it("파생지표 포함 — CPI 행 존재, CSV에 WoW% 헤더", () => {
    const v = buildDashboardVerdict({ csvData: makeCsv({ recentInstalls: 20, prevInstalls: 10 }) });
    const keys = v.metricRows.map((m) => m.key);
    expect(keys).toContain("cpi");
    expect(keys).toContain("cost");
    expect(v.export.csv).toContain("WoW");
  });

  it("리텐션 매핑 시 리텐션 행 포함(0.3→0.4)", () => {
    const v = buildDashboardVerdict({ csvData: makeCsv({ recentInstalls: 20, prevInstalls: 10, withRetention: true }) });
    const ret = v.metricRows.find((m) => m.key === "ret");
    expect(ret).toBeTruthy();
    expect(ret.prev).toBeCloseTo(0.3, 5);
    expect(ret.recent).toBeCloseTo(0.4, 5);
  });

  it("미매핑 지표는 표에서 제외(actions·revenue 없음)", () => {
    const v = buildDashboardVerdict({ csvData: makeCsv({ recentInstalls: 20, prevInstalls: 10 }) });
    const keys = v.metricRows.map((m) => m.key);
    expect(keys).not.toContain("cpa");
    expect(keys).not.toContain("roas");
    expect(keys).not.toContain("ret");
  });

  it("관측상 가장 큰 채널 변화를 인과 단정 없이 제시", () => {
    const csv = makeCsv({ recentInstalls: 10, prevInstalls: 20 });
    csv.raw.forEach((row, index) => { row.channel = index < 7 ? "Meta" : "Google"; });
    csv.mapping.channel = "channel";
    const v = buildDashboardVerdict({ csvData: csv });
    expect(v.primaryDriver).toBeTruthy();
    expect(v.points.some((point) => point.text.includes("관측상 가장 크게 움직인 곳"))).toBe(true);
  });
});
