import { createAnalysisResult, ANALYSIS_RESULT_STATUS } from "./analysisResultContract";
import { getMappedRows } from "@/utils/dashboardAggregator";
import {
  discreteHazard,
  kaplanMeier,
  medianSurvival,
  normalizeDateSurvivalRows,
  normalizeSurvivalRows,
  restrictedMeanSurvival,
  survivalEvidence,
} from "@/utils/subscriptionSurvivalMath";

const TOOL_ID = "5-28";

function tr(locale, ko, en) {
  return locale === "en" ? en : ko;
}

function firstDefined(row, keys) {
  const key = keys.find((candidate) => Object.hasOwn(row || {}, candidate)
    && row[candidate] != null
    && String(row[candidate]).trim() !== "");
  return key ? row[key] : undefined;
}

function periodRows(rows) {
  return rows.map((row) => ({
    tenure_periods: firstDefined(row, ["tenure_periods", "subscription_tenure"]),
    event_observed: firstDefined(row, ["event_observed", "churn_event"]),
    entry_period: firstDefined(row, ["entry_period", "subscription_entry"]),
  }));
}

function dateRows(rows) {
  return rows.map((row) => ({
    subscription_start_date: firstDefined(row, ["subscription_start_date", "subscription_started_at", "subscription_start", "start_date", "started_at"]),
    churn_date: firstDefined(row, ["churn_date", "subscription_churn_date", "cancel_date", "cancelled_at", "canceled_at", "ended_at"]),
    observation_end_date: firstDefined(row, ["observation_end_date", "subscription_end_date", "observed_until", "as_of_date", "snapshot_date"]),
    entry_period: firstDefined(row, ["entry_period", "subscription_entry"]),
  }));
}

function notComputable({ inputSignature, mappingSignature, locale, reason, normalized }) {
  return createAnalysisResult({
    toolId: TOOL_ID,
    status: ANALYSIS_RESULT_STATUS.NOT_COMPUTABLE,
    inputSignature,
    mappingSignature,
    verdict: {
      evidenceState: "not_computable",
      headline: tr(locale, "관측 가능한 구독 유지 곡선을 계산하지 못했습니다.", "An observable subscription-survival curve could not be calculated."),
      stats: [
        { id: "valid-episodes", label: tr(locale, "유효 구독 에피소드", "Valid subscription episodes"), value: normalized?.validRows?.length || 0 },
        { id: "observed-churns", label: tr(locale, "관측 이탈", "Observed churns"), value: normalized?.eventCount || 0 },
      ],
      action: tr(locale, "기간과 이탈 여부 또는 시작일·이탈일·관측 종료일 컬럼을 확인합니다.", "Review tenure and churn status, or start, churn, and observation-end date columns."),
      caveats: [tr(locale, "관측 이탈이 없으면 유지 확률의 하락 시점을 추정할 수 없습니다.", "Without observed churn events, the timing of survival decline cannot be estimated.")],
    },
    manifest: {
      engine: "subscriptionSurvivalMath",
      reason,
      validEpisodeCount: normalized?.validRows?.length || 0,
      observedEventCount: normalized?.eventCount || 0,
      excludedCount: normalized?.excludedRows?.length || 0,
    },
  });
}

function runSubscriptionSurvival({ csvData, inputSignature, mappingSignature, locale = "ko" } = {}) {
  if (!inputSignature || !mappingSignature) throw new Error("subscription_adapter_signatures_required");
  const rows = getMappedRows(csvData || {});
  const usesDates = rows.some((row) => firstDefined(row, ["subscription_start_date", "subscription_started_at", "subscription_start", "start_date", "started_at"]) != null);
  const normalized = usesDates
    ? normalizeDateSurvivalRows(dateRows(rows), { timeUnit: "month" })
    : normalizeSurvivalRows(periodRows(rows), { timeUnit: "month" });
  if (!normalized.validRows.length) return notComputable({ inputSignature, mappingSignature, locale, reason: "no_valid_episodes", normalized });
  const table = kaplanMeier(normalized.validRows);
  if (!table.length || !normalized.eventCount) return notComputable({ inputSignature, mappingSignature, locale, reason: "no_observed_events", normalized });

  const horizon = table.at(-1).time;
  const evidence = survivalEvidence({ normalized, kmTable: table, horizon });
  const median = medianSurvival(table);
  const rmst = restrictedMeanSurvival(table, horizon);
  const hazard = discreteHazard(table);
  const evidenceState = evidence.status === "READY" ? "estimated" : "descriptive";
  const headline = median == null
    ? tr(locale, `관측 ${horizon}개월 안에서 구독 유지율이 50% 아래로 내려가지 않았습니다.`, `Survival did not fall below 50% within the observed ${horizon}-month horizon.`)
    : tr(locale, `관측된 구독 유지기간 중앙값은 ${median}개월입니다.`, `The observed median subscription survival is ${median} months.`);

  return createAnalysisResult({
    toolId: TOOL_ID,
    status: ANALYSIS_RESULT_STATUS.SUCCESS,
    inputSignature,
    mappingSignature,
    verdict: {
      evidenceState,
      headline,
      stats: [
        { id: "valid-episodes", label: tr(locale, "유효 구독 에피소드", "Valid subscription episodes"), value: normalized.validRows.length },
        { id: "observed-churns", label: tr(locale, "관측 이탈", "Observed churns"), value: normalized.eventCount },
        { id: "median-survival", label: tr(locale, "유지기간 중앙값", "Median survival"), value: median, unit: tr(locale, "개월", "months") },
        { id: "rmst", label: tr(locale, "관측기간 평균 유지기간", "Observed-horizon RMST"), value: rmst, unit: tr(locale, "개월", "months") },
      ],
      action: tr(locale, "위험집합이 충분한 구간과 이탈 위험이 높아지는 갱신 시점을 상세 화면에서 확인합니다.", "Review periods with adequate risk sets and renewal points where churn hazard rises in the detailed view."),
      caveats: [tr(locale, "이 결과는 관측기간 안의 Kaplan–Meier 기술 추정이며 미래 생존이나 이탈 원인을 예측하지 않습니다.", "This is a descriptive Kaplan–Meier estimate within the observed horizon; it does not predict future survival or explain the cause of churn.")],
    },
    visualizations: [
      {
        id: "subscription-survival-curve",
        kind: "line",
        question: tr(locale, "구독 유지 확률은 관측기간 동안 어떻게 변했는가?", "How did subscription survival change over the observed horizon?"),
        data: table.map((point) => ({ period: point.time, survival: point.survival, ciLow: point.ciLow, ciHigh: point.ciHigh, atRisk: point.atRisk })),
        options: { x: "period", y: "survival", unit: "rate" },
      },
      {
        id: "subscription-hazard",
        kind: "bar",
        question: tr(locale, "이탈 위험이 높았던 갱신 시점은 언제인가?", "At which renewal points was churn hazard highest?"),
        data: hazard.rows.map((point) => ({ period: point.time, hazard: point.hazard, atRisk: point.atRisk })),
        options: { x: "period", y: "hazard", unit: "rate" },
      },
    ],
    manifest: {
      engine: "subscriptionSurvivalMath",
      inputMode: usesDates ? "dates" : "periods",
      timeUnit: "month",
      validEpisodeCount: normalized.validRows.length,
      observedEventCount: normalized.eventCount,
      censoredCount: normalized.censoredCount,
      excludedCount: normalized.excludedRows.length,
      observedHorizon: horizon,
      evidenceStatus: evidence.status,
    },
  });
}

export const SUBSCRIPTION_ANALYSIS_TOOL_IDS = Object.freeze([TOOL_ID]);

export function subscriptionAdapterFor(toolId) {
  return toolId === TOOL_ID ? runSubscriptionSurvival : null;
}

export function runSubscriptionAnalysis({ toolId, ...input } = {}) {
  const adapter = subscriptionAdapterFor(toolId);
  if (!adapter) throw new Error(`Unsupported subscription analysis adapter: ${toolId || "unknown"}`);
  return adapter(input);
}
