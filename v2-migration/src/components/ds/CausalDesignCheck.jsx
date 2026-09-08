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
    ["unit", en ? "Assignment / observation unit" : "배정·관측 단위", [["person", "사람", "Person"], ["device", "기기", "Device"], ["region", "지역·오디언스 집단", "Region / audience cluster"], ["time", "시간 집계", "Time aggregate"]]],
    ["assignment", en ? "Comparison design" : "비교 설계", [["randomized", "사전 무작위 배정", "Pre-randomized assignment"], ["comparison", "비무작위 비교군", "Non-random comparison"], ["observational", "관찰 전후 비교", "Observational pre/post"]]],
    ["plannedWindow", en ? "Window and stopping rule" : "기간·중단 규칙", [["planned", "결과를 보기 전에 정한 기간", "Fixed before looking at results"], ["changed", "결과를 본 뒤 기간 변경·조기 중단", "Changed / stopped after seeing results"]]],
    ["concurrentChanges", en ? "Tracking, promotion, seasonality or other concurrent changes" : "추적 정책·프로모션·계절성 등 동시 변경", [["none", "검토했으며 알려진 교란 없음", "Reviewed; no known confounding change"], ["present", "동시 변경 있음", "Concurrent changes present"]]],
    ...(design.requiresRandomization ? [["independentCounts", en ? "Independent counts across the full window" : "전체 기간의 독립 단위 집계", [["unique", "중복 없는 배정 단위 수 확인", "Unique assigned units confirmed"], ["repeated", "반복 집계·중복 가능", "Repeated counts / possible duplicates"]]]] : []),
  ];
  return <section className="analysis-design-check" aria-label={en ? "Design conditions" : "설계 조건"}>
    <h3>{en ? "Check the design before acting" : "행동 판단 전 설계 확인"}</h3>
    <p>{en ? "These are your declarations, not checks inferred from CSV totals. Changing the data or selected window resets them. Cluster assignment and repeated counts need uncertainty methods beyond the aggregate binomial model." : "CSV 합계에서 자동 확인한 사실이 아닌 입력자의 선언입니다. 데이터나 선택 기간을 바꾸면 초기화됩니다. 집단 배정·반복 집계에는 집계 이항모형과 다른 불확실성 검증이 필요합니다."}</p>
    {fields.map(([key, label, options]) => <label key={key} htmlFor={`${id}-${key}`}>{label}
      <select id={`${id}-${key}`} value={design.values[key]} onChange={(event) => design.set(key, event.target.value)}>
        <option value="">{en ? "Not confirmed" : "미확인"}</option>
        {options.map(([value, ko, english]) => <option key={value} value={value}>{en ? english : ko}</option>)}
      </select>
    </label>)}
    <p role="status">{design.ready
      ? (en ? "Declared conditions recorded. They do not independently prove causal validity; review the model diagnostics too." : "선언 조건을 기록했습니다. 인과 타당성을 독립적으로 검증한 것은 아니며 모형 진단도 함께 확인하세요.")
      : (en ? "Action withheld: design or comparison conditions are unconfirmed or unsuitable. Numbers remain exploratory comparisons." : "행동 판단 보류: 설계·비교 조건이 미확인이거나 적합하지 않습니다. 수치는 탐색적 비교로만 읽으세요.")}</p>
  </section>;
}
