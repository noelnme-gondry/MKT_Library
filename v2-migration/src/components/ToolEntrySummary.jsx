import { getToolSearchContent } from "@/lib/toolSearchContent";
import { getToolGuide } from "@/utils/toolGuide";
import { isRouteIndexable } from "@/lib/routeMap";

// 참고 창을 열기 전에도 목적·입력·활용 한계는 읽힌다. 카피는 기존 도구 정본에서 파생한다.
export default function ToolEntrySummary({ toolId, locale = "ko" }) {
  const content = getToolSearchContent(toolId, locale);
  if (!isRouteIndexable(toolId) || !content) return null;
  const needs = (getToolGuide(toolId, locale)?.needs || []).filter(field => field.required).map(field => field.label);
  const application = content.sections?.at(-1)?.[1];
  const titleId = `tool-entry-summary-${toolId}`;
  return <section className="tool-entry-summary" aria-labelledby={titleId}>
    <h2 id={titleId}>{content.question || content.title}</h2>
    <p>{content.lead || content.answer}</p>
    {needs.length > 0 && <p>{locale === "en" ? "Required data: " : "필요한 데이터: "}{needs.join(" · ")}</p>}
    {application && <p>{application}</p>}
  </section>;
}
