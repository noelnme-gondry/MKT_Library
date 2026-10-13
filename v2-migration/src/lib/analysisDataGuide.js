import Papa from "papaparse";
import { buildToolTemplateCsv } from "@/components/ds/csvTemplate";
import { csvBody } from "@/utils/download";
import { toolIndexByStage } from "@/lib/toolIndex";
import { TOOL_GROUP } from "@/lib/toolGroups";
import { getToolGuide } from "@/utils/toolGuide";
import { getTemplatePage, TEMPLATE_PAGES } from "@/lib/templateCatalog";

export const DATA_GUIDE_PATH = "/data-guide";
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

const SOURCES = {
  efficiency: ["광고 플랫폼·MMP의 일별 캠페인 성과. 소재도 볼 때는 소재 단위로 내보내세요.", "Daily campaign performance from ad platforms or your MMP. Export creative-level rows to examine creatives."],
  creative: ["광고 플랫폼의 일별 소재 보고서. 같은 소재가 여러 날짜에 기록되어 있어야 변화도 볼 수 있습니다.", "Daily creative reports from an ad platform. Repeated dates per creative let you examine changes."],
  response: ["MMP·분석 도구의 전체 성과와 광고 플랫폼별 지출을 같은 날짜나 주차로 합친 표.", "A table joining total outcomes from your MMP or analytics tool with channel spend, on the same dates or weeks."],
  experiment: ["실험 도구에서 집계한 그룹별 대상자 수와 전환 수. 실험 배정 기준을 함께 확인하세요.", "Group-level population and conversions from your experiment tool. Check how participants were assigned."],
  incrementality: ["광고 노출·차단 실험 결과 또는 집행을 바꾼 전후의 성과 기록. 일반 캠페인 보고서만으로 실험군을 만들 수는 없습니다.", "Exposure/holdout experiment results or outcomes before and after a spend change. An ordinary campaign report does not establish experiment groups."],
  brand_incrementality: ["검색·직접 유입 등의 날짜별 성과와 브랜드 캠페인 집행 기록을 합친 표.", "Daily search or direct-traffic outcomes joined with the brand campaign's on/off record."],
  collinearity: ["광고 플랫폼별 지출을 같은 날짜 기준으로 모은 표. 최소 두 채널이 필요합니다.", "Spend from at least two ad channels aligned to the same dates."],
  aha: ["제품 분석·이벤트 로그를 사용자별로 집계한 표. 초기 행동을 센 기간과 목표 달성을 확인한 기간을 구분하세요.", "Product-event logs aggregated by user. Separate the early-action window from the later outcome window."],
  content_attr: ["콘텐츠별 성과 보고서에 훅·자막·길이 등 직접 기록한 요소를 붙인 표.", "Content performance joined with recorded features such as hooks, captions and length."],
  asa_keyword: ["Apple Ads 검색어 보고서. 캠페인·광고그룹 예산과 목표 단가가 있으면 조정 판단에도 쓰입니다.", "Apple Ads search-term reports. Campaign or ad-group budgets and target costs also support adjustment decisions."],
  aso_store: ["App Store Connect·Google Play Console의 유입 경로별 스토어 실적.", "Store performance by traffic source from App Store Connect or Google Play Console."],
  subscription_survival: ["핵심 액션의 시작·종료 기록을 관측 기간과 종료 여부로 정리한 표. 관측 종료까지 유지한 사례도 포함하세요.", "Action start/end records summarized as observed duration and exit status. Include cases still active at the observation cutoff."],
  segment_composition: ["두 기간의 국가·연령·플랜 등 구분값별 인원 집계. 전체 인원과 부분 집계를 중복해서 더하지 마세요.", "Population counts by country, age or plan for two periods. Do not add total rows to their component counts."],
  multitouch: ["AppsFlyer 설치 raw 리포트. 최종 유입과 contributor 기록을 함께 내보내세요.", "AppsFlyer raw install reports containing both the attributed source and contributor records."],
};


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
    source: guide.source || SOURCES[TOOL_GROUP[toolId]]?.[locale === "en" ? 1 : 0] || "",
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
