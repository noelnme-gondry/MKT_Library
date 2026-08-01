"use client";
import React, { useState } from "react";
import { getToolGuide } from "@/utils/toolGuide";
import { hasToolTemplate, downloadTemplateCsv, TEMPLATE_FAMILY } from "@/components/ds/csvTemplate";
import DataTable from "@/components/ds/DataTable";
import ModalDialog from "@/components/ds/ModalDialog";

// CSV upload guidance (design-system baseline §1.4). Hybrid per claude-ux §0
// (avoid hidden-affordance trap): an always-visible 1-line summary + a prominent
// button that opens a modal with the full "when / why each column / prep / example".
// Sits ABOVE the dropzone. Used by CsvUploader + custom dropzones (5-18/5-20/holdout).
const GUIDE_COPY = {
  ko: {
    need: "필요: ",
    openBtn: "📖 어떤 데이터가 왜 필요한가요?",
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
    openBtn: "📖 What data is needed and why?",
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

export default function CsvGuide({ toolId, onDownloadTemplate, locale = "ko" }) {
  const [open, setOpen] = useState(false);
  const T = GUIDE_COPY[locale] || GUIDE_COPY.ko;
  const guide = getToolGuide(toolId, locale);
  if (!guide) return null;

  const reqCols = guide.needs.filter((n) => n.required).map((n) => n.label).join(" · ");
  const close = () => setOpen(false);
  const needColumns = [
    { key: "col", label: T.colCol, fmt: (value) => <code className="inline">{value}</code> },
    { key: "label", label: T.colWhat },
    { key: "why", label: T.colWhy, cellClassName: "csv-guide-reason" },
    { key: "required", label: T.colRequired, align: "center", fmt: (value) => value ? "✅" : "—" },
  ];

  return (
    <div className="csv-guide">
      <div className="csv-guide-summary">
        <div className="csv-guide-line">
          <span className="csv-guide-when">{guide.when}</span>
          {reqCols && <span className="csv-guide-need">{T.need}{reqCols}</span>}
        </div>
        <button type="button" className="csv-guide-btn" onClick={() => setOpen(true)}>
          {T.openBtn}
        </button>
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
          <section className="csv-guide-section csv-guide-section--purpose">
            <h4>{T.whenHeading}</h4>
            <p>{guide.when}</p>
            {guide.grain && <p className="csv-guide-grain">📄 {guide.grain}</p>}
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
