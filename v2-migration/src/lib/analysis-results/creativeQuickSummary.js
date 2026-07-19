import { CREATIVE_FATIGUE, CREATIVE_STATS } from "@/utils/creativeMath";
import { CREATIVE_CONFIG } from "@/utils/creativeConfig";
import { getMappedRows } from "@/utils/dashboardAggregator";

// 대시보드에서 보여 줄 최소·결론용 소재 결과. CreativeAnalyzer와 같은 피로도 엔진을
// 사용하되, WLS·차트 같은 무거운 상세 렌더는 상세 화면에서만 수행한다.
export function buildCreativeQuickSummary(csvData) {
  const mapped = new Set(Object.values(csvData?.mapping || {}).filter((value) => value && value !== "__ignore__"));
  const required = ["creative_id", "date", "impressions", "clicks"];
  if (!required.every((field) => mapped.has(field))) return { available: false, missing: required.filter((field) => !mapped.has(field)) };
  const rows = getMappedRows(csvData).filter((row) => row.creative_id && row.date && Number(row.impressions) >= 0 && Number(row.clicks) >= 0);
  if (!rows.length) return { available: false, missing: ["유효 행"] };
  const fatigue = CREATIVE_STATS.fatigueDetect(rows, "ctr", CREATIVE_CONFIG);
  const alerts = CREATIVE_FATIGUE.buildAlerts(rows, CREATIVE_CONFIG.fatigueAlert);
  return {
    available: true,
    creativeCount: new Set(rows.map((row) => row.creative_id)).size,
    fatiguedCount: fatigue.filter((item) => item.fatigued).length,
    alertNowCount: alerts.filter((item) => item.alert).length,
    alertCount: alerts.length,
  };
}
