"use client";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { analysisResultEventKey, productAnalysisType, trackProductEvent, trackProductEventOnce } from "@/lib/analytics";
import DecisionReview from "@/components/ds/DecisionReview";
import AnalysisBasisBar from "@/components/data-import/AnalysisBasisBar";
import { computeAnalyzeSig, findMeta, TOOL_GROUP, useAppStore } from "@/store/useDataStore";
import { findingFromResultCard } from "@/lib/assist/findingProducers";
import { reportBlockFromResultCard } from "@/lib/reports/reportSchema";
import { encodeSharePayload, shareUrlFromPayload } from "@/lib/decisionShare";
import { localizedTool } from "@/lib/toolConnections";
import { downloadText } from "@/utils/download";

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

function detailedDocument({ title, headline, stats, points, locale }) {
  const heading = locale === "en" ? "Analysis details" : "분석 상세 문서";
  const keyFigures = stats.length
    ? `\n## ${locale === "en" ? "Key figures" : "핵심 수치"}\n${stats.map((stat) => `- ${stat.label}: ${stat.value}${stat.detail ? ` (${stat.detail})` : ""}`).join("\n")}`
    : "";
  const evidence = points.length
    ? `\n## ${locale === "en" ? "Interpretation and next checks" : "해석과 다음 확인"}\n${points.map((point) => `- ${typeof point.text === "string" ? point.text : "—"}`).join("\n")}`
    : "";
  return `# ${title}\n\n## ${heading}\n${typeof headline === "string" ? headline : "—"}${keyFigures}${evidence}\n\n${locale === "en" ? "This document summarizes the displayed result. It does not replace causal validation or an experiment." : "이 문서는 화면에 표시된 결과를 요약합니다. 인과 검증이나 실험을 대체하지 않습니다."}\n`;
}

export default function ResultActionCard({
  tone = "neutral",
  title = "결론",
  headline,
  points = [],
  stats = [],
  download = null,
  controls = null,
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
  const [reportAdded, setReportAdded] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const inputSignature = computeAnalyzeSig(csvData);
  const resolvedAnalysisType = analysisType || productAnalysisType(toolId);
  const dataSource = String(csvData?.fileName || "").startsWith("demo_")
    ? "demo"
    : csvData?.importSource || (csvData?.raw?.length ? "csv" : "manual");
  const resultTelemetryKey = analysisResultEventKey(toolId, resolvedAnalysisType, inputSignature, analysisKey || "", locale);
  const resultScope = useMemo(() => ({
    dateStart: dashboardFilter?.dateStart || undefined,
    dateEnd: dashboardFilter?.dateEnd || undefined,
    channels: [...(dashboardFilter?.channels || [])].map(String).sort(),
    countries: [...(dashboardFilter?.countries || [])].map(String).sort(),
  }), [dashboardFilter]);
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
  const resolvedDecisionPrefillKey = useMemo(() => decisionPrefillKey(decisionPrefill), [decisionPrefill]);
  const hasDecisionPrefill = Boolean(
    decisionPrefill
      && typeof decisionPrefill === "object"
      && !Array.isArray(decisionPrefill)
      && String(decisionPrefill.action || "").trim(),
  );
  const canScheduleDecision = Boolean(decisionReview && toolId && hasDecisionPrefill && !String(csvData?.fileName || "").startsWith("demo_"));
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
  const canDownloadDetails = Boolean(toolId && typeof headline === "string" && headline.trim());
  const copyShareLink = async () => {
    const token = encodeSharePayload({ toolId, toolTitle: shareToolTitle, headline, points, stats, locale });
    const url = token && shareUrlFromPayload(token, locale, typeof window === "undefined" ? "" : window.location.origin);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      trackProductEvent("share_link_copied", { tool_id: toolId, placement: "result_action_card", locale });
      window.setTimeout(() => setShareCopied(false), 2400);
    } catch {
      // 클립보드 권한이 없으면 조용히 무시한다(공유는 보조 기능).
    }
  };
  const collectForReport = () => {
    if (!generatedReportBlock) return;
    addReportBlock(generatedReportBlock);
    setReportAdded(true);
    trackProductEvent("weekly_report_block_added", { tool_id: toolId, locale });
  };
  return (
    <section ref={cardRef} className={`result-action-card ${tone}`} style={style} aria-labelledby={headline ? headingId : undefined} aria-label={!headline && typeof resolvedTitle === "string" ? resolvedTitle : undefined}>
      <div className="result-action-card__head">
        <span className="result-action-card__signal" aria-hidden>{t.icon}</span>
        <div className="result-action-card__copy">
          <div className="result-action-card__label">
            {resolvedTitle}
          </div>
          {headline && (
            <h2 id={headingId} className="result-action-card__headline">
              {headline}
            </h2>
          )}
        </div>
        {(controls || download || generatedReportBlock || canShareDecision || canDownloadDetails) && (
          <div className="result-action-card__controls">
            {controls}
            {canShareDecision && (
              <button className="btn ghost" type="button" onClick={copyShareLink}>
                {shareCopied
                  ? (locale === "en" ? "✓ Link copied" : "✓ 링크 복사됨")
                  : (locale === "en" ? "Share conclusion" : "결론 공유")}
              </button>
            )}
            {canDownloadDetails && (
              <button
                className="btn ghost"
                type="button"
                onClick={() => downloadText(
                  detailedDocument({ title: shareToolTitle, headline, stats, points, locale }),
                  `${toolId}-analysis-details`,
                  "md",
                  locale,
                )}
              >
                {locale === "en" ? "Download details" : "상세 문서 받기"}
              </button>
            )}
            {generatedReportBlock && (
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
            {download}
          </div>
        )}
        {(analysisMeta || (analysisBasis && toolId)) && (
          <aside className="result-action-card__evidence" aria-label={locale === "en" ? "Data and method information" : "데이터 기준과 신뢰도"}>
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
        <details className="result-action-card__details">
          <summary>{locale === "en" ? `View ${hiddenPoints.length} more supporting point(s)` : `근거 ${hiddenPoints.length}개 더 보기`}</summary>
          <ul className="result-action-card__points result-action-card__points--nested">
            {hiddenPoints.map((p, i) => (
              <li key={i} className={`${p.cls || ""} ${p.label ? "is-structured" : ""}`.trim()}>
                {p.label && <span className="result-action-card__point-label">{p.label}</span>}
                {p.label ? <strong>{p.text}</strong> : p.text}
                {p.detail && <small>{p.detail}</small>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {canScheduleDecision && (
        <DecisionReview
          toolId={toolId}
          locale={locale}
          decisionPrefill={decisionPrefill}
          decisionPrefillKey={resolvedDecisionPrefillKey}
        />
      )}

      {analysisDetails}
      {children}
    </section>
  );
}
