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
    ["tracking", "기간 중 추적·어트리뷰션 기준이 바뀌었나요?", "Did tracking or attribution rules change in this period?", [["consistent", "아니요, 같은 기준입니다", "No, same rules"], ["changed", "네, 바뀌었습니다", "Yes, they changed"]]],
    ["seasonality", "같은 기간에 시즌·프로모션 변화가 있었나요?", "Was there a season or promotion change in this period?", [["reviewed", "확인했고 없었습니다", "Checked; none"], ["changed", "있었습니다", "Yes"]]],
    ["delivery", "광고를 멈추거나 예산을 크게 옮긴 적이 있나요?", "Did ads pause or budget shift a lot?", [["continuous", "아니요, 계속 집행했습니다", "No, delivery was steady"], ["interrupted", "네, 있었습니다", "Yes"]]],
  ];
  return <section className="analysis-design-check" aria-label={en ? "Observational comparison conditions" : "관찰 비교 조건"}>
    <h3>{en ? "Before you trust this result" : "이 결과를 믿기 전에"}</h3>
    <p>{en ? "CSV totals cannot distinguish tracking changes from real demand or advertising changes. These declarations are not independently verified and reset when the input or analysis scope changes." : "CSV 합계만으로 추적 변경과 실제 수요·광고 변화를 구분할 수 없습니다. 아래는 독립 검증된 사실이 아닌 입력자의 선언이며 입력·분석 범위를 바꾸면 초기화됩니다."}</p>
    {fields.map(([key, ko, english, options]) => <label key={key} htmlFor={`${id}-${key}`}>{en ? english : ko}
      <select id={`${id}-${key}`} value={conditions.values[key]} onChange={(event) => conditions.set(key, event.target.value)}>
        <option value="">{en ? "Not sure yet" : "아직 모름"}</option>
        {options.map(([value, koOption, enOption]) => <option key={value} value={value}>{en ? enOption : koOption}</option>)}
      </select>
    </label>)}
    <p role="status">{comparisonConditionsNote(conditions.ready, locale)}</p>
  </section>;
}
