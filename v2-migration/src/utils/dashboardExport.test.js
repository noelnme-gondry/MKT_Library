import { describe, it, expect } from "vitest";
import { buildDashboardExports } from "./dashboardExport";

function makeCsv({ withChannel = false, withCampaign = false } = {}) {
  const raw = [];
  const mapping = { date: "date", cost: "cost", installs: "installs", clicks: "clicks", impressions: "impressions" };
  if (withChannel) mapping.channel = "channel";
  if (withCampaign) mapping.campaign = "campaign";
  for (let i = 0; i < 6; i++) {
    const day = String((i % 3) + 1).padStart(2, "0");
    const row = { date: `2024-01-${day}`, cost: 100, installs: 10, clicks: 50, impressions: 1000 };
    if (withChannel) row.channel = i % 2 === 0 ? "Google" : "Meta";
    if (withCampaign) row.campaign = i % 2 === 0 ? "C1" : "C2";
    raw.push(row);
  }
  return { raw, headers: Object.keys(mapping), mapping };
}

describe("buildDashboardExports", () => {
  it("데이터 없음 → 전부 null", () => {
    const e = buildDashboardExports({ csvData: { raw: [], headers: [], mapping: {} } });
    expect(e.daily).toBe(null);
    expect(e.byChannel).toBe(null);
  });

  it("일별 CSV — BOM+CRLF + 파생지표 헤더 포함", () => {
    const e = buildDashboardExports({ csvData: makeCsv() });
    expect(e.daily.startsWith("﻿")).toBe(true);
    expect(e.daily).toContain("\r\n");
    // 파생 지표 컬럼
    for (const c of ["cpi", "cpa", "ctr", "cvr", "roas"]) expect(e.daily).toContain(c);
    // 날짜 3종 집계(같은 날 합산)
    const dataLines = e.daily.trim().split("\r\n").slice(1);
    expect(dataLines.length).toBe(3);
    // CPI = cost/installs = (100*2)/(10*2) = 10
    expect(e.daily).toContain(",10,"); // cpi 값 등장(정수)
  });

  it("channel 미매핑이면 byChannel=null, 매핑되면 집계", () => {
    expect(buildDashboardExports({ csvData: makeCsv() }).byChannel).toBe(null);
    const e = buildDashboardExports({ csvData: makeCsv({ withChannel: true }) });
    expect(e.byChannel).toContain("Google");
    expect(e.byChannel).toContain("Meta");
  });

  it("campaign 매핑 시 byCampaign 집계", () => {
    const e = buildDashboardExports({ csvData: makeCsv({ withCampaign: true }) });
    expect(e.byCampaign).toContain("C1");
    expect(e.byCampaign).toContain("C2");
  });

  it("locale en → 영문 키 헤더", () => {
    const e = buildDashboardExports({ csvData: makeCsv({ withChannel: true }), locale: "en" });
    expect(e.daily.split("\r\n")[0]).toContain("date");
    expect(e.byChannel.split("\r\n")[0]).toContain("channel");
  });
});
