"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IA, useAppStore } from "@/store/useDataStore";
import { hasEnVersion, idToSlug } from "@/lib/routeMap";
import { trGroupTitle, trItemTitle } from "@/lib/enNavCopy";
import { CONNECTED_TOOLS } from "@/lib/toolConnections";
import LegacyPillGroupA11y from "@/components/ds/LegacyPillGroupA11y";

const COPY = {
  ko: { placeholder: "작업·도구·가이드 검색", move: "이동", run: "열기", close: "닫기", empty: "바로 맞는 도구를 찾지 못했습니다", emptyHint: "파일을 올려 가능한 분석을 확인하거나 세 문항으로 문제부터 좁혀보세요.", emptyStart: "내 데이터 분석", emptyDiagnose: "성과 문제 진단", pages: "빠른 이동", analystGroup: "작업 환경", analystOn: "분석가 모드 켜기", analystOff: "분석가 모드 끄기" },
  en: { placeholder: "Search tasks, tools, and guides", move: "move", run: "open", close: "close", empty: "We could not find a direct match", emptyHint: "Upload a file to see compatible analyses, or narrow the problem in three questions.", emptyStart: "Analyze my data", emptyDiagnose: "Diagnose performance", pages: "Quick navigation", analystGroup: "Workspace", analystOn: "Turn on Analyst mode", analystOff: "Turn off Analyst mode" },
};

const SEARCH_STOP_WORDS = new Set([
  "너무", "정말", "지금", "자꾸", "계속", "조금", "많이", "매우", "어떻게", "어떤", "어느",
  "my", "the", "a", "an", "is", "are", "was", "were", "has", "have", "had", "been", "being",
  "we", "our", "me", "to", "of", "for", "from", "since", "after", "now", "too", "very", "should", "does", "did",
]);

function normalizeSearchToken(value) {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}:+.-]/gu, "")
    .replace(/(에서|으로|에게|까지|부터|처럼|보다|하고|이나|거나|은|는|이|가|을|를|에|로)$/u, "")
    .replace(/(습니다|입니다|했어요|됐어요|돼요|졌어요|었어요|았어요|어요|아요|네요|나요|까요)$/u, "");
}

function searchTokens(value) {
  return String(value || "")
    .split(/\s+/)
    .map(normalizeSearchToken)
    .filter((token) => token.length >= 2 && !SEARCH_STOP_WORDS.has(token));
}

function searchScore(entry, query) {
  const queryParts = searchTokens(query);
  if (!queryParts.length) return 0;
  const haystack = entry.searchText.toLocaleLowerCase();
  const haystackParts = searchTokens(haystack);
  const titleParts = searchTokens(entry.title);
  const matched = queryParts.filter((queryPart) => (
    haystack.includes(queryPart)
    || haystackParts.some((part) => part.startsWith(queryPart) || queryPart.startsWith(part))
  )).length;
  const titleMatched = queryParts.filter((queryPart) => titleParts.some((part) => (
    part === queryPart || part.startsWith(queryPart) || queryPart.startsWith(part)
  ))).length;
  if (queryParts.length === 1) return matched ? 10 : 0;
  if (titleMatched > 0) return 30 + titleMatched * 10 + matched;
  const coverage = matched / queryParts.length;
  if (queryParts.length === 2) return matched && coverage >= 0.5 ? matched * 10 - (queryParts.length - matched) * 2 : 0;
  if (matched < 2) return 0;
  return matched * 10 - (queryParts.length - matched) * 2;
}

export default function GlobalModals({ locale = "ko" }) {
  const T = COPY[locale] || COPY.ko;
  const router = useRouter();
  const isCmdkOpen = useAppStore((state) => state.isCmdkOpen);
  const setCmdkOpen = useAppStore((state) => state.setCmdkOpen);
  const analystMode = useAppStore((state) => state.analystMode);
  const setAnalystMode = useAppStore((state) => state.setAnalystMode);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const lastActiveRef = useRef(null);
  const wasOpenRef = useRef(false);
  const entries = useMemo(() => {
    const items = IA.flatMap((group) => group.items.filter((item) => !item.hidden).map((item) => {
      const connectedTool = CONNECTED_TOOLS[item.id];
      const question = connectedTool?.question?.[locale] || connectedTool?.question?.ko || "";
      const keywords = connectedTool?.keywords?.[locale] || connectedTool?.keywords?.ko || "";
      const title = trItemTitle(item.id, locale, item.title);
      const groupTitle = trGroupTitle(group.id, locale, group.title);
      const kind = item.id.startsWith("5-") || item.id.startsWith("9-") ? (locale === "en" ? "Analysis" : "분석") : (locale === "en" ? "Guide" : "가이드");
      return {
      key: item.id,
      title,
      group: groupTitle,
      href: locale === "en" && hasEnVersion(item.id) ? `/en${idToSlug[item.id]}` : idToSlug[item.id],
      kind,
      hint: question || groupTitle,
      searchText: `${title} ${groupTitle} ${kind} ${question} ${keywords} ${item.seoTitle || ""} ${item.seoDescription || ""} ${item.seoTitleEn || ""} ${item.seoDescriptionEn || ""}`,
    };
    }));
    const workspace = [
      { key: "start", title: locale === "en" ? "Analyze my data" : "내 데이터 분석", group: locale === "en" ? "Decision workspace" : "의사결정 워크스페이스", href: locale === "en" ? "/en/start" : "/start", kind: locale === "en" ? "Start" : "시작", hint: locale === "en" ? "Upload CSV or XLSX and see compatible analyses" : "CSV·XLSX를 올리고 가능한 분석 추천", searchText: locale === "en" ? "analyze data CSV XLSX file upload compatible analysis recommendation" : "내 데이터 분석 CSV XLSX 파일 업로드 가능한 분석 추천" },
      { key: "diagnose", title: locale === "en" ? "Diagnose performance" : "성과 문제 진단", group: locale === "en" ? "Decision workspace" : "의사결정 워크스페이스", href: locale === "en" ? "/en/diagnose" : "/diagnose", kind: locale === "en" ? "Diagnose" : "진단", hint: locale === "en" ? "Find the likely cause and check order in three questions" : "3문항으로 원인과 확인 순서 찾기", searchText: locale === "en" ? "diagnose performance issue cause check order CPA CPI ROAS three questions" : "성과 문제 진단 원인 확인 순서 CPA CPI ROAS 세 문항 3문항" },
      { key: "calculator", title: locale === "en" ? "Marketing metric calculators" : "마케팅 지표 계산기", group: locale === "en" ? "Decision workspace" : "의사결정 워크스페이스", href: locale === "en" ? "/en/calculator" : "/calculator", kind: locale === "en" ? "Calculate" : "계산", hint: locale === "en" ? "Calculate target CPA, ROAS, and A/B sample size" : "목표 CPA·ROAS·A/B 표본수 계산", searchText: locale === "en" ? "marketing metric calculator target CPA ROAS AB sample size" : "마케팅 지표 계산기 목표 CPA ROAS AB A/B 표본수" },
      { key: "blog", title: locale === "en" ? "Performance marketing blog" : "퍼포먼스 마케팅 블로그", group: locale === "en" ? "Learn" : "실무 자료", href: locale === "en" ? "/en/blog" : "/blog", kind: locale === "en" ? "Blog" : "블로그" },
      { key: "glossary", title: locale === "en" ? "Marketing glossary" : "마케팅 용어사전", group: locale === "en" ? "Learn" : "실무 자료", href: locale === "en" ? "/en/glossary" : "/glossary", kind: locale === "en" ? "Glossary" : "용어" },
      { key: "templates", title: locale === "en" ? "CSV templates" : "CSV 템플릿", group: locale === "en" ? "Prepare data" : "데이터 준비", href: locale === "en" ? "/en/templates" : "/templates", kind: locale === "en" ? "Template" : "템플릿" },
    ];
    const growthOps = {
      key: "growth-funnel",
      title: locale === "en" ? "Product growth funnel report" : "제품 성장 퍼널 리포트",
      group: T.analystGroup,
      href: locale === "en" ? "/en/growth-funnel" : "/growth-funnel",
      kind: locale === "en" ? "Analyst" : "분석가",
      hint: locale === "en" ? "Read a GA4 event export locally" : "GA4 이벤트 내보내기를 브라우저에서 분석",
      searchText: locale === "en" ? "GA4 event export acquisition activation retention funnel report" : "GA4 이벤트 내보내기 유입 활성화 이용 리텐션 퍼널 리포트",
    };
    const setting = {
        key: analystMode ? "analyst-mode-off" : "analyst-mode-on",
        title: analystMode ? T.analystOff : T.analystOn,
        group: T.analystGroup,
        kind: locale === "en" ? "Setting" : "설정",
        action: () => setAnalystMode(!analystMode),
    };
    const analyses = items.filter((entry) => entry.kind === (locale === "en" ? "Analysis" : "분석"));
    const guides = items.filter((entry) => !analyses.includes(entry));
    return [...workspace.slice(0, 3), ...(analystMode ? [growthOps] : []), ...analyses, ...workspace.slice(3), ...guides, setting].map((entry) => ({
      ...entry,
      hint: entry.hint || entry.group,
      searchText: entry.searchText || `${entry.title} ${entry.group} ${entry.kind}`,
    }));
  }, [locale, analystMode, setAnalystMode, T.analystGroup, T.analystOff, T.analystOn]);
  const results = useMemo(() => {
    if (!query.trim()) return entries;
    return entries
      .map((entry, index) => ({ entry, index, score: searchScore(entry, query) }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, 16)
      .map((result) => result.entry);
  }, [entries, query]);
  const open = (entry) => {
    if (!entry) return;
    if (entry.action) entry.action();
    else router.push(entry.href);
    setCmdkOpen(false);
    setQuery("");
  };

  useEffect(() => {
    const onGlobalKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") { event.preventDefault(); setCmdkOpen(!isCmdkOpen); }
      if (event.key === "Escape" && isCmdkOpen) setCmdkOpen(false);
    };
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  }, [isCmdkOpen, setCmdkOpen]);
  useEffect(() => {
    if (isCmdkOpen && !wasOpenRef.current) {
      lastActiveRef.current = document.activeElement;
      window.requestAnimationFrame(() => { setSelected(0); inputRef.current?.focus(); });
    } else if (!isCmdkOpen && wasOpenRef.current) {
      lastActiveRef.current?.focus?.();
    }
    wasOpenRef.current = isCmdkOpen;
  }, [isCmdkOpen]);
  useEffect(() => {
    if (!isCmdkOpen) return;
    document.getElementById(`cmdk-option-${results[selected]?.key}`)?.scrollIntoView({ block: "nearest" });
  }, [isCmdkOpen, results, selected]);

  const onInputKey = (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setSelected((value) => Math.min(value + 1, results.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setSelected((value) => Math.max(value - 1, 0)); }
    if (event.key === "Enter") { event.preventDefault(); open(results[selected]); }
  };
  const onDialogKeyDown = (event) => {
    if (event.key !== "Tab") return;
    const focusable = [...(panelRef.current?.querySelectorAll("button:not([disabled]), input:not([disabled]), a[href]") || [])];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return <>
    <LegacyPillGroupA11y />
    <div id="toast-container" className="toast-container" role="status" aria-live="polite"></div>
    <div id="cmdk" className="cmdk-overlay" hidden={!isCmdkOpen} onMouseDown={(event) => { if (event.target === event.currentTarget) setCmdkOpen(false); }}>
      <div ref={panelRef} className="cmdk-panel" role="dialog" aria-modal="true" aria-label={T.placeholder} onKeyDown={onDialogKeyDown}>
        <div className="cmdk-inputwrap"><span aria-hidden>⌕</span><input ref={inputRef} id="cmdk-input" type="search" role="combobox" aria-label={T.placeholder} aria-autocomplete="list" aria-expanded="true" aria-controls="cmdk-results" aria-activedescendant={results[selected] ? `cmdk-option-${results[selected].key}` : undefined} value={query} onChange={(event) => { setQuery(event.target.value); setSelected(0); }} onKeyDown={onInputKey} placeholder={T.placeholder} autoComplete="off" spellCheck="false" /><button type="button" onClick={() => setCmdkOpen(false)} aria-label={T.close} style={{ minWidth: "44px", minHeight: "44px" }}>ESC</button></div>
        <div id="cmdk-results" className="cmdk-results" role={results.length ? "listbox" : undefined} aria-label={T.pages}>
          {results.map((entry, index) => <button id={`cmdk-option-${entry.key}`} key={entry.key} type="button" role="option" aria-selected={selected === index} className={`cmdk-item${selected === index ? " sel" : ""}`} onMouseEnter={() => setSelected(index)} onClick={() => open(entry)}><span className="cmdk-ico">{entry.kind.slice(0,1)}</span><span className="cmdk-l"><b>{entry.title}</b><small>{entry.hint}</small></span><span className="cmdk-tier">{entry.kind}</span></button>)}
          {results.length === 0 && <div className="cmdk-empty"><strong>{T.empty}</strong><p>{T.emptyHint}</p><div className="cmdk-empty__actions"><button type="button" onClick={() => open(entries.find((entry) => entry.key === "start"))}>{T.emptyStart}</button><button type="button" onClick={() => open(entries.find((entry) => entry.key === "diagnose"))}>{T.emptyDiagnose}</button></div></div>}
        </div>
        <div className="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> {T.move}</span><span><kbd>↵</kbd> {T.run}</span><span><kbd>esc</kbd> {T.close}</span></div>
      </div>
    </div>
  </>;
}
