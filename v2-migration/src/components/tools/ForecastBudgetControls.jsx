"use client";
import { CommaNumberInput } from "./marketingResponseModel";

// 표시 통화를 받지 않는다. 입력 숫자는 그대로 원본 통화의 모델 제약으로 전달한다.
export default function ForecastBudgetControls({ currency, locale = "ko", total, minimum, maximum, onTotal, onMinimum, onMaximum }) {
  const en = locale === "en";
  return <div data-currency-scope="declare">
    <div className="forecast-budget-controls">
      <label>{en ? "Total weekly budget" : "총 주간 예산"} ({currency})<CommaNumberInput allowDecimals value={total ?? ""} onCommit={onTotal} /></label>
      <label>{en ? "Channel min" : "채널 최소"} ({currency})<CommaNumberInput allowDecimals value={minimum} onCommit={value => onMinimum(value ?? 0)} /></label>
      <label>{en ? "Channel max" : "채널 최대"} ({currency})<CommaNumberInput allowDecimals value={maximum ?? ""} onCommit={onMaximum} /></label>
    </div>
    <p className="wr-note">{en
      ? `Enter budgets in the source CSV currency (${currency}). Changing display currency does not change model budgets.`
      : `예산은 원본 CSV 통화(${currency})로 입력합니다. 표시 통화를 바꿔도 모델에 넣는 예산은 달라지지 않습니다.`}</p>
  </div>;
}
