"use client";
import { useMemo, useState } from "react";
import Link from "next/link";

const COPY = {
  ko: { all: "전체" },
  en: { all: "All" },
};

// 용어사전 카테고리 필터 — 클라이언트 인터랙션만 분리(서버 컴포넌트 page.js가
// fs로 읽은 terms를 그대로 넘겨줌). 페이지 이동 없이 필터만 바뀌는 걸 의도(§UX,
// 블로그 태그처럼 별도 라우트 대신 인페이지 필터로 요청받음).
export default function GlossaryFilterList({ terms, categories, locale = "ko", glossaryPath = "/glossary" }) {
  const T = COPY[locale] || COPY.ko;
  const [active, setActive] = useState(null); // null = 전체

  const filtered = useMemo(() => {
    if (!active) return terms;
    return terms.filter((t) => t.category === active);
  }, [terms, active]);

  return (
    <div>
      {categories.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "1.5rem" }}>
          <button
            type="button"
            className="chip"
            onClick={() => setActive(null)}
            style={{
              cursor: "pointer",
              border: !active ? "1px solid var(--primary)" : undefined,
              color: !active ? "var(--primary)" : undefined,
              fontWeight: !active ? 700 : undefined,
            }}
          >
            {T.all} <span style={{ opacity: 0.6 }}>{terms.length}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.category}
              type="button"
              className="chip"
              onClick={() => setActive(c.category)}
              style={{
                cursor: "pointer",
                border: active === c.category ? "1px solid var(--primary)" : undefined,
                color: active === c.category ? "var(--primary)" : undefined,
                fontWeight: active === c.category ? 700 : undefined,
              }}
            >
              {c.category} <span style={{ opacity: 0.6 }}>{c.count}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {filtered.map((t) => (
          <Link
            key={t.slug}
            href={`${glossaryPath}/${t.slug}`}
            className="card"
            style={{ display: "block", textDecoration: "none" }}
          >
            <div className="card-title">{t.term}</div>
            {t.shortDef && <div className="card-desc">{t.shortDef}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}
