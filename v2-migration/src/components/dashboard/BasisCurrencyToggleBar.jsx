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
export default function BasisCurrencyToggleBar() {
  const csvData = useAppStore((state) => state.csvData);
  const denomBasis = useAppStore((state) => state.denomBasis);
  const setDenomBasis = useAppStore((state) => state.setDenomBasis);
  const displayCurrency = useAppStore((state) => state.displayCurrency);
  const setDisplayCurrency = useAppStore((state) => state.setDisplayCurrency);

  if (!csvData || !csvData.raw || csvData.raw.length === 0) return null;

  const mapped = new Set(Object.values(csvData.mapping || {}));
  const hasInstalls = mapped.has("installs");
  const hasActions = mapped.has("actions");

  return (
    <div className="mon-filter-bar" style={{ marginTop: "6px" }}>
      <div className="mon-filter-inner">
        <span className="mon-filter-title">토글</span>
        {(hasInstalls || hasActions) && (
          <div className="mon-filter-item" style={{ alignItems: "center", gap: "4px" }}>
            <span className="mon-filter-label" title="CPI/CPA·CVR·ARPU·리텐션·LTV·퍼널의 분모를 설치/가입 중 무엇으로 볼지 — 이 CSV를 공유하는 도구 전체에 적용">기준</span>
            <button
              className={`ab-pill ${effectiveDenomBasis(csvData, denomBasis) !== "actions" ? "active" : ""} ${!hasInstalls ? "disabled" : ""}`}
              disabled={!hasInstalls}
              onClick={() => hasInstalls && setDenomBasis("installs")}
            >
              설치{!hasInstalls ? " 🔒" : ""}
            </button>
            <button
              className={`ab-pill ${effectiveDenomBasis(csvData, denomBasis) === "actions" ? "active" : ""} ${!hasActions ? "disabled" : ""}`}
              disabled={!hasActions}
              onClick={() => hasActions && setDenomBasis("actions")}
            >
              가입{!hasActions ? " 🔒" : ""}
            </button>
          </div>
        )}
        <div className="mon-filter-item" style={{ alignItems: "center", gap: "4px" }}>
          <span className="mon-filter-label" title="표시 통화 단위만 전환(값 변환 아님 — CSV 통화 그대로). 모든 탭·차트·표에 적용.">통화</span>
          <button
            className={`ab-pill ${displayCurrency === "KRW" ? "active" : ""}`}
            onClick={() => setDisplayCurrency("KRW")}
          >
            원 ₩
          </button>
          <button
            className={`ab-pill ${displayCurrency === "USD" ? "active" : ""}`}
            onClick={() => setDisplayCurrency("USD")}
          >
            달러 $
          </button>
        </div>
      </div>
    </div>
  );
}
