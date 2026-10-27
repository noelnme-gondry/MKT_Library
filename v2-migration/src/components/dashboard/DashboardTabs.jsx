"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import ModalDialog from "@/components/ds/ModalDialog";
import { useAppStore } from "@/store/useDataStore";
import { trackProductEvent } from "@/lib/analytics";
import {
  Activity,
  BarChart2,
  CalendarDays,
  ChevronDown,
  Clock,
  Filter,
  Grid,
  LineChart,
  Users,
} from "lucide-react";

// 운영 대시보드의 공통 뷰 전환. 분석 범위 필터와 함께 상단 sticky 바에 두어,
// 어느 결과 탭을 스크롤 중이든 즉시 다른 분석 뷰로 이동할 수 있게 한다.
const MON_TAB_GROUPS = [
  { label: "모니터링", labelEn: "Monitoring", tabs: ["viz", "scorecard", "seasonality", "pacing", "anomaly"] },
  { label: "장기 가치", labelEn: "Long-term Value", tabs: ["ltv", "cohort"] },
  { label: "효율 진단", labelEn: "Efficiency diagnosis", tabs: ["funnel", "segment"] },
];

// desc: 폰의 "보기 고르기" 창에서 이름 옆에 붙는 한 줄 — 그 보기가 무엇을 답하는지(각 탭의 섹션 제목에서 옮김).
const TABS_INFO = {
  viz: { label: "시각화", labelEn: "Visualization", icon: <BarChart2 size={13} />, desc: "핵심 지표와 기간별 추이", descEn: "Key metrics and their trend over time" },
  scorecard: { label: "스코어카드", labelEn: "Scorecard", icon: <Grid size={13} />, desc: "기간별 핵심 지표 표", descEn: "Key-metric table for the period" },
  pacing: { label: "페이싱", labelEn: "Pacing", icon: <Clock size={13} />, desc: "지출 속도와 기간 말 착지 예측", descEn: "Spend pace and end-of-period forecast" },
  anomaly: { label: "이상탐지", labelEn: "Anomaly detection", icon: <Activity size={13} />, desc: "평소와 크게 다른 날과 변동을 만든 곳", descEn: "Days that broke from normal and what drove them" },
  seasonality: { label: "시즈널리티", labelEn: "Seasonality", icon: <CalendarDays size={13} />, desc: "요일·월마다 반복되는 패턴", descEn: "Patterns that repeat by weekday and month" },
  ltv: { label: "LTV & ROAS", labelEn: "LTV & ROAS", icon: <LineChart size={13} />, desc: "LTV:CAC·회수 기간·ROAS 성숙 예측", descEn: "LTV:CAC, payback period and ROAS maturity" },
  cohort: { label: "코호트 분석", labelEn: "Cohort analysis", icon: <Users size={13} />, desc: "설치 후 경과일별 리텐션", descEn: "Retention by days since install" },
  funnel: { label: "퍼널 진단", labelEn: "Funnel diagnosis", icon: <Filter size={13} />, desc: "단계별 전환과 지난주 대비 변화", descEn: "Stage conversion and change vs last week" },
  segment: { label: "세그먼트", labelEn: "Segment", icon: <Grid size={13} />, desc: "세그먼트별 효율 비교", descEn: "Efficiency compared across segments" },
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerTrigger = useRef(null);
  const en = locale === "en";

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

  const activeInfo = TABS_INFO[dashboardTab] || TABS_INFO[availableTabs[0]];
  const activeIndex = Math.max(0, availableTabs.indexOf(dashboardTab));
  return (
    <>
    {/* 폰에서는 탭 세 줄 대신 한 줄 버튼 — 누르면 모든 보기가 묶음·설명과 함께 나온다(product-ssot §1.1c).
        목록을 가로로 밀어 숨기지 않는다: 있는 보기를 한 번에 다 보여 주는 것이 이 창의 일이다. */}
    <div className="dashboard-view-picker">
      <button type="button" className="btn secondary dashboard-view-picker__button" ref={pickerTrigger} aria-haspopup="dialog" onClick={() => setPickerOpen(true)}>
        <span className="dashboard-view-picker__label">{en ? "View" : "보기"}</span>
        <strong>{activeInfo.icon} {en ? activeInfo.labelEn : activeInfo.label}</strong>
        <span className="dashboard-view-picker__count">{en ? `${activeIndex + 1} of ${availableTabs.length}` : `${availableTabs.length}개 중 ${activeIndex + 1}`}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <ModalDialog open={pickerOpen} onClose={() => setPickerOpen(false)} returnFocusRef={pickerTrigger} ariaLabel={en ? "Choose a view" : "보기 고르기"} overlayClassName="tutorial-overlay dashboard-view-sheet-overlay" panelClassName="tool-reference-panel dashboard-view-sheet">
        <header className="tool-reference-panel__head">
          <h2>{en ? "Choose a view" : "보기 고르기"}</h2>
          <button type="button" className="btn ghost" onClick={() => setPickerOpen(false)}>{en ? "Close" : "닫기"}</button>
        </header>
        {groups.map((group) => (
          <section className="dashboard-view-sheet__group" key={group.label} aria-label={en ? group.labelEn : group.label}>
            <h3>{en ? group.labelEn : group.label}</h3>
            <ul>
              {group.tabs.map((tabId) => {
                const info = TABS_INFO[tabId];
                const isActive = dashboardTab === tabId;
                return (
                  <li key={tabId}>
                    <button type="button" aria-current={isActive ? "true" : undefined} onClick={() => { selectTab(tabId); setPickerOpen(false); }}>
                      <span className="dashboard-view-sheet__icon" aria-hidden="true">{info.icon}</span>
                      <strong>{en ? info.labelEn : info.label}{isActive && <em className="dashboard-view-sheet__current">{en ? "Showing" : "지금 보기"}</em>}</strong>
                      <small>{en ? info.descEn : info.desc}</small>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </ModalDialog>
    </div>
    {/* role="tablist"가 role="group"을 거쳐 tab을 소유하면 ARIA 필수 소유 관계가 끊겨
        보조기술이 탭을 탭으로 인식하지 못한다. 그룹마다 tablist를 두고 nav는 평범한
        내비게이션 컨테이너로 되돌린다(감사 P1-15). 로빙 tabindex·화살표 키는 기존 유지. */}
    <nav className="dashboard-tabs" aria-label={locale === "en" ? "Dashboard views" : "대시보드 보기"}>
      {groups.map((group, groupIndex) => (
        // id는 인덱스로 만든다 — 그룹 라벨("장기 가치")에 공백이 있어 id로 못 쓴다.
        <div className="dashboard-tabs__group" key={group.label}>
          <span className="dashboard-tabs__label" id={`dashboard-tabgroup-${groupIndex}`}>{locale === "en" ? group.labelEn : group.label}</span>
          <div className="dashboard-tabs__items" role="tablist" aria-labelledby={`dashboard-tabgroup-${groupIndex}`}>
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
                >
                  {info.icon} {locale === "en" ? info.labelEn : info.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
    </>
  );
}
