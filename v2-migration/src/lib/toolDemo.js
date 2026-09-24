import { buildDemoCsv } from "@/utils/demoData";
import { TOOL_GROUP } from "@/lib/toolGroups";
import { buildCanonicalDataset } from "@/lib/data-import/buildCanonicalDataset";
import { buildLegacyRows } from "@/lib/data-import/canonical-v2/buildLegacyRows";

// 도구 하나의 예시 슬라이스. 예시는 매핑이 이미 맞춰진 데이터라 확인·분석하기 없이 바로
// 결과로 간다 — 도구 안의 예시 버튼과 홈 샘플(모든 도구)이 같은 조립을 쓴다(2026-09-24).
export function buildToolDemo(toolId, locale = "ko") {
  const demo = buildDemoCsv(TOOL_GROUP[toolId] || "efficiency", locale);
  return { ...demo, canonicalData: buildCanonicalDataset(demo), mappedRows: buildLegacyRows({ raw: demo.raw, legacyMapping: demo.mapping, toolId }) };
}
