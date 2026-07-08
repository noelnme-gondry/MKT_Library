"use client";
import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store/useDataStore";
import { resolveDashCopy } from "@/utils/contentDomain";
import CsvUploader from "@/components/CsvUploader";
import DashboardFilterBar from "@/components/dashboard/DashboardFilterBar";
import DashboardTabs from "@/components/dashboard/DashboardTabs";
import VizTab from "@/components/dashboard/VizTab";
import ScorecardTab from "@/components/dashboard/ScorecardTab";
import PacingTab from "@/components/dashboard/PacingTab";
import MonEventMarkerUI from "@/components/tools/MonEventMarkerUI";
import AnomalyTab from "@/components/dashboard/AnomalyTab";
import LtvTab from "@/components/dashboard/LtvTab";
import CohortTab from "@/components/dashboard/CohortTab";
import FunnelTab from "@/components/dashboard/FunnelTab";
import SegmentTab from "@/components/dashboard/SegmentTab";
import { FileText, ChevronRight } from "lucide-react";

const TOC_MAP = {
  viz: [
    { id: "s-cohort", title: "코호트" },
    { id: "s-kpi", title: "KPI 요약" },
    { id: "s-charts", title: "차트" },
  ],
  scorecard: [{ id: "s-score", title: "스코어카드" }],
  pacing: [{ id: "s-pace", title: "페이싱" }],
  anomaly: [{ id: "s-anom", title: "이상 감지" }],
  ltv: [
    { id: "s-ctl", title: "분석 단위" },
    { id: "s-table", title: "LTV:CAC 표" },
    { id: "s-mat", title: "ROAS 성숙도" },
  ],
  cohort: [
    { id: "s-retention", title: "리텐션 곡선" },
    { id: "s-ret-segment", title: "세그먼트별" },
    { id: "s-ret-predict", title: "예측" },
  ],
  funnel: [
    { id: "s-funnel-wow", title: "주간 변화" },
    { id: "s-funnel-ctl", title: "단계 선택" },
    { id: "s-funnel-trend", title: "시계열 급락" },
    { id: "s-funnel-seg", title: "세그먼트 랭킹" },
    { id: "s-funnel", title: "전체 퍼널 표" },
  ],
  segment: [{ id: "s-matrix", title: "세그먼트" }],
};

// 콘텐츠 대시보드(9-7)는 3탭만 노출 — 결제·예산·매출 전제 탭(pacing·ltv·cohort·
// funnel·segment)은 콘텐츠 데이터로 의미가 없어 제외(§정직성).
const CONTENT_TABS = ["viz", "scorecard", "anomaly"];
const CONTENT_TOC_MAP = {
  viz: [
    { id: "s-kpi", title: "KPI 요약" },
    { id: "s-charts", title: "차트" },
  ],
  scorecard: [{ id: "s-score", title: "스코어카드" }],
  anomaly: [{ id: "s-anom", title: "이상 감지" }],
};

export default function Dashboard({ domain = "performance" } = {}) {
  const C = resolveDashCopy(domain);
  const isContent = domain === "content";
  // 콘텐츠판은 9-7 CSV 슬라이스·게이트를, 기본판은 5-2를 사용.
  const toolId = isContent ? "9-7" : "5-2";
  const csvData = useAppStore((state) => state.csvData);
  const dashboardTab = useAppStore((state) => state.dashboardTab);
  const setDashboardTab = useAppStore((state) => state.setDashboardTab);
  // #4 분석 게이트: 업로드·자동매핑만으로는 바로 분석하지 않는다. 사용자가
  // CsvUploader의 "분석하기"를 눌러 매핑을 확정해야(그룹 sig 저장) 결과가 열림.
  // 매핑을 바꾸면 sig가 달라져 다시 false → 결과 자동 숨김(faithful isToolAnalyzed).
  const analyzed = useAppStore((state) => state.isGroupAnalyzed(toolId));

  // dashboardTab은 5-2와 공유하는 전역 상태 → 콘텐츠 진입 시 허용셋 밖(ltv 등)이면
  // viz로 되돌린다(reset-on-change). 첫 페인트는 activeTab(파생값)으로 정확히 렌더.
  const activeTab = isContent && !CONTENT_TABS.includes(dashboardTab) ? "viz" : dashboardTab;
  useEffect(() => {
    if (isContent && !CONTENT_TABS.includes(dashboardTab)) setDashboardTab("viz");
  }, [isContent, dashboardTab, setDashboardTab]);
  // 분석 완료 후 접힌 "데이터 매핑 설정" details — native <details>는 열림/닫힘 상태를
  // React가 자동으로 모르므로 controlled로 추적(라벨 펼치기/접기 동기화, §CLAUDE 12.20류 렌더층 패턴).
  const [mappingOpen, setMappingOpen] = useState(false);

  const hasData = csvData && csvData.raw.length > 0;
  // 결과(탭·차트·TOC)는 데이터가 있고 + 분석이 확정된 뒤에만 렌더.
  const showResults = hasData && analyzed;
  const tocMap = isContent ? CONTENT_TOC_MAP : TOC_MAP;
  const currentToc = showResults ? tocMap[activeTab] || [] : [];

  return (
    <div className="section active" style={{ display: "flex", width: "100%", height: "100%" }}>
      
      {/* Main Content Area */}
      <div style={{ flex: 1, minWidth: 0, paddingRight: showResults ? "220px" : "0" }}>
        {/* 압축 sticky 타이틀 바 — 다른 5-x 도구(ToolPageShell)와 동일한
            .page-sticky-bar/row1/title 클래스로 통일(§디자인시스템). 필터도
            같은 박스 안에 이어 붙여 한 도구 셸처럼 보이게(제목만 박스 밖에
            동떨어져 보이던 문제 해결). 결과가 열린 뒤엔 스크롤해도 상단(topbar
            아래 top:48px)에 고정. */}
        <div className="page-sticky-bar">
          <div className="page-sticky-row1">
            <span className="page-sticky-title">{C.pageTitle}</span>
            {hasData && (
              <>
                <span className="chip" style={{ display: "inline-flex", alignItems: "center" }}>
                  <span className="dot"></span>
                  {csvData.fileName || "Data.csv"}
                </span>
                <span className="chip ok" style={{ display: "inline-flex", alignItems: "center" }}>
                  <span className="dot"></span>
                  {csvData.raw.length.toLocaleString()}행
                </span>
              </>
            )}
          </div>
          {showResults && <DashboardFilterBar />}
        </div>

        {!hasData && (
          <p style={{ color: "var(--text-secondary)", margin: "1rem 0 2rem", fontSize: "13px" }}>
            {C.noDataIntro}
          </p>
        )}

        {/* Csv Uploader — 상태별 3분기:
            ① 데이터 없음: 업로드 안내 + 드롭존(펼침).
            ② 데이터 有 · 미분석(#4): 매핑을 바로 볼 수 있게 펼친 상태로 노출 →
               사용자가 "데이터 분석하기"를 눌러 확정(CsvUploader가 게이트 세팅).
            ③ 데이터 有 · 분석 완료: 매핑을 접어(details) 결과에 집중. */}
        {!hasData ? (
          <div className="block">
            <h2 className="section-title">데이터 업로드</h2>
            <p className="card-desc" style={{ marginBottom: "1rem" }}>{C.uploadDesc}</p>
            <CsvUploader toolId={toolId} />
          </div>
        ) : !analyzed ? (
          <div className="block" style={{ padding: "12px", margin: "0 0 16px", borderRadius: "var(--radius-lg)", background: "rgba(255,255,255,0.01)" }}>
            <div style={{ marginBottom: "8px", fontSize: "11px", color: "var(--text-muted)" }}>
              🔒 업로드 데이터는 브라우저 메모리에서만 안전하게 유지됩니다.
            </div>
            <CsvUploader toolId={toolId} />
          </div>
        ) : (
          <details
            className="block"
            open={mappingOpen}
            onToggle={(e) => setMappingOpen(e.target.open)}
            style={{ padding: "8px 12px", margin: "0 0 16px", borderRadius: "var(--radius-lg)", background: "rgba(255,255,255,0.01)" }}
          >
            <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: "700", color: "var(--primary, #adc6ff)", outline: "none", display: "flex", alignItems: "center" }}>
              <span style={{ marginRight: "6px" }}>⚙</span> 데이터 매핑 설정 {mappingOpen ? "(접기)" : "(펼치기)"}
            </summary>
            <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed var(--border-subtle)" }}>
              <div style={{ marginBottom: "6px", fontSize: "11px", color: "var(--text-muted)" }}>
                🔒 업로드 데이터는 브라우저 메모리에서만 안전하게 유지됩니다.
              </div>
              <CsvUploader toolId={toolId} />
            </div>
          </details>
        )}

        {/* #4 분석 대기: 데이터는 있으나 아직 "분석하기" 미확정 → 탭/결과 대신
            안내 플레이스홀더. 위 CsvUploader가 "데이터 분석하기"를 제공
            (게이트는 CsvUploader가 setGroupAnalyzed로 확정). */}
        {hasData && !analyzed && (
          <div className="card" style={{ marginTop: "1rem", textAlign: "center", padding: "2.5rem 1rem" }}>
            <div style={{ fontSize: "28px", marginBottom: "0.75rem" }}>🗂</div>
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "15px", fontWeight: "700" }}>분석 대기 중</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0, lineHeight: 1.6 }}>
              위에서 컬럼 매핑이 올바른지 확인한 뒤
              <br />
              <strong>&quot;데이터 분석하기&quot;</strong>를 눌러 대시보드를 생성하세요.
              <br />
              <span style={{ fontSize: "11.5px" }}>매핑을 바꾸면 결과가 숨겨지고 다시 분석해야 합니다.</span>
            </p>
          </div>
        )}

        {/* Tabs & Content */}
        {showResults && (
          <div className="dashboard-content">
            <MonEventMarkerUI />
            <DashboardTabs domain={domain} />

            <div className="tab-content" style={{ marginTop: "1rem" }}>
              {activeTab === "viz" && <VizTab domain={domain} />}
              {activeTab === "scorecard" && <ScorecardTab domain={domain} />}
              {activeTab === "anomaly" && <AnomalyTab domain={domain} />}
              {/* 콘텐츠 대시보드는 아래 마케팅 전용 탭(결제·예산·매출 전제)을 노출하지 않음. */}
              {!isContent && activeTab === "pacing" && <PacingTab />}
              {!isContent && activeTab === "ltv" && <LtvTab />}
              {!isContent && activeTab === "cohort" && <CohortTab />}
              {!isContent && activeTab === "funnel" && <FunnelTab />}
              {!isContent && activeTab === "segment" && <SegmentTab />}
              {!["viz", "scorecard", "pacing", "anomaly", "ltv", "cohort", "funnel", "segment"].includes(activeTab) && (
                <div className="card">
                  <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "2rem 0" }}>
                    [{activeTab}] 탭은 현재 마이그레이션 중입니다...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating Table of Contents (Right Side) — 결과가 열린 뒤에만(섹션 앵커 존재). */}
      {showResults && (
        <aside style={{
          position: "fixed",
          top: "100px",
          right: "24px",
          width: "180px",
          borderLeft: "1px solid var(--border-subtle)",
          paddingLeft: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
            목차
          </div>
          {currentToc.map((item) => (
            <a 
              key={item.id} 
              href={`#${item.id}`}
              style={{ fontSize: "12px", color: "var(--text-2)", textDecoration: "none", transition: "color 0.2s" }}
              onMouseOver={(e) => e.target.style.color = "var(--text-1)"}
              onMouseOut={(e) => e.target.style.color = "var(--text-2)"}
            >
              {item.title}
            </a>
          ))}
        </aside>
      )}
    </div>
  );
}
