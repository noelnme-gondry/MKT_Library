"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IA, useAppStore } from "@/store/useDataStore";
import { hasEnVersion, idToSlug } from "@/lib/routeMap";
import { trGroupTitle, trItemTitle } from "@/lib/enNavCopy";

const COPY = {
  ko: { placeholder: "도구·가이드·용어 검색", move: "이동", run: "열기", close: "닫기", empty: "일치하는 페이지가 없습니다", pages: "빠른 이동" },
  en: { placeholder: "Search tools, guides, and glossary", move: "move", run: "open", close: "close", empty: "No matching pages", pages: "Quick navigation" },
};

export default function GlobalModals({ locale = "ko" }) {
  const T = COPY[locale] || COPY.ko;
  const router = useRouter();
  const isCmdkOpen = useAppStore((state) => state.isCmdkOpen);
  const setCmdkOpen = useAppStore((state) => state.setCmdkOpen);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const lastActiveRef = useRef(null);
  const wasOpenRef = useRef(false);
  const entries = useMemo(() => {
    const items = IA.flatMap((group) => group.items.filter((item) => !item.hidden).map((item) => ({
      key: item.id,
      title: trItemTitle(item.id, locale, item.title),
      group: trGroupTitle(group.id, locale, group.title),
      href: locale === "en" && hasEnVersion(item.id) ? `/en${idToSlug[item.id]}` : idToSlug[item.id],
      kind: item.id.startsWith("5-") || item.id.startsWith("9-") ? (locale === "en" ? "Analysis" : "분석") : (locale === "en" ? "Guide" : "가이드"),
    })));
    return items.concat([
      { key: "blog", title: locale === "en" ? "Performance marketing blog" : "퍼포먼스 마케팅 블로그", group: locale === "en" ? "Learn" : "실무 자료", href: locale === "en" ? "/en/blog" : "/blog", kind: locale === "en" ? "Blog" : "블로그" },
      { key: "glossary", title: locale === "en" ? "Marketing glossary" : "마케팅 용어사전", group: locale === "en" ? "Learn" : "실무 자료", href: locale === "en" ? "/en/glossary" : "/glossary", kind: locale === "en" ? "Glossary" : "용어" },
      { key: "templates", title: locale === "en" ? "CSV templates" : "CSV 템플릿", group: locale === "en" ? "Prepare data" : "데이터 준비", href: locale === "en" ? "/en/templates" : "/templates", kind: locale === "en" ? "Template" : "템플릿" },
    ]);
  }, [locale]);
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return entries;
    return entries.filter((entry) => `${entry.title} ${entry.group} ${entry.kind}`.toLocaleLowerCase().includes(normalized)).slice(0, 16);
  }, [entries, query]);
  const open = (entry) => { if (!entry) return; router.push(entry.href); setCmdkOpen(false); setQuery(""); };

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
    <div id="toast-container" className="toast-container" role="status" aria-live="polite"></div>
    <div id="cmdk" className="cmdk-overlay" hidden={!isCmdkOpen} onMouseDown={(event) => { if (event.target === event.currentTarget) setCmdkOpen(false); }}>
      <div ref={panelRef} className="cmdk-panel" role="dialog" aria-modal="true" aria-label={T.placeholder} onKeyDown={onDialogKeyDown}>
        <div className="cmdk-inputwrap"><span aria-hidden>⌕</span><input ref={inputRef} id="cmdk-input" type="search" role="combobox" aria-label={T.placeholder} aria-autocomplete="list" aria-expanded="true" aria-controls="cmdk-results" aria-activedescendant={results[selected] ? `cmdk-option-${results[selected].key}` : undefined} value={query} onChange={(event) => { setQuery(event.target.value); setSelected(0); }} onKeyDown={onInputKey} placeholder={T.placeholder} autoComplete="off" spellCheck="false" /><button type="button" onClick={() => setCmdkOpen(false)} aria-label={T.close} style={{ minWidth: "44px", minHeight: "44px" }}>ESC</button></div>
        <div id="cmdk-results" className="cmdk-results" role="listbox" aria-label={T.pages}>
          {results.map((entry, index) => <button id={`cmdk-option-${entry.key}`} key={entry.key} type="button" role="option" aria-selected={selected === index} className={`cmdk-item${selected === index ? " sel" : ""}`} onMouseEnter={() => setSelected(index)} onClick={() => open(entry)}><span className="cmdk-ico">{entry.kind.slice(0,1)}</span><span className="cmdk-l"><b>{entry.title}</b><small>{entry.group}</small></span><span className="cmdk-tier">{entry.kind}</span></button>)}
          {results.length === 0 && <div className="cmdk-empty">{T.empty}</div>}
        </div>
        <div className="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> {T.move}</span><span><kbd>↵</kbd> {T.run}</span><span><kbd>esc</kbd> {T.close}</span></div>
      </div>
    </div>
  </>;
}
