"use client";
import Link from "next/link";
import { downloadTemplateCsv } from "@/components/ds/csvTemplate";

// /templates 페이지 전용 카드 — 서버 컴포넌트(SEO 텍스트)에서 이 클라이언트
// 조각만 분리(다운로드는 document/Blob 필요, §12.19 buildToolTemplateCsv 재사용).
export default function TemplateDownloadCard({ toolId, title, desc, href, unified }) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div>
        <div className="card-title">{title}</div>
        {desc && <div className="card-desc">{desc}</div>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
        <button type="button" className="ab-pill" onClick={() => downloadTemplateCsv(toolId, "tool")}>
          ⬇ 이 도구 템플릿
        </button>
        {unified && (
          <button
            type="button"
            className="ab-pill"
            title="효율·예산 도구(5-2/5-3/5-21/5-22) 공통 통합 템플릿"
            onClick={() => downloadTemplateCsv(toolId, "unified")}
          >
            ⬇ 통합 템플릿
          </button>
        )}
        <Link href={href} className="ab-pill" style={{ textDecoration: "none" }}>
          도구 열기 →
        </Link>
      </div>
    </div>
  );
}
