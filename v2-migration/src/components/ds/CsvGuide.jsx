"use client";
import React, { useState } from "react";
import { getToolGuide } from "@/utils/toolGuide";
import { hasToolTemplate, downloadTemplateCsv, TEMPLATE_FAMILY } from "@/components/ds/csvTemplate";
import DataTable from "@/components/ds/DataTable";
import ModalDialog from "@/components/ds/ModalDialog";
import { trackProductEvent } from "@/lib/analytics";
import SourceExportGuide from "./SourceExportGuide";
import useExampleLink from "@/components/ds/useExampleLink";

// CSV upload guidance (design-system baseline §1.4). Hybrid per claude-ux §0
// (avoid hidden-affordance trap): an always-visible 1-line summary + a prominent
// button that opens a modal with the full "when / why each column / prep / example".
// Sits ABOVE the dropzone. Used by CsvUploader + custom dropzones (5-18/5-20/holdout).
const GUIDE_COPY = {
  ko: {
    need: "필요: ",
    effort: (count) => `필수 컬럼 ${count}개`,
    tryExample: "예시 데이터로 결과 바로 보기",
    openBtn: "어떤 데이터가 왜 필요한가요?",
    modalTitle: "이 도구에 올릴 데이터 안내",
    close: "닫기",
    whenHeading: "언제 쓰나요?",
    colsHeading: "어떤 컬럼이 왜 필요한가요?",
    colCol: "컬럼",
    colWhat: "무엇",
    colWhy: "왜 필요",
    colRequired: "필수",
    prepHeading: "준비 팁",
    exampleHeading: "이렇게 생긴 파일이면 됩니다 (예시)",
    exampleFoot: "첫 줄 = 컬럼 이름(헤더), 그 아래 = 실제 데이터 한 줄씩.",
    templateBtn: "⬇ 템플릿 CSV 받기",
    toolTemplateBtn: "⬇ 이 도구 템플릿",
    unifiedTemplateBtn: "⬇ 통합 템플릿",
    unifiedTemplateTitle: "효율·예산 도구(5-2/5-3/5-21/5-22) 공통 통합 템플릿",
    confirm: "확인",
  },
  en: {
    need: "Needs: ",
    effort: (count) => `${count} required columns`,
    tryExample: "Run the example and see results",
    openBtn: "What data is needed and why?",
    modalTitle: "Data guide for this tool",
    close: "Close",
    whenHeading: "When do you use this?",
    colsHeading: "Which columns are needed and why?",
    colCol: "Column",
    colWhat: "What",
    colWhy: "Why needed",
    colRequired: "Required",
    prepHeading: "Prep tips",
    exampleHeading: "A file shaped like this works (example)",
    exampleFoot: "First row = column names (header), each row below = one real data row.",
    templateBtn: "⬇ Download template CSV",
    toolTemplateBtn: "⬇ This tool's template",
    unifiedTemplateBtn: "⬇ Unified template",
    unifiedTemplateTitle: "Shared template for efficiency/budget tools (5-2/5-3/5-21/5-22)",
    confirm: "OK",
  },
};

export default function CsvGuide({ toolId, onDownloadTemplate, onTryExample = null, locale = "ko", helpAction = null, compact = false }) {
  const [open, setOpen] = useState(false);
  const T = GUIDE_COPY[locale] || GUIDE_COPY.ko;
  const guide = getToolGuide(toolId, locale);
  // 버튼과 링크(?example=1)가 같은 경로를 탄다 — 계측의 interaction_source만 다르다.
  const runExample = (source = "csv_guide") => {
    trackProductEvent("example_run_started", {
      tool_id: String(toolId).split(":")[0],
      source,
      placement: "before_upload",
      locale,
    });
    onTryExample?.();
  };
  useExampleLink(guide && onTryExample ? runExample : null);
  if (!guide) return helpAction ? <div className="csv-guide-actions">{helpAction}</div> : null;

  const requiredNeeds = guide.needs.filter((n) => n.required);
  const reqCols = requiredNeeds.map((n) => n.label).join(" · ");
  // 소요 시간 표기는 뺐다 — 데이터 크기·매핑 상태에 따라 실제와 달라지는데
  // 화면은 확정된 숫자처럼 보여줬다. 확인할 수 없는 숫자는 적지 않는다(§8).
  const close = () => setOpen(false);
  const needColumns = [
    { key: "col", label: T.colCol, fmt: (value) => <code className="inline">{value}</code> },
    { key: "label", label: T.colWhat },
    { key: "why", label: T.colWhy, cellClassName: "csv-guide-reason" },
    { key: "required", label: T.colRequired, align: "center", fmt: (value) => value ? "✓" : "—" },
  ];

  return (
    <div className={`csv-guide${compact ? " csv-guide--compact" : ""}`}>
      <div className="csv-guide-summary">
        {!compact && <div className="csv-guide-line">
          {guide.when && <span className="csv-guide-when">{guide.when}</span>}
          {guide.outcomes?.length > 0 && (
            <ol className="csv-guide-outcomes" aria-label={locale === "en" ? "What happens after upload" : "업로드 후 진행 순서"}>
              {guide.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}
            </ol>
          )}
          {reqCols && <span className="csv-guide-need">{T.need}{reqCols}</span>}
          {/* 필수 컬럼이 없으면(자동 판정 입구) 이 줄은 아무것도 알려 주지 않는다 — 뜻 없는 굵은 한 줄을 남기지 않는다(2026-09-29). */}
          {requiredNeeds.length > 0 && <span className="csv-guide-effort">{T.effort(requiredNeeds.length)}</span>}
        </div>}
        <div className="csv-guide-actions">
          {/* 파일 없이 온 사람의 첫 행동이라 줄의 맨 앞·버튼 크기로 둔다(체험과 데모를 나란히 두는 분석 SaaS
              랜딩과 같은 위계, 2026-09-29). 읽는 순서와 보이는 순서를 맞추려고 CSS order가 아니라 DOM 순서로. */}
          {onTryExample && !compact && <button type="button" data-mobile-task=".csv-guide-example-btn" className="csv-guide-example-btn" onClick={() => runExample()}>{T.tryExample}<span aria-hidden>→</span></button>}
          {helpAction}
          <button type="button" className="csv-guide-btn" onClick={() => setOpen(true)}>
            {T.openBtn}
          </button>
        </div>
      </div>

      <ModalDialog
        open={open}
        onClose={close}
        ariaLabel={T.modalTitle}
        overlayClassName="csv-guide-overlay"
        panelClassName="csv-guide-modal"
      >
        <div className="csv-guide-modal-head">
          <strong className="csv-guide-modal-title">{T.modalTitle}</strong>
          <button type="button" className="csv-guide-close" onClick={close} aria-label={`${T.modalTitle}: ${T.close}`}>✕</button>
        </div>

        <div className="csv-guide-modal-body">
          <SourceExportGuide toolId={toolId} locale={locale} />
          <section className="csv-guide-section csv-guide-section--purpose">
            <h4>{T.whenHeading}</h4>
            <p>{guide.when}</p>
            {guide.grain && <p className="csv-guide-grain">{guide.grain}</p>}
          </section>

          <section className="csv-guide-section csv-guide-section--columns">
            <h4>{T.colsHeading}</h4>
            <DataTable
              columns={needColumns}
              rows={guide.needs}
              rowKey={(row, index) => `${row.col}-${index}`}
              ariaLabel={T.colsHeading}
            />
          </section>

          {guide.prep && guide.prep.length > 0 && (
            <section className="csv-guide-section csv-guide-section--prep">
              <h4>{T.prepHeading}</h4>
              <ul className="csv-guide-prep">
                {guide.prep.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </section>
          )}

          {guide.example && (() => {
            const lines = guide.example.trim().split("\n");
            const head = (lines[0] || "").split(",");
            const body = lines.slice(1).map((l) => l.split(","));
            return (
              <section className="csv-guide-section csv-guide-section--example">
                <h4>{T.exampleHeading}</h4>
                <div className="table-wrap">
                  <table className="data csv-guide-example-table" aria-label={T.exampleHeading}>
                    <caption className="sr-only">{T.exampleHeading}</caption>
                    <thead><tr>{head.map((h, i) => <th className="csv-guide-example-heading" scope="col" key={i}>{h}</th>)}</tr></thead>
                    <tbody>{body.map((row, ri) => (
                      <tr key={ri}>{row.map((c, ci) => <td className="csv-guide-example-cell" key={ci}>{c}</td>)}</tr>
                    ))}</tbody>
                  </table>
                </div>
                <p className="csv-guide-example-foot">{T.exampleFoot}</p>
              </section>
            );
          })()}
        </div>

        <div className="csv-guide-modal-foot">
          {/* 템플릿 다운로드 — 도구 자체 제공(onDownloadTemplate) 우선, 없으면 효율패밀리
              표준필드로 자동 생성(구 DataFeatureMatrix 통합 템플릿 이식). */}
          {onDownloadTemplate ? (
            <button type="button" className="ab-pill btn csv-guide-modal-action" onClick={onDownloadTemplate}>{T.templateBtn}</button>
          ) : hasToolTemplate(toolId) && (
            <>
              <button type="button" className="ab-pill btn csv-guide-modal-action" onClick={() => downloadTemplateCsv(toolId, "tool")}>{T.toolTemplateBtn}</button>
              {TEMPLATE_FAMILY.includes(toolId) && (
                <button type="button" className="ab-pill btn csv-guide-modal-action" title={T.unifiedTemplateTitle} onClick={() => downloadTemplateCsv(toolId, "unified")}>{T.unifiedTemplateBtn}</button>
              )}
            </>
          )}
          <button type="button" className="ab-button btn primary csv-guide-modal-action is-primary" onClick={close}>{T.confirm}</button>
        </div>
      </ModalDialog>
    </div>
  );
}
