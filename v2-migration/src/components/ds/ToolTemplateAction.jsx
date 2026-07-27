"use client";

import Link from "next/link";

import { trackProductEvent } from "@/lib/analytics";
import {
  downloadTemplateCsv,
  getToolTemplateFields,
  hasToolTemplate,
} from "@/components/ds/csvTemplate";

const COPY = {
  ko: {
    eyebrow: "MAPPING TEMPLATE",
    title: "분석 전에 컬럼부터 맞추세요",
    deck: "필수·선택 컬럼이 들어간 빈 CSV입니다. 원본 데이터를 이 구조에 맞추거나 업로드 뒤 매핑에서 같은 의미의 컬럼을 연결하면 됩니다.",
    download: "매핑 템플릿 받기",
    all: "전체 템플릿 보기",
    fields: "포함 컬럼",
  },
  en: {
    eyebrow: "MAPPING TEMPLATE",
    title: "Align the columns before analysis",
    deck: "This blank CSV contains the required and optional fields. Reshape the source data or map equivalent columns after upload.",
    download: "Download mapping template",
    all: "View all templates",
    fields: "Included fields",
  },
};

export default function ToolTemplateAction({
  toolId,
  locale = "ko",
  compact = false,
  reason,
  source = "analysis_tool",
}) {
  const lang = locale === "en" ? "en" : "ko";
  if (!hasToolTemplate(toolId)) return null;
  const T = COPY[lang];
  const fields = getToolTemplateFields(toolId);
  const visibleFields = fields.slice(0, compact ? 4 : 7);

  const download = () => {
    downloadTemplateCsv(toolId);
    trackProductEvent("mapping_template_download", {
      tool_id: toolId,
      source,
      placement: compact ? "compact_template_action" : "template_action",
      locale: lang,
    });
  };

  return (
    <aside className={`tool-template-action ${compact ? "is-compact" : ""}`}>
      <div className="tool-template-action__copy">
        <span>{T.eyebrow}</span>
        <strong>{reason || T.title}</strong>
        {!compact && <p>{T.deck}</p>}
        <small>
          {T.fields}: {visibleFields.join(" · ")}
          {fields.length > visibleFields.length ? ` +${fields.length - visibleFields.length}` : ""}
        </small>
      </div>
      <div className="tool-template-action__actions">
        <button type="button" onClick={download}>{T.download} ↓</button>
        {!compact && <Link href={`${lang === "en" ? "/en" : ""}/templates`}>{T.all} →</Link>}
      </div>
    </aside>
  );
}
