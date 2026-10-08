import { ALLOC_MATH } from "@/utils/allocationMath";
import { predictAllocationCost, ALLOCATION_MODEL_TYPES, ALLOCATION_PREDICTION_METRICS } from "@/utils/allocationModels";

const TYPES = Object.fromEntries(Object.values(ALLOCATION_MODEL_TYPES).map((type, index) => [type, index + 1]));
const cell = (formula, value = null) => ({ formula, ...(Number.isFinite(value) ? { value } : {}) });
const parameter = (column, row) => `'COST_MODELS'!${column}${row}`;

function evaluationFormula(input, row) {
  const type = parameter("C", row), low = parameter("G", row), high = parameter("H", row), shape = parameter("I", row), vertex = parameter("J", row);
  return `=IF(AND(ISNUMBER(${input}),${input}>=0,${type}>0),MAX(${low},MIN(${high},IF(${shape}=1,MIN(${input},${vertex}),IF(${shape}=2,MAX(${input},${vertex}),${input})))),"")`;
}
function modelFormula(input, row) {
  const type = parameter("C", row), a = parameter("D", row), b = parameter("E", row), c = parameter("F", row);
  return `=IFERROR(IF(${type}=1,${a}*${input}+${b},IF(${type}=2,${a}*LN(${input})+${b},IF(${type}=3,${a}*${input}*${input}+${b}*${input}+${c},${a}*POWER(${input},${b})))),"")`;
}

/** Fitted parameters are frozen; only Cost inputs drive predictions. No refitting or allocation in Excel. */
export function allocationCostWorkbook({ groupings, metric, periodDays = 1, locale = "ko" }) {
  const en = locale === "en";
  const modelRows = [["group", "metric", "type_code", "a", "b", "c", "observed_min_daily_cost", "observed_max_daily_cost", "shape_code", "vertex", "model", "fit_start", "fit_end"]];
  const helperRows = [["group_metric", "daily_cost", "evaluation_cost", "raw_cpr", "fallback_cpr", "safe_cpr", "predicted_daily_results", "unused", "next_evaluation_cost", "next_raw_cpr", "next_safe_cpr", "next_daily_results", "marginal_cpr", "warning_code"]];
  const inputs = [[en ? "Grouping" : "분배 단위", en ? "Group" : "대상", en ? "Cost input" : "Cost 입력", en ? "Days per input" : "입력 기간(일)", en ? "Predicted objective" : "목표 성과 예측", en ? "Predicted actions" : "행동 예측", en ? "Predicted D7 revenue" : "D7 매출 예측", en ? "Cost per objective" : "목표 성과당 비용", "ROAS", "Marginal CPR (+10%)", en ? "Warning code" : "확인 코드"]];
  for (const grouping of groupings) {
    const names = new Set(Object.values(grouping.models).flatMap(models => [...(models?.keys() || [])]));
    for (const name of names) {
      const inputRow = inputs.length + 1;
      const currentDailyCost = grouping.history[name] && Number.isFinite(grouping.history[name].totalCost) ? grouping.history[name].totalCost : null;
      const helperIndex = {};
      const predictions = {};
      for (const field of ALLOCATION_PREDICTION_METRICS) {
        const wrapper = grouping.models[field]?.get(name);
        const modelRow = modelRows.length + 1, helperRow = helperRows.length + 1;
        const params = wrapper?.model?.params || {};
        const shape = wrapper?.poly2Shape || ALLOC_MATH.detectPoly2Shape(wrapper?.model);
        modelRows.push([`${grouping.label}: ${name}`, field, TYPES[wrapper?.model?.type] || 0, params.a ?? 0, params.b ?? 0, params.c ?? 0,
          wrapper?.xMin ?? 0, wrapper?.xMax ?? 0, shape?.shape === "bell" ? 1 : shape?.shape === "u" ? 2 : 0, shape?.vertex ?? 0,
          wrapper?.model?.type || "", wrapper?.scopeStart || "", wrapper?.scopeEnd || ""]);
        const predicted = predictAllocationCost(wrapper, currentDailyCost);
        const next = currentDailyCost == null ? null : predictAllocationCost(wrapper, currentDailyCost * 1.1);
        predictions[field] = predicted;
        helperIndex[field] = helperRow;
        const base = `B${helperRow}`, raw = `D${helperRow}`, fallback = `E${helperRow}`, safe = `F${helperRow}`;
        const modelType = parameter("C", modelRow);
        helperRows.push([
          `${grouping.label}: ${name} / ${field}`,
          cell(`=IF(AND(ISNUMBER('COST_INPUT'!C${inputRow}),'COST_INPUT'!C${inputRow}>=0),'COST_INPUT'!C${inputRow}/'COST_INPUT'!D${inputRow},"")`, currentDailyCost),
          cell(evaluationFormula(base, modelRow)), cell(modelFormula(`C${helperRow}`, modelRow)), cell(modelFormula(parameter("H", modelRow), modelRow)),
          cell(`=IF(AND(ISNUMBER(${base}),${modelType}>0),IF(${raw}>0,${raw},IF(${fallback}>0,${fallback},"")),"")`, predicted ? ALLOC_MATH.predictSafeCpr(wrapper, currentDailyCost) : null),
          cell(`=IF(AND(ISNUMBER(${base}),ISNUMBER(${safe}),${safe}>0),${base}/${safe},"")`, predicted?.results), "",
          cell(evaluationFormula(`B${helperRow}*1.1`, modelRow)), cell(modelFormula(`I${helperRow}`, modelRow)),
          cell(`=IF(AND(ISNUMBER(${base}),${modelType}>0),IF(J${helperRow}>0,J${helperRow},IF(${fallback}>0,${fallback},"")),"")`),
          cell(`=IF(AND(ISNUMBER(${base}),ISNUMBER(K${helperRow}),K${helperRow}>0),${base}*1.1/K${helperRow},"")`, next?.results),
          cell(`=IF(AND(ISNUMBER(G${helperRow}),ISNUMBER(L${helperRow}),L${helperRow}>G${helperRow}),${base}*0.1/(L${helperRow}-G${helperRow}),"")`, next && predicted && next.results > predicted.results ? currentDailyCost * 0.1 / (next.results - predicted.results) : null),
          cell(`=IF(${modelType}=0,3,IF(ISNUMBER(${base}),IF(OR(${base}<${parameter("G", modelRow)},${base}>${parameter("H", modelRow)}),1,0),2))`, !wrapper?.model ? 3 : predicted ? (predicted.estimated ? 1 : 0) : 2),
        ]);
      }
      const result = field => cell(`=IF(ISNUMBER('COST_CURVES'!G${helperIndex[field]}),'COST_CURVES'!G${helperIndex[field]}*D${inputRow},"")`, predictions[field] ? predictions[field].results * periodDays : null);
      inputs.push([grouping.label, name, currentDailyCost == null ? "" : currentDailyCost * periodDays, periodDays, result(metric), result("actions"), result("revenue_d7"),
        cell(`=IF(AND(ISNUMBER(E${inputRow}),E${inputRow}>0),C${inputRow}/E${inputRow},"")`, predictions[metric]?.cpr),
        cell(`=IF(AND(ISNUMBER(G${inputRow}),ISNUMBER(C${inputRow}),C${inputRow}>0),G${inputRow}/C${inputRow},"")`, predictions.revenue_d7?.roas),
        cell(`='COST_CURVES'!M${helperIndex[metric]}`), cell(`='COST_CURVES'!N${helperIndex[metric]}`),
      ]);
    }
  }
  return [
    { name: "COST_INPUT", title: en ? "Cost scenarios from fitted curves" : "곡선 기준 Cost 시나리오", note: en
      ? "Edit only Cost input (column C). Days per input is fixed at export. Each grouping is an independent view; do not sum the views. Codes: 0 observed range, 1 boundary-efficiency extension outside range, 2 invalid Cost, 3 unavailable model. This does not refit curves or reallocate budget."
      : "C열 Cost 입력만 수정하세요. 입력 기간은 내보낼 때 고정됩니다. 분배 단위별 보기는 독립적이므로 서로 합산하지 마세요. 코드 0=관측 범위, 1=범위 밖 경계 효율 연장, 2=잘못된 Cost, 3=모델 없음. 곡선 재적합·자동 재배분은 수행하지 않습니다.", rows: inputs },
    { name: "COST_MODELS", title: en ? "Frozen fitted parameters" : "현재 곡선의 적합 계수", note: en ? "Daily-average spend domain. Type codes: 1 Linear, 2 Log, 3 Poly2, 4 Power. Shape: 1 inverted U, 2 U. Missing models stay unavailable." : "일평균 비용 기준입니다. 모형 코드: 1 Linear, 2 Log, 3 Poly2, 4 Power. 형태: 1 ∩, 2 U. 모델이 없는 항목은 예측하지 않습니다.", rows: modelRows },
    { name: "COST_CURVES", title: en ? "Formula prediction chain" : "예측 계산 연결", rows: helperRows },
  ];
}
