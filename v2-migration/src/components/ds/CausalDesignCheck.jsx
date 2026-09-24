"use client";
import { useId, useState } from "react";
import { EMPTY_DESIGN, assessCausalDesign } from "@/lib/analysis-results/causalDesignEvidence";

export function useCausalDesign(scopeKey, requiresRandomization = false) {
  const [record, setRecord] = useState({ scopeKey, values: EMPTY_DESIGN });
  const values = record.scopeKey === scopeKey ? record.values : EMPTY_DESIGN;
  return {
    values, ...assessCausalDesign(values, requiresRandomization), requiresRandomization,
    set: (key, value) => setRecord((current) => ({ scopeKey, values: { ...(current.scopeKey === scopeKey ? current.values : EMPTY_DESIGN), [key]: value } })),
  };
}

export default function CausalDesignCheck({ design, locale = "ko" }) {
  const id = useId();
  const en = locale === "en";
  const fields = [
    ["unit", en ? "What did you compare?" : "비교한 대상은 무엇인가요?", [["person", "사람", "People"], ["device", "기기", "Devices"], ["region", "지역·오디언스 묶음", "Regions or audience groups"], ["time", "날짜별 합계", "Daily or weekly totals"]]],
    ["assignment", en ? "How were the two groups split?" : "두 그룹은 어떻게 나눴나요?", [["randomized", "미리 무작위로 나눔", "Randomly, in advance"], ["comparison", "비슷한 그룹을 골라 비교", "Picked a similar group"], ["observational", "같은 대상의 전후 비교", "Before vs after, same audience"]]],
    ["plannedWindow", en ? "Did you fix the dates before seeing results?" : "결과를 보기 전에 기간을 정했나요?", [["planned", "네, 미리 정했습니다", "Yes, fixed in advance"], ["changed", "결과를 보고 바꾸거나 일찍 멈췄습니다", "Changed or stopped after seeing results"]]],
    ["concurrentChanges", en ? "Did a promotion, season or tracking change happen in the same period?" : "같은 기간에 프로모션·시즌·추적 방식이 바뀐 적이 있나요?", [["none", "확인했고 없었습니다", "Checked; none"], ["present", "있었습니다", "Yes"]]],
    ...(design.requiresRandomization ? [["independentCounts", en ? "Is each person counted once over the whole period?" : "기간 전체에서 한 대상을 한 번씩만 셌나요?", [["unique", "네, 중복 없이 셌습니다", "Yes, no duplicates"], ["repeated", "여러 번 셌을 수 있습니다", "They may repeat"]]]] : []),
  ];
  return <section className="analysis-design-check" aria-label={en ? "Design conditions" : "설계 조건"}>
    <h3>{en ? "Before you trust this result" : "이 결과를 믿기 전에"}</h3>
    <p>{en ? "These are your declarations, not checks inferred from CSV totals. Changing the data or selected window resets them. Cluster assignment and repeated counts need uncertainty methods beyond the aggregate binomial model." : "CSV 합계에서 자동 확인한 사실이 아닌 입력자의 선언입니다. 데이터나 선택 기간을 바꾸면 초기화됩니다. 집단 배정·반복 집계에는 집계 이항모형과 다른 불확실성 검증이 필요합니다."}</p>
    {fields.map(([key, label, options]) => <label key={key} htmlFor={`${id}-${key}`}>{label}
      <select id={`${id}-${key}`} value={design.values[key]} onChange={(event) => design.set(key, event.target.value)}>
        <option value="">{en ? "Not sure yet" : "아직 모름"}</option>
        {options.map(([value, ko, english]) => <option key={value} value={value}>{en ? english : ko}</option>)}
      </select>
    </label>)}
    <p role="status">{design.ready
      ? (en ? "Declared conditions recorded. They do not independently prove causal validity; review the model diagnostics too." : "선언 조건을 기록했습니다. 인과 타당성을 독립적으로 검증한 것은 아니며 모형 진단도 함께 확인하세요.")
      : (en ? "Action withheld: design or comparison conditions are unconfirmed or unsuitable. Numbers remain exploratory comparisons." : "행동 판단 보류: 설계·비교 조건이 미확인이거나 적합하지 않습니다. 수치는 탐색적 비교로만 읽으세요.")}</p>
  </section>;
}
