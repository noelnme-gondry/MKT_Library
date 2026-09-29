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
    for (const { header, field } of shown) expect(mapping[header], header).toBe(field);
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
