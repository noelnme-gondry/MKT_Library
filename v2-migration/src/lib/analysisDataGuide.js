import Papa from "papaparse";
import { buildToolTemplateCsv } from "@/components/ds/csvTemplate";
import { csvBody } from "@/utils/download";
import { toolIndexByStage } from "@/lib/toolIndex";
import { dataSourceForTool } from "@/lib/dataSources";
import { getToolGuide } from "@/utils/toolGuide";
import { getTemplatePage, TEMPLATE_PAGES } from "@/lib/templateCatalog";

export const INCREMENTALITY_METHODS = [
  { id: "suppression", ko: "광고 노출군과 차단군 비교", en: "Exposed vs holdout groups" },
  { id: "on", ko: "광고를 켠 전후 비교", en: "Before and after ads started" },
  { id: "off", ko: "광고를 끈 전후 비교", en: "Before and after ads stopped" },
];

// 질문과 도구 목록은 홈과 같은 레지스트리에서, 필요한 값·이유·예시는 업로더에서 가져온다.
// 이 페이지는 파일을 읽거나 CSV 그룹에 쓰지 않는 준비 안내다.
export function dataGuideQuestions(locale = "ko") {
  return toolIndexByStage(locale).map(stage => ({ ...stage, question: stage.homeQuestion }));
}

function exampleLabel(key, fields, needs, locale) {
  const known = fields.find(field => field.key === key)?.label;
  if (known && (locale !== "en" || !/[가-힣]/.test(known))) return known;
  const explained = needs.find(need => need.col.split(/[·\s/()]+/).includes(key))?.label;
  return explained || key;
}

export function analysisDataDetail(toolId, locale = "ko", method = "suppression") {
  const tool = dataGuideQuestions(locale).flatMap(stage => stage.tools).find(item => item.id === toolId);
  if (!tool) return null;
  const isIncrementality = toolId === "5-23";
  const safeMethod = INCREMENTALITY_METHODS.some(item => item.id === method) ? method : "suppression";
  // 소재 라우트의 업로더도 performance 도메인인 5-6 안내를 사용한다.
  const guideId = isIncrementality ? `${toolId}:${safeMethod}` : toolId === "9-6" ? "5-6" : toolId;
  const guide = getToolGuide(guideId, locale);
  if (!guide) return null;
  const template = TEMPLATE_PAGES.find(item => item.toolId === toolId);
  const templatePage = template ? getTemplatePage(template.slug, locale) : null;
  const parsed = guide.example ? Papa.parse(guide.example.trim(), { header: true, skipEmptyLines: true }) : null;
  const headers = parsed?.meta.fields || [];
  const fields = templatePage?.fields || [];
  return {
    ...tool, guide, guideId, method: isIncrementality ? safeMethod : null,
    source: guide.source || dataSourceForTool(toolId, locale)?.prep || "",
    // 전후 방식은 통제군 템플릿 계약과 다르므로 잘못된 템플릿 링크를 보여 주지 않는다.
    template: isIncrementality && safeMethod !== "suppression" ? null : template,
    example: {
      columns: headers.map(key => ({ key, label: exampleLabel(key, fields, guide.needs, locale), align: parsed.data.every(row => row[key] !== "" && Number.isFinite(Number(row[key]))) ? "right" : "left" })),
      rows: parsed?.data || [],
    },
  };
}

// 전후 방식은 업로더 가이드의 예시 헤더로 빈 양식을 파생한다. 통제군 양식과 혼용하지 않는다.
export function dataGuideTemplateCsv(detail) {
  return detail.template ? buildToolTemplateCsv(detail.id) : csvBody(detail.example.columns.map(column => column.key), []);
}
