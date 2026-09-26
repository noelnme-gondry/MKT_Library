"use client";
import { isDemoData } from "@/lib/dataOrigin";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { analysisResultEventKey, productAnalysisType, trackProductEvent, trackProductEventOnce } from "@/lib/analytics";
import { buildReviewEvidence } from "@/lib/reviewEvidence";
import LinkAnalysisToDecision from "./LinkAnalysisToDecision";
import DecisionReview from "@/components/ds/DecisionReview";
import DecisionReviewPreview from "@/components/ds/DecisionReviewPreview";
import AnalysisBasisBar from "@/components/data-import/AnalysisBasisBar";
import AnalysisScopeEvidence from "@/components/ds/AnalysisScopeEvidence";
import { scopeEvidenceTable, scopeFilters } from "@/lib/analysis-results/scopeEvidence";
import { computeAnalyzeSig, findMeta, TOOL_GROUP, useAppStore } from "@/store/useDataStore";
import { findingFromResultCard } from "@/lib/assist/findingProducers";
import { reportBlockFromResultCard } from "@/lib/reports/reportSchema";
import { encodeSharePayload, shareUrlFromPayload } from "@/lib/decisionShare";
import { localizedTool } from "@/lib/toolConnections";
import DownloadHub from "@/components/ds/DownloadHub";
import { AnalysisExportProvider } from "@/lib/analysis-export/AnalysisExportContext";
import { buildAnalysisExportPayload } from "@/lib/analysis-export/exportContract";

// 표준 결론·액션 카드 — "결론 먼저, 근거는 접어서"(claude-ux §0)의 1층.
// 5-3 예산배분의 alloc-verdict-card 패턴을 디자인시스템 공용으로 승격한 것.
// 전 분석 도구가 결과 최상단에 이 카드를 두어 ① 한 줄 결론 ② 핵심 수치
// ③ 다음 액션 ④ 결과 받기(다운로드)를 한 곳에서 제공한다.
//
// props:
//   tone     : "good" | "bad" | "neutral"  (좌측 보더·아이콘 색)
//   title    : 카드 제목(기본 "결론")
//   headline : 한 줄 평어 결론(string | node)  — 통계용어 없이
//   points   : [{ text, cls? }]  다음 액션/설명 불릿 (cls: "bad"|"good"|"muted")
//   stats    : [{ label, value, detail? }]  핵심 수치 스트립
//   download : node (DownloadHub 등)  — 우상단 배치
//   analysisDetails : node (AnalysisDetails 등) — 단위·신뢰도·provenance 접기
//   children : 카드 하단 추가 콘텐츠(선택)
//   collapsePointsAfter : 첫 N개 근거만 펼쳐 보이고 나머지는 details에 둔다.
//   toolId : 지정하면 실제 결과 카드가 화면에 도달한 순간만 익명 제품 이벤트를 남긴다.
//   analysisKey / analysisType / resultState : 같은 실행의 완료·노출을 정확히 1회 기록한다.
//   trackAnalysisStart : 별도 실행 버튼 없이 유효 설정에서 즉시 계산되는 도구만 사용한다.
//   decisionReview : 결과 → 실행 → 다음 검토의 CSV 기반 기록 루프를 표시한다.
//   decisionPrefill : 도구가 명시적으로 만든 안전한 결론·행동·기준값 제안. 원본 행 금지.
const TONE = {
  good: { icon: "↗" },
  bad: { icon: "!" },
  neutral: { icon: "→" },
};

const DECISION_PREFILL_FIELDS = ["conclusion", "action", "hypothesis", "metric", "baseline", "reviewQuestion", "reviewDate", "sourcePeriod"];

function decisionPrefillKey(prefill) {
  if (!prefill || typeof prefill !== "object" || Array.isArray(prefill)) return "empty";
  return JSON.stringify(DECISION_PREFILL_FIELDS.map((key) => {
    const value = prefill[key];
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
  }));
}

export default function ResultActionCard({
  tone = "neutral",
  title = "결론",
  headline,
  points = [],
  stats = [],
  download = null,
  controls = null,
  coreFigure = null,
  analysisDetails = null,
  analysisMeta = null,
  children,
  style,
  collapsePointsAfter = null,
  locale = "ko",
  toolId = null,
  shareTitle = null,
  analysisKey = null,
  analysisType = null,
  resultState = "ready",
  trackAnalysisStart = false,
  decisionReview = true,
  decisionPrefill = null,
  analysisBasis = true,
  reportBlock = null,
  workbookExport = null,
  scopeEvidence = null,
}) {
  const resolvedTitle = title === "결론" && locale === "en" ? "Conclusion" : title;
  const t = TONE[tone] || TONE.neutral;
  const headingId = useId();
  const trackedVisibleResultKey = useRef(null);
  const cardRef = useRef(null);
  const csvData = useAppStore((state) => state.csvData);
  const dashboardFilter = useAppStore((state) => state.dashboardFilter);
  const publishFinding = useAppStore((state) => state.publishFinding);
  const addReportBlock = useAppStore((state) => state.addReportBlock);
  const reportDraft = useAppStore((state) => state.reportDraft);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareError, setShareError] = useState("");
  const inputSignature = computeAnalyzeSig(csvData);
  const resolvedAnalysisType = analysisType || productAnalysisType(toolId);
  const dataSource = isDemoData(csvData)
    ? "demo"
    : csvData?.importSource || (csvData?.raw?.length ? "csv" : "manual");
  const resultTelemetryKey = analysisResultEventKey(toolId, resolvedAnalysisType, inputSignature, analysisKey || "", locale);
  const resultScope = useMemo(() => ({
    dateStart: dashboardFilter?.dateStart || undefined,
    dateEnd: dashboardFilter?.dateEnd || undefined,
    ...scopeFilters(dashboardFilter),
    ...(scopeEvidence ? {
      ...(scopeEvidence.filters || {}),
      dateStart: scopeEvidence.periods.find((period) => period.id === "after")?.start,
      dateEnd: scopeEvidence.periods.find((period) => period.id === "after")?.end,
      comparisonStart: scopeEvidence.periods.find((period) => period.id === "before")?.start,
      comparisonEnd: scopeEvidence.periods.find((period) => period.id === "before")?.end,
    } : {}),
  }), [dashboardFilter, scopeEvidence]);
  const shareToolTitle = locale === "en"
    ? (localizedTool(toolId, "en")?.title || findMeta(toolId)?.title || shareTitle || toolId)
    : (findMeta(toolId)?.title || shareTitle || toolId);
  const generatedReportBlock = useMemo(() => reportBlock || reportBlockFromResultCard({
    toolId,
    toolTitle: shareToolTitle,
    headline,
    points,
    stats,
    inputSignature,
    locale,
    dataGroup: TOOL_GROUP[toolId],
    scope: resultScope,
  }), [reportBlock, toolId, shareToolTitle, headline, points, stats, inputSignature, locale, resultScope]);
  const generatedFinding = useMemo(() => findingFromResultCard({
    toolId,
    tone,
    headline,
    points,
    stats,
    inputSignature,
    locale,
    dataGroup: TOOL_GROUP[toolId],
    scope: resultScope,
  }), [toolId, tone, headline, points, stats, inputSignature, locale, resultScope]);
  // 보고서는 판단 가능한 결과만 수집한다. 표본 부족·차단·미결론 결과를
  // "결론"으로 보관하면 다음 주 검토에서 실제 판단처럼 보이기 때문이다.
  const canCollectReport = Boolean(generatedReportBlock && resultState === "ready");
  const reportAdded = Boolean(generatedReportBlock && reportDraft?.blocks?.some(block => block.id === generatedReportBlock.id && JSON.stringify(block) === JSON.stringify(generatedReportBlock)));
  const resolvedDecisionPrefill = useMemo(() => decisionPrefill || { conclusion: typeof headline === "string" ? headline : "" }, [decisionPrefill, headline]);
  const resolvedDecisionPrefillKey = useMemo(() => decisionPrefillKey(resolvedDecisionPrefill), [resolvedDecisionPrefill]);
  const hasDecisionPrefill = Boolean(
    decisionPrefill
      && typeof decisionPrefill === "object"
      && !Array.isArray(decisionPrefill)
      && String(decisionPrefill.action || "").trim(),
  );
  const canScheduleDecision = Boolean(decisionReview && toolId && (hasDecisionPrefill || (decisionPrefill == null && resultState === "ready" && headline)) && !isDemoData(csvData));
  // 결과를 읽은 자리가 판단 기록 루프의 출발점이다. 레일처럼 별도 화면에만
  // 두면 결과→재방문 이음매가 끊기므로, 실제 데이터 결과에는 항상 주간 검토
  // 진입점을 함께 둔다. 데모는 가짜 판단을 남기지 않도록 제외한다.
  const canOpenDecisionReview = Boolean(toolId && !isDemoData(csvData));
  // 예시 데이터에서는 저장하지 않되 저장 단계가 있다는 사실과 조건은 보여 준다(B안).
  const canPreviewDecision = Boolean(decisionReview && toolId && (hasDecisionPrefill || (decisionPrefill == null && resultState === "ready" && headline)) && isDemoData(csvData));
  const visiblePoints = collapsePointsAfter == null ? points : points.slice(0, collapsePointsAfter);
  const hiddenPoints = collapsePointsAfter == null ? [] : points.slice(collapsePointsAfter);
  useEffect(() => {
    if (!toolId) return;
    if (trackAnalysisStart) {
      trackProductEventOnce("analysis_started", resultTelemetryKey, {
        tool_id: toolId,
        source: dataSource,
        row_count: csvData?.raw?.length || 0,
        analysis_type: resolvedAnalysisType,
        locale,
      });
    }
    trackProductEventOnce("analysis_completed", resultTelemetryKey, {
      tool_id: toolId,
      source: dataSource,
      row_count: csvData?.raw?.length || 0,
      analysis_type: resolvedAnalysisType,
      result_state: resultState,
      placement: "result_action_card",
      locale,
    });
  }, [csvData?.raw?.length, dataSource, locale, resolvedAnalysisType, resultState, resultTelemetryKey, toolId, trackAnalysisStart]);
  useEffect(() => {
    if (!toolId || !cardRef.current || typeof IntersectionObserver !== "function") return undefined;
    const target = cardRef.current;
    const observer = new IntersectionObserver((entries) => {
      const isVisible = entries.some((entry) => entry.target === target && entry.isIntersecting && entry.intersectionRatio > 0);
      if (!isVisible || trackedVisibleResultKey.current === resultTelemetryKey) return;

      const sent = trackProductEventOnce("analysis_result_viewed", resultTelemetryKey, {
        tool_id: toolId,
        source: dataSource,
        analysis_type: resolvedAnalysisType,
        result_state: resultState,
        placement: "result_action_card",
        locale,
      });
      if (!sent) return;
      trackedVisibleResultKey.current = resultTelemetryKey;
      observer.disconnect();
    }, { threshold: [0, 0.1] });
    observer.observe(target);
    return () => observer.disconnect();
  }, [dataSource, locale, resolvedAnalysisType, resultState, resultTelemetryKey, toolId]);
  useEffect(() => {
    if (generatedFinding) publishFinding(generatedFinding);
  }, [generatedFinding, publishFinding]);
  const canShareDecision = Boolean(toolId && typeof headline === "string" && headline.trim());
  const canExportWorkbook = Boolean(toolId && headline);
  const analysisExport = useMemo(() => ({
    toolId,
    locale,
    buildPayload: (manifest = null) => buildAnalysisExportPayload({
      toolId,
      toolTitle: shareToolTitle,
      locale,
      headline,
      points,
      stats,
      resultState,
      analysisType: resolvedAnalysisType,
      inputSignature,
      source: {
        fileName: csvData?.fileName,
        importSource: csvData?.importSource,
        headers: csvData?.headers,
        rows: csvData?.raw,
        mapping: csvData?.mapping,
      },
      scope: resultScope,
      manifest,
      addon: scopeEvidence ? () => {
        const addon = (typeof workbookExport === "function" ? workbookExport() : workbookExport) || {};
        return { ...addon, calculationTables: [...(addon.calculationTables || []), scopeEvidenceTable(scopeEvidence)] };
      } : workbookExport,
      projectName: isDemoData(csvData) ? "" : useAppStore.getState().projects.find(project => project.id === useAppStore.getState().activeProjectId)?.name,
      reviewRecords: isDemoData(csvData) ? [] : useAppStore.getState().decisionRecords.filter(record => record.toolId === toolId),
      generatedAt: new Date().toISOString(),
    }),
  }), [csvData, headline, inputSignature, locale, points, resolvedAnalysisType, resultScope, resultState, shareToolTitle, stats, toolId, workbookExport, scopeEvidence]);
  const copyShareLink = async () => {
    setShareError("");
    const token = encodeSharePayload({ toolId, toolTitle: shareToolTitle, headline, points, stats, locale, context: { ...resultScope, currency: csvData?.currency }, limitations: [locale === "en" ? "A shared result summary. Verify comparison conditions, uncertainty and study design before acting." : "공유된 결과 요약입니다. 실행 전에 비교 조건·불확실성·분석 설계를 함께 확인하세요."] });
    const url = token && shareUrlFromPayload(token, locale, typeof window === "undefined" ? "" : window.location.origin);
    if (!url) { setShareError(locale === "en" ? "This result is too large for a share link. Use a report instead." : "공유 링크에 담기에는 결과가 큽니다. 보고서를 이용해 주세요."); return; }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      trackProductEvent("share_link_copied", { tool_id: toolId, placement: "result_action_card", locale });
      window.setTimeout(() => setShareCopied(false), 2400);
    } catch {
      setShareError(locale === "en" ? "Could not copy the link. Allow clipboard access and try again." : "링크를 복사하지 못했습니다. 클립보드 권한을 확인하고 다시 시도해 주세요.");
    }
  };
  const collectForReport = () => {
    if (!generatedReportBlock) return;
    addReportBlock(generatedReportBlock);
    trackProductEvent("weekly_report_block_added", { tool_id: toolId, locale });
  };
  return (
    <AnalysisExportProvider value={canExportWorkbook ? analysisExport : null}>
    <section ref={cardRef} data-mobile-task=".result-action-card" className={`result-action-card ${tone}`} style={style} aria-labelledby={headline ? headingId : undefined} aria-label={!headline && typeof resolvedTitle === "string" ? resolvedTitle : undefined}>
      <div className="result-action-card__head">
        <span className="result-action-card__signal" aria-hidden>{t.icon}</span>
        <div className="result-action-card__copy">
          {/* 결론 문장이 있으면 그 위에 작은 라벨("변동 원인 결론")을 눈에 보이게 붙이지 않는다 —
              폰에서 안 읽히고 제목과 경쟁한다(2026-09-24). 화면낭독기에는 어떤 결론인지 맥락으로 남긴다.
              문장이 없을 때만 이름이 보이는 제목 역할을 한다. */}
          <div className={headline ? "sr-only" : "result-action-card__label"}>
            {resolvedTitle}
          </div>
          {headline && (
            <h2 id={headingId} className="result-action-card__headline">
              {headline}
            </h2>
          )}
        </div>
        {(controls || download || canExportWorkbook) && (
          <div className="result-action-card__controls">
            {controls}
            {download || (canExportWorkbook && (
              <DownloadHub
                toolId={toolId}
                locale={locale}
                align="right"
                label={locale === "en" ? "Download results" : "결과 받기"}
              />
            ))}
          </div>
        )}
        {/* 확인할 점은 결론 옆 빨간 "!" 하나로 모은다(데이터 기준·입력 결측·경고). 문제가 없으면 아무것도
            그리지 않는다. 예전의 '실제 분석 범위·분모 확인'·'신뢰도·방법' 블록은 2026-09-24 제거. */}
        {(analysisMeta || analysisDetails || scopeEvidence || (analysisBasis && toolId)) && (
          <aside className="result-action-card__evidence" aria-label={locale === "en" ? "Things to check" : "확인할 점"}>
            {scopeEvidence && <AnalysisScopeEvidence scope={scopeEvidence} locale={locale} />}
            {analysisDetails}
            {analysisBasis && toolId && (
              <AnalysisBasisBar
                canonicalData={csvData?.canonicalData}
                mappedRows={csvData?.mappedRows}
                mapping={csvData?.mapping}
                toolId={toolId}
                locale={locale}
                showPeriodComparison={toolId !== "5-2"}
                variant="tooltip"
              />
            )}
            {analysisMeta}
          </aside>
        )}
      </div>
      {stats.length > 0 && (
        <div className="result-action-card__stats" aria-label={locale === "en" ? "Key figures" : "핵심 수치"}>
          {stats.map((s, i) => (
            <div className={s.emphasis === "primary" ? "is-primary" : ""} key={i}>
              <span>{s.label}</span>
              <strong>{s.value}</strong>
              {s.detail && <small>{s.detail}</small>}
            </div>
          ))}
        </div>
      )}

      {coreFigure}

      {visiblePoints.length > 0 && (
        <ul className="result-action-card__points">
          {visiblePoints.map((p, i) => (
            <li key={i} className={`${p.cls || ""} ${p.label ? "is-structured" : ""}`.trim()}>
              {p.label && <span className="result-action-card__point-label">{p.label}</span>}
              {p.label ? <strong>{p.text}</strong> : p.text}
              {p.detail && <small>{p.detail}</small>}
            </li>
          ))}
        </ul>
      )}

      {hiddenPoints.length > 0 && (
        <section data-information-section="" className="result-action-card__details">
          <header data-information-heading="">{locale === "en" ? `View ${hiddenPoints.length} more supporting point(s)` : `근거 ${hiddenPoints.length}개 더 보기`}</header>
          <ul className="result-action-card__points result-action-card__points--nested">
            {hiddenPoints.map((p, i) => (
              <li key={i} className={`${p.cls || ""} ${p.label ? "is-structured" : ""}`.trim()}>
                {p.label && <span className="result-action-card__point-label">{p.label}</span>}
                {p.label ? <strong>{p.text}</strong> : p.text}
                {p.detail && <small>{p.detail}</small>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {canScheduleDecision && !isDemoData(csvData) && <LinkAnalysisToDecision toolId={toolId} metric={resolvedDecisionPrefill?.metric} locale={locale} evidence={buildReviewEvidence({ headline, points, stats, scope: { ...resultScope, currency: csvData?.currency, metric: resolvedDecisionPrefill?.metric }, analysisType: resolvedAnalysisType, resultState })} />}
      {canScheduleDecision && (
        <DecisionReview
          toolId={toolId}
          locale={locale}
          analysisEvidence={buildReviewEvidence({ headline, points, stats, scope: { ...resultScope, currency: csvData?.currency }, analysisType: resolvedAnalysisType, resultState })}
          decisionPrefill={resolvedDecisionPrefill}
          allowAutomaticComparison={hasDecisionPrefill}
          decisionPrefillKey={resolvedDecisionPrefillKey}
        />
      )}

      {canPreviewDecision && <DecisionReviewPreview toolId={toolId} locale={locale} />}

      {/* 보조 동선은 결론·수치·행동보다 뒤에 둔다. 예전에는 이 넷이 카드 머리의
          다운로드와 나란히 서서, 결과를 읽는 자리에서 시각적으로 가장 강한 것이
          유틸리티 버튼 다섯이었다(§5.3 "동급으로 보이는 CTA 여럿" · §5.5 "다음 행동 1개"). */}
      {shareError && <p role="alert">{shareError}</p>}
      {(canShareDecision || canCollectReport || canOpenDecisionReview) && (
        <div className="result-action-card__utilities" role="group" aria-label={locale === "en" ? "More actions for this result" : "이 결과로 더 할 수 있는 것"}>
          {canShareDecision && (
            <button className="btn ghost" type="button" onClick={copyShareLink}>
              {shareCopied
                ? (locale === "en" ? "✓ Link copied" : "✓ 링크 복사됨")
                : (locale === "en" ? "Share conclusion" : "결론 공유")}
            </button>
          )}
          {canCollectReport && (
            reportAdded ? (
              <Link className="btn ghost" href={locale === "en" ? "/en/weekly-report" : "/weekly-report"}>
                {locale === "en" ? "✓ Open report" : "✓ 보고서 열기"}
              </Link>
            ) : (
              <button className="btn ghost" type="button" onClick={collectForReport}>
                {locale === "en" ? "Add to report" : "보고서에 추가"}
              </button>
            )
          )}
          {canOpenDecisionReview && (
            <Link className="btn ghost" onClick={() => trackProductEvent("review_entry_clicked", { tool_id: toolId, source: "analysis_result", placement: "result_action_card", locale })} href={locale === "en" ? "/en/weekly-review#wr-history" : "/weekly-review#wr-history"}>
              {locale === "en" ? "Open My projects" : "내 프로젝트 열기"}
            </Link>
          )}
        </div>
      )}

      {children}
    </section>
    </AnalysisExportProvider>
  );
}
