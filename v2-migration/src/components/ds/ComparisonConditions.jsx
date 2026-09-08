"use client";
import { useId, useState } from "react";
import { EMPTY_COMPARISON_CONDITIONS, comparisonConditionsReady } from "@/lib/analysis-results/comparisonConditions";

export function useComparisonConditions(scope) {
  const [record, setRecord] = useState({ scope, values: EMPTY_COMPARISON_CONDITIONS });
  const values = record.scope === scope ? record.values : EMPTY_COMPARISON_CONDITIONS;
  return { values, ready: comparisonConditionsReady(values), set: (key, value) => setRecord((current) => ({ scope, values: { ...(current.scope === scope ? current.values : EMPTY_COMPARISON_CONDITIONS), [key]: value } })) };
}

export function comparisonConditionsNote(ready, locale) {
  return ready
    ? (locale === "en" ? "Comparison conditions were declared. Co-movement still does not identify an advertising effect." : "비교 조건을 선언했습니다. 동행 변화만으로 광고 효과가 식별되지는 않습니다.")
    : (locale === "en" ? "Comparison conditions are unknown or changed. Treat patterns as descriptive and withhold operating actions until tracking, seasonality and delivery changes are checked." : "비교 조건이 미확인이거나 달라졌습니다. 추적 정책·계절성·집행 변경을 확인할 때까지 패턴은 현상 설명으로만 읽고 운영 행동은 보류하세요.");
}

export default function ComparisonConditions({ conditions, locale = "ko" }) {
  const id = useId();
  const en = locale === "en";
  const fields = [
    ["tracking", "추적·어트리뷰션 정책", "Tracking / attribution policy", [["consistent", "같은 집계·분류 기준 확인", "Consistent counting and classification confirmed"], ["changed", "정책·분류 변경 있음", "Policy or classification changed"]]],
    ["seasonality", "계절성·프로모션 조건", "Seasonality / promotion conditions", [["reviewed", "검토했으며 알려진 동시 변경 없음", "Reviewed; no known concurrent change"], ["changed", "계절·프로모션 변화 있음", "Seasonal or promotional change present"]]],
    ["delivery", "광고 집행 연속성", "Ad delivery continuity", [["continuous", "중단·큰 예산 전환 없음 확인", "No interruption or major budget switch confirmed"], ["interrupted", "중단·큰 예산 전환 있음", "Interruption or major budget switch present"]]],
  ];
  return <section className="analysis-design-check" aria-label={en ? "Observational comparison conditions" : "관찰 비교 조건"}>
    <h3>{en ? "Check what changed around the data" : "데이터와 함께 바뀐 조건 확인"}</h3>
    <p>{en ? "CSV totals cannot distinguish tracking changes from real demand or advertising changes. These declarations are not independently verified and reset when the input or analysis scope changes." : "CSV 합계만으로 추적 변경과 실제 수요·광고 변화를 구분할 수 없습니다. 아래는 독립 검증된 사실이 아닌 입력자의 선언이며 입력·분석 범위를 바꾸면 초기화됩니다."}</p>
    {fields.map(([key, ko, english, options]) => <label key={key} htmlFor={`${id}-${key}`}>{en ? english : ko}
      <select id={`${id}-${key}`} value={conditions.values[key]} onChange={(event) => conditions.set(key, event.target.value)}>
        <option value="">{en ? "Not confirmed" : "미확인"}</option>
        {options.map(([value, koOption, enOption]) => <option key={value} value={value}>{en ? enOption : koOption}</option>)}
      </select>
    </label>)}
    <p role="status">{comparisonConditionsNote(conditions.ready, locale)}</p>
  </section>;
}
