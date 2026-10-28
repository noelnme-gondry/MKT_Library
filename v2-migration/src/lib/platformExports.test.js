import { describe, expect, it } from "vitest";
import { buildMappingContract } from "@/lib/data-import/mappingContract";
import { buildCanonicalDataset } from "@/lib/data-import/buildCanonicalDataset";
import { evaluateEligibility } from "@/lib/analysis-router/evaluateEligibility";
import { mapDataset } from "@/lib/data-import/semantic-mapper/mapDataset";
import { evaluateV2Eligibility } from "@/lib/data-import/schema/toolDataRequirements";
import { TOOL_REQUIRED_FIELDS } from "@/utils/csvConstants";
import { publishedToolIds } from "@/lib/routeMap";
import { TEMPLATE_PAGES } from "@/lib/templateCatalog";
import { PLATFORM_EXPORTS, platformExportHeaders, platformExportsForTool, toolReadsField } from "./platformExports";
import { efficiencyAdapterFor, runEfficiencyAnalysis } from "@/lib/assistant/efficiencyAnalysisAdapters";

// 템플릿 페이지에 "그대로 올려도 된다"고 적은 파일은 실제 업로드 판정 셋을 모두 통과해야 한다.
// 업로드 화면은 기존 매핑 계약·의미 매퍼(V2)·분석 자격 셋 중 하나라도 막히면 분석 버튼을
// 잠그므로(§7), 하나만 검사하면 Google Play처럼 화면에서만 막히는 파일이 통과한다.
const STORE_SOURCES = {
  "app-store-connect": ["App Store Search", "App Store Browse", "App Referrer"],
  "google-play-console": ["Google Play search", "Google Play explore", "Third-party referrers"],
};

function cellFor(entry, field, header, day, index) {
  if (field === "date") return `2026-08-${String(day + 1).padStart(2, "0")}`;
  if (field === "store_source") return STORE_SOURCES[entry.id][index];
  if (field === "campaign_name") return `Campaign_${index}`;
  if (field === "cost") return header.includes("KRW") ? "412,300" : "312.40";
  if (field === undefined) return /name|이름/i.test(header) ? `set_${index}` : "448000";
  return String(1000 + day * 10 + index * 7);
}

const rowsFor = (entry) => Array.from({ length: 21 }, (_, day) => [0, 1, 2].map((index) => Object.fromEntries(
  platformExportHeaders(entry).map((header) => [header, cellFor(entry, entry.columns[header], header, day, index)]),
))).flat();

const requiredKeys = (toolId) => (TOOL_REQUIRED_FIELDS[toolId] || []).flatMap((field) => typeof field === "string" ? [field] : field?.oneOf || []);

const cases = PLATFORM_EXPORTS.flatMap((entry) => entry.tools.map((toolId) => [`${entry.id} → ${toolId}`, entry, toolId]));

describe("플랫폼 내보내기 파일 그대로 올리기", () => {
  it("검사 대상이 비어 있지 않다", () => {
    expect(cases.length).toBeGreaterThanOrEqual(8);
  });

  it.each(cases)("%s: 적어 둔 열이 그대로 매핑되고 무시한다고 적은 열은 읽지 않는다", (_name, entry, toolId) => {
    const { mapping, requiredMissing, assessments } = buildMappingContract({ toolId, headers: platformExportHeaders(entry), rows: rowsFor(entry) });
    expect(requiredMissing).toEqual([]);
    // 화면에 "이 열로 읽는다"고 보여 주는 열(그 도구가 읽는 열)은 전부 그 필드로 잡혀야 한다.
    const shown = platformExportsForTool(toolId, "ko").find((item) => item.id === entry.id).columns;
    expect(shown.length).toBeGreaterThanOrEqual(3);
    // 같은 열을 도구마다 다른 키로 읽는다 — 5-21은 지출을 spend, 캠페인 이름을 campaign_id로 분해한다
    // (getMappedRows가 cost↔spend를 함께 채운다, AGENTS §7). 키는 달라도 같은 열이다.
    const SAME = [["campaign_name", "campaign_id"], ["cost", "spend"]];
    const sameColumn = (field) => SAME.find((group) => group.includes(field)) || [field];
    for (const { header, field } of shown) expect(sameColumn(field), header).toContain(mapping[header]);
    for (const [header, field] of Object.entries(entry.columns)) if (!toolReadsField(toolId, field)) expect(mapping[header] || "__ignore__", header).toBe("__ignore__");
    for (const header of Object.keys(entry.ignored)) expect(mapping[header] || "__ignore__", header).toBe("__ignore__");
    // 필수 열이 "확인 필요"로 남으면 분석 버튼이 막힌다.
    const required = new Set(requiredKeys(toolId));
    const blocking = assessments.filter((item) => required.has(item.field) && item.state === "must_confirm");
    expect(blocking).toEqual([]);
  });

  it.each(cases)("%s: 기존 자격과 의미 매퍼(V2) 자격 모두 막히지 않는다", (_name, entry, toolId) => {
    const headers = platformExportHeaders(entry);
    const rows = rowsFor(entry);
    const { mapping } = buildMappingContract({ toolId, headers, rows });
    const canonical = buildCanonicalDataset({ raw: rows, headers, mapping });
    expect(evaluateEligibility({ toolId, mapping, canonicalData: canonical }).status).not.toBe("blocked");
    expect(evaluateV2Eligibility({ toolId, bindings: mapDataset({ headers, rows }).bindings }).status).not.toBe("blocked");
  });

  // 헤더가 맞아도 결과 작업대(/start 업로드 뒤 결과)가 단위를 못 고르면 같은 파일이 도구 화면에서는 되고
  // 작업대에서는 "채널 매핑 부족"으로 막힌다(2026-10-28 — Meta 캠페인 보고서엔 채널 열이 없다).
  // 지출이 날마다 움직이고 설치가 수확체감하는 행으로 실제 결과까지 계산한다.
  const resultCases = cases.filter(([, , toolId]) => efficiencyAdapterFor(toolId));
  const variedRows = (entry) => Array.from({ length: 35 }, (_, day) => [0, 1, 2].map((index) => {
    const spend = 300000 * (1 + index * 0.4) * (1 + 0.45 * Math.sin(day * 0.9 + index * 2.1));
    const installs = Math.round(9 * Math.sqrt(spend / 100) * (1 + 0.1 * Math.cos(day * 1.3 + index)));
    return Object.fromEntries(platformExportHeaders(entry).map((header) => {
      const field = entry.columns[header];
      if (field === "date") return [header, `2026-08-${String(day + 1).padStart(2, "0")}`.replace(/-08-3(\d)$/, (_m, d) => `-09-0${Number(d) + 1}`)];
      if (field === "campaign_name") return [header, `Campaign_${index}`];
      if (field === "cost") return [header, header.includes("KRW") ? Math.round(spend).toLocaleString("en-US") : (spend / 1400).toFixed(2)];
      if (field === "installs") return [header, String(installs)];
      if (field === "impressions") return [header, String(Math.round(spend / 8))];
      if (field === "clicks") return [header, String(Math.round(spend / 900))];
      return [header, /name|이름/i.test(header) ? `set_${index}` : "448000"];
    }));
  })).flat();

  it("결과 계산 검사 대상이 비어 있지 않다", () => {
    expect(resultCases.length).toBeGreaterThanOrEqual(4);
  });

  it.each(resultCases)("%s: 결과 작업대에서도 결론까지 계산한다", (_name, entry, toolId) => {
    const headers = platformExportHeaders(entry);
    const raw = variedRows(entry);
    expect(new Set(raw.map((row) => row[headers.find((header) => entry.columns[header] === "date")])).size).toBe(35);
    const { mapping } = buildMappingContract({ toolId, headers, rows: raw });
    const result = runEfficiencyAnalysis({ toolId, csvData: { raw, headers, mapping, fileName: `${entry.id}.csv` }, inputSignature: "in", mappingSignature: "map", locale: "ko" });
    expect(result.verdict.headline).not.toMatch(/매핑이 부족/);
    expect(result.status, result.verdict.headline).toBe("success");
  });

  it("안내를 싣는 도구는 모두 발행 도구이고 템플릿 페이지가 있다", () => {
    const templateTools = new Set(TEMPLATE_PAGES.map((page) => page.toolId));
    for (const entry of PLATFORM_EXPORTS) for (const toolId of entry.tools) {
      expect(publishedToolIds(), toolId).toContain(toolId);
      expect(templateTools.has(toolId), toolId).toBe(true);
    }
  });

  it("EN 표시는 한글이 섞이지 않고 KO와 같은 열을 보여 준다", () => {
    for (const toolId of new Set(PLATFORM_EXPORTS.flatMap((entry) => entry.tools))) {
      const ko = platformExportsForTool(toolId, "ko");
      const en = platformExportsForTool(toolId, "en");
      expect(en.map((item) => item.id)).toEqual(ko.map((item) => item.id));
      for (const [index, item] of en.entries()) {
        expect(item.columns.map((column) => column.header)).toEqual(ko[index].columns.map((column) => column.header));
        const shown = [item.platform, item.report, ...item.columns.map((column) => column.label), ...item.ignored.map((column) => column.reason)].join(" ");
        expect(shown).not.toMatch(/[가-힣]/);
      }
    }
  });
});
