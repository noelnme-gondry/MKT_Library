"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { toolIndexEntry } from "@/lib/toolIndex";
import { localizedHref } from "@/lib/localizedHref";
import {
  ANALYSIS_REFERENCES, MARKETING_ANALYSIS_DOMAINS, analysisLibraryStatus, filterAnalysisLibrary,
} from "@/lib/marketingAnalysisLibrary";

const COPY = {
  ko: {
    title: "마케팅 분석 지도",
    intro: "질문에 맞는 분석과 필요한 데이터를 찾으세요. 연결 도구의 지원 범위와 참고 자료를 구분해 안내합니다.",
    search: "분석 질문·방법 검색", placeholder: "예: 리텐션, CUPED, 가격, CRM",
    domain: "분야", status: "제공 범위", all: "전체",
    statuses: { tool: "연결 도구 있음", guide: "내부 가이드", reference: "외부 참고 자료" },
    input: "필요한 데이터", limit: "해석·지원 범위", tools: "연결 도구", posts: "개념·사례",
    references: "방법 참고 문헌", referenceNote: "참고 문헌의 모든 기능이 연결 도구에 구현된 것은 아닙니다.",
    checked: "자료 확인", empty: "조건에 맞는 분석이 없습니다. 검색어나 분야를 바꿔보세요.",
    reset: "필터 초기화", count: (n) => `${n}개 분석 방법`,
    article: (n) => `관련 글 ${n}`,
  },
  en: {
    title: "Marketing analysis map",
    intro: "Find analyses and data for your question. Tool capabilities are distinguished from reference material.",
    search: "Search questions and methods", placeholder: "e.g. retention, CUPED, pricing, CRM",
    domain: "Domain", status: "Availability", all: "All",
    statuses: { tool: "Tool linked", guide: "Internal guide", reference: "External reference" },
    input: "Data needed", limit: "Interpretation and scope", tools: "Linked tools", posts: "Concepts and examples",
    references: "Method references", referenceNote: "Linked tools do not implement every capability described in these references.",
    checked: "Source checked", empty: "No analyses match. Try another query or domain.",
    reset: "Reset filters", count: (n) => `${n} analysis methods`,
    article: (n) => `Related article ${n}`,
  },
};

export default function MarketingAnalysisLibrary({ locale = "ko" }) {
  const language = locale === "en" ? "en" : "ko";
  const C = COPY[language];
  const controlId = useId();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [domain, setDomain] = useState("all");
  const groups = filterAnalysisLibrary({ query, status, locale: language })
    .filter((group) => domain === "all" || group.id === domain);
  const count = groups.reduce((total, group) => total + group.methods.length, 0);

  return (
    <section id="analysis-library" className="analysis-library" aria-labelledby={`${controlId}-title`}>
      <h2 id={`${controlId}-title`}>{C.title}</h2>
      <p>{C.intro}</p>
      <div className="analysis-library__filters">
        <label htmlFor={`${controlId}-search`}>
          {C.search}
          <input id={`${controlId}-search`} type="search" value={query} placeholder={C.placeholder}
            onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label htmlFor={`${controlId}-domain`}>
          {C.domain}
          <select id={`${controlId}-domain`} value={domain} onChange={(event) => setDomain(event.target.value)}>
            <option value="all">{C.all}</option>
            {MARKETING_ANALYSIS_DOMAINS.map((group) => <option key={group.id} value={group.id}>{group.title[language]}</option>)}
          </select>
        </label>
        <label htmlFor={`${controlId}-status`}>
          {C.status}
          <select id={`${controlId}-status`} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">{C.all}</option>
            {Object.entries(C.statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="button" className="btn btn-secondary" onClick={() => { setQuery(""); setStatus("all"); setDomain("all"); }}>
          {C.reset}
        </button>
      </div>
      <p role="status" aria-live="polite" aria-atomic="true">{C.count(count)}</p>
      {!count && <p>{C.empty}</p>}
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`${controlId}-${group.id}`} className="analysis-library__domain">
          <h3 id={`${controlId}-${group.id}`}>{group.title[language]}</h3>
          {group.methods.map((entry) => (
            <details key={entry.id} className="analysis-library__method" id={`analysis-${entry.id}`}>
              <summary>
                <span>{entry.title[language]}</span>
                <span className="analysis-library__status">{C.statuses[analysisLibraryStatus(entry)]}</span>
              </summary>
              <div className="analysis-library__body">
                <p className="analysis-library__question">{entry.question[language]}</p>
                <dl>
                  <dt>{C.input}</dt><dd>{entry.input[language]}</dd>
                  <dt>{C.limit}</dt><dd>{entry.limit[language]}</dd>
                </dl>
                {entry.tools.length > 0 && <div>
                  <h4>{C.tools}</h4>
                  <ul>{entry.tools.map((toolId) => {
                    const tool = toolIndexEntry(toolId, language);
                    return tool && <li key={toolId}><Link href={localizedHref(tool.href, language)}>{tool.name}</Link></li>;
                  })}</ul>
                </div>}
                {entry.posts.length > 0 && <div>
                  <h4>{C.posts}</h4>
                  <ul>{entry.posts.map((slug, index) => (
                    <li key={slug}><Link href={localizedHref(`/blog/${slug}`, language)}>{entry.title[language]} — {C.article(index + 1)}</Link></li>
                  ))}</ul>
                </div>}
                <h4>{C.references}</h4>
                <p className="analysis-library__reference-note">{C.referenceNote}</p>
                <ul>{entry.references.map((id) => {
                  const reference = ANALYSIS_REFERENCES[id];
                  return <li key={id}>
                    <a href={reference.url}>{reference.title}</a>
                    <span className="analysis-library__checked"> · {C.checked} {reference.checkedAt}</span>
                  </li>;
                })}</ul>
              </div>
            </details>
          ))}
        </section>
      ))}
    </section>
  );
}
