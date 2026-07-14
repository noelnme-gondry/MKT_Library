"use client";
import React from "react";
import { useAppStore } from "@/store/useDataStore";
import { 
  Monitor, 
  TrendingUp, 
  BarChart2, 
  Activity,
  LineChart,
  Users,
  Filter,
  Grid,
  Clock,
  Target
} from "lucide-react";

const MON_TAB_GROUPS = [
  { label: "모니터링", labelEn: "Monitoring", icon: <Monitor size={14} />, tabs: ["viz", "scorecard", "pacing", "anomaly"] },
  { label: "장기 가치", labelEn: "Long-term Value", icon: <TrendingUp size={14} />, tabs: ["ltv", "cohort"] },
  { label: "효율 진단", labelEn: "Efficiency Diagnosis", icon: <Target size={14} />, tabs: ["funnel", "segment"] },
];

const TABS_INFO = {
  viz: { label: "시각화", labelEn: "Visualization", icon: <BarChart2 size={13} /> },
  scorecard: { label: "스코어카드", labelEn: "Scorecard", icon: <Grid size={13} /> },
  pacing: { label: "페이싱", labelEn: "Pacing", icon: <Clock size={13} /> },
  anomaly: { label: "이상탐지", labelEn: "Anomaly Detection", icon: <Activity size={13} /> },
  ltv: { label: "LTV & ROAS", labelEn: "LTV & ROAS", icon: <LineChart size={13} /> },
  cohort: { label: "코호트 분석", labelEn: "Cohort Analysis", icon: <Users size={13} /> },
  funnel: { label: "퍼널 진단", labelEn: "Funnel Diagnosis", icon: <Filter size={13} /> },
  segment: { label: "세그먼트", labelEn: "Segment", icon: <Grid size={13} /> },
};

// 콘텐츠 대시보드(9-7)는 viz·scorecard·anomaly 3탭만(단일 그룹). 결제·예산·매출
// 전제 탭은 제외 — 마케팅 전용 그룹(장기 가치·효율 진단)을 통째로 뺀다.
const CONTENT_TAB_GROUPS = [
  { label: "모니터링", labelEn: "Monitoring", icon: <Monitor size={14} />, tabs: ["viz", "scorecard", "anomaly"] },
];

export default function DashboardTabs({ domain = "performance", locale = "ko" } = {}) {
  const dashboardTab = useAppStore((state) => state.dashboardTab);
  const setDashboardTab = useAppStore((state) => state.setDashboardTab);
  const csvData = useAppStore((state) => state.csvData);

  const hasData = csvData && csvData.raw.length > 0;
  if (!hasData) return null;

  const groups = domain === "content" ? CONTENT_TAB_GROUPS : MON_TAB_GROUPS;

  return (
    <div className="mon-sticky-bar" style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", margin: "2px 0 16px 0" }}>
      {groups.map((group, gIdx) => (
        <React.Fragment key={group.label}>
          <div style={{ display: "inline-flex", alignItems: "center", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "3px 6px", gap: "2px" }}>
            <span style={{ fontSize: "10.5px", color: "var(--text-muted)", fontWeight: "700", marginRight: "6px", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "4px" }}>
              {group.icon} {locale === "en" ? group.labelEn : group.label}
            </span>
            {group.tabs.map((tabId) => {
              const info = TABS_INFO[tabId];
              const isActive = dashboardTab === tabId;
              return (
                <button
                  key={tabId}
                  className={`ab-pill ${isActive ? "active" : ""}`}
                  onClick={() => setDashboardTab(tabId)}
                  style={{ display: "inline-flex", alignItems: "center", gap: "4px", margin: "2px", cursor: "pointer" }}
                >
                  {info.icon} {locale === "en" ? info.labelEn : info.label}
                </button>
              );
            })}
          </div>
          {gIdx < groups.length - 1 && (
            <span style={{ color: "var(--border-stronger)", alignSelf: "center", fontSize: "16px", margin: "0 4px" }}>|</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
