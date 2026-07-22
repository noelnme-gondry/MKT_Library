"use client";
import React from "react";
import { useAppStore } from "@/store/useDataStore";
import { effectiveDenomBasis } from "@/utils/dashboardAggregator";

// 기준(설치/가입) + 표시 통화(₩/$) 토글 — 원래 DashboardFilterBar(5-2) 전용이었으나
// 전역 denomBasis/displayCurrency는 효율 CSV 공유 도구(5-3/5-21/5-22)에도 적용되는데
// 그 도구들엔 토글 UI 자체가 없어 5-2를 거치지 않으면 바꿀 방법이 없던 문제 수정 —
// 재사용 가능하도록 분리. 통화 토글은 예전에 Header(브레드크럼 옆)로 뺐다가, 실제로는
// "토글 기준" 필터줄(이 컴포넌트)에 붙어있어야 자연스럽다는 피드백으로 여기 복귀 —
// 통화 토글 UI는 이 컴포넌트 하나뿐(도구별 중복 금지, 디자인시스템).
export default function BasisCurrencyToggleBar({ locale = "ko" } = {}) {
  const csvData = useAppStore((state) => state.csvData);
  const denomBasis = useAppStore((state) => state.denomBasis);
  const setDenomBasis = useAppStore((state) => state.setDenomBasis);
  const displayCurrency = useAppStore((state) => state.displayCurrency);
  const setDisplayCurrency = useAppStore((state) => state.setDisplayCurrency);
  const tr = (ko, en) => (locale === "en" ? en : ko);

  if (!csvData || !csvData.raw || csvData.raw.length === 0) return null;

  const mapped = new Set(Object.values(csvData.mapping || {}));
  const hasInstalls = mapped.has("installs");
  const hasActions = mapped.has("actions");

  return (
    <>
        {(hasInstalls || hasActions) && (
          <div className="analysis-control-group">
            <span className="analysis-control-group__label">{tr("성과 기준", "Performance basis")}</span>
            <button
              className={`ab-pill ${effectiveDenomBasis(csvData, denomBasis) !== "actions" ? "active" : ""} ${!hasInstalls ? "disabled" : ""}`}
              disabled={!hasInstalls}
              onClick={() => hasInstalls && setDenomBasis("installs")}
            >
              {tr("설치", "Installs")}{!hasInstalls ? " 🔒" : ""}
            </button>
            <button
              className={`ab-pill ${effectiveDenomBasis(csvData, denomBasis) === "actions" ? "active" : ""} ${!hasActions ? "disabled" : ""}`}
              disabled={!hasActions}
              onClick={() => hasActions && setDenomBasis("actions")}
            >
              {tr("가입", "Actions")}{!hasActions ? " 🔒" : ""}
            </button>
          </div>
        )}
        <div className="analysis-control-group">
          <span className="analysis-control-group__label">{tr("표시 통화", "Display currency")}</span>
          <button
            className={`ab-pill ${displayCurrency === "KRW" ? "active" : ""}`}
            onClick={() => setDisplayCurrency("KRW")}
          >
            {tr("원 ₩", "KRW ₩")}
          </button>
          <button
            className={`ab-pill ${displayCurrency === "USD" ? "active" : ""}`}
            onClick={() => setDisplayCurrency("USD")}
          >
            {tr("달러 $", "USD $")}
          </button>
        </div>
    </>
  );
}
