import { PVM_MATH } from "@/utils/pvmMath";
import { effectiveDenomBasis, getMonFilteredRows } from "@/utils/dashboardAggregator";

const DAY = 86400000;

// 결과 허브용 최근 7일 PVM 스냅샷. 상세 도구와 같은 Bennet 엔진을 쓰되, 화면에는
// 가장 큰 기여 한 건만 올리고 전체 브릿지·드릴다운은 PVM 상세 화면에 맡긴다.
export function buildPvmQuickSummary({ csvData, dashboardFilter, denomBasis = "installs" } = {}) {
  const mapped = new Set(Object.values(csvData?.mapping || {}).filter((value) => value && value !== "__ignore__"));
  const resultField = effectiveDenomBasis(csvData, denomBasis) === "actions" && mapped.has("actions") ? "actions" : "installs";
  if (!["date", "channel", resultField].every((field) => mapped.has(field)) || !(mapped.has("spend") || mapped.has("cost"))) return { available: false };
  const rows = getMonFilteredRows(csvData, dashboardFilter || {}).map((row) => ({ ...row, spend: row.spend ?? row.cost ?? 0, campaign_id: row.campaign_id ?? row.campaign_name, _t: new Date(`${row.date}T00:00:00Z`).getTime() })).filter((row) => !Number.isNaN(row._t));
  if (!rows.length) return { available: false };
  // 대용량 행 스프레드 인자 한계 회피(computeWeightedRetention과 동일 함정 — reduce로 최대값).
  const maxT = rows.reduce((m, row) => (row._t > m ? row._t : m), -Infinity);
  const current = rows.filter((row) => row._t >= maxT - 6 * DAY && row._t <= maxT);
  const prior = rows.filter((row) => row._t >= maxT - 13 * DAY && row._t < maxT - 6 * DAY);
  if (!current.length || !prior.length) return { available: false };
  const keys = { ch: "channel", cmp: mapped.has("campaign_id") || mapped.has("campaign_name") ? "campaign_id" : null, cr: mapped.has("creative_id") ? "creative_id" : null, resultField };
  if (!PVM_MATH.inspectFinestInputs(prior, current, keys).ok) return { available: false };
  const finest = PVM_MATH.decomposeFinest(prior, current, keys);
  if (!finest) return { available: false };
  const cbar = (finest.CPA1 + finest.CPA2) / 2;
  const layer = PVM_MATH.decomposeLayer(prior, current, keys, finest.Result1, finest.Result2, cbar, "channel");
  const driver = [...layer].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))[0];
  return { available: Boolean(driver), metric: resultField === "actions" ? "CPA" : "CPI", prior: finest.CPA1, current: finest.CPA2, delta: finest.deltaCpa, driver };
}
