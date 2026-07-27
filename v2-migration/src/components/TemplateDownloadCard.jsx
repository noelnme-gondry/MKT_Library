"use client";
import Link from "next/link";
import { downloadTemplateCsv } from "@/components/ds/csvTemplate";

// /templates 페이지 전용 카드 — 서버 컴포넌트(SEO 텍스트)에서 이 클라이언트
// 조각만 분리(다운로드는 document/Blob 필요, §12.19 buildToolTemplateCsv 재사용).
const COPY = {
  ko: { tool: "⬇ CSV / Google Sheets 템플릿", unified: "⬇ 통합 템플릿", unifiedTitle: "효율·예산 도구(5-2/5-3/5-21/5-22) 공통 통합 템플릿", open: "도구 열기 →" },
  en: { tool: "⬇ CSV / Google Sheets template", unified: "⬇ Unified template", unifiedTitle: "Unified template shared by efficiency and budget tools (5-2/5-3/5-21/5-22)", open: "Open tool →" },
};

export default function TemplateDownloadCard({ toolId, title, desc, href, unified, locale = "ko" }) {
  const T = COPY[locale] || COPY.ko;
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div>
        <div className="card-title">{title}</div>
        {desc && <div className="card-desc">{desc}</div>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
        <button type="button" className="ab-pill" onClick={() => downloadTemplateCsv(toolId, "tool")}>
          {T.tool}
        </button>
        {unified && (
          <button
            type="button"
            className="ab-pill"
            title={T.unifiedTitle}
            onClick={() => downloadTemplateCsv(toolId, "unified")}
          >
            {T.unified}
          </button>
        )}
        <Link href={href} className="ab-pill" style={{ textDecoration: "none" }}>
          {T.open}
        </Link>
      </div>
    </div>
  );
}
