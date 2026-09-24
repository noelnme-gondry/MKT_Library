"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TEMPLATE_PAGES } from "@/lib/templateCatalog";
import Papa from "papaparse";
import { useAppStore } from "@/store/useDataStore";
import { groupForRoute } from "@/lib/toolGroups";
import { idToSlug } from "@/lib/routeMap";
import { blogMapping, blogMappingToolId, descriptiveBlogResult, runBlogAdapter, strictMetric } from "@/lib/blogInsightRunner";
import { STANDARD_FIELDS, TOOL_REQUIRED_FIELDS, TOOL_OPTIONAL_FIELDS } from "@/utils/csvConstants";
import { FUNNEL_MATH } from "@/utils/funnelMath";
import { trackProductEvent } from "@/lib/analytics";
import BlogInsightChart from "./BlogInsightChart";
import BlogExampleChart from "./BlogExampleChart";
import { tutorialDuration } from "@/lib/videoTutorials";
import { VideoHelpButton } from "@/components/VideoTutorialHelp";

export default function BlogCsvAnalysis({ config, slug, locale = "ko", practice = null, example = null, postTitle = "" }) {
  const en = locale === "en", id = useId(), router = useRouter();
  const [csv, setCsv] = useState(null), [result, setResult] = useState(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [selection, setSelection] = useState({ category: "", value: "", denominator: "" });
  const [replacementTarget, setReplacementTarget] = useState(null);
  const task = useRef(0);
  useEffect(() => () => { task.current += 1; }, []);
  const projectId = useAppStore(state => state.activeProjectId);
  // Initial device restoration can change the destination while a demo is loading.
  // Storage-disabled and storage-unavailable sessions can still analyze in memory.
  const projectPreparing = useAppStore(state => state.projectSwitching || (state.decisionPersistenceEnabled && !state.projectsReady && !state.projectError));
  const inputDisabled = busy || projectPreparing;
  const existing = useAppStore(state => state.csvGroups[groupForRoute(config.toolId)]);
  const needsReplace = Boolean(existing?.raw?.length && csv && existing.raw !== csv.raw);
  const custom = config.type !== "adapter" && config.type !== "funnel";
  const mappingToolId = blogMappingToolId(config.toolId);
  const allowedFields = new Set([...(TOOL_REQUIRED_FIELDS[mappingToolId] || []).flatMap(field => typeof field === "string" ? [field] : field.oneOf || []), ...(TOOL_OPTIONAL_FIELDS[mappingToolId] || []).map(field => field.key)]);
  const hasMoney = csv && Object.values(csv.mapping).some(field => /^(cost|spend|revenue|budget)/.test(field));
  const message = en ? "Check columns and units. Empty, negative, non-numeric and percentage cells cannot be used as counts. For larger or more complex files, open the full analysis." : "열과 단위를 확인해 주세요. 빈칸·음수·문자·백분율 셀은 건수로 계산하지 않습니다. 크거나 복잡한 파일은 상세 분석에서 확인하세요.";
  const parseCsv = text => {
    if (new Blob([text]).size > 5 * 1024 * 1024) throw new Error("size");
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: "greedy" });
    if (parsed.errors.length || !parsed.data.length || parsed.data.length > 20000 || !parsed.meta.fields?.length || parsed.meta.renamedHeaders && Object.keys(parsed.meta.renamedHeaders).length) throw new Error("csv");
    return parsed;
  };
  const upload = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const request = ++task.current;
    setCsv(null); setResult(null); setError(""); setBusy(true); setReplacementTarget(null);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("size");
      const parsed = parseCsv(await file.text());
      if (request !== task.current) return;
      const contract = blogMapping(parsed.data, parsed.meta.fields, config.toolId);
      let sample = null;
      if (practice?.demoGroup) {
        const { buildBlogPracticeDownload, matchesBlogPracticeDemo } = await import("@/lib/blogPracticeData");
        const { demo } = buildBlogPracticeDownload(practice);
        if (matchesBlogPracticeDemo(parsed, demo)) sample = demo;
      }
      if (request !== task.current) return;
      setCsv({ raw: parsed.data, headers: parsed.meta.fields, mapping: contract.mapping, fileName: file.name, projectId, importSource: sample ? "demo" : "upload", ...(sample?.currency ? { currency: sample.currency } : {}) });
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
  const openDetail = (candidate = csv, confirmedTarget = replacementTarget) => {
    const state = useAppStore.getState();
    if (candidate) {
      if (state.activeProjectId !== candidate.projectId || state.projectSwitching) { setError(en ? "The active project changed. Select the CSV again in this project." : "활성 프로젝트가 바뀌었습니다. 이 프로젝트에서 CSV를 다시 선택해 주세요."); return; }
      const currentRows = state.csvGroups[groupForRoute(config.toolId)]?.raw;
      if (currentRows?.length && confirmedTarget !== currentRows) { setError(en ? "Confirm replacing this tool's current dataset below." : "아래에서 상세 도구의 기존 데이터 교체를 확인해 주세요."); return; }
      state.setCurrentRouteId(config.toolId);
      // Mapping is built against the full destination contract. Calculations remain gated.
      state.setCsvData(candidate, candidate.projectId);
      // The preview used every uploaded row; stale detail filters must not hide them.
      state.setDashboardFilter(useAppStore.getInitialState().dashboardFilter);
      if (config.type === "funnel") state.setDashboardTab("funnel");
    }
    // 도착 화면(시안 E)이 출처를 한 줄로 말하도록 공개 글 식별자·제목·파일명만 남긴다.
    state.setBlogArrival({ slug, title: postTitle, toolId: config.toolId, fileName: candidate?.fileName || null, source: candidate ? (candidate.importSource === "demo" ? "demo" : "csv") : "none" });
    trackProductEvent("blog_tool_cta_clicked", { content_slug: slug, content_type: "blog", tool_id: config.toolId, locale, placement: "article_inline" });
    router.push(`${en ? "/en" : ""}${idToSlug[config.toolId]}`);
  };
  const openDemo = async () => {
    const request = ++task.current;
    setBusy(true); setCsv(null); setResult(null); setError(""); setReplacementTarget(null);
    try {
      const { loadBlogPracticeDemo } = await import("@/lib/blogPracticeData");
      const sample = await loadBlogPracticeDemo(practice);
      if (request !== task.current) return;
      const parsed = parseCsv(sample.text);
      const contract = blogMapping(parsed.data, parsed.meta.fields, config.toolId);
      const candidate = { raw: parsed.data, headers: parsed.meta.fields, mapping: contract.mapping, fileName: sample.file, projectId, importSource: "demo", ...(sample.demo.currency ? { currency: sample.demo.currency } : {}) };
      setCsv(candidate);
      // Loading a sample never grants permission to replace existing project data.
      openDetail(candidate, null);
    } catch { if (request === task.current) setError(en ? "The demo could not be loaded. Try again or choose a CSV." : "데모를 불러오지 못했습니다. 다시 시도하거나 CSV를 선택해 주세요."); }
    finally { if (request === task.current) setBusy(false); }
  };
  const ex = example?.[en ? "en" : "ko"];
  const template = TEMPLATE_PAGES.find(page => page.toolId === config.toolId);
  // 글이 자기 예제 파일을 가진 경우만 단계 안내를 접어 둔다 — 공용 데모 글의 단계 문구는 도구 사용법 반복이었다.
  const customSteps = Boolean(practice && !practice.demoGroup && practice.steps?.length);
  return <aside className={`blog-inline-insight${practice ? " blog-practice" : ""}${ex ? " blog-example" : ""}`} id={practice ? "blog-practice" : undefined} tabIndex={practice ? -1 : undefined} aria-labelledby={id}>
    {ex ? <>
      <h2 id={id} className="blog-example__headline">{ex.headline}</h2>
      <BlogExampleChart example={example} locale={locale} />
      <p className="blog-example__caption">{ex.caption}</p>
    </> : <>
      <h2 id={id}>{practice ? practice.title : custom ? (en ? "Inspect the data behind this section" : "이 문단의 데이터 먼저 살펴보기") : (en ? "Check this with your CSV" : "이 내용을 내 CSV로 확인")}</h2>
      <p>{practice ? practice.introduction : en ? "One chart and the result. CSV processing stays in this browser." : "차트 하나와 결과만 확인하세요. CSV는 이 브라우저에서 처리합니다."}</p>
    </>}
    {slug === "weekly-marketing-report-template" && <VideoHelpButton topic="decisions" locale={locale}>{en ? `Save and revisit · ${tutorialDuration("decisions")}-second guide` : `저장·재검토 ${tutorialDuration("decisions")}초 가이드`}</VideoHelpButton>}
    {custom && practice?.mode !== "detail" && !ex && <p>{en ? "This quick view shows totals or a ratio of sums. Choose additive counts or amounts with matching units and periods, not pre-calculated averages, CPA, LTV or retention rates. The full tool handles the model and its assumptions." : "이 빠른 뷰는 합계 또는 합계의 비율을 보여 줍니다. 같은 단위·기간의 합산 가능한 건수·금액을 선택하세요. 이미 계산된 평균·CPA·LTV·리텐션율은 합산하지 마세요. 모형과 적용 조건은 상세 도구에서 확인합니다."}</p>}
    <div className="blog-practice__actions">
      <label className="btn primary blog-example__upload">{ex ? (en ? "Run this on my CSV" : "내 CSV로 같은 분석 보기") : (en ? "Choose CSV" : "CSV 선택")}<input type="file" accept=".csv,text/csv" disabled={inputDisabled} onChange={upload} /></label>
      {practice && <button type="button" className="blog-example__demo" disabled={inputDisabled} onClick={openDemo}>{en ? "Open the full example result" : "예시 결과 전체 보기"}</button>}
      {ex && template && <Link className="blog-example__demo" href={`${en ? "/en" : ""}/templates/${template.slug}`}>{en ? "See the CSV columns" : "필요한 CSV 열 보기"}</Link>}
    </div>
    {customSteps && <details className="blog-practice__instructions">
      <summary>{en ? "Follow this example step by step" : "이 예제 따라 하기"}</summary>
      <ol>{practice.steps.map(step => <li key={step}>{step}</li>)}</ol>
      <p className="blog-practice__limit">{practice.limit}</p>
      <a className="blog-practice__download" href={practice.href} download={practice.file}>{practice.download}</a>
    </details>}
    {projectPreparing && <p role="status">{en ? "Checking device storage…" : "기기 저장 상태를 확인하고 있습니다…"}</p>}
    {csv && <>
      {practice?.demoGroup ? <p className="blog-practice__file" role="status">{csv.fileName} · {csv.raw.length.toLocaleString(locale)}{en ? " rows" : "행"}</p> : <section data-information-section="" ><header data-information-heading="">{en ? "Check columns" : "열 확인"}</header>
        {custom ? ["category", "value", "denominator"].map((key, index) => <label key={key}>{(en ? ["Group / date", "Value column (counts or amounts)", "Denominator (optional)"] : ["그룹 / 날짜", "값 열 (건수·금액)", "분모 열 (선택)"])[index]}<select disabled={busy} value={selection[key]} onChange={event => { setSelection(value => ({ ...value, [key]: event.target.value })); setResult(null); }}><option value="">—</option>{csv.headers.map(header => <option key={header}>{header}</option>)}</select></label>) : csv.headers.map(header => <label key={header}>{header}<select disabled={busy} value={csv.mapping[header] || "__ignore__"} onChange={event => { setCsv(value => ({ ...value, mapping: { ...value.mapping, [header]: event.target.value } })); setResult(null); }}><option value="__ignore__">{en ? "Ignore" : "사용 안 함"}</option>{Object.entries(STANDARD_FIELDS).filter(([key]) => allowedFields.has(key)).map(([key, field]) => <option key={key} value={key}>{en ? key : field.label}</option>)}</select></label>)}
        {hasMoney && config.type === "adapter" && <label data-currency-scope="declare">{en ? "Source currency (no conversion)" : "원본 통화 (환산 없음)"}<select disabled={busy} value={csv.currency || ""} onChange={event => { setCsv(value => ({ ...value, currency: event.target.value })); setResult(null); }}><option value="">—</option><option value="KRW">KRW</option><option value="USD">USD</option></select></label>}
      </section>}
      {practice?.mode !== "detail" && <button className="btn primary" disabled={busy} onClick={analyze}>{busy ? (en ? "Calculating…" : "계산 중…") : (en ? "Show result" : "결과 보기")}</button>}
    </>}
    {error && <p role="alert">{error}</p>}
    {result && <div className="blog-inline-insight__result"><p className="blog-inline-insight__finding">{result.verdict.headline}</p>{result.status === "success" && <BlogInsightChart visual={result.visualizations[0]} locale={locale} />}{result.verdict.caveats.map((note, index) => <p key={index}>{note}</p>)}</div>}
    {needsReplace && <label><input type="checkbox" checked={replacementTarget === existing.raw} onChange={event => setReplacementTarget(event.target.checked ? existing.raw : null)} />{en ? "Replace the current dataset in the detailed tool with this CSV." : "상세 도구의 기존 데이터를 이 CSV로 교체합니다."}</label>}
    {csv && practice?.detailNote && <p>{practice.detailNote}</p>}
    {(csv || !practice) && <button className="btn" disabled={inputDisabled} onClick={() => openDetail()}>{en ? "Open detailed analysis" : "더 자세한 분석 보기"}</button>}
  </aside>;
}
