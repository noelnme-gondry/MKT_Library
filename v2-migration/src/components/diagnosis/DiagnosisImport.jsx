"use client";

import { useEffect, useSyncExternalStore, useEffectEvent, useMemo, useRef, useState } from "react";
import { ArrowUpFromLine, ChartNoAxesCombined, FileDown } from "lucide-react";
import { csvImportErrorMessage } from "@/lib/data-import/csvImportPolicy";
import {
  DIAGNOSIS_CURRENCIES, DIAGNOSIS_FIELDS, DIAGNOSIS_SAMPLE_URL, diagnosisScopeValues, loadDiagnosisExample, mapDiagnosisData,
  readDiagnosisFile, suggestedGrain,
} from "@/lib/diagnosisImport";
import { trackDiagnosis } from "@/lib/trackDiagnosis";
import styles from "./DiagnosisImport.module.css";

const subscribeToMount = () => () => {};
const mounted = () => true;
const server = () => false;
const primaryFields = DIAGNOSIS_FIELDS.slice(0, 5);
const optionalFields = DIAGNOSIS_FIELDS.slice(5);

export default function DiagnosisImport({ locale = "ko", initialExample = false, restored, onData, onReset }) {
  const interactive = useSyncExternalStore(subscribeToMount, mounted, server);
  const en = locale === "en";
  const t = (ko, english) => en ? english : ko;
  const input = useRef(null);
  const generation = useRef(0);
  const [data, setData] = useState(restored?.data ?? null);
  const [mapping, setMapping] = useState(restored?.mapping ?? {});
  const [grain, setGrain] = useState(restored?.grain ?? "daily");
  const [currency, setCurrency] = useState(restored?.currency ?? "");
  const [market, setMarket] = useState(restored?.market ?? "");
  const [platform, setPlatform] = useState(restored?.platform ?? "");
  const markets = useMemo(() => diagnosisScopeValues(data, mapping, "market"), [data, mapping]);
  const platforms = useMemo(() => diagnosisScopeValues(data, mapping, "platform", market), [data, mapping, market]);
  const [target, setTarget] = useState(restored?.target ?? "");
  const [exclusive, setExclusive] = useState(restored?.exclusive ?? false);
  const [active, setActive] = useState(restored?.active ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function accept(result) {
    setActive({ count: result.rows.length, ...result.meta });
    setError("");
    trackDiagnosis("mapping_success", result.meta.source === "example" ? "demo" : "upload", locale);
    onData(result.rows, result.meta, {
      data: result.meta.source === "example" ? null : data, mapping, grain, currency,
      market, platform, target, exclusive, active: {count:result.rows.length,...result.meta},
    });
  }

  function reset() {
    generation.current++;
    setActive(null);
    setData(null);
    setError("");
    setBusy(false);
    onReset?.();
  }

  async function showExample() {
    const ticket = ++generation.current;
    setError("");
    setBusy(true);
    try {
      const result = await loadDiagnosisExample(locale);
      if (ticket !== generation.current) return;
      setData(null);
      trackDiagnosis("example_open", "demo", locale);
      accept(result);
    } catch (e) {
      if (ticket === generation.current) setError(e.message);
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  }
  const initialLoad = useEffectEvent(showExample);
  useEffect(() => {
    const state = generation;
    const ticket = state.current;
    if (initialExample) queueMicrotask(() => { if (generation.current === ticket) initialLoad(); });
    return () => { state.current += 1; };
  }, [initialExample]);

  async function pickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const ticket = ++generation.current;
    setBusy(true);
    setError("");
    trackDiagnosis("file_selected", "upload", locale);
    try {
      const parsed = await readDiagnosisFile(file, locale);
      if (ticket !== generation.current) return;
      setActive(null);
      setData(parsed);
      setMapping(parsed.mapping);
      setGrain(suggestedGrain(parsed));
      setCurrency("");
      setMarket("");
      setPlatform("");
      setTarget("");
      setExclusive(false);
      onReset?.();
    } catch (e) {
      if (ticket === generation.current) setError(e.code ? csvImportErrorMessage(e.code, locale) : e.message);
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    try {
      accept(mapDiagnosisData(data, mapping, {
        locale, grain, currency, market, platform, targetCpa: target === "" ? null : Number(target), organicExclusive: Boolean(mapping.organic && exclusive),
      }));
    } catch (e) {
      setError(e.message);
    }
  }

  function selectField(field) {
    const isRequired = ["date", "cost", "result"].includes(field.key);
    return <label key={field.key}>{en ? field.en : field.ko}
      <select value={mapping[field.key] || ""} required={isRequired}
        onChange={(e) => {
          if (field.key === "market") { setMarket(""); setPlatform(""); }
          if (field.key === "platform") setPlatform("");
          setMapping({ ...mapping, [field.key]: e.target.value });
        }}>
        <option value="">{isRequired ? t("열 선택", "Choose a column") : t("연결 안 함", "Not mapped")}</option>
        {data.headers.map((header) => <option key={header}>{header}</option>)}
      </select>
    </label>;
  }

  function scopeText(values, fieldName) {
    if (!values?.length || (values.length === 1 && !values[0])) return en ? `${fieldName} unspecified` : `${fieldName} 미지정`;
    if (values.length === 1) return `${fieldName} · ${values[0]}`;
    const missing = values.includes("") ? t(" (미지정 포함)", " (includes unspecified)") : "";
    return en ? `${fieldName} · ${values.length} groups${missing}` : `${fieldName} ${values.length}개 범위${missing}`;
  }

  return <div className={styles.intake} aria-busy={busy}>
    <input ref={input} type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={pickFile}
      aria-label={t("진단할 CSV 파일", "CSV file to diagnose")} hidden />
    {active ? <div className={styles.strip}>
      <p><strong>{active.source === "example" ? t("예시 데이터", "Example data") : t("내 CSV", "Your CSV")}</strong>
        <span>{active.count.toLocaleString(en ? "en-US" : "ko-KR")}{t("행", " rows")} · {active.grain === "weekly" ? t("주별", "Weekly") : t("일별", "Daily")} · {active.resultLabel}{active.currency && ` · ${active.currency}`}</span></p>
      {active.scope && <span className={styles.scope}>{scopeText(active.scope.markets, t("시장", "Market"))} · {scopeText(active.scope.platforms, t("플랫폼", "Platform"))}
        {active.scope.fileRows !== active.scope.selectedRows && (en ? ` · ${active.scope.selectedRows} of ${active.scope.fileRows} rows selected` : ` · 원본 ${active.scope.fileRows}행 중 ${active.scope.selectedRows}행 선택`)}
      </span>}
      {data && <button type="button" onClick={() => { setActive(null); onReset?.(); }}>{t("열 연결 수정", "Edit mapping")}</button>}
      <button type="button" onClick={() => input.current?.click()}>{t("CSV 변경", "Change CSV")}</button>
      <button type="button" onClick={reset}>{t("처음으로", "Start over")}</button>
    </div> : data ? <form className={styles.mapping} onSubmit={submit}>
      <div className={styles.mappingHead}><h2>{t("어떤 성과를 비교할까요?", "Which outcome should we compare?")}</h2>
        <button type="button" onClick={reset}>{t("취소", "Cancel")}</button></div>
      <p>{t(`${data.records.length.toLocaleString()}행을 읽었습니다. 같은 단위의 성과 한 가지와 채널 또는 캠페인을 골라 주세요.`, `Read ${data.records.length.toLocaleString()} rows. Choose one consistent outcome and a channel or campaign.`)}</p>
      <div className={styles.grid}>{primaryFields.map(selectField)}
        <label>{t("집계 단위", "Row frequency")}
          <select value={grain} onChange={(e) => setGrain(e.target.value)}>
            <option value="daily">{t("일별", "Daily")}</option><option value="weekly">{t("주별 합계 (주 시작일)", "Weekly totals (week start)")}</option>
          </select>
        </label></div>
      {(markets.length > 1 || platforms.length > 1 || market || platform) && <fieldset className={styles.filter}>
        <legend>{t("어느 시장과 플랫폼을 비교할까요?", "Which market and platform should we compare?")}</legend>
        <div className={styles.grid}>
          {markets.length > 0 && <label>{t("분석할 시장", "Market scope")}
            <select value={market} onChange={e => { setMarket(e.target.value); setPlatform(""); }}>
              <option value="">{t("전체 시장", "All markets")}</option>
              {markets.filter(Boolean).map(value => <option key={value}>{value}</option>)}
            </select></label>}
          {platforms.length > 0 && <label>{t("분석할 플랫폼", "Platform scope")}
            <select value={platform} onChange={e => setPlatform(e.target.value)}>
              <option value="">{t("전체 플랫폼", "All platforms")}</option>
              {platforms.filter(Boolean).map(value => <option key={value}>{value}</option>)}
            </select></label>}
        </div>
        <p>{t("오가닉과 매체 간 성과는 같은 시장·플랫폼에서 비교합니다.", "Organic and cross-channel performance are compared within the same market and platform.")}</p>
      </fieldset>}
      <details className={styles.additional}><summary>{t("통화·목표 CPA와 추가 분석 열", "Currency, target CPA and optional columns")}</summary>
        <div className={styles.grid}>
          <label>{t("금액 단위", "Currency")}
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="">{t("파일에 지정된 단위", "As specified in the file")}</option>
              {DIAGNOSIS_CURRENCIES.map((code) => <option key={code}>{code}</option>)}
            </select></label>
          <label>{t("목표 CPA (선택)", "Target CPA (optional)")}<input type="number" min="0" step="any" value={target} onChange={(e) => setTarget(e.target.value)} /></label>
          {optionalFields.map(selectField)}
        </div>
        {mapping.organic && <label className={styles.check}><input type="checkbox" checked={exclusive} onChange={(e) => setExclusive(e.target.checked)} />
          {t("오가닉 열은 같은 시장·기간의 유료 성과와 중복되지 않는 성과 건수입니다.", "Organic outcomes exclude paid outcomes for the same market and period.")}</label>}
      </details>
      <button className={styles.primary} type="submit">{t("이 열로 진단하기", "Diagnose this CSV")}</button>
    </form> : <>
      <div className={styles.buttons}>
        <button className={styles.primary} type="button" disabled={busy || !interactive} onClick={() => input.current?.click()}><ArrowUpFromLine aria-hidden size={17} />{t("내 CSV로 진단하기", "Diagnose my CSV")}</button>
        <button className={styles.secondary} type="button" disabled={busy || !interactive} onClick={showExample}><ChartNoAxesCombined aria-hidden size={17} />{t("예시로 먼저 보기", "Try an example")}</button>
      </div>
      <p className={styles.privacy}>{t("내 파일은 이 브라우저에서만 읽습니다.", "Your file stays in this browser.")} <a href={DIAGNOSIS_SAMPLE_URL} download><FileDown aria-hidden size={14} />{t("예시 CSV 받기", "Download example CSV")}</a></p>
    </>}
    {busy && <p role="status">{t("데이터를 읽고 있습니다…", "Reading data…")}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </div>;
}
