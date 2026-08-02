"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
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
import SeasonalityTab from "@/components/dashboard/SeasonalityTab";
import ResultActionCard from "@/components/ds/ResultActionCard";
import ToolTemplateAction from "@/components/ds/ToolTemplateAction";
import AnalysisDetails from "@/components/ds/AnalysisDetails";
import DownloadHub from "@/components/ds/DownloadHub";
import { buildDashboardVerdict } from "@/utils/dashboardVerdict";
import { buildDashboardRecommendations } from "@/utils/dashboardRecommendations";
import DashboardRecommendedViews from "@/components/dashboard/DashboardRecommendedViews";
import { trackProductEvent } from "@/lib/analytics";
import { downloadCsv, downloadText } from "@/utils/download";
import AnalysisHistory from "@/components/data-import/AnalysisHistory";
import AnalysisPathway from "@/components/data-import/AnalysisPathway";
import { buildResultManifest } from "@/lib/analysis-results/resultManifest";
import { runDashboardVerdict, shouldUseDashboardVerdictWorker } from "@/lib/analysis/dashboardVerdictWorkerClient";
import { getIndustryPreset, getIndustryScaleOptions } from "@/lib/industryPresets";

// 콘텐츠 대시보드(9-7)는 3탭만 노출 — 결제·예산·매출 전제 탭(pacing·ltv·cohort·
// funnel·segment)은 콘텐츠 데이터로 의미가 없어 제외(§정직성).
const CONTENT_TABS = ["viz", "scorecard", "anomaly"];

// Dashboard.jsx 전용 EN 카피 — resolveDashCopy(contentDomain.js)는 domain(퍼포먼스/
// 콘텐츠) 리라벨 축이라 건드리지 않고, locale 축은 여기서 로컬 오버라이드한다.
const EN_DASH_COPY = {
  performance: {
    pageTitle: "Operations Dashboard",
    noDataIntro:
      "Upload a daily campaign report CSV to summarize performance and visualize key metrics.",
    uploadDesc: "Upload a marketing performance CSV to generate the operations dashboard.",
  },
  content: {
    pageTitle: "Content Operations Dashboard",
    noDataIntro:
      "Upload a content performance CSV (traffic source, impressions, clicks, visits, etc.) to summarize traffic and visualize key metrics.",
    uploadDesc: "Upload a content performance CSV to generate the content operations dashboard.",
  },
};

export default function Dashboard({ domain = "performance", locale = "ko" } = {}) {
  const C = resolveDashCopy(domain);
  const isContent = domain === "content";
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const enC = EN_DASH_COPY[domain] || EN_DASH_COPY.performance;
  // 콘텐츠판은 9-7 CSV 슬라이스·게이트를, 기본판은 5-2를 사용.
  const toolId = isContent ? "9-7" : "5-2";
  const csvData = useAppStore((state) => state.csvData);
  const dashboardTab = useAppStore((state) => state.dashboardTab);
  const setDashboardTab = useAppStore((state) => state.setDashboardTab);
  const dashboardFilter = useAppStore((state) => state.dashboardFilter);
  const denomBasis = useAppStore((state) => state.denomBasis);
  const displayCurrency = useAppStore((state) => state.displayCurrency);
  const dashWindowDays = useAppStore((state) => state.dashWindowDays);
  const setDashWindowDays = useAppStore((state) => state.setDashWindowDays);
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
  const [supportOpen, setSupportOpen] = useState(false);
  const analysisEventRef = useRef(null);
  const [workerState, setWorkerState] = useState({ key: "", result: null });

  const hasData = csvData && csvData.raw.length > 0;
  // 결과(탭·차트)는 데이터가 있고 + 분석이 확정된 뒤에만 렌더.
  const showResults = hasData && analyzed;

  // 결론 카드 판정(WoW) — 결과가 열린 뒤에만 계산. dashboardAggregator 순수함수
  // 재사용(엔진 불변), 데이터 부족하면 insufficient로 카드 미노출(§8 정직).
  const syncVerdict = useMemo(() => {
    if (!showResults || shouldUseDashboardVerdictWorker(csvData?.raw?.length || 0)) return null;
    return buildDashboardVerdict({ csvData, filterState: dashboardFilter, denomBasis, displayCurrency, windowDays: dashWindowDays, locale });
  }, [showResults, csvData, dashboardFilter, denomBasis, displayCurrency, dashWindowDays, locale]);

  const workerKey = JSON.stringify({
    toolId,
    fileName: csvData?.fileName || "",
    rows: csvData?.raw?.length || 0,
    windowDays: dashWindowDays,
    denomBasis,
    displayCurrency,
    locale,
    dateStart: dashboardFilter.dateStart || null,
    dateEnd: dashboardFilter.dateEnd || null,
    platforms: [...(dashboardFilter.platforms || [])].sort(),
    countries: [...(dashboardFilter.countries || [])].sort(),
    channels: [...(dashboardFilter.channels || [])].sort(),
    sources: [...(dashboardFilter.sources || [])].sort(),
  });

  useEffect(() => {
    const useWorker = showResults && shouldUseDashboardVerdictWorker(csvData?.raw?.length || 0);
    if (!useWorker) return undefined;
    let active = true;
    runDashboardVerdict({ csvData, filterState: dashboardFilter, denomBasis, displayCurrency, windowDays: dashWindowDays, locale })
      .then((result) => {
        if (!active) return;
        setWorkerState({ key: workerKey, result });
      })
      .catch(() => {
        if (!active) return;
        setWorkerState({ key: workerKey, result: { insufficient: true, workerError: true } });
      });
    return () => { active = false; };
  }, [showResults, csvData, dashboardFilter, denomBasis, displayCurrency, dashWindowDays, locale, workerKey]);

  const useDashboardWorker = showResults && shouldUseDashboardVerdictWorker(csvData?.raw?.length || 0);
  const workerPending = useDashboardWorker && workerState.key !== workerKey;
  const verdict = useDashboardWorker
    ? (workerState.key === workerKey ? workerState.result : null)
    : syncVerdict;
  const dashboardRecommendations = useMemo(() => buildDashboardRecommendations({
    verdict,
    mapping: csvData?.mapping,
    domain,
    locale,
  }), [verdict, csvData?.mapping, domain, locale]);
  const isDemo = String(csvData?.fileName || "").startsWith("demo_");
  const industryPreset = !isContent ? getIndustryPreset(csvData?.demoPresetId, locale) : null;
  const industryScale = industryPreset
    ? getIndustryScaleOptions(locale).find((scale) => scale.id === csvData?.demoPresetScale)
    : null;
  const openMapping = () => {
    setMappingOpen(true);
    requestAnimationFrame(() => document.getElementById("dashboard-data-setup")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const openSupportTools = () => {
    setSupportOpen(true);
    requestAnimationFrame(() => document.getElementById("dashboard-support-tools")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const selectRecommendedView = (item) => {
    setDashboardTab(item.tab);
    trackProductEvent("dashboard_recommendation_open", { tool_id: toolId, tab_name: item.tab, rank: item.rank, confidence: item.confidence });
    requestAnimationFrame(() => document.getElementById("dashboard-tabpanel")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  useEffect(() => {
    if (!showResults) return;
    const signature = `${toolId}|${csvData?.fileName || ""}|${csvData?.raw?.length || 0}`;
    if (analysisEventRef.current === signature) return;
    analysisEventRef.current = signature;
    trackProductEvent("analysis_completed", {
      tool_id: toolId,
      source: csvData?.fileName?.startsWith("demo_") ? "demo" : "csv",
      row_count: csvData?.raw?.length || 0,
      result_state: verdict?.insufficient ? "insufficient" : "ready",
      locale,
    });
  }, [showResults, toolId, csvData?.fileName, csvData?.raw?.length, verdict?.insufficient, locale]);

  return (
    <div className={`section active dashboard-shell${showResults ? " has-results" : ""}`}>
      
      {/* Main Content Area */}
      <div className="dashboard-shell__main">
        {/* 압축 sticky 타이틀 바 — 다른 5-x 도구(ToolPageShell)와 동일한
            .page-sticky-bar/row1/title 클래스로 통일(§디자인시스템). 필터도
            같은 박스 안에 이어 붙여 한 도구 셸처럼 보이게(제목만 박스 밖에
            동떨어져 보이던 문제 해결). 결과가 열린 뒤엔 스크롤해도 상단(topbar
            아래 top:48px)에 고정. */}
        <div className="page-sticky-bar">
          <div className="page-sticky-row1 dashboard-sticky-context">
            <h1 className="page-sticky-title">{tr(C.pageTitle, enC.pageTitle)}</h1>
            {hasData && (
              <div className="dashboard-sticky-context__data" role="group" aria-label={tr("현재 데이터", "Current data")}>
                <span className={`chip dashboard-sticky-context__file${isDemo ? " warn" : ""}`}>
                  <span className="dot"></span>
                  {isDemo ? tr("예시 데이터", "Sample data") : (csvData.fileName || "Data.csv")}
                </span>
                <span className="chip ok dashboard-sticky-context__rows">
                  <span className="dot"></span>
                  {csvData.raw.length.toLocaleString()}{tr("행", " rows")}
                </span>
              </div>
            )}
          </div>
          {showResults && (
            <>
              <DashboardFilterBar locale={locale} />
              <DashboardTabs domain={domain} locale={locale} />
            </>
          )}
        </div>

        {!hasData && (
          <p style={{ color: "var(--text-secondary)", margin: "1rem 0 2rem", fontSize: "13px" }}>
            {tr(C.noDataIntro, enC.noDataIntro)}
          </p>
        )}

        {/* Csv Uploader — 상태별 3분기:
            ① 데이터 없음: 업로드 안내 + 드롭존(펼침).
            ② 데이터 有 · 미분석(#4): 매핑을 바로 볼 수 있게 펼친 상태로 노출 →
               사용자가 "데이터 분석하기"를 눌러 확정(CsvUploader가 게이트 세팅).
            ③ 데이터 有 · 분석 완료: 매핑을 접어(details) 결과에 집중. */}
        {!hasData ? (
          <div className="block dashboard-data-setup dashboard-data-setup--empty" id="dashboard-data-setup">
            <h2 className="section-title">{tr("데이터 업로드", "Upload Data")}</h2>
            <p className="card-desc" style={{ marginBottom: "1rem" }}>{tr(C.uploadDesc, enC.uploadDesc)}</p>
            <CsvUploader toolId={toolId} locale={locale} />
          </div>
        ) : !analyzed ? (
          <div className="block dashboard-data-setup dashboard-data-setup--pending" id="dashboard-data-setup">
            <div className="dashboard-data-setup__privacy">
              {tr("🔒 업로드 데이터는 브라우저 메모리에서만 안전하게 유지됩니다.", "🔒 Uploaded data stays safely in your browser memory only.")}
            </div>
            <CsvUploader toolId={toolId} locale={locale} />
          </div>
        ) : (
          <details
            className="dashboard-data-disclosure"
            id="dashboard-data-setup"
            open={mappingOpen}
            onToggle={(e) => setMappingOpen(e.target.open)}
          >
            <summary className="dashboard-data-disclosure__summary">
              <span className="dashboard-data-disclosure__title"><span aria-hidden="true">⚙</span> {tr("데이터 매핑 설정", "Data Mapping Settings")}</span>
              <small>{tr("필요할 때만 열어 수정", "Open only when you need to edit")}</small>
              <b aria-hidden="true">{mappingOpen ? "−" : "＋"}</b>
            </summary>
            <div className="dashboard-data-disclosure__body">
              <div className="dashboard-data-setup__privacy">
                {tr("🔒 업로드 데이터는 브라우저 메모리에서만 안전하게 유지됩니다.", "🔒 Uploaded data stays safely in your browser memory only.")}
              </div>
              <CsvUploader toolId={toolId} locale={locale} />
            </div>
          </details>
        )}

        {/* #4 분석 대기: 데이터는 있으나 아직 "분석하기" 미확정 → 탭/결과 대신
            안내 플레이스홀더. 위 CsvUploader가 "데이터 분석하기"를 제공
            (게이트는 CsvUploader가 setGroupAnalyzed로 확정). */}
        {hasData && !analyzed && (
          <div className="card" style={{ marginTop: "1rem", textAlign: "center", padding: "2.5rem 1rem" }}>
            <div style={{ fontSize: "28px", marginBottom: "0.75rem" }}>🗂</div>
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "15px", fontWeight: "700" }}>{tr("분석 대기 중", "Waiting for Analysis")}</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0, lineHeight: 1.6 }}>
              {tr("위에서 컬럼 매핑이 올바른지 확인한 뒤", "After confirming the column mapping above,")}
              <br />
              {tr(<><strong>&quot;데이터 분석하기&quot;</strong>를 눌러 대시보드를 생성하세요.</>, <>click <strong>&quot;Analyze Data&quot;</strong> to generate the dashboard.</>)}
              <br />
              <span style={{ fontSize: "11.5px" }}>{tr("매핑을 바꾸면 결과가 숨겨지고 다시 분석해야 합니다.", "Changing the mapping hides the results until you re-analyze.")}</span>
            </p>
          </div>
        )}

        {/* Tabs & Content */}
        {showResults && (
          <div className="dashboard-content">
            {workerPending && (
              <div className="callout" role="status" aria-live="polite" style={{ marginBottom: "1rem" }}>
                <div className="ico">◌</div>
                <div className="body"><strong>{tr("대용량 데이터 분석 중", "Analyzing large dataset")}</strong><p>{tr("화면을 멈추지 않고 결과를 계산하고 있습니다.", "The result is being computed without blocking the page.")}</p></div>
              </div>
            )}
            {/* 전체 결론은 첫 진입인 시각화 탭에서만 보여 준다. 하위 탭에서는
                현재 선택한 분석의 그래프·조작 기능이 첫 화면을 차지한다. */}
            {activeTab === "viz" && verdict && !verdict.insufficient && (
              <section className="dashboard-briefing" aria-label={tr("현재 결론과 다음 단계", "Current conclusion and next steps")}>
                {isDemo && (
                  <section className={`dashboard-demo-source${industryPreset ? " is-industry-preset" : ""}`} id="dashboard-demo-source" aria-label={tr("예시 데이터 안내", "Sample data notice")}>
                    <div>
                      <span>{industryPreset ? `SITUATION PRESET · ${industryPreset.title}${industryScale ? ` · ${industryScale.short}` : ""}` : "SAMPLE DATA"}</span>
                      <strong>{industryPreset ? industryPreset.question : tr("지금 보는 수치는 예시입니다", "These numbers are an example")}</strong>
                      <p>{industryPreset
                        ? `${industryPreset.description} · ${tr("90일 합성 데이터이며 실제 고객 데이터가 아닙니다.", "This is 90 days of synthetic data, not real customer data.")}`
                        : tr("내 CSV를 올리면 같은 화면에서 실제 데이터로 바로 교체됩니다.", "Upload your CSV to replace this view with your real data.")}</p>
                    </div>
                    <button type="button" onClick={openMapping}>{industryPreset ? tr("내 CSV로 같은 판단하기", "Run the same decision on my CSV") : tr("내 CSV로 바꾸기", "Use my CSV")} <span aria-hidden="true">→</span></button>
                  </section>
                )}
                <ResultActionCard
                toolId={toolId}
                tone={verdict.tone}
                title={tr("결론 — 최근 성과 요약", "Conclusion — recent performance")}
                headline={verdict.headline}
                points={verdict.keyPoints}
                stats={verdict.stats}
                locale={locale}
                decisionPrefill={{
                  conclusion: verdict.headline,
                  action: verdict.tone === "bad"
                    ? tr(
                      isContent ? "이상 감지에서 급변한 날짜와 유입경로를 먼저 점검한다" : "이상 감지에서 급변한 날짜와 채널을 먼저 점검한다",
                      isContent ? "Check the spike date and traffic source in Anomaly Detection first" : "Check the spike date and channel in Anomaly Detection first",
                    )
                    : verdict.tone === "good"
                      ? tr(
                        isContent ? "개선에 기여한 유입경로를 확인하고 한 조건만 유지 시험한다" : "포화도와 예산 배분에서 여력을 확인하고 한 채널만 소규모 시험한다",
                        isContent ? "Identify the traffic source associated with the improvement and test one condition" : "Check saturation and allocation headroom, then run a small test on one channel",
                      )
                      : tr("같은 기준으로 다음 비교기간의 변화를 다시 확인한다", "Recheck the next comparison window using the same definition"),
                  metric: verdict.stats.find((stat) => stat.emphasis === "primary")?.label || verdict.stats[0]?.label || "",
                  baseline: verdict.stats.find((stat) => stat.emphasis === "primary")?.value || verdict.stats[0]?.value || "",
                  sourcePeriod: tr(`최근 ${dashWindowDays}일 vs 직전 ${dashWindowDays}일`, `Last ${dashWindowDays} days vs. prior ${dashWindowDays} days`),
                  reviewQuestion: tr(
                    `다음 ${dashWindowDays}일에도 같은 지표가 현재 기준보다 개선됐는가?`,
                    `After the next ${dashWindowDays} days, did the same metric improve from this baseline?`,
                  ),
                }}
                analysisDetails={
                  <AnalysisDetails
                    locale={locale}
                    statusLabel={verdict.tone === "good" ? tr("개선", "Improving") : verdict.tone === "bad" ? tr("주의", "Watch") : tr("안정", "Stable")}
                    statusTone={verdict.tone}
                    metric={tr("최근 성과 변화", "Recent performance change")}
                    unit={tr("비교 기간 대비 변화율·매핑된 KPI 단위", "Change rate vs. prior window; mapped KPI units")}
                    meaning={tr("관측상 요약 — 광고의 인과효과나 증분효과가 아님", "Observed summary — not causal or incremental attribution")}
                    sampleSize={{ label: tr("사용 행", "Rows used"), value: csvData.raw.length, detail: tr("현재 필터와 업로드 범위", "Current filter and upload scope") }}
                    scope={tr(`최근 ${dashWindowDays}일 vs 직전 ${dashWindowDays}일`, `Last ${dashWindowDays} days vs. prior ${dashWindowDays} days`)}
                    method={tr("WoW 운영 요약", "WoW operational summary")}
                    version="dashboard-verdict"
                    cachePolicy={tr("브라우저 메모리 전용", "In-memory browser cache only")}
                    warnings={[tr("이 카드는 관측 요약입니다. 인과효과로 해석하려면 증분분석 또는 실험이 필요합니다.", "This is an observed summary. Use incrementality or an experiment for causal claims.")]}
                  />
                }
                controls={
                  <div className="ab-pillgroup" style={{ display: "inline-flex", alignItems: "center" }}>
                    <span className="ab-pillgroup-label">{tr("비교", "Window")}</span>
                    {[7, 14, 28].map((d) => (
                      <button
                        key={d}
                        className={`ab-pill ${dashWindowDays === d ? "active" : ""}`}
                        onClick={() => setDashWindowDays(d)}
                      >
                        {tr(`${d}일`, `${d}d`)}
                      </button>
                    ))}
                  </div>
                }
                download={
                  <DownloadHub
                    toolId={toolId}
                    locale={locale}
                    label={tr("결과 받기", "Download")}
                    align="right"
                    manifest={buildResultManifest({
                      toolId,
                      source: csvData.fileName?.startsWith("demo_") ? "demo" : isContent ? "content-csv" : "csv",
                      inputSignature: `${csvData.fileName || "dataset"}|${csvData.raw.length}`,
                      filter: { windowDays: dashWindowDays },
                      grain: "dashboard-period",
                      metricDefinitions: verdict.stats.map((stat) => ({ key: stat.label, label: stat.label })),
                      engineVersion: "dashboard-verdict",
                      status: "COMPLETE",
                      warnings: ["Observed summary; not causal attribution"],
                    })}
                    items={[
                      { icon: "📄", analyticsType: "csv", label: tr("성과 요약표 (CSV)", "Performance summary (CSV)"), desc: tr("전 지표 증감(WoW)+CPA·CPI·ROAS·리텐션", "All metrics WoW + CPA/CPI/ROAS/retention"), onSelect: () => downloadCsv(verdict.export.csv, isContent ? "content_dashboard_summary" : "dashboard_summary") },
                      { icon: "📝", analyticsType: "text", label: tr("성과 요약 문서 (텍스트)", "Performance summary (text)"), desc: tr("결론·지표 증감·다음 액션", "Conclusion, metric changes, next actions"), onSelect: () => downloadText(verdict.export.text, isContent ? "content_dashboard_summary" : "dashboard_summary") },
                    ]}
                  />
                }
                />
                <div className="dashboard-briefing__followup">
                  <nav className="dashboard-decision-strip dashboard-result-toolbar" aria-label={tr("다음 작업", "Next actions")}>
                    <div className="dashboard-decision-strip__copy"><span>NEXT ACTIONS</span><strong>{tr("결과에서 바로 이어가기", "Continue from this result")}</strong></div>
                    <div className="dashboard-decision-strip__actions">
                      <button type="button" onClick={openSupportTools}>{tr("다음 분석 선택", "Choose next analysis")}</button>
                      <ToolTemplateAction toolId={toolId} locale={locale} compact reason={tr("다음 분석용 입력 형식", "Input format for the next analysis")} source="dashboard_result" />
                    </div>
                  </nav>
                  <DashboardRecommendedViews
                    {...dashboardRecommendations}
                    locale={locale}
                    onSelect={selectRecommendedView}
                  />
                  <div className="dashboard-data-jump dashboard-data-jump--quiet">
                    <a href="#dashboard-tabpanel">{tr("바로 데이터 보기", "Jump to data")} <span aria-hidden="true">↓</span></a>
                    <span>{tr("기록·다음 분석·이벤트 마커는 데이터 아래에 정리했습니다.", "History, next analyses, and event markers are organized below the data.")}</span>
                  </div>
                </div>
              </section>
            )}

            <div id="dashboard-tabpanel" className="tab-content" role="tabpanel" aria-labelledby={`dashboard-tab-${activeTab}`} tabIndex={0} style={{ marginTop: "1rem" }}>
              {activeTab === "viz" && <VizTab domain={domain} locale={locale} />}
              {activeTab === "scorecard" && <ScorecardTab domain={domain} locale={locale} />}
              {activeTab === "anomaly" && <AnomalyTab domain={domain} locale={locale} />}
              {!isContent && activeTab === "seasonality" && <SeasonalityTab locale={locale} />}
              {/* 콘텐츠 대시보드는 아래 마케팅 전용 탭(결제·예산·매출 전제)을 노출하지 않음. */}
              {!isContent && activeTab === "pacing" && <PacingTab locale={locale} />}
              {!isContent && activeTab === "ltv" && <LtvTab locale={locale} />}
              {!isContent && activeTab === "cohort" && <CohortTab locale={locale} />}
              {!isContent && activeTab === "funnel" && <FunnelTab locale={locale} />}
              {!isContent && activeTab === "segment" && <SegmentTab locale={locale} />}
              {!["viz", "scorecard", "seasonality", "pacing", "anomaly", "ltv", "cohort", "funnel", "segment"].includes(activeTab) && (
                <div className="card">
                  <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "2rem 0" }}>
                    {tr(`[${activeTab}] 탭은 현재 마이그레이션 중입니다...`, `The [${activeTab}] tab is currently being migrated...`)}
                  </p>
                </div>
              )}
            </div>
            {verdict && !verdict.insufficient && (
              <details className="dashboard-support-tools" id="dashboard-support-tools" open={supportOpen} onToggle={(event) => setSupportOpen(event.target.open)}>
                <summary>
                  <span>{tr("분석 보조 도구", "Analysis utilities")}</span>
                  <small>{tr("기록 · 다음 분석 · 이벤트 마커", "History · next analyses · event markers")}</small>
                  <b aria-hidden="true">＋</b>
                </summary>
                <div className="dashboard-support-tools__body">
                  <AnalysisHistory toolId={toolId} summary={{ headline: verdict.headline, tone: verdict.tone, stats: verdict.stats }} locale={locale} />
                  <AnalysisPathway csvData={csvData} locale={locale} />
                  <MonEventMarkerUI locale={locale} />
                </div>
              </details>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
