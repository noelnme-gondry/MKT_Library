"use client";
import { useEffect, useId, useMemo, useState } from "react";
import CsvUploader from "@/components/CsvUploader";
import ToolPageShell from "@/components/ToolPageShell";
import ResultActionCard from "@/components/ds/ResultActionCard";
import DataTable from "@/components/ds/DataTable";
import DownloadHub from "@/components/ds/DownloadHub";
import { useAppStore } from "@/store/useDataStore";
import { isDemoData } from "@/lib/dataOrigin";
import { ADVANCED_BY_ID, advancedDefaults, localized } from "@/lib/advanced-marketing/registry";
import { advancedDemoOptions } from "@/lib/advanced-marketing/demo";
import { projectAdvancedRows } from "@/lib/advanced-marketing/input";
import { advancedErrorText } from "@/lib/advanced-marketing/errors";
import { ADVANCED_FIELDS } from "@/lib/advanced-marketing/fields";
import { fmtNum, fmtPct, fmtCurrency } from "@/utils/format";
import { csvBody, downloadCsv } from "@/utils/download";
import AdvancedFigure from "./advanced-marketing/AdvancedFigure";

export function formatAdvanced(value, type, currency, locale) {
  if (type === "text") return String(localized(value, locale) ?? "");
  if (!Number.isFinite(value)) return locale === "en" ? "Not computable" : "계산 불가";
  if (type === "rate") return fmtPct(value, 2);
  if (type === "money") return ["KRW", "USD"].includes(currency) ? fmtCurrency(value, { currency, precise: true }) : `${currency} ${fmtNum(value, 2)}`;
  return fmtNum(value, type === "integer" ? 0 : 3);
}
function ResultTable({ data, locale, currency }) {
  const [limit, setLimit] = useState(50), id = useId();
  const en = locale === "en";
  return <section className="block advanced-table" aria-labelledby={id}>
    <h2 id={id} className="section-title">{localized(data.title, locale)}</h2>
    <DataTable columns={data.columns.map((column) => ({ key: column.key, label: localized(column.label, locale),
      align: column.type === "text" ? "left" : "right", fmt: (value) => formatAdvanced(value, column.type, currency, locale) }))}
      rows={data.rows.slice(0, limit)} rowKey={(_, index) => index} ariaLabel={localized(data.title, locale)}
      emptyText={en ? "No rows meet the declared conditions." : "지정 조건을 충족하는 행이 없습니다."} />
    {data.rows.length > 50 && <p>{en ? "Displayed" : "표시"} {fmtNum(Math.min(limit, data.rows.length))} / {fmtNum(data.rows.length)}
      {data.rows.length > limit && <button className="btn ghost" type="button" onClick={() => setLimit((value) => value + 100)}>{en ? "Show 100 more" : "100개 더 보기"}</button>}</p>}
  </section>;
}

export default function AdvancedMarketingAnalysis({ toolId, locale = "ko" }) {
  const spec = ADVANCED_BY_ID[toolId], en = locale === "en", t = (value) => localized(value, locale), uid = useId();
  const csvData = useAppStore((state) => state.csvData), analyzed = useAppStore((state) => state.isGroupAnalyzed(toolId));
  const displayCurrency = useAppStore((state) => state.displayCurrency);
  const setDisplayCurrency = useAppStore((state) => state.setDisplayCurrency);
  const demo = isDemoData(csvData);
  const initialConfig = () => ({ raw: csvData?.raw, values: demo ? advancedDemoOptions(toolId) : advancedDefaults(toolId), dirty: false, epoch: 0, cancelled: false });
  const [config, setConfig] = useState(initialConfig);
  // A different raw file is a new study: do not carry randomization/design
  // attestations from a demo or a previous user's dataset into this upload.
  if (config.raw !== csvData?.raw) setConfig(initialConfig());
  const [response, setResponse] = useState(null);
  const job = useMemo(() => ({ csvData, values: config.values, epoch: config.epoch, toolId }), [csvData, config.values, config.epoch, toolId]);
  const enabled = analyzed && !config.dirty && !config.cancelled && config.raw === csvData?.raw;
  const current = enabled && response?.job === job ? response : null;
  const report = current?.report, error = current?.error, running = enabled && !current;
  useEffect(() => {
    if (!enabled) return;
    let worker, active = true;
    try {
      worker = new Worker(new URL("../../lib/advanced-marketing/analysis.worker.js", import.meta.url), { type: "module" });
      worker.onmessage = ({ data }) => { if (active) setResponse({ job, ...data }); };
      worker.onerror = () => { if (active) setResponse({ job, error: { code: "calculation_failed" } }); worker.terminate(); };
      worker.postMessage({ requestId: job.epoch, toolId, rows: projectAdvancedRows(job.csvData, toolId), options: job.values });
    } catch {
      // Async completion follows the same lifecycle as a worker error.
      queueMicrotask(() => { if (active) setResponse({ job, error: { code: "worker_unavailable" } }); });
    }
    return () => { active = false; worker?.terminate(); };
  }, [enabled, job, toolId]);
  const run = () => setConfig((previous) => ({ ...previous, dirty: false, cancelled: false, epoch: previous.epoch + 1 }));
  const change = (key, value) => setConfig((previous) => ({ ...previous, values: { ...previous.values, [key]: value }, dirty: true, cancelled: false }));
  const currency = report?.diagnostics.currency || displayCurrency || "KRW";
  const metricText = (metric) => formatAdvanced(metric.value, metric.type, currency, locale);
  const downloadTable = (data) => downloadCsv(csvBody(data.columns.map((column) => t(column.label)), data.rows.map((row) => data.columns.map((column) => {
    const value = row[column.key];
    return column.type === "text" ? t(value) : Number.isFinite(value) ? value : "";
  }))), `${spec.key}-${data.id}`);
  return <ToolPageShell toolId={toolId} locale={locale} title={t(spec.name)} summary={<p>{t(spec.answer)}</p>}>
    <div className="advanced-analysis" data-tool-id={toolId}>
      {report && <div data-advanced-result="ready"><ResultActionCard toolId={toolId} locale={locale} analysisType={spec.key}
        analysisKey={`advanced-${config.epoch}`} resultState="ready" headline={t(report.headline)} tone="neutral"
        points={[{ text: t(report.action) }, { text: t(report.method) }]}
        stats={report.metrics.map((metric) => ({ label: t(metric.label), value: metricText(metric),
          detail: metric.low !== null && metric.high !== null
            ? `95%: ${formatAdvanced(metric.low, metric.type, currency, locale)} ~ ${formatAdvanced(metric.high, metric.type, currency, locale)}` : undefined }))}
        coreFigure={<AdvancedFigure report={report} locale={locale} />}
        decisionPrefill={{ conclusion: t(report.headline), action: t(report.action), metric: t(spec.goal), goalMetric: `rerun:${spec.key}`, goalDirection: spec.direction }}
        resultScope={{ currency, observationEnd: config.values.observationEnd || undefined }}
        workbookExport={() => ({ calculationMode: "hybrid_engine_output",
          calculationTables: [...report.tables.map((data, i) => ({ name: `ADVANCED_${i + 1}`, title: t(data.title),
            note: t(report.method), rows: [data.columns.map((column) => t(column.label)), ...data.rows.map((row) => data.columns.map((column) => {
              const value = row[column.key]; return column.type === "text" ? t(value) : Number.isFinite(value) ? value : "not_computable";
            }))] })), { name: "ANALYSIS_SETTINGS", title: en ? "Declared settings" : "분석 설정",
            rows: [[en ? "Setting" : "설정", en ? "Value" : "값"], ...spec.options.map(option => [t(option.label), String(config.values[option.key])])] }],
          method: { name: t(spec.name), version: "advanced-marketing-v1", limitations: [t(spec.limit), ...report.warnings.map(t)] },
        })}
        download={<DownloadHub toolId={toolId} locale={locale} label={en ? "Get results" : "결과 받기"} items={report.tables.map((data) => ({ icon: "↓", analyticsType: "csv",
          label: `${t(data.title)} (CSV)`, desc: en ? "All result rows; missing estimates remain blank" : "전체 결과 행 · 계산 불가 값은 빈 칸", onSelect: () => downloadTable(data) }))} />}
      /></div>}
      {running && <section className="block advanced-status" role="status" aria-live="polite">
        <h2 className="section-title">{en ? "Analyzing in your browser…" : "브라우저에서 분석 중…"}</h2>
        <p>{en ? "Input stays on this device. You can cancel the calculation." : "입력은 이 기기 안에서 처리합니다. 계산을 취소할 수 있습니다."}</p>
        <button type="button" className="btn ghost" onClick={() => setConfig((state) => ({ ...state, cancelled: true }))}>{en ? "Cancel calculation" : "계산 취소"}</button>
      </section>}
      {error && <section className="block advanced-error" role="alert" data-advanced-result="blocked">
        <h2 className="section-title">{en ? "Check the input before estimating" : "추정 전에 입력 확인이 필요합니다"}</h2><p>{advancedErrorText(error, locale)}</p>
        {error.context?.field && <p>{en ? "Field" : "필드"}: {en ? ADVANCED_FIELDS[error.context.field]?.labelEn || error.context.field : ADVANCED_FIELDS[error.context.field]?.label || error.context.field}</p>}
        {error.context?.row && <p>{en ? "CSV row (including header)" : "CSV 행 (헤더 포함)"}: {fmtNum(error.context.row)}</p>}
      </section>}
      {(config.dirty || config.cancelled) && <p role="status">{config.cancelled ? (en ? "Calculation cancelled. No result was saved." : "계산을 취소했습니다. 결과는 저장되지 않았습니다.")
        : (en ? "Settings changed. Apply them to rerun the analysis." : "설정이 바뀌었습니다. 적용 후 다시 분석하세요.")}</p>}
      <details className="block advanced-settings" open={!report}>
        <summary>{en ? "Study settings and input conditions" : "분석 설정과 입력 조건"}</summary>
        <p>{t(spec.grain)} · {t(spec.need)}</p>
        <form onSubmit={(event) => { event.preventDefault(); if (analyzed) run(); }}>
          <div className="advanced-settings__grid">
            {spec.options.map((option) => <label key={option.key} className={option.type === "checkbox" ? "advanced-setting is-check" : "advanced-setting"} htmlFor={`${uid}-${option.key}`}>
              <span>{t(option.label)}</span>
              {option.type === "textarea" ? <textarea id={`${uid}-${option.key}`} rows={3} value={config.values[option.key]} onChange={(event) => change(option.key, event.target.value)} />
                : option.type === "select" ? <select id={`${uid}-${option.key}`} value={config.values[option.key]} onChange={(event) => change(option.key, event.target.value)}>{option.choices.map((choice) => <option key={choice.value} value={choice.value}>{t(choice.label)}</option>)}</select>
                  : <input id={`${uid}-${option.key}`} type={option.type} min={option.min} max={option.max} step={option.step ?? (option.type === "number" ? "any" : undefined)}
                    checked={option.type === "checkbox" ? Boolean(config.values[option.key]) : undefined} value={option.type === "checkbox" ? undefined : config.values[option.key]}
                    onChange={(event) => change(option.key, option.type === "checkbox" ? event.target.checked : event.target.value)} />}
            </label>)}
            {toolId === "5-37" && <label className="advanced-setting" data-currency-scope="declare" htmlFor={`${uid}-currency`}><span>{en ? "Value unit (no conversion)" : "금액 단위 (환산 없음)"}</span>
              <select id={`${uid}-currency`} value={displayCurrency} onChange={(event) => setDisplayCurrency(event.target.value)}><option value="KRW">KRW</option><option value="USD">USD</option></select></label>}
          </div>
          {analyzed && <button type="submit" className="ab-button" disabled={running}>{en ? "Apply settings and analyze" : "설정 적용 후 분석"}</button>}
          <p className="text-muted">{t(spec.limit)}</p>
        </form>
      </details>
      <CsvUploader toolId={toolId} locale={locale} onAnalyzed={run} />
      {report && <>
        <section className="block"><h2 className="section-title">{en ? "Interpretation and follow-up" : "해석과 다음 확인"}</h2>
          {report.warnings.map((warning, i) => <p key={i}>{t(warning)}</p>)}
          <p>{en ? "This tool requires rerunning with new data for a decision review. Efficiency-snapshot guardrails are not available for this data unit." : "결정 검토 시 새 데이터로 이 도구를 다시 실행해야 합니다. 이 데이터 단위에는 효율 스냅샷 자동 가드레일을 제공하지 않습니다."}</p>
          <p>{en ? "Currency, when supplied" : "통화 입력 시 원본 단위"}: {currency} · {en ? "No exchange-rate conversion" : "환율 변환 없음"}</p>
        </section>
        {report.tables.map((data) => <ResultTable key={`${toolId}-${config.epoch}-${data.id}`} data={data} locale={locale} currency={currency} />)}
      </>}
      <details className="block"><summary>{en ? "Primary references" : "원문 참고 자료"}</summary><ul>{spec.refs.map((reference) => <li key={reference.url}><a href={reference.url} target="_blank" rel="noreferrer">{reference.title}</a></li>)}</ul></details>
    </div>
  </ToolPageShell>;
}
