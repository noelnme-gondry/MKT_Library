"use client";
import React, { useEffect, useMemo } from "react";
import { useAppStore } from "@/store/useDataStore";
import { trackProductEvent } from "@/lib/analytics";

// 긴 탭 나열 대신, 분석 범위와 분리된 "어떤 화면을 볼지" 단일 선택으로 둔다.
// 옵션 그룹은 탐색 보조일 뿐 필터/분석값에는 영향을 주지 않는다.
const MON_TAB_GROUPS = [
  { label: "모니터링", labelEn: "Monitoring", tabs: ["viz", "scorecard", "seasonality", "pacing", "anomaly"] },
  { label: "장기 가치", labelEn: "Long-term Value", tabs: ["ltv", "cohort"] },
  { label: "효율 진단", labelEn: "Efficiency diagnosis", tabs: ["funnel", "segment"] },
];

const TABS_INFO = {
  viz: { label: "시각화", labelEn: "Visualization" },
  scorecard: { label: "스코어카드", labelEn: "Scorecard" },
  pacing: { label: "페이싱", labelEn: "Pacing" },
  anomaly: { label: "이상탐지", labelEn: "Anomaly detection" },
  seasonality: { label: "시즈널리티", labelEn: "Seasonality" },
  ltv: { label: "LTV & ROAS", labelEn: "LTV & ROAS" },
  cohort: { label: "코호트 분석", labelEn: "Cohort analysis" },
  funnel: { label: "퍼널 진단", labelEn: "Funnel diagnosis" },
  segment: { label: "세그먼트", labelEn: "Segment" },
};

const CONTENT_TAB_GROUPS = [
  { label: "모니터링", labelEn: "Monitoring", tabs: ["viz", "scorecard", "anomaly"] },
];

export default function DashboardTabs({ domain = "performance", locale = "ko" } = {}) {
  const dashboardTab = useAppStore((state) => state.dashboardTab);
  const setDashboardTab = useAppStore((state) => state.setDashboardTab);
  const csvData = useAppStore((state) => state.csvData);
  const hasData = csvData && csvData.raw.length > 0;
  const toolId = domain === "content" ? "9-7" : "5-2";
  const groups = domain === "content" ? CONTENT_TAB_GROUPS : MON_TAB_GROUPS;
  const availableTabs = useMemo(() => groups.flatMap((group) => group.tabs), [groups]);

  // 콘텐츠 대시보드에는 마케팅 전용 뷰가 없다. 이전 화면의 선택값이 남아도
  // 첫 유효 화면으로 안전하게 복귀한다.
  useEffect(() => {
    if (hasData && !availableTabs.includes(dashboardTab)) setDashboardTab(availableTabs[0]);
  }, [hasData, dashboardTab, setDashboardTab, availableTabs]);

  if (!hasData) return null;

  const selectTab = (tabId) => {
    setDashboardTab(tabId);
    trackProductEvent("dashboard_tab_view", { tool_id: toolId, tab_name: tabId });
  };

  return (
    <div className="dashboard-view-filter">
      <label htmlFor="dashboard-view-select">{locale === "en" ? "Dashboard view" : "대시보드 보기"}</label>
      <select id="dashboard-view-select" value={dashboardTab} onChange={(event) => selectTab(event.target.value)}>
        {groups.map((group) => (
          <optgroup key={group.label} label={locale === "en" ? group.labelEn : group.label}>
            {group.tabs.map((tabId) => {
              const info = TABS_INFO[tabId];
              return <option key={tabId} value={tabId}>{locale === "en" ? info.labelEn : info.label}</option>;
            })}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
