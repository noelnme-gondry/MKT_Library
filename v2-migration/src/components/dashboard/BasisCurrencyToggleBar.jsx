"use client";
import React from "react";
import BlockedOptionsNote from "@/components/ds/BlockedOptionsNote";
import FixedRateNote from "@/components/ds/FixedRateNote";
import { useAppStore } from "@/store/useDataStore";
import { effectiveDenomBasis, hasUsableDenomBasis } from "@/utils/dashboardAggregator";
import { sourceCurrencyOf } from "@/utils/format";

// 기준(설치/가입) + 표시 통화(₩/$) 토글 — 원래 DashboardFilterBar(5-2) 전용이었으나
// 전역 denomBasis/displayCurrency는 효율 CSV 공유 도구(5-3/5-21/5-22)에도 적용되는데
// 그 도구들엔 토글 UI 자체가 없어 5-2를 거치지 않으면 바꿀 방법이 없던 문제 수정 —
// 재사용 가능하도록 분리. 통화 토글은 예전에 Header(브레드크럼 옆)로 뺐다가, 실제로는
// "토글 기준" 필터줄(이 컴포넌트)에 붙어있어야 자연스럽다는 피드백으로 여기 복귀 —
// 통화 토글 UI는 이 컴포넌트 하나뿐(도구별 중복 금지, 디자인시스템).
export default function BasisCurrencyToggleBar({ locale = "ko", currencyMode = "declare" } = {}) {
  const csvData = useAppStore((state) => state.csvData);
  const setCsvData = useAppStore((state) => state.setCsvData);
  const denomBasis = useAppStore((state) => state.denomBasis);
  const setDenomBasis = useAppStore((state) => state.setDenomBasis);
  const displayCurrency = useAppStore((state) => state.displayCurrency);
  const setDisplayCurrency = useAppStore((state) => state.setDisplayCurrency);
  const currentRouteId = useAppStore((state) => state.currentRouteId);
  const isGroupAnalyzed = useAppStore((state) => state.isGroupAnalyzed);
  const setGroupAnalyzed = useAppStore((state) => state.setGroupAnalyzed);
  const tr = (ko, en) => (locale === "en" ? en : ko);

  if (!csvData || !csvData.raw || csvData.raw.length === 0) return null;

  const hasInstalls = hasUsableDenomBasis(csvData, "installs");
  const hasActions = hasUsableDenomBasis(csvData, "actions");
  const sourceCurrency = sourceCurrencyOf(csvData);
  const isConversionMode = currencyMode === "convert";
  const selectedCurrency = isConversionMode ? displayCurrency : sourceCurrency;
  const chooseCurrency = (currency) => {
    if (isConversionMode) {
      setDisplayCurrency(currency);
      return;
    }
    // 효율 패밀리는 전 탭·엔진이 원본 숫자를 그대로 쓴다. 따라서 이 컨트롤은
    // 환산이 아니라 단위 선언이며, 전역 포맷 fallback도 같은 값으로 맞춘다.
    // 선언은 csvData에 쓰이는데 currency가 분석 게이트 시그(computeAnalyzeSig)에
    // 들어 있어, 그대로 두면 단위만 바꿔도 게이트가 닫혀 결과가 통째로 사라진다
    // (사용자에겐 "달러 눌렀더니 데이터가 확 바뀜"으로 보인다). 이 모드에서는
    // 숫자가 한 자리도 바뀌지 않으므로 분석 상태를 새 시그로 다시 찍어 잇는다.
    // 저장된 보고서의 최신성 판정은 여전히 시그를 비교하므로 영향받지 않는다.
    const wasAnalyzed = isGroupAnalyzed(currentRouteId);
    setCsvData({ ...csvData, currency });
    setDisplayCurrency(currency);
    if (wasAnalyzed) setGroupAnalyzed(currentRouteId);
  };

  return (
    <>
        {(hasInstalls || hasActions) && (
          <div className="analysis-control-group">
            <span className="analysis-control-group__label">{tr("성과 기준", "Performance basis")}</span>
            <button
              type="button"
              className={`ab-pill ${effectiveDenomBasis(csvData, denomBasis) !== "actions" ? "active" : ""} ${!hasInstalls ? "disabled" : ""}`}
              disabled={!hasInstalls}
              onClick={() => hasInstalls && setDenomBasis("installs")}
            >
              {tr("설치", "Installs")}
            </button>
            <button
              type="button"
              className={`ab-pill ${effectiveDenomBasis(csvData, denomBasis) === "actions" ? "active" : ""} ${!hasActions ? "disabled" : ""}`}
              disabled={!hasActions}
              onClick={() => hasActions && setDenomBasis("actions")}
            >
              {tr("가입", "Actions")}
            </button>
          </div>
        )}
        <div className="analysis-control-group" {...(!isConversionMode ? { "data-currency-scope": "declare" } : {})}>
          <span className="analysis-control-group__label">{isConversionMode ? tr("표시 통화", "Display currency") : tr("데이터 통화", "Data currency")}</span>
          <button
            type="button"
            className={`ab-pill ${selectedCurrency === "KRW" ? "active" : ""}`}
            onClick={() => chooseCurrency("KRW")}
          >
            {tr("원 ₩", "KRW ₩")}
          </button>
          <button
            type="button"
            className={`ab-pill ${selectedCurrency === "USD" ? "active" : ""}`}
            onClick={() => chooseCurrency("USD")}
          >
            {tr("달러 $", "USD $")}
          </button>
        </div>
        {isConversionMode ? (
          <FixedRateNote sourceCurrency={sourceCurrency} displayCurrency={displayCurrency} locale={locale} />
        ) : (
          <p className="muted" style={{ fontSize: "12px", margin: "6px 0 0" }}>
            {tr("원본 금액의 단위만 지정합니다. 숫자는 환산하지 않습니다.", "Declares the unit of the original amounts. Values are not converted.")}
          </p>
        )}
        <BlockedOptionsNote items={[
          { label: tr("설치", "Installs"), reason: !hasInstalls ? (hasActions ? tr("양수 값이 없어 가입 기준을 자동 적용했습니다", "No positive values; Actions was applied automatically") : tr("사용 가능한 양수 값이 없습니다", "No usable positive values")) : "" },
          { label: tr("가입", "Actions"), reason: !hasActions ? tr("사용 가능한 양수 값이 없습니다", "No usable positive values") : "" },
        ]} />
    </>
  );
}
