"use client";

import Link from "next/link";
import { useState } from "react";
import DataTable from "@/components/ds/DataTable";
import { downloadFile } from "@/utils/download";
import { fmtNum } from "@/utils/format";
import { analysisDataDetail, dataGuideTemplateCsv, INCREMENTALITY_METHODS } from "@/lib/analysisDataGuide";
import { trackProductEvent } from "@/lib/analytics";

/**
 * 분석 하나의 "준비 방법" — 예전 /data-guide 상세를 분석 찾기 카드의 창으로 옮긴 것.
 * 한 행에 담을 내용 · 어디서 가져오나 · 들어 있어야 할 값과 쓰임 · 정리 예시 ·
 * 확인할 점 · 빈 양식. 내용은 그대로 두고 자리만 옮겼다(product-ssot §1.1c 결정 1).
 */
export default function AnalysisDataPrep({ toolId, locale = "ko", headingId, exampleHref = null, toolHref = null }) {
  const en = locale === "en";
  const tr = (ko, english) => (en ? english : ko);
  const prefix = en ? "/en" : "";
  const [method, setMethod] = useState("suppression");
  const detail = analysisDataDetail(toolId, locale, method);
  if (!detail) return null;
  const track = (name, extra = {}) => trackProductEvent(name, { locale, source: "analysis_finder", tool_id: toolId, analysis_type: detail.href.split("/").at(-1), ...extra });
  const needColumns = [
    { key: "label", label: tr("준비할 내용", "What to include") },
    { key: "why", label: tr("분석에 쓰이는 곳", "What it is used for") },
    { key: "required", label: tr("구분", "Requirement"), fmt: (value) => (value ? tr("필수", "Required") : tr("추가 분석용", "For additional analysis")) },
  ];
  return (
    <div className="analysis-data-prep">
      <p className="analysis-data-prep__need" id={headingId ? `${headingId}-desc` : undefined}>{detail.dataNeed}</p>
      {detail.method && (
        <fieldset className="analysis-data-guide__methods">
          <legend>{tr("어떤 방식으로 비교하나요?", "How will you compare?")}</legend>
          {INCREMENTALITY_METHODS.map((item) => (
            <button key={item.id} type="button" aria-pressed={detail.method === item.id} onClick={() => { setMethod(item.id); track("data_guide_method_selected", { tab_name: item.id }); }}>{item[locale] || item.ko}</button>
          ))}
        </fieldset>
      )}
      <dl className="analysis-data-guide__preparation">
        <div><dt>{tr("한 행에 담을 내용", "What one row represents")}</dt><dd>{detail.guide.grain}</dd></div>
        <div><dt>{tr("어디서 가져오나요?", "Where to get it")}</dt><dd>{detail.source}</dd></div>
      </dl>
      <section className="analysis-data-guide__fields" aria-label={tr("파일에 들어 있어야 할 내용", "What the file needs to contain")}>
        <h3>{tr("파일에 들어 있어야 할 내용", "What the file needs to contain")}</h3>
        <DataTable columns={needColumns} rows={detail.guide.needs} rowKey={(row) => row.col} ariaLabel={tr("필요한 데이터와 쓰임", "Required data and its use")} />
      </section>
      {detail.example.rows.length > 0 && (
        <section className="analysis-data-guide__example" aria-label={tr("이렇게 정리하면 됩니다", "How to arrange the file")}>
          <h3>{tr("이렇게 정리하면 됩니다", "How to arrange the file")}</h3>
          <p>{tr("형태를 보여주는 가상 예시입니다. 아래 행 수만으로 분석이 가능한 것은 아닙니다.", "Fictional rows illustrating the layout. The row count shown is not enough to establish analysis eligibility.")}</p>
          <DataTable columns={detail.example.columns.map((column) => ({ ...column, fmt: column.align === "right" ? (value) => fmtNum(Number(value), Number.isInteger(Number(value)) ? 0 : 2) : undefined }))} rows={detail.example.rows} ariaLabel={tr("데이터 작성 예시", "Example data layout")} />
        </section>
      )}
      <section className="analysis-data-guide__checks" aria-label={tr("준비할 때 확인하세요", "Check before you export")}>
        <h3>{tr("준비할 때 확인하세요", "Check before you export")}</h3>
        <ul>{detail.guide.prep.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <footer className="analysis-data-guide__actions">
        <nav aria-label={tr("데이터 준비 후 다음 행동", "Next steps after preparing data")}>
          <button type="button" className="btn secondary" onClick={() => {
            downloadFile(new Blob([dataGuideTemplateCsv(detail)], { type: "text/csv;charset=utf-8" }), `template_${detail.href.split("/").at(-1)}${detail.method ? `_${detail.method}` : ""}.csv`);
            track("data_guide_template_downloaded", { download_type: "csv", tab_name: detail.method || undefined });
          }}>{tr("빈 CSV 양식 받기", "Download blank CSV")}</button>
          {detail.template && <Link href={`${prefix}/templates/${detail.template.slug}`} onClick={() => track("data_guide_columns_clicked")}>{tr("컬럼명·전체 양식 확인", "Column names and full template")}</Link>}
        </nav>
        <p>{tr("기존 파일의 컬럼명을 그대로 두어도 됩니다. 업로드 뒤 날짜·광고비 등 각 항목에 연결하세요.", "You can keep your existing column names. Map each to its role, such as date or spend, after uploading.")}</p>
      </footer>
      {/* 비교 방식(5-23)을 골랐으면 예시와 도구도 그 방식으로 연다 — 고른 양식과 도구 입력이 어긋나지 않게. */}
      {(exampleHref || toolHref) && (
        <nav className="finder-prep-dialog__next" aria-label={tr("다음", "Next")}>
          {exampleHref && <Link className="btn secondary" href={`${exampleHref}${detail.method ? `&method=${detail.method}` : ""}`} onClick={() => track("data_guide_demo_clicked", { tab_name: detail.method || undefined })}>{tr("예시 보고서 보기", "View example report")}</Link>}
          {toolHref && <Link className="btn primary" href={`${toolHref}${detail.method ? `?method=${detail.method}` : ""}`} onClick={() => track("data_guide_tool_clicked", { tab_name: detail.method || undefined })}>{tr("내 파일로 하기", "Use my file")}</Link>}
        </nav>
      )}
    </div>
  );
}
