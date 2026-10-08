"use client";
import React, { useId, useRef, useState } from "react";
import Papa from "papaparse";
import CsvGuide from "@/components/ds/CsvGuide";
import ModalDialog from "@/components/ds/ModalDialog";
import { useAppStore } from "@/store/useDataStore";
import { buildToolDemo } from "@/lib/toolDemo";
import { guessReportMapping, missingReportFields } from "@/lib/attributionReports/fields";
import { prepareCsvParseInput } from "@/lib/data-import/csvParseInput";
import { csvImportErrorMessage } from "@/lib/data-import/csvImportPolicy";
import { fmtNum } from "@/utils/format";
import { TOOL_GROUP } from "@/lib/toolGroups";
import { trackProductEvent } from "@/lib/analytics";
import { useClientReady } from "@/lib/useClientReady";
export default function ReportCsvInput({ toolId, fields, locale = "ko", validate = () => true, onAnalyze = null }) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  const csv = useAppStore(state => state.csvData), analyzed = useAppStore(state => state.isGroupAnalyzed(toolId));
  const hydrated = useClientReady();
  const routeReady = useAppStore(state => state.currentRouteId === toolId && !state.projectSwitching && (state.decisionPersistenceEnabled !== true || state.projectsReady || Boolean(state.projectError)));
  const ready = hydrated && routeReady;
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [editing, setEditing] = useState(false);
  const request = useRef(0), inputId = useId(), returnFocus = useRef(null);
  const missing = missingReportFields(csv?.mapping, fields);
  const hasRows = Boolean(csv?.raw?.length), valid = hasRows && !missing.length && validate(csv);
  const runExample = () => {
    request.current++; setBusy(false); setError("");
    const store = useAppStore.getState();
    store.setCsvData(buildToolDemo(toolId, locale)); store.setGroupAnalyzed(toolId);
  };
  const read = async file => {
    if (!file) return;
    const id = ++request.current, projectId = useAppStore.getState().activeProjectId;
    setBusy(true); setError("");
    trackProductEvent("data_import_start", { tool_id: toolId, source: "csv", locale });
    const fail = message => { if (request.current === id) { setError(message); setBusy(false); } };
    try {
      const data = await prepareCsvParseInput(file);
      Papa.parse(data, { header: true, skipEmptyLines: true, worker: true, dynamicTyping: false,
        complete(parsed) {
          if (request.current !== id || useAppStore.getState().currentRouteId !== toolId || useAppStore.getState().activeProjectId !== projectId) return;
          if (!parsed.data?.length || parsed.errors?.length) { fail(tr("CSV 형식 오류가 있습니다. 헤더와 따옴표를 확인하세요.", "The CSV has format errors. Check its headers and quotes.")); return; }
          const headers = parsed.meta.fields || [], mapping = guessReportMapping(headers, fields, parsed.data);
          // Filename + length can repeat across different exports. A fresh real
          // upload must not inherit the previous dataset's confirmed gate.
          useAppStore.setState(state => ({ analyzedByGroup: { ...state.analyzedByGroup, [TOOL_GROUP[toolId]]: null } }));
          useAppStore.getState().setCsvData({ raw: parsed.data, headers, mapping, fileName: file.name, importSource: "csv", workspaceSource: { blob: file.slice(), kind: "csv", originalFileName: file.name } }, projectId);
          trackProductEvent("data_import_success", { tool_id: toolId, source: "csv", locale, column_count: headers.length, row_count: parsed.data.length });
          setBusy(false);
        },
        error() { fail(tr("파일을 읽지 못했습니다.", "Could not read the file.")); },
      });
    } catch (problem) { fail(csvImportErrorMessage(problem.code, locale)); }
  };
  const mappingKeys = Object.values(csv?.mapping || {});
  return <section className="block report-input" aria-label={tr("데이터 준비", "Data preparation")}>
    <CsvGuide toolId={toolId} locale={locale} onTryExample={runExample} />
    <div className="report-input__actions">
      <label className="btn ghost" htmlFor={inputId}>{busy ? tr("CSV 읽는 중…", "Reading CSV…") : hasRows ? tr("다른 CSV 선택", "Choose another CSV") : tr("CSV 선택", "Choose CSV")}</label>
      <input id={inputId} className="sr-only" type="file" accept=".csv,text/csv" disabled={!ready} onChange={e => { read(e.target.files?.[0]); e.target.value = ""; }} />
      {hasRows && <><span>{csv.fileName} · {fmtNum(csv.raw.length)}{tr("행", " rows")}</span><button ref={returnFocus} className="btn ghost" type="button" onClick={() => setEditing(true)}>{tr("컬럼 확인·수정", "Review columns")}</button></>}
      {hasRows && <button className="btn primary" type="button" disabled={!valid || busy} onClick={() => { trackProductEvent("analysis_started", { tool_id: toolId, source: "csv", locale }); useAppStore.getState().setGroupAnalyzed(toolId); onAnalyze?.(); }}>{analyzed ? tr("다시 분석", "Analyze again") : tr("데이터 분석하기", "Analyze data")}</button>}
    </div>
    {error && <p role="alert">{error}</p>}
    {hasRows && !valid && <p role="status">{tr("필수 컬럼을 확인하세요: ", "Check required columns: ")}{missing.map(key => fields[key][locale === "en" ? "labelEn" : "label"]).join(" · ")}{!validate(csv) && tr(" · 날짜 또는 ISO 연도+주차", " · date or ISO year + week")}</p>}
    {editing && <ModalDialog open ariaLabel={tr("파일의 열 확인", "Review file columns")} onClose={() => setEditing(false)} returnFocusRef={returnFocus} overlayClassName="csv-guide-overlay" panelClassName="csv-guide-modal">
      <h2>{tr("파일의 열 확인", "Review file columns")}</h2>
      <div className="report-filters">{Object.entries(fields).map(([key, field]) => {
        const header = Object.entries(csv.mapping || {}).find(([, value]) => value === key)?.[0] || "";
        return <label key={key}>{locale === "en" ? field.labelEn : field.label}{field.required ? " *" : ""}<select value={header} onChange={e => {
          const mapping = Object.fromEntries(Object.entries(csv.mapping || {}).filter(([h, value]) => value !== key && h !== e.target.value));
          if (e.target.value) mapping[e.target.value] = key;
          useAppStore.getState().setCsvData({ ...csv, mapping });
        }}><option value="">{tr("사용 안 함", "Not used")}</option>{csv.headers.map(h => <option key={h} value={h} disabled={mappingKeys.includes(csv.mapping[h]) && csv.mapping[h] !== key && Boolean(csv.mapping[h])}>{h}</option>)}</select></label>;
      })}</div>
      <button className="btn primary" onClick={() => setEditing(false)}>{tr("확인", "Done")}</button>
    </ModalDialog>}
  </section>;
}
