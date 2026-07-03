"use client";
import React from "react";
import { useAppStore } from "@/store/useDataStore";
import { effectiveDenomBasis } from "@/utils/dashboardAggregator";

// 기준(설치/가입) 토글 — 원래 DashboardFilterBar(5-2) 전용이었으나 전역 denomBasis는
// 효율 CSV 공유 도구(5-3/5-21/5-22)에도 적용되는데 그 도구들엔 토글 UI 자체가 없어
// 5-2를 거치지 않으면 가입 기준으로 바꿀 방법이 없던 문제 수정 — 재사용 가능하도록 분리.
// 통화(₩/$) 토글은 Header(브레드크럼 옆)의 전역 토글 하나로 통일 — 여기서 중복 렌더
// 금지(디자인시스템: 통화 토글은 전 도구에 딱 하나만).
export default function BasisCurrencyToggleBar() {
  const csvData = useAppStore((state) => state.csvData);
  const denomBasis = useAppStore((state) => state.denomBasis);
  const setDenomBasis = useAppStore((state) => state.setDenomBasis);

  if (!csvData || !csvData.raw || csvData.raw.length === 0) return null;

  const mapped = new Set(Object.values(csvData.mapping || {}));
  const hasInstalls = mapped.has("installs");
  const hasActions = mapped.has("actions");
  if (!hasInstalls && !hasActions) return null;
  const effBasis = effectiveDenomBasis(csvData, denomBasis);

  return (
    <div className="mon-filter-bar" style={{ marginTop: "6px" }}>
      <div className="mon-filter-inner">
        <span className="mon-filter-title">토글</span>
        <div className="mon-filter-item" style={{ alignItems: "center", gap: "4px" }}>
          <span className="mon-filter-label" title="CPI/CPA·CVR·ARPU·리텐션·LTV·퍼널의 분모를 설치/가입 중 무엇으로 볼지 — 이 CSV를 공유하는 도구 전체에 적용">기준</span>
          <button
            className={`ab-pill ${effBasis !== "actions" ? "active" : ""} ${!hasInstalls ? "disabled" : ""}`}
            disabled={!hasInstalls}
            onClick={() => hasInstalls && setDenomBasis("installs")}
          >
            설치{!hasInstalls ? " 🔒" : ""}
          </button>
          <button
            className={`ab-pill ${effBasis === "actions" ? "active" : ""} ${!hasActions ? "disabled" : ""}`}
            disabled={!hasActions}
            onClick={() => hasActions && setDenomBasis("actions")}
          >
            가입{!hasActions ? " 🔒" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
