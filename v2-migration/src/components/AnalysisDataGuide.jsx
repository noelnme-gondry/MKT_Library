"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import DataTable from "@/components/ds/DataTable";
import { downloadFile } from "@/utils/download";
import { fmtNum } from "@/utils/format";
import { analysisDataDetail, dataGuideQuestions, dataGuideTemplateCsv, INCREMENTALITY_METHODS } from "@/lib/analysisDataGuide";
import { exampleHref } from "@/lib/exampleLink";
import { trackProductEvent } from "@/lib/analytics";

export default function AnalysisDataGuide({ locale = "ko" }) {
  const en = locale === "en", tr = (ko, english) => en ? english : ko;
  const prefix = en ? "/en" : "";
  const stages = dataGuideQuestions(locale);
  const [selection, setSelection] = useState({ stage: stages[0].id, tool: stages[0].tools[0].id, method: "suppression" });
  const stage = stages.find(item => item.id === selection.stage);
  const detail = analysisDataDetail(selection.tool, locale, selection.method);
  // 공용 GA의 tool_id는 주간 분석 계열을 합치므로 분석 경로도 고정 범주로 남긴다.
  const track = (name, extra = {}) => trackProductEvent(name, { locale, source: "data_guide", section_id: selection.stage, tool_id: selection.tool, analysis_type: detail.href.split("/").at(-1), ...extra });

  const viewedLocale = useRef(null);
  useEffect(() => {
    if (viewedLocale.current === locale) return;
    viewedLocale.current = locale;
    trackProductEvent("data_guide_viewed", { locale, source: "route" });
  }, [locale]);

  const needColumns = [
    { key: "label", label: tr("준비할 내용", "What to include") },
    { key: "why", label: tr("분석에 쓰이는 곳", "What it is used for") },
    { key: "required", label: tr("구분", "Requirement"), fmt: value => value ? tr("필수", "Required") : tr("추가 분석용", "For additional analysis") },
  ];

  return <div className="analysis-data-guide">
    <header className="analysis-data-guide__intro">
      <h1>{tr("어떤 데이터가 필요한가요?", "What data do you need?")}</h1>
      <p>{tr("보고 싶은 내용을 고르면, 가능한 분석과 파일 준비 방법을 보여드립니다.", "Choose what you want to examine to find the analysis and how to prepare its data.")}</p>
    </header>

    <section className="analysis-data-guide__questions" aria-labelledby="data-guide-question">
      <h2 id="data-guide-question">{tr("보고 싶은 내용은?", "What do you want to examine?")}</h2>
      <div className="analysis-data-guide__question-grid">
        {stages.map(item => <button key={item.id} type="button" aria-pressed={item.id === selection.stage} aria-controls="data-guide-matches" onClick={() => {
          setSelection({ stage: item.id, tool: item.tools[0].id, method: "suppression" });
          trackProductEvent("data_guide_question_selected", { locale, source: "data_guide", section_id: item.id });
        }}><span>{item.question}</span><span aria-hidden="true">{item.id === selection.stage ? "✓" : "→"}</span></button>)}
      </div>
    </section>

    <section className="analysis-data-guide__matches" id="data-guide-matches" aria-labelledby="data-guide-match-title">
      <header><h2 id="data-guide-match-title">{tr("이 질문에 맞는 분석", "Analyses for this question")}</h2><p>{tr("분석을 선택해 필요한 데이터를 확인하세요.", "Choose an analysis to see its data requirements.")}</p></header>
      <div className="analysis-data-guide__tool-grid">
        {stage.tools.map(tool => <button key={tool.id} data-analysis-id={tool.id} type="button" aria-pressed={tool.id === selection.tool} aria-controls="data-guide-detail" onClick={() => {
          setSelection({ ...selection, tool: tool.id, method: "suppression" });
          track("data_guide_analysis_selected", { tool_id: tool.id, analysis_type: tool.href.split("/").at(-1) });
        }}><strong>{tool.name}</strong><span>{tool.question}</span><span className="analysis-data-guide__tool-state">{tool.id === selection.tool ? tr("데이터 안내 보는 중", "Showing data guide") : tr("필요한 데이터 보기", "View data needs")}</span></button>)}
      </div>
    </section>

    <section className="analysis-data-guide__detail" id="data-guide-detail" aria-labelledby="data-guide-detail-title">
      <header className="analysis-data-guide__detail-head"><h2 id="data-guide-detail-title">{detail.name}</h2><p>{detail.dataNeed}</p></header>
      {detail.method && <fieldset className="analysis-data-guide__methods"><legend>{tr("어떤 방식으로 비교하나요?", "How will you compare?")}</legend>
        {INCREMENTALITY_METHODS.map(method => <button key={method.id} type="button" aria-pressed={detail.method === method.id} onClick={() => {
          setSelection({ ...selection, method: method.id });
          track("data_guide_method_selected", { tab_name: method.id });
        }}>{method[locale]}</button>)}
      </fieldset>}
      <dl className="analysis-data-guide__preparation">
        <div><dt>{tr("한 행에 담을 내용", "What one row represents")}</dt><dd>{detail.guide.grain}</dd></div>
        <div><dt>{tr("어디서 가져오나요?", "Where to get it")}</dt><dd>{detail.source}</dd></div>
      </dl>
      <section className="analysis-data-guide__fields" aria-labelledby="data-guide-fields-title">
        <h3 id="data-guide-fields-title">{tr("파일에 들어 있어야 할 내용", "What the file needs to contain")}</h3>
        <DataTable columns={needColumns} rows={detail.guide.needs} rowKey={row => row.col} ariaLabel={tr("필요한 데이터와 쓰임", "Required data and its use")} />
      </section>
      {detail.example.rows.length > 0 && <section className="analysis-data-guide__example" aria-labelledby="data-guide-example-title">
        <header><h3 id="data-guide-example-title">{tr("이렇게 정리하면 됩니다", "How to arrange the file")}</h3><p>{tr("형태를 보여주는 가상 예시입니다. 아래 행 수만으로 분석이 가능한 것은 아닙니다.", "Fictional rows illustrating the layout. The row count shown is not enough to establish analysis eligibility.")}</p></header>
        <DataTable columns={detail.example.columns.map(column => ({ ...column, fmt: column.align === "right" ? value => fmtNum(Number(value), Number.isInteger(Number(value)) ? 0 : 2) : undefined }))} rows={detail.example.rows} ariaLabel={tr("데이터 작성 예시", "Example data layout")} />
      </section>}
      <section className="analysis-data-guide__checks" aria-labelledby="data-guide-checks-title"><h3 id="data-guide-checks-title">{tr("준비할 때 확인하세요", "Check before you export")}</h3>
        <ul>{detail.guide.prep.map(item => <li key={item}>{item}</li>)}</ul>
      </section>
      <footer className="analysis-data-guide__actions">
        <nav aria-label={tr("데이터 준비 후 다음 행동", "Next steps after preparing data")}>
          <button type="button" className="btn primary" onClick={() => {
            downloadFile(new Blob([dataGuideTemplateCsv(detail)], { type: "text/csv;charset=utf-8" }), `template_${detail.href.split("/").at(-1)}${detail.method ? `_${detail.method}` : ""}.csv`);
            track("data_guide_template_downloaded", { download_type: "csv", tab_name: detail.method || undefined });
          }}>{tr("빈 CSV 양식 받기", "Download blank CSV")}</button>
          <Link className="btn ghost" href={`${exampleHref(detail.id, locale)}${detail.method ? `&method=${detail.method}` : ""}`} onClick={() => track("data_guide_demo_clicked", { tab_name: detail.method || undefined })}>{tr("분석 데모 보기", "View analysis demo")}</Link>
          <Link className="btn ghost" href={`${prefix}${detail.href}${detail.method ? `?method=${detail.method}` : ""}`} onClick={() => track("data_guide_tool_clicked", { tab_name: detail.method || undefined })}>{tr("내 데이터로 분석하기", "Analyze my data")}</Link>
          {detail.template && <Link href={`${prefix}/templates/${detail.template.slug}`} onClick={() => track("data_guide_columns_clicked")}>{tr("컬럼명·전체 양식 확인", "Column names and full template")}</Link>}
        </nav>
        <p>{tr("기존 파일의 컬럼명을 그대로 두어도 됩니다. 업로드 뒤 날짜·광고비 등 각 항목에 연결하세요.", "You can keep your existing column names. Map each to its role, such as date or spend, after uploading.")}</p>
      </footer>
    </section>
  </div>;
}
