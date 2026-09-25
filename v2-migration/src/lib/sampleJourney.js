import { buildDemoCsv } from "@/utils/demoData";
import { compareSamplePerformance } from "@/utils/sampleSpendPreview";
import { buildCanonicalDataset } from "@/lib/data-import/buildCanonicalDataset";
import { buildLegacyRows } from "@/lib/data-import/canonical-v2/buildLegacyRows";

// Only this module's source rows and mapping can skip manual sample mapping.
// Display-only copies retain that identity; uploaded rows or remapping do not.
const journeys = new WeakMap();

export function buildSampleJourney(locale = "ko") {
  const demo = buildDemoCsv("efficiency", locale);
  const preview = compareSamplePerformance(demo.raw);
  // 유료 채널 전체를 싣는다. 채널 하나로 좁히면 채널을 비교하는 분석(성과 변동 원인·증액 여력·
  // 예산 재배분·채널 중복)이 "비교 대상 1개"로 판정을 못 내 결과 화면이 거의 비었다(2026-09-25).
  // 홈 미리보기가 보여 준 채널(CPA 상승폭 최대)은 성과 변동 원인에서 가장 큰 기여로 다시 나온다.
  const channels = preview?.channels || [];
  if (!channels.length) throw new Error("The built-in sample needs a comparable paid channel.");
  const dates = new Set(preview.dates);
  const raw = demo.raw.filter(row => row.source === "paid" && dates.has(row.date));
  const csv = { ...demo, raw, importSource: "demo" };
  csv.canonicalData = buildCanonicalDataset(csv);
  csv.mappedRows = buildLegacyRows({ raw, legacyMapping: csv.mapping, toolId: "start-gate" });
  const context = {
    channel: locale === "en" ? `${channels.length} paid channels` : `유료 채널 ${channels.length}개`,
    period: { previousStart: preview.dates[0], previousEnd: preview.dates[6], currentStart: preview.dates[7], currentEnd: preview.dates[13] },
  };
  journeys.set(raw, { mapping: csv.mapping, context });
  return csv;
}

export function getSampleJourney(csv) {
  const entry = csv?.importSource === "demo" && journeys.get(csv.raw);
  return entry && entry.mapping === csv.mapping ? entry.context : null;
}
