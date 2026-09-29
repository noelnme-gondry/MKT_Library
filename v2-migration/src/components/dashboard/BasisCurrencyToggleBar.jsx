"use client";
import React, { useId } from "react";
import BlockedOptionsNote from "@/components/ds/BlockedOptionsNote";
import FixedRateNote from "@/components/ds/FixedRateNote";
import HelpTip from "@/components/ds/HelpTip";
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
  const idBase = useId();

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

  const basis = effectiveDenomBasis(csvData, denomBasis);
  // 두 칸이 모두 버튼으로 보이는 한 덩어리 토글. 예전에는 선택된 쪽만 상자라 나머지가 라벨처럼 읽혔다(2026-09-29).
  // 렌더 중에 컴포넌트를 만들면 매번 다시 마운트되므로 JSX를 돌려주는 함수로 둔다.
  const option = ({ key, pressed, disabled = false, onClick, children }) => (
    <button
      key={key}
      type="button"
      className={`segmented__option ${pressed ? "active" : ""} ${disabled ? "disabled" : ""}`}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
  const currencyLabel = isConversionMode ? tr("표시 통화", "Display currency") : tr("금액 단위", "Amount unit");

  return (
    <>
        {(hasInstalls || hasActions) && (
          <div className="analysis-control-group">
            <span className="analysis-control-group__label" id={`${idBase}-basis`}>{tr("성과 기준", "Performance basis")}</span>
            <div className="segmented" role="group" aria-labelledby={`${idBase}-basis`}>
              {option({ key: "설치", pressed: basis !== "actions", disabled: !hasInstalls, onClick: () => hasInstalls && setDenomBasis("installs"), children: tr("설치", "Installs") })}
              {option({ key: "가입", pressed: basis === "actions", disabled: !hasActions, onClick: () => hasActions && setDenomBasis("actions"), children: tr("가입", "Actions") })}
            </div>
          </div>
        )}
        <div className="analysis-control-group" {...(!isConversionMode ? { "data-currency-scope": "declare" } : {})}>
          <span className="analysis-control-group__label" id={`${idBase}-currency`}>{currencyLabel}</span>
          <div className="segmented" role="group" aria-labelledby={`${idBase}-currency`}>
            {option({ key: "원 ₩", pressed: selectedCurrency === "KRW", onClick: () => chooseCurrency("KRW"), children: tr("원 ₩", "KRW ₩") })}
            {option({ key: "달러 $", pressed: selectedCurrency === "USD", onClick: () => chooseCurrency("USD"), children: tr("달러 $", "USD $") })}
          </div>
          {/* 오해 방지 문장은 컨트롤 줄 가운데가 아니라 ⓘ 안에 둔다 — 줄 한가운데 문장이 끼면 버튼 줄이 문단이 된다. */}
          {!isConversionMode && (
            <HelpTip label={tr("금액 단위 설명", "About the amount unit")}>
              {tr("원본 금액의 단위만 지정합니다. 숫자는 환산하지 않습니다. 같은 CSV를 쓰는 도구에 함께 적용됩니다.", "Declares the unit of the original amounts. Values are not converted. Applies to every tool using the same CSV.")}
            </HelpTip>
          )}
        </div>
        {isConversionMode && <FixedRateNote sourceCurrency={sourceCurrency} displayCurrency={displayCurrency} locale={locale} />}
        <BlockedOptionsNote items={[
          { label: tr("설치", "Installs"), reason: !hasInstalls ? (hasActions ? tr("양수 값이 없어 가입 기준을 자동 적용했습니다", "No positive values; Actions was applied automatically") : tr("사용 가능한 양수 값이 없습니다", "No usable positive values")) : "" },
          { label: tr("가입", "Actions"), reason: !hasActions ? tr("사용 가능한 양수 값이 없습니다", "No usable positive values") : "" },
        ]} />
    </>
  );
}
