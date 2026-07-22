"use client";
import React, { useEffect, useMemo } from "react";
import { useAppStore } from "@/store/useDataStore";
import { trackProductEvent } from "@/lib/analytics";
import {
  Activity,
  BarChart2,
  CalendarDays,
  Clock,
  Filter,
  Grid,
  LineChart,
  Monitor,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

// 운영 대시보드의 공통 뷰 전환. 분석 범위 필터와 함께 상단 sticky 바에 두어,
// 어느 결과 탭을 스크롤 중이든 즉시 다른 분석 뷰로 이동할 수 있게 한다.
const MON_TAB_GROUPS = [
  { label: "모니터링", labelEn: "Monitoring", icon: <Monitor size={14} />, tabs: ["viz", "scorecard", "seasonality", "pacing", "anomaly"] },
  { label: "장기 가치", labelEn: "Long-term Value", icon: <TrendingUp size={14} />, tabs: ["ltv", "cohort"] },
  { label: "효율 진단", labelEn: "Efficiency diagnosis", icon: <Target size={14} />, tabs: ["funnel", "segment"] },
];

const TABS_INFO = {
  viz: { label: "시각화", labelEn: "Visualization", icon: <BarChart2 size={13} /> },
  scorecard: { label: "스코어카드", labelEn: "Scorecard", icon: <Grid size={13} /> },
  pacing: { label: "페이싱", labelEn: "Pacing", icon: <Clock size={13} /> },
  anomaly: { label: "이상탐지", labelEn: "Anomaly detection", icon: <Activity size={13} /> },
  seasonality: { label: "시즈널리티", labelEn: "Seasonality", icon: <CalendarDays size={13} /> },
  ltv: { label: "LTV & ROAS", labelEn: "LTV & ROAS", icon: <LineChart size={13} /> },
  cohort: { label: "코호트 분석", labelEn: "Cohort analysis", icon: <Users size={13} /> },
  funnel: { label: "퍼널 진단", labelEn: "Funnel diagnosis", icon: <Filter size={13} /> },
  segment: { label: "세그먼트", labelEn: "Segment", icon: <Grid size={13} /> },
};

const CONTENT_TAB_GROUPS = [
  { label: "모니터링", labelEn: "Monitoring", icon: <Monitor size={14} />, tabs: ["viz", "scorecard", "anomaly"] },
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

  const onTabKeyDown = (event, tabId) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = availableTabs.indexOf(tabId);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? availableTabs.length - 1
        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + availableTabs.length) % availableTabs.length;
    const nextTab = availableTabs[nextIndex];
    selectTab(nextTab);
    window.requestAnimationFrame(() => document.querySelector(`[data-dashboard-tab="${nextTab}"]`)?.focus());
  };

  return (
    <nav className="dashboard-tabs" role="tablist" aria-label={locale === "en" ? "Dashboard views" : "대시보드 보기"}>
      {groups.map((group, groupIndex) => (
        <React.Fragment key={group.label}>
          <div className="dashboard-tabs__group">
            <span className="dashboard-tabs__label">
              {group.icon} {locale === "en" ? group.labelEn : group.label}
            </span>
            {group.tabs.map((tabId) => {
              const info = TABS_INFO[tabId];
              const isActive = dashboardTab === tabId;
              return (
                <button
                  key={tabId}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="dashboard-tabpanel"
                  id={`dashboard-tab-${tabId}`}
                  tabIndex={isActive ? 0 : -1}
                  data-dashboard-tab={tabId}
                  className={`ab-pill ${isActive ? "active" : ""}`}
                  onClick={() => selectTab(tabId)}
                  onKeyDown={(event) => onTabKeyDown(event, tabId)}
                  style={{ display: "inline-flex", alignItems: "center", gap: "4px", cursor: "pointer" }}
                >
                  {info.icon} {locale === "en" ? info.labelEn : info.label}
                </button>
              );
            })}
          </div>
          {groupIndex < groups.length - 1 && <span className="dashboard-tabs__divider">/</span>}
        </React.Fragment>
      ))}
    </nav>
  );
}
