import { isRoutePublished, idToPath, ROUTES } from "@/lib/routeMap";
import { TOOL_JOURNEY } from "@/lib/toolConnections";
import { getToolSearchContent } from "@/lib/toolSearchContent";
import { TOOL_REQUIRED_FIELDS, STANDARD_FIELDS } from "@/utils/csvConstants";
import { findMeta } from "@/store/useDataStore";
import { trItemTitle } from "@/lib/enNavCopy";

/* ============================================================
 * toolIndex — "무엇을 할 수 있나" 목록의 단일 출처.
 *
 * 새 목록을 만들지 않는다. 기존 SSOT 네 곳에서 파생한다(§7 — 목록을 두 곳에
 * 나열하지 말고 파생시켜라):
 *   TOOL_JOURNEY        질문 축(상태 확인 → 원인 → 선택 → 검증 → 학습)
 *   store IA            짧은 이름
 *   toolSearchContent   그 도구가 답하는 질문 + 한 줄 답
 *   TOOL_REQUIRED_FIELDS 필요한 컬럼
 *
 * 이름을 짧게 줄이면 이름만으로는 무엇을 하는지 알 수 없다. 그 손실을 메우는
 * 것이 `question`(무엇을 묻는 도구인가)과 `answer`(무엇을 알려주는가)다.
 * 목록에서도 도구 화면에서도 같은 문장을 쓴다 — 두 곳이 다르면 신뢰가 깨진다.
 * ============================================================ */

const PUBLISHED_TOOL_IDS = ROUTES
  .filter((route) => isRoutePublished(route) && /^(5-|9-)/.test(route.id))
  .map((route) => route.id);

// 필요한 컬럼을 사람이 읽는 라벨로. oneOf는 "둘 중 하나"라 슬래시로 잇는다.
const MAX_NEEDS = 4;

function requiredLabels(toolId, locale = "ko") {
  const fields = TOOL_REQUIRED_FIELDS[toolId] || [];
  const label = (key) => {
    const field = STANDARD_FIELDS[key];
    if (!field) return null;
    // EN 라벨이 없으면 한글을 그대로 내보내지 않는다 — 반쪽 번역보다 생략이 낫다(§2.11).
    return locale === "en" ? field.labelEn || null : field.label || null;
  };
  const labels = fields.map((field) => {
    const keys = field && typeof field === "object" && Array.isArray(field.oneOf) ? field.oneOf : [field];
    const parts = keys.map(label);
    // oneOf 중 하나라도 라벨이 없으면 그 항목은 통째로 버린다(반쪽 표기 방지).
    return parts.every(Boolean) ? parts.join("/") : null;
  }).filter(Boolean);
  // 네 개를 넘기면 "필요한 데이터"가 아니라 명세서가 된다. 나머지는 수로 접는다.
  if (labels.length <= MAX_NEEDS) return labels;
  const rest = labels.length - MAX_NEEDS;
  return [...labels.slice(0, MAX_NEEDS), locale === "en" ? `+${rest} more` : `외 ${rest}개`];
}

/** 도구 하나의 인덱스 항목. 없는 도구는 null(빈 항목을 만들지 않는다). */
export function toolIndexEntry(toolId, locale = "ko") {
  if (!PUBLISHED_TOOL_IDS.includes(toolId)) return null;
  const meta = findMeta(toolId);
  const content = getToolSearchContent(toolId, locale) || {};
  return {
    id: toolId,
    href: idToPath(toolId),
    // EN 이름은 사이드바와 같은 경로로 뽑는다 — 두 곳이 다르면 같은 도구가
    // 목록과 내비에서 다른 이름으로 보인다.
    name: (locale === "en" ? trItemTitle(toolId, locale, meta?.titleEn || meta?.title) : meta?.title) || toolId,
    question: content.question || "",
    answer: content.answer || "",
    needs: requiredLabels(toolId, locale),
  };
}

/** 질문 축(TOOL_JOURNEY 스테이지)별로 묶은 전체 인덱스. */
export function toolIndexByStage(locale = "ko") {
  return TOOL_JOURNEY.map((stage) => ({
    id: stage.id,
    title: stage.title[locale] || stage.title.ko,
    description: stage.description[locale] || stage.description.ko,
    tools: stage.tools.map((toolId) => toolIndexEntry(toolId, locale)).filter(Boolean),
  })).filter((stage) => stage.tools.length > 0);
}

/** 평평한 전체 목록(검색·카운트용). */
export function allToolIndexEntries(locale = "ko") {
  return toolIndexByStage(locale).flatMap((stage) => stage.tools);
}

export { PUBLISHED_TOOL_IDS };
