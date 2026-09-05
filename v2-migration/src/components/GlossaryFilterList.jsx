"use client";
import { useMemo, useState } from "react";
import Link from "next/link";

const COPY = {
  ko: { all: "전체", search: "용어·정의 검색", empty: "검색 조건에 맞는 용어가 없습니다." },
  en: { all: "All", search: "Search terms and definitions", empty: "No terms match this search." },
};

// 용어사전 카테고리 필터 — 클라이언트 인터랙션만 분리(서버 컴포넌트 page.js가
// fs로 읽은 terms를 그대로 넘겨줌). 페이지 이동 없이 필터만 바뀌는 걸 의도(§UX,
// 블로그 태그처럼 별도 라우트 대신 인페이지 필터로 요청받음).
export default function GlossaryFilterList({ terms, categories, locale = "ko", glossaryPath = "/glossary" }) {
  const T = COPY[locale] || COPY.ko;
  const [active, setActive] = useState(null); // null = 전체
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return terms.filter((term) => {
      if (active && term.category !== active) return false;
      if (!normalized) return true;
      return `${term.term} ${term.shortDef || ""} ${term.category || ""}`.toLocaleLowerCase().includes(normalized);
    });
  }, [terms, active, query]);

  return (
    <div className="glossary-browser">
      <label className="glossary-browser__search">
        <span aria-hidden>⌕</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={T.search} aria-label={T.search} />
        <small>{filtered.length}/{terms.length}</small>
      </label>
      {categories.length > 1 && (
        <div className="glossary-browser__filters">
          <button
            type="button"
            className={`chip${!active ? " is-active" : ""}`}
            onClick={() => setActive(null)}
            aria-pressed={!active}
          >
            {T.all} <span style={{ color: "var(--text-muted)" }}>{terms.length}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.category}
              type="button"
              className={`chip${active === c.category ? " is-active" : ""}`}
              onClick={() => setActive(c.category)}
              aria-pressed={active === c.category}
            >
              {c.category} <span style={{ color: "var(--text-muted)" }}>{c.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="glossary-browser__grid">
        {filtered.map((t) => (
          <Link
            key={t.slug}
            href={`${glossaryPath}/${t.slug}`}
            className="card glossary-card"
            style={{ display: "block", textDecoration: "none" }}
          >
            <div className="card-title">{t.term}</div>
            {t.shortDef && <div className="card-desc">{t.shortDef}</div>}
          </Link>
        ))}
        {filtered.length === 0 && <p className="glossary-browser__empty">{T.empty}</p>}
      </div>
    </div>
  );
}
