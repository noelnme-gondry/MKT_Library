import { buildVifSpendPanel } from "@/lib/analysis-router/vifReadiness";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { buildAsaKeywordRecommendations } from "@/utils/asaKeywordMath";
import { computeVif, correlationMatrix } from "@/utils/modelDiagnostics";

import { ANALYSIS_RESULT_STATUS, createAnalysisResult } from "./analysisResultContract";

const OPTIMIZATION_TOOL_IDS = Object.freeze(["5-25", "5-26"]);

function tr(locale, ko, en) {
  return locale === "en" ? en : ko;
}

function readInput(input = {}) {
  return {
    csvData: input.csvData,
    inputSignature: String(input.inputSignature || ""),
    mappingSignature: String(input.mappingSignature || ""),
    locale: input.locale === "en" ? "en" : "ko",
    options: input.options || {},
  };
}

function requireSignatures({ inputSignature, mappingSignature }) {
  if (!inputSignature || !mappingSignature) throw new Error("Dochi adapter requires inputSignature and mappingSignature");
}

function safeNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function unavailable({ toolId, inputSignature, mappingSignature, locale, status = ANALYSIS_RESULT_STATUS.NOT_COMPUTABLE, headline, caveats = [], manifest = {} }) {
  return createAnalysisResult({
    toolId,
    status,
    inputSignature,
    mappingSignature,
    verdict: {
      evidenceState: status === ANALYSIS_RESULT_STATUS.NOT_IDENTIFIED ? "not_identified" : "not_computable",
      headline,
      caveats,
    },
    manifest: { engine: "optimization-analysis-adapter-v1", status, ...manifest },
  });
}

function vifAdapter(input) {
  const { csvData, inputSignature, mappingSignature, locale } = readInput(input);
  requireSignatures({ inputSignature, mappingSignature });
  const panel = buildVifSpendPanel(getMappedRows(csvData).map((row) => ({
    date: row.date,
    entity: row.channel || row.campaign_name,
    cost: row.cost ?? row.spend,
  })));
  if (panel.entities.length < 2 || panel.matrix.length < panel.entities.length + 3) {
    return unavailable({
      toolId: "5-25", inputSignature, mappingSignature, locale,
      headline: tr(locale, "VIF 점검에는 최소 2개 채널과 채널 수보다 3개 이상 많은 공통 기간이 필요합니다.", "VIF checking needs at least two channels and at least three more common periods than channels."),
      manifest: { engine: "buildVifSpendPanel+computeVif", entityCount: panel.entities.length, periodCount: panel.matrix.length, reason: "insufficient_panel" },
    });
  }
  const vif = computeVif(panel.matrix);
  if (vif.verdict === "not_applicable") {
    return unavailable({
      toolId: "5-25", inputSignature, mappingSignature, locale,
      headline: tr(locale, "시간에 따라 달라진 채널이 2개 미만이라 VIF를 계산하지 않았습니다.", "Fewer than two channels vary over time, so VIF was not calculated."),
      manifest: { engine: "buildVifSpendPanel+computeVif", entityCount: panel.entities.length, periodCount: panel.matrix.length, varyingEntityCount: vif.variableIndices.length, reason: "insufficient_variation" },
    });
  }
  if (vif.verdict === "severe" && !Number.isFinite(vif.maxVif)) {
    return unavailable({
      toolId: "5-25", inputSignature, mappingSignature, locale,
      status: ANALYSIS_RESULT_STATUS.NOT_IDENTIFIED,
      headline: tr(locale, "채널 지출이 완전히 겹쳐 각 채널의 기여도를 분리할 수 없습니다.", "Channel spend overlaps perfectly, so individual channel contributions cannot be separated."),
      caveats: [tr(locale, "계산 불가 값을 무한대나 정상 신호로 바꾸지 않았습니다.", "The uncomputable value was not converted into infinity or a normal signal.")],
      manifest: { engine: "buildVifSpendPanel+computeVif", entityCount: panel.entities.length, periodCount: panel.matrix.length, varyingEntityCount: vif.variableIndices.length, verdict: vif.verdict, reason: "singular_vif" },
    });
  }
  const correlations = correlationMatrix(panel.entities.map((name, index) => ({ name, values: panel.matrix.map((row) => row[index]) })));
  const vifRows = vif.variableIndices.map((index, vifIndex) => ({
    entity: panel.entities[index],
    vif: safeNumber(vif.vif[vifIndex]),
    isComputable: Number.isFinite(vif.vif[vifIndex]),
  }));
  const headline = vif.verdict === "ok"
    ? tr(locale, "심한 채널 지출 중복 신호는 관측되지 않았습니다.", "No severe channel-spend overlap signal was observed.")
    : vif.verdict === "warn"
      ? tr(locale, "일부 채널 지출이 함께 움직여 MMM 해석에 주의가 필요합니다.", "Some channel spend moves together, so MMM interpretation needs caution.")
      : tr(locale, "채널 지출 중복이 심해 현재 데이터로 기여도를 분리하면 안 됩니다.", "Channel-spend overlap is severe; do not separate contribution with this data.");
  return createAnalysisResult({
    toolId: "5-25",
    status: ANALYSIS_RESULT_STATUS.SUCCESS,
    inputSignature,
    mappingSignature,
    verdict: {
      evidenceState: "descriptive",
      headline,
      stats: [
        { id: "max-vif", label: tr(locale, "최대 VIF", "Maximum VIF"), value: safeNumber(vif.maxVif) },
        { id: "varying-entities", label: tr(locale, "변동 채널", "Varying channels"), value: vifRows.length },
        { id: "common-periods", label: tr(locale, "공통 기간", "Common periods"), value: panel.matrix.length },
      ],
      action: vif.verdict === "ok"
        ? tr(locale, "MMM을 진행하되 주요 배분 결정은 별도 실험으로 확인합니다.", "Proceed with MMM, but verify major allocation decisions with a separate experiment.")
        : tr(locale, "함께 움직인 채널의 예산 변동을 분리한 뒤 VIF를 다시 점검합니다.", "Create independent spend variation for overlapping channels, then rerun VIF."),
      caveats: [tr(locale, "VIF와 상관은 관측 진단이며 인과 효과를 식별하지 않습니다.", "VIF and correlation are observational diagnostics, not causal identification.")],
    },
    visualizations: [
      { id: "vif-by-entity", kind: "table", question: tr(locale, "채널별 지출 중복은 어느 수준인가?", "How much does spend overlap by channel?"), table: { columns: ["entity", "vif", "isComputable"], rows: vifRows } },
      {
        id: "vif-correlation-pairs",
        kind: "table",
        question: tr(locale, "어떤 채널쌍이 함께 움직였는가?", "Which channel pairs moved together?"),
        table: {
          columns: ["left", "right", "pearsonR", "spearmanR", "holmP", "isSignificant", "robustness"],
          rows: correlations.pairs.map((pair) => ({
            left: pair.left,
            right: pair.right,
            pearsonR: safeNumber(pair.pearsonR),
            spearmanR: safeNumber(pair.spearmanR),
            holmP: safeNumber(pair.holmP),
            isSignificant: pair.isSignificant === true,
            robustness: pair.robustness || "not_identified",
          })),
        },
      },
    ],
    manifest: {
      engine: "buildVifSpendPanel+computeVif+correlationMatrix",
      status: "COMPLETE",
      entityCount: panel.entities.length,
      periodCount: panel.matrix.length,
      varyingEntityCount: vifRows.length,
      verdict: vif.verdict,
      correlationComparisons: correlations.comparisons,
      evidenceState: "descriptive",
    },
  });
}

function asaOption(options, key, alias) {
  return options[key] ?? options[alias] ?? 0;
}

function asaAdapter(input) {
  const { csvData, inputSignature, mappingSignature, locale, options } = readInput(input);
  requireSignatures({ inputSignature, mappingSignature });
  const recommendations = buildAsaKeywordRecommendations(getMappedRows(csvData), {
    globalDailyBudget: asaOption(options, "globalDailyBudget", "budget"),
    globalTargetCpa: asaOption(options, "globalTargetCpa", "cpa"),
    globalTargetCpt: asaOption(options, "globalTargetCpt", "cpt"),
  });
  if (!recommendations.length) {
    return unavailable({
      toolId: "5-26", inputSignature, mappingSignature, locale,
      headline: tr(locale, "검색어가 있는 ASA 행이 없어 Exact·CPT 후보를 만들지 않았습니다.", "There are no ASA rows with a search term, so Exact and CPT candidates were not created."),
      manifest: { engine: "buildAsaKeywordRecommendations", candidateCount: 0, reason: "no_search_terms" },
    });
  }
  const exact = recommendations.filter((row) => row.isExactCandidate);
  const negatives = recommendations.filter((row) => row.isNegativeCandidate);
  const raises = recommendations.filter((row) => row.action.code === "raise");
  const lowers = recommendations.filter((row) => row.action.code === "lower");
  const bidIdentified = recommendations.some((row) => row.action.code !== "target_needed" && row.action.code !== "budget_needed");
  const needsInputs = recommendations.some((row) => row.action.code === "target_needed" || row.action.code === "budget_needed");
  const actionRows = recommendations.map((row) => ({
    term: row.term,
    country: row.country || null,
    campaign: row.campaign || null,
    matchType: row.matchType,
    action: row.action.code,
    recommendedCpt: safeNumber(row.recommendedCpt),
    actualCpt: safeNumber(row.cpt),
    actualCpa: safeNumber(row.cpa),
    pace: safeNumber(row.pace),
    isExactCandidate: row.isExactCandidate === true,
    isNegativeCandidate: row.isNegativeCandidate === true,
  }));
  return createAnalysisResult({
    toolId: "5-26",
    status: ANALYSIS_RESULT_STATUS.SUCCESS,
    inputSignature,
    mappingSignature,
    verdict: {
      evidenceState: "descriptive",
      headline: tr(locale, `Exact 승격 ${exact.length}건 · CPT 증액 ${raises.length}건 · 감액 ${lowers.length}건 후보입니다.`, `${exact.length} Exact, ${raises.length} raise-CPT, and ${lowers.length} lower-CPT candidates are ready.`),
      stats: [
        { id: "exact-candidates", label: tr(locale, "Exact 승격", "Exact candidates"), value: exact.length },
        { id: "raise-cpt", label: tr(locale, "CPT 증액", "Raise CPT"), value: raises.length },
        { id: "lower-cpt", label: tr(locale, "CPT 감액", "Lower CPT"), value: lowers.length },
        { id: "negative-candidates", label: tr(locale, "제외 검토", "Negative candidates"), value: negatives.length },
      ],
      action: bidIdentified
        ? tr(locale, "후보를 Apple Ads 콘솔에서 하나씩 검토한 뒤 제한적으로 적용합니다.", "Review candidates one by one in Apple Ads, then apply a limited change.")
        : tr(locale, "캠페인 예산과 목표 CPA 또는 CPT를 입력한 뒤 입찰 조치를 다시 계산합니다.", "Enter campaign budget and target CPA or CPT, then recalculate bid actions."),
      caveats: [
        tr(locale, "추천은 보고서의 관측 성과와 입력 목표를 바탕으로 한 운영 후보이며 자동 입찰 변경이 아닙니다.", "Recommendations are operational candidates based on observed report performance and entered targets; they do not change live bids."),
        ...(needsInputs ? [tr(locale, "일부 행은 예산 또는 목표가 없어 CPT 증감 방향을 식별하지 않았습니다.", "Some rows lack a budget or target, so no CPT direction was identified.")] : []),
      ],
    },
    visualizations: [{
      id: "asa-keyword-actions",
      kind: "table",
      question: tr(locale, "어떤 검색어를 Exact·CPT·제외 후보로 검토할 것인가?", "Which search terms should be reviewed for Exact, CPT, or negative actions?"),
      table: { columns: ["term", "country", "campaign", "matchType", "action", "recommendedCpt", "actualCpt", "actualCpa", "pace", "isExactCandidate", "isNegativeCandidate"], rows: actionRows },
    }],
    manifest: {
      engine: "buildAsaKeywordRecommendations",
      status: "COMPLETE",
      candidateCount: actionRows.length,
      exactCandidateCount: exact.length,
      negativeCandidateCount: negatives.length,
      raiseCptCount: raises.length,
      lowerCptCount: lowers.length,
      bidIdentified,
      evidenceState: "descriptive",
    },
  });
}

export const OPTIMIZATION_ANALYSIS_ADAPTERS = Object.freeze({
  "5-25": Object.freeze({ toolId: "5-25", run: vifAdapter }),
  "5-26": Object.freeze({ toolId: "5-26", run: asaAdapter }),
});

export function optimizationAdapterFor(toolId) {
  return OPTIMIZATION_ANALYSIS_ADAPTERS[toolId] || null;
}

export function runOptimizationAnalysis({ toolId, ...input } = {}) {
  const adapter = optimizationAdapterFor(toolId);
  if (!adapter) throw new Error(`No optimization adapter registered for ${toolId}`);
  return adapter.run(input);
}

export { OPTIMIZATION_TOOL_IDS };
