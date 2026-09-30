import { SATURATION_AXIS_FIELDS } from "@/utils/csvConstants";
import { prepareRecipeRows, normalizeRecipeValue } from "./recipeRows";
import { satActiveVerdict, satBuildPoints } from "@/utils/satMath";

export const SATURATION_BLOCKS = [
  { id: "s-sat-summary", label: { ko: "요약", en: "Summary" }, locked: true },
  { id: "s-scale-map", label: { ko: "증액·감액 지도", en: "Scale decision map" } },
  { id: "s-marginal-gap", label: { ko: "평균·한계효율", en: "Average vs. marginal" }, locked: true },
  { id: "s-sat", label: { ko: "포화도 순위·판정 보류 사유", en: "Saturation ranking and abstention reasons" }, locked: true },
  { id: "s-sat-curve", label: { ko: "응답곡선", en: "Response curve" } },
];

export function saturationSpec(mappedFields, revField) {
  return {
    commandExample: { ko: "예: OS별, 포화만 보기, Meta만 분석", en: "e.g. By OS, Show saturated only, Analyze Meta only" },
    toolId: "5-22", maxLevels: 1, metrics: revField ? ["cpa", "roas"] : ["cpa"],
    periodKinds: [], exportFormats: [], blocks: SATURATION_BLOCKS,
    defaults: { levels: [SATURATION_AXIS_FIELDS.find((field) => mappedFields.has(field)) || "channel"], metric: "cpa" },
  };
}

export function legacySaturationSteps(state = {}) {
  return [
    ...(state.grain === "campaign" ? [{ id: "level.field", params: { field: "campaign_name" } }] : []),
    ...(state.metric === "roas" ? [{ id: "metric.saturation.roas", params: {} }] : []),
  ];
}

// 기존 엔진의 channel 슬롯에 임의 단축을 투영한다. 계산식과 캠페인의 채널 접두사는 유지한다.
export function prepareSaturationRows(rows, { field, filters, caseSensitive }) {
  const prepared = prepareRecipeRows(rows, {
    levels: field === "campaign_name" ? ["channel", field] : [field], filters, caseSensitive,
  });
  return {
    ...prepared,
    rows: ["channel", "campaign_name"].includes(field) ? prepared.rows
      : prepared.rows.map((row) => ({ ...row, channel: row[field] == null ? "" : String(row[field]).trim() })),
  };
}

// 보기 설정은 순위표에만 적용한다. 전체 결론·계산표·판정 보류 사유는 유지한다.
export function applySaturationView(rows, { view, metric, filters = [], field, caseSensitive = false, entityNames = new Map() }) {
  let visible = rows;
  const unapplied = [];
  for (const filter of filters.filter((item) => item.scope === "view")) {
    if (filter.field !== field) { unapplied.push(filter); continue; }
    const wanted = new Set(filter.values.flatMap((value) => entityNames.get(normalizeRecipeValue(value, caseSensitive)) || [value])
      .map((value) => normalizeRecipeValue(value, caseSensitive)));
    visible = visible.filter((row) => wanted.has(normalizeRecipeValue(row.name, caseSensitive)) === (filter.op === "in"));
  }
  if (view.only) visible = visible.filter((row) => satActiveVerdict(row, metric) === (view.only === "worse" ? "saturated" : "scale"));
  if (view.topN != null) visible = visible.slice(0, view.topN);
  return { rows: visible, hiddenCount: rows.length - visible.length, unapplied };
}

// 캠페인 이름과 엔진의 채널 접두사 이름을 연결한다. 이름 조립 규칙은 엔진에서만 소유한다.
export function saturationEntityNames(rows, field, metricField, revField, caseSensitive) {
  if (field !== "campaign_name") return new Map();
  const groups = new Map();
  for (const row of rows) {
    const key = normalizeRecipeValue(row[field], caseSensitive);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return new Map([...groups].map(([key, group]) => [key, [...satBuildPoints(group, "campaign", metricField, revField).keys()]]));
}
