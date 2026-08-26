"use client";

import Link from "next/link";
import { useState } from "react";
import { computeAnalyzeSig, useAppStore } from "@/store/useDataStore";
import { serializeReportDraft } from "@/lib/reports/reportSchema";
import { renderReportMarkdown } from "@/lib/reports/renderMarkdown";
import { downloadText } from "@/utils/download";
import { downloadXlsx } from "@/utils/download";
import { createWeeklyReportWorkbook } from "@/lib/reports/reportWorkbook";
import { trackProductEvent } from "@/lib/analytics";
import NewsletterSignup from "@/components/seo/NewsletterSignup";

const COPY = {
  ko: {
    eyebrow: "WEEKLY REPORT",
    title: "분석 결론을 한 장의 주간 보고서로",
    deck: "각 도구의 결과 카드에서 선택한 결론만 모읍니다. 원본 CSV 행은 보고서에 포함되지 않습니다.",
    reportTitle: "보고서 제목",
    defaultTitle: "주간 성과 보고서",
    period: "보고 기간",
    note: "공유 메모",
    empty: "아직 수집한 결과가 없습니다. 운영 대시보드·성과 변동·포화도·예산 배분 결과에서 ‘보고서에 추가’를 누르세요.",
    tools: "지원 도구 열기",
    stale: "입력 데이터가 바뀐 뒤 만들어진 이전 결과입니다.",
    up: "위로",
    down: "아래로",
    remove: "제거",
    markdown: "Markdown 받기",
    workbook: "XLSX 받기",
    print: "인쇄 / PDF",
    privacy: "브라우저 세션에서만 유지됩니다. 원본 데이터는 저장하거나 내보내지 않습니다.",
    mixedPeriods: "수집한 결과의 분석 기간이 서로 다릅니다. 공유 전 각 결론의 기간을 확인하세요.",
    analysisPeriod: "분석 기간",
  },
  en: {
    eyebrow: "WEEKLY REPORT",
    title: "Turn analysis conclusions into one weekly report",
    deck: "Collect only the conclusions selected from result cards. Source CSV rows are never included.",
    reportTitle: "Report title",
    defaultTitle: "Weekly performance report",
    period: "Reporting period",
    note: "Sharing note",
    empty: "No results collected yet. Use “Add to report” in Dashboard, Campaign Variance, Saturation, or Budget Allocation.",
    tools: "Open supported tools",
    stale: "This result was created from an earlier data input.",
    up: "Move up",
    down: "Move down",
    remove: "Remove",
    markdown: "Download Markdown",
    workbook: "Download XLSX",
    print: "Print / PDF",
    privacy: "Kept only for this browser session. Source data is neither stored nor exported.",
    mixedPeriods: "Collected results use different analysis periods. Check each conclusion’s period before sharing.",
    analysisPeriod: "Analysis period",
  },
};

function reportPeriodKey(block) {
  const start = block?.scope?.dateStart;
  const end = block?.scope?.dateEnd;
  return start && end ? `${start}~${end}` : null;
}

export default function WeeklyReport({ locale = "ko" }) {
  const t = COPY[locale] || COPY.ko;
  const draft = useAppStore((state) => state.reportDraft);
  const csvData = useAppStore((state) => state.csvData);
  const csvGroups = useAppStore((state) => state.csvGroups);
  const setReportMeta = useAppStore((state) => state.setReportMeta);
  const setReportNote = useAppStore((state) => state.setReportNote);
  const removeReportBlock = useAppStore((state) => state.removeReportBlock);
  const moveReportBlock = useAppStore((state) => state.moveReportBlock);
  const currentSig = computeAnalyzeSig(csvData);
  const [isWorkbookExporting, setIsWorkbookExporting] = useState(false);
  const title = draft.title || t.defaultTitle;
  const hasMixedPeriods = new Set(draft.blocks.map(reportPeriodKey).filter(Boolean)).size > 1;
  const download = () => {
    const safe = serializeReportDraft({ ...draft, title });
    downloadText(renderReportMarkdown(safe, locale), locale === "en" ? "weekly-performance-report" : "주간-성과-보고서", "md", locale);
  };
  const downloadWorkbook = async () => {
    if (isWorkbookExporting) return;
    setIsWorkbookExporting(true);
    try {
      const safe = serializeReportDraft({ ...draft, title });
      const bytes = await createWeeklyReportWorkbook(safe, locale);
      downloadXlsx(bytes, locale === "en" ? "weekly-performance-report" : "주간-성과-보고서");
      trackProductEvent("result_downloaded", { source: "weekly_report", download_type: "xlsx", locale });
    } finally {
      setIsWorkbookExporting(false);
    }
  };

  return (
    <main id="main-content" tabIndex="-1" className="page-inner weekly-review-page weekly-report-page">
      <header className="weekly-review-page__head">
        <div className="weekly-review-page__eyebrow">{t.eyebrow}</div>
        <h1>{t.title}</h1>
        <p>{t.deck}</p>
      </header>
      <section className="weekly-review-page__toolbar no-print" aria-label={t.title}>
        <label>
          <span>{t.reportTitle}</span>
          <input value={draft.title} placeholder={t.defaultTitle} onChange={(event) => setReportMeta({ title: event.target.value })} />
        </label>
        <fieldset className="weekly-report-page__period-fieldset">
          <legend>{t.period}</legend>
          <label><span>{locale === "en" ? "Start date" : "시작일"}</span><input type="date" value={draft.period?.start || ""} onChange={(event) => setReportMeta({ period: { ...(draft.period || {}), start: event.target.value } })} /></label>
          <label><span>{locale === "en" ? "End date" : "종료일"}</span><input type="date" value={draft.period?.end || ""} onChange={(event) => setReportMeta({ period: { ...(draft.period || {}), end: event.target.value } })} /></label>
        </fieldset>
        <button className="btn primary" type="button" disabled={!draft.blocks.length} onClick={download}>{t.markdown}</button>
        <button className="btn ghost" type="button" disabled={!draft.blocks.length || isWorkbookExporting} onClick={downloadWorkbook}>{isWorkbookExporting ? "XLSX…" : t.workbook}</button>
        <button className="btn ghost" type="button" disabled={!draft.blocks.length} onClick={() => window.print()}>{t.print}</button>
      </section>
      <p className="weekly-review-page__privacy">{t.privacy}</p>
      {!draft.blocks.length ? (
        <div className="weekly-review-page__empty">
          <p>{t.empty}</p>
          <Link className="btn ghost" href={locale === "en" ? "/en/dashboard" : "/dashboard"}>{t.tools}</Link>
        </div>
      ) : (
        <section className="weekly-review-page__ledger" aria-label={title}>
          <div className="print-only weekly-report-page__print-title">{title}</div>
          {hasMixedPeriods && <p className="weekly-report-page__period-warning" role="status">{t.mixedPeriods}</p>}
          {draft.blocks.map((block, index) => (
            <article className="weekly-review-record" key={block.id}>
              <div className="weekly-review-record__top">
                <span>{block.toolTitle}{reportPeriodKey(block) && <> · {t.analysisPeriod} {reportPeriodKey(block).replace("~", " ~ ")}</>}</span>
                {block.inputSignature !== computeAnalyzeSig(csvGroups[block.dataGroup] || csvData) && (
                  <em className="weekly-review-record__status due">{t.stale}</em>
                )}
              </div>
              <h2>{block.headline}</h2>
              {block.stats.length > 0 && (
                <div className="weekly-review-record__baseline">
                  {block.stats.map((stat) => <span key={stat.label}><b>{stat.label}</b> {stat.displayValue}</span>)}
                </div>
              )}
              {block.points.length > 0 && <ul>{block.points.map((point) => <li key={point}>{point}</li>)}</ul>}
              <div className="no-print">
                <button className="btn ghost" type="button" disabled={index === 0} onClick={() => moveReportBlock(block.id, -1)}>{t.up}</button>
                <button className="btn ghost" type="button" disabled={index === draft.blocks.length - 1} onClick={() => moveReportBlock(block.id, 1)}>{t.down}</button>
                <button className="btn ghost" type="button" onClick={() => removeReportBlock(block.id)}>{t.remove}</button>
              </div>
            </article>
          ))}
          <label className="weekly-report-page__note no-print">
            <span>{t.note}</span>
            <textarea value={draft.notes?.[0]?.text || ""} onChange={(event) => setReportNote(event.target.value)} />
          </label>
          {draft.notes?.[0]?.text && <blockquote>{draft.notes[0].text}</blockquote>}
        </section>
      )}
      {draft.blocks.length > 0 && <div className="no-print"><NewsletterSignup locale={locale} source="product" placement="weekly_report" /></div>}
    </main>
  );
}
