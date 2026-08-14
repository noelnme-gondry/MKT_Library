import Link from "next/link";

import { getComparePage } from "@/lib/compareContent";
import { getToolOneLiner } from "@/lib/brandFacts";
import { idToPath } from "@/lib/routeMap";

// 방법 비교 페이지 렌더러(서버 컴포넌트). KO/EN 마크업이 같아야 구조화 데이터와
// 추출 결과도 같아지므로 로케일만 받아 한 곳에서 그린다(§2.11).
//
// 관련 도구의 이름·설명은 routeSeo에서 파생한다 — 여기에 다시 적으면 도구 설명이
// 바뀔 때 이 페이지만 옛말을 하게 된다(§7 "목록을 두 곳에 나열하지 말 것").
export default function ComparePage({ slug, locale = "ko" }) {
  const lang = locale === "en" ? "en" : "ko";
  const page = getComparePage(slug, lang);
  if (!page) return null;

  const t = lang === "en"
    ? { table: "Side by side", guidance: "Which one to use", faq: "Frequently asked questions", tools: "Tools for this", back: "← All method comparisons" }
    : { table: "한눈에 비교", guidance: "언제 무엇을 쓰나", faq: "자주 묻는 질문", tools: "관련 도구", back: "← 방법 비교 전체 보기" };
  const comparePath = lang === "en" ? "/en/compare" : "/compare";
  const toolHref = (toolId) => (lang === "en" ? `/en${idToPath(toolId)}` : idToPath(toolId));

  const tools = page.toolIds
    .map((toolId) => ({ toolId, ...(getToolOneLiner(toolId, lang) || {}) }))
    .filter((tool) => tool.title);

  return (
    <article className="compare-page">
      <span className="compare-page__eyebrow">{page.eyebrow}</span>
      <h1>{page.title}</h1>

      {/* 질문과 한 문장 답을 본문 맨 앞에. 아래 표·해설은 근거다. */}
      <div className="compare-page__answer">
        <p className="compare-page__question">{page.question}</p>
        <p>{page.answer}</p>
      </div>

      <p className="compare-page__lead">{page.lead}</p>

      <h2>{t.table}</h2>
      <div className="table-scroll">
        <table className="compare-page__table">
          <caption>{page.table.caption}</caption>
          <thead>
            <tr>
              {page.table.columns.map((column) => <th key={column} scope="col">{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {page.table.rows.map(([head, ...cells]) => (
              <tr key={head}>
                <th scope="row">{head}</th>
                {cells.map((cell, index) => <td key={`${head}-${index}`}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>{t.guidance}</h2>
      <dl className="compare-page__guidance">
        {page.guidance.map(([when, then]) => (
          <div key={when}>
            <dt>{when}</dt>
            <dd>{then}</dd>
          </div>
        ))}
      </dl>

      <h2>{t.faq}</h2>
      <div className="compare-page__faq">
        {page.faq.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>

      {tools.length ? <>
        <h2>{t.tools}</h2>
        <ul className="compare-page__tools">
          {tools.map((tool) => (
            <li key={tool.toolId}>
              <Link href={toolHref(tool.toolId)}>{tool.title}</Link>
              <span>{tool.description}</span>
            </li>
          ))}
        </ul>
      </> : null}

      <p className="compare-page__back"><Link href={comparePath}>{t.back}</Link></p>
    </article>
  );
}
