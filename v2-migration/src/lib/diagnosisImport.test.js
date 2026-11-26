import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { DIAGNOSIS_SAMPLE_URL, loadDiagnosisExample, mapDiagnosisData, parseDiagnosisCsv, suggestedGrain } from "./diagnosisImport";
import { analyzeDiagnosis } from "./campaignDiagnosis";

const map = (csv, options = {}) => {
  const parsed = parseDiagnosisCsv(csv);
  return mapDiagnosisData(parsed, parsed.mapping, options);
};
describe("diagnosis CSV", () => {
  it("preserves blank outcomes and true zero with their spend; supports quoted names, KRW and grouped numbers", () => {
    const result = map('일자,매체,광고비 (KRW),설치 수,캠페인명\n2026-11-18,Meta,"₩100,000",,"고객, 신규"\n2026-11-19,Meta,50000,0,리타겟');
    expect(result.rows).toMatchObject([{ cost:100000, result:null, campaign:"고객, 신규" }, { cost:50000, result:0 }]);
    expect(result.meta).toMatchObject({ currency:"KRW", organicExclusive:false });
  });
  it("requires a deliberate KPI choice for multiple valid outcomes", () => {
    const parsed = parseDiagnosisCsv("date,campaign,cost,installs,purchases\n2026-10-09,A,100,10,2");
    expect(parsed.mapping.result).toBe("");
    expect(() => mapDiagnosisData(parsed, parsed.mapping)).toThrow();
    expect(mapDiagnosisData(parsed, { ...parsed.mapping, result:"purchases" }).rows[0].result).toBe(2);
  });
  it.each([
    ["date,channel,cost,conversions\n2026-11-18,A,10,3\n2026-11-19,A,20,rubbish", /2행/],
    ["date,channel,cost,conversions\n2026-11-18,A,,3", /비용/],
    ["date,channel,cost,conversions\n2026-11-18,A,-9,3", /0 이상/],
    ["date,channel,cost,conversions\n2026-02-30,A,9,3", /YYYY-MM-DD/],
    ["date,channel,cost,conversions\n2026-11-18,A,9,3,extra", /열 개수/],
    ["date,channel,cost,cost\n2026-11-18,A,9,3", /제목/],
    ["date,channel,cost,conversions\n2026-11-18,A,19%,3", /0 이상/],
    ["date,channel,cost,conversions,currency\n2026-11-18,A,19,3,KRW\n2026-11-19,B,1,3,USD", /통화/],
  ])("rejects incomplete or invalid files without dropping bad rows: %s", (csv, expected) => {
    expect(() => map(csv)).toThrow(expected);
  });
  it("keeps mixed audience scopes explicit and narrows aligned rows before currency aggregation", () => {
    const csv="week,channel,cost,result,market,OS,organic,currency\n2026-W46,Meta,100,10,KR,iOS,18,KRW\n2026-W46,Meta,100,10,KR,Android,18,KRW\n2026-W46,Meta,10,2,US,iOS,5,USD";
    expect(() => map(csv, {grain:"weekly"})).toThrow(/통화/);
    const both=map(csv, {grain:"weekly", market:"KR"});
    expect(both.rows).toHaveLength(2);
    expect(both.meta).toMatchObject({supplementalScopeHeld:true,scope:{markets:["KR"],platforms:["Android","iOS"],fileRows:3,selectedRows:2}});
    const one=map(csv, {grain:"weekly", market:"KR", platform:"iOS"});
    expect(one.meta).toMatchObject({supplementalScopeHeld:false,currency:"KRW",scope:{platforms:["iOS"],selectedRows:1}});
    expect(() => map(csv, {grain:"weekly", market:"US", platform:"Android"})).toThrow(/해당하는 행/);
  });
  it("requires an explicit currency for ambiguous symbols and rejects disagreeing units", () => {
    const csv="date,channel,cost,result\n2026-11-18,A,$25,3";
    expect(() => map(csv)).toThrow(/통화 코드/);
    expect(map(csv, {currency:"CAD"}).rows[0]).toMatchObject({cost:25,currency:"CAD"});
    expect(() => map(csv, {currency:"KRW"})).toThrow(/통화 코드/);
    expect(map("date,channel,cost,result\n2026-11-18,A,325 CHF,3").rows[0]).toMatchObject({cost:325,currency:"CHF"});
    expect(() => map("date,channel,cost,result\n2026-11-18,A,25,₩3")).toThrow(/금액/);
  });
  it("reads declared weekly totals, without treating sparse daily rows as weekly totals", () => {
    const data = parseDiagnosisCsv("주차,채널,광고비,가입 수\n2026-W46,A,100,10\n2026-W47,A,120,11");
    expect(suggestedGrain(data)).toBe("weekly");
    expect(mapDiagnosisData(data, data.mapping, {grain:"weekly"}).rows[1].date).toBe("2026-11-16");
    expect(suggestedGrain(parseDiagnosisCsv("date,channel,cost,result\n2026-11-09,A,100,10\n2026-11-16,A,120,12"))).toBe("daily");
    expect(() => map("week,channel,cost,result\n2026-11-09,A,100,10\n2026-11-19,A,20,2", {grain:"weekly"})).toThrow(/요일/);
  });
  it("loads and diagnoses the exact downloadable sample", async () => {
    const contents = readFileSync(`public${DIAGNOSIS_SAMPLE_URL}`, "utf8");
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(contents));
    try {
      const {rows,meta} = await loadDiagnosisExample();
      expect(fetch).toHaveBeenCalledWith(DIAGNOSIS_SAMPLE_URL, {signal:undefined});
      expect(rows).toHaveLength(126);
      const report = analyzeDiagnosis(rows,meta);
      expect(report.previous).toMatchObject({cost:1400000,result:180});
      expect(report.current).toMatchObject({cost:1600000,result:195});
      expect(report.organic).toMatchObject({previous:90,current:80,totalDelta:5});
      expect(report.budget.status).toBe("ready");
      expect(report.creative.entered).toHaveLength(1);
      expect(report.creative.exited).toHaveLength(1);
      expect(report.creative.fatigue).toHaveLength(1);
      expect(report.channelPerformance.channels.map(ch => ch.name)).toEqual(["Google","Meta"]);
      expect(report.channels.find(r=>r.name==="Meta").incrementalCpa).toBe(15000);
    } finally {
      fetch.mockRestore();
    }
  });
});
