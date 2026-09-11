"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { useAppStore } from "@/store/useDataStore";
import { groupForRoute } from "@/lib/toolGroups";
import { idToSlug } from "@/lib/routeMap";
import { blogMapping, blogMappingToolId, descriptiveBlogResult, runBlogAdapter, strictMetric } from "@/lib/blogInsightRunner";
import { STANDARD_FIELDS, TOOL_REQUIRED_FIELDS, TOOL_OPTIONAL_FIELDS } from "@/utils/csvConstants";
import { FUNNEL_MATH } from "@/utils/funnelMath";
import { trackProductEvent } from "@/lib/analytics";
import BlogInsightChart from "./BlogInsightChart";

export default function BlogCsvAnalysis({ config, slug, locale = "ko" }) {
  const en = locale === "en", id = useId(), router = useRouter();
  const [csv, setCsv] = useState(null), [result, setResult] = useState(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [selection, setSelection] = useState({ category: "", value: "", denominator: "" });
  const [replace, setReplace] = useState(false);
  const task = useRef(0);
  const projectId = useAppStore(state => state.activeProjectId);
  const existing = useAppStore(state => state.csvGroups[groupForRoute(config.toolId)]);
  const needsReplace = Boolean(existing?.raw?.length && csv && existing.raw !== csv.raw);
  const custom = config.type !== "adapter" && config.type !== "funnel";
  const mappingToolId = blogMappingToolId(config.toolId);
  const allowedFields = new Set([...(TOOL_REQUIRED_FIELDS[mappingToolId] || []).flatMap(field => typeof field === "string" ? [field] : field.oneOf || []), ...(TOOL_OPTIONAL_FIELDS[mappingToolId] || []).map(field => field.key)]);
  const hasMoney = csv && Object.values(csv.mapping).some(field => /^(cost|spend|revenue|budget)/.test(field));
  const message = en ? "Check columns and units. Empty, negative, non-numeric and percentage cells cannot be used as counts. For larger or more complex files, open the full analysis." : "열과 단위를 확인해 주세요. 빈칸·음수·문자·백분율 셀은 건수로 계산하지 않습니다. 크거나 복잡한 파일은 상세 분석에서 확인하세요.";
  const upload = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const request = ++task.current;
    setCsv(null); setResult(null); setError(""); setBusy(true); setReplace(false);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("size");
      const parsed = Papa.parse(await file.text(), { header: true, skipEmptyLines: "greedy" });
      if (request !== task.current) return;
      if (parsed.errors.length || !parsed.data.length || parsed.data.length > 20000 || !parsed.meta.fields?.length || parsed.meta.renamedHeaders && Object.keys(parsed.meta.renamedHeaders).length) throw new Error("csv");
      const contract = blogMapping(parsed.data, parsed.meta.fields, config.toolId);
      setCsv({ raw: parsed.data, headers: parsed.meta.fields, mapping: contract.mapping, fileName: file.name, projectId });
      setSelection({ category: "", value: "", denominator: "" });
    } catch { if (request === task.current) setError(en ? "Use a CSV up to 5 MB / 20,000 rows with unique headers, or open the full analysis." : "중복 없는 헤더의 CSV(5MB·2만 행 이하)를 선택하거나 상세 분석을 이용하세요."); }
    finally { if (request === task.current) setBusy(false); }
    event.target.value = "";
  };
  const analyze = async () => {
    const request = ++task.current;
    setBusy(true); setResult(null); setError("");
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      let next;
      if (!custom) {
        const keys = Object.values(csv.mapping).filter(key => key !== "__ignore__");
        if (new Set(keys).size !== keys.length) throw new Error("duplicate");
      }
      if (custom) next = descriptiveBlogResult(csv, selection, locale);
      else if (config.type === "funnel") {
        const labels = en ? ["Impressions", "Clicks", "Installs", "Actions"] : ["노출", "클릭", "설치", "액션"];
        const fields = ["impressions", "clicks", "installs", "actions"];
        const definitions = fields.flatMap((field, index) => Object.entries(csv.mapping).filter(([, key]) => key === field).map(([header]) => ({ key: header, label: labels[index] })));
        if (definitions.length < 2) throw new Error("columns");
        const sums = {};
        for (const def of definitions) {
          const values = csv.raw.map(row => strictMetric(row[def.key]));
          if (values.some(value => value === null)) throw new Error("values");
          sums[def.key] = values.reduce((sum, value) => sum + value, 0);
          if (!Number.isFinite(sums[def.key])) throw new Error("values");
        }
        const steps = FUNNEL_MATH.stepsOf(sums, definitions);
        next = { status: "success", verdict: { headline: en ? "Stage totals in your uploaded file" : "업로드한 파일의 단계별 합계", caveats: [en ? "Aggregate counts are not linked-user dropout rates. Check event definitions, repeat events and observation windows before interpreting transitions." : "집계 건수는 동일 사용자의 이탈률이 아닙니다. 단계 간 해석 전에 이벤트 정의·중복 이벤트·관찰 기간을 확인하세요."] }, visualizations: [{ kind: "bar", question: en ? "Stage totals" : "단계별 합계", data: steps, options: { x: "label", y: "count" } }] };
      } else {
        if (hasMoney && !csv.currency) throw new Error("currency");
        next = await runBlogAdapter(config.toolId, csv, locale);
      }
      if (request === task.current) { setResult(next); trackProductEvent("blog_inline_csv_checked", { content_slug: slug, content_type: "blog", tool_id: config.toolId, locale, result_state: next.status }); }
    } catch { if (request === task.current) setError(message); }
    finally { if (request === task.current) setBusy(false); }
  };
  const openDetail = () => {
    const state = useAppStore.getState();
    if (csv) {
      if (state.activeProjectId !== csv.projectId || state.projectSwitching) { setError(en ? "The active project changed. Select the CSV again in this project." : "활성 프로젝트가 바뀌었습니다. 이 프로젝트에서 CSV를 다시 선택해 주세요."); return; }
      if (state.csvGroups[groupForRoute(config.toolId)]?.raw?.length && !replace) { setError(en ? "Confirm replacing this tool's current dataset below." : "아래에서 상세 도구의 기존 데이터 교체를 확인해 주세요."); return; }
      state.setCurrentRouteId(config.toolId);
      // Mapping is built against the full destination contract. Calculations remain gated.
      state.setCsvData(csv, csv.projectId);
      // The preview used every uploaded row; stale detail filters must not hide them.
      state.setDashboardFilter(useAppStore.getInitialState().dashboardFilter);
      if (config.type === "funnel") state.setDashboardTab("funnel");
    }
    trackProductEvent("blog_tool_cta_clicked", { content_slug: slug, content_type: "blog", tool_id: config.toolId, locale, placement: "article_inline" });
    router.push(`${en ? "/en" : ""}${idToSlug[config.toolId]}`);
  };
  return <aside className="blog-inline-insight" aria-labelledby={id}>
    <h2 id={id}>{custom ? (en ? "Inspect the data behind this section" : "이 문단의 데이터 먼저 살펴보기") : (en ? "Check this with your CSV" : "이 내용을 내 CSV로 확인")}</h2>
    <p>{en ? "One chart and the result. CSV processing stays in this browser." : "차트 하나와 결과만 확인하세요. CSV는 이 브라우저에서 처리합니다."}</p>
    {custom && <p>{en ? "This quick view shows totals or a ratio of sums. Choose additive counts or amounts with matching units and periods, not pre-calculated averages, CPA, LTV or retention rates. The full tool handles the model and its assumptions." : "이 빠른 뷰는 합계 또는 합계의 비율을 보여 줍니다. 같은 단위·기간의 합산 가능한 건수·금액을 선택하세요. 이미 계산된 평균·CPA·LTV·리텐션율은 합산하지 마세요. 모형과 적용 조건은 상세 도구에서 확인합니다."}</p>}
    <label className="btn">{en ? "Choose CSV" : "CSV 선택"}<input type="file" accept=".csv,text/csv" aria-label={en ? "Choose CSV" : "CSV 선택"} disabled={busy} onChange={upload} /></label>
    {csv && <>
      <details open={!result}><summary>{en ? "Check columns" : "열 확인"}</summary>
        {custom ? ["category", "value", "denominator"].map((key, index) => <label key={key}>{(en ? ["Group / date", "Value column (counts or amounts)", "Denominator (optional)"] : ["그룹 / 날짜", "값 열 (건수·금액)", "분모 열 (선택)"])[index]}<select disabled={busy} value={selection[key]} onChange={event => { setSelection(value => ({ ...value, [key]: event.target.value })); setResult(null); }}><option value="">—</option>{csv.headers.map(header => <option key={header}>{header}</option>)}</select></label>) : csv.headers.map(header => <label key={header}>{header}<select disabled={busy} value={csv.mapping[header] || "__ignore__"} onChange={event => { setCsv(value => ({ ...value, mapping: { ...value.mapping, [header]: event.target.value } })); setResult(null); }}><option value="__ignore__">{en ? "Ignore" : "사용 안 함"}</option>{Object.entries(STANDARD_FIELDS).filter(([key]) => allowedFields.has(key)).map(([key, field]) => <option key={key} value={key}>{en ? key : field.label}</option>)}</select></label>)}
        {hasMoney && config.type === "adapter" && <label data-currency-scope="declare">{en ? "Source currency (no conversion)" : "원본 통화 (환산 없음)"}<select disabled={busy} value={csv.currency || ""} onChange={event => { setCsv(value => ({ ...value, currency: event.target.value })); setResult(null); }}><option value="">—</option><option value="KRW">KRW</option><option value="USD">USD</option></select></label>}
      </details>
      <button className="btn primary" disabled={busy} onClick={analyze}>{busy ? (en ? "Calculating…" : "계산 중…") : (en ? "Show result" : "결과 보기")}</button>
    </>}
    {error && <p role="alert">{error}</p>}
    {result && <div className="blog-inline-insight__result"><p className="blog-inline-insight__finding">{result.verdict.headline}</p>{result.status === "success" && <BlogInsightChart visual={result.visualizations[0]} locale={locale} />}{result.verdict.caveats.map((note, index) => <p key={index}>{note}</p>)}</div>}
    {needsReplace && <label><input type="checkbox" checked={replace} onChange={event => setReplace(event.target.checked)} />{en ? "Replace the current dataset in the detailed tool with this CSV." : "상세 도구의 기존 데이터를 이 CSV로 교체합니다."}</label>}
    <button className="btn" disabled={busy} onClick={openDetail}>{en ? "Open detailed analysis" : "더 자세한 분석 보기"}</button>
  </aside>;
}
