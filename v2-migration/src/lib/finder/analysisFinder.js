import { toolIndexByStage, fieldLabels } from "@/lib/toolIndex";
import { TOOL_GROUP } from "@/lib/toolGroups";
import { TOOL_OPTIONAL_FIELDS } from "@/utils/csvConstants";
import { exampleHref } from "@/lib/exampleLink";
import FINDER_EXAMPLES from "@/lib/finder/finderExamples.json";

/* ============================================================
 * 분석 찾기 — 앱 안의 입구(홈 목록·/start·분석 방법 둘러보기·/data-guide)를
 * 한 곳으로 모은 화면의 카드 데이터(product-ssot §1.1c 결정 1·분석 카드 계약).
 *
 * 새 목록을 만들지 않는다. 상황·이름·질문·필요한 파일은 toolIndex(→ TOOL_JOURNEY ·
 * IA · toolSearchContent · TOOL_REQUIRED_FIELDS · dataSources)에서, 결론 예시는
 * 실제 엔진 결과의 파생본(finderExamples.json)에서, 같은 파일로 되는 분석은
 * TOOL_GROUP에서 파생한다.
 *
 * 카드 한 장 = 쓰는 상황 · 결론 예시(없으면 받게 될 결과 한 줄) · 필요한 파일
 * (이름 → 출처 → 필수 → 있으면 더 좋은) · 예시 보고서 보기 / 내 파일로 하기 ·
 * 같은 파일로 되는 다른 분석.
 * ============================================================ */

const MAX_OPTIONAL = 4;

function optionalLabels(toolId, locale) {
  const keys = (TOOL_OPTIONAL_FIELDS[toolId] || []).map((field) => (field && typeof field === "object" && Array.isArray(field.oneOf) ? field.oneOf.join("/") : field));
  const labels = [...new Set(fieldLabels(keys, locale))];
  if (labels.length <= MAX_OPTIONAL) return labels;
  const rest = labels.length - MAX_OPTIONAL;
  return [...labels.slice(0, MAX_OPTIONAL), locale === "en" ? `+${rest} more` : `외 ${rest}개`];
}

/** 상황 목록(칩) — 번호 이름표·제목·사용자의 말(질문)·분석 수. */
export function finderSituations(locale = "ko") {
  return toolIndexByStage(locale).map((stage) => ({
    id: stage.id,
    label: stage.label,
    title: stage.title,
    question: stage.homeQuestion,
    description: stage.description,
    count: stage.tools.length,
  }));
}

/** 분석 카드 전체 — 상황 순서 그대로(상황 안에서는 TOOL_JOURNEY 순서). */
export function finderCards(locale = "ko") {
  const stages = toolIndexByStage(locale);
  const all = stages.flatMap((stage) => stage.tools.map((tool) => ({ tool, stage })));
  const names = Object.fromEntries(all.map(({ tool }) => [tool.id, tool.name]));
  return all.map(({ tool, stage }) => {
    const group = TOOL_GROUP[tool.id];
    const sameFile = group
      ? all.filter(({ tool: other }) => other.id !== tool.id && TOOL_GROUP[other.id] === group).map(({ tool: other }) => ({ id: other.id, name: names[other.id], href: other.href }))
      : [];
    const example = FINDER_EXAMPLES[tool.id]?.[locale === "en" ? "en" : "ko"] || null;
    const optional = optionalLabels(tool.id, locale);
    return {
      id: tool.id,
      name: tool.name,
      href: tool.href,
      question: tool.question,
      answer: tool.answer,
      // 결론 예시가 없을 때 "보고서에 담기는 것" — SEO 답(answer)보다 짧고 구체적이다.
      outputs: tool.outputs,
      situation: { id: stage.id, label: stage.label, title: stage.title },
      // 결론 예시는 예시 데이터로 실제 계산한 문장일 때만. 없으면 화면이 보고서 구성(outputs)을 쓴다.
      example,
      source: tool.source,
      required: tool.needs,
      optional,
      exampleHref: exampleHref(tool.id, locale),
      sameFile,
      searchText: [tool.name, tool.question, tool.answer, tool.searchText, ...tool.outputs, ...tool.needs, ...optional, tool.source?.file, tool.source?.family, tool.source?.where, stage.title, stage.homeQuestion].filter(Boolean).join(" ").toLocaleLowerCase(),
    };
  });
}

/**
 * 상황·검색어·저장 여부로 거른다. 검색어는 공백으로 나눈 모든 낱말이 들어 있어야 한다.
 * situation: 상황 id | "all" | "saved".
 */
export function filterFinderCards(cards, { situation = "all", query = "", savedIds = [] } = {}) {
  const terms = String(query || "").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return cards.filter((card) => {
    if (situation === "saved" && !savedIds.includes(card.id)) return false;
    if (situation !== "all" && situation !== "saved" && card.situation.id !== situation) return false;
    return terms.every((term) => card.searchText.includes(term));
  });
}

/** 주소의 ?situation= 값을 알려진 상황 id로만 받는다(모르는 값은 전체). */
export function parseFinderSituation(value, locale = "ko") {
  const ids = finderSituations(locale).map((situation) => situation.id);
  return ids.includes(value) ? value : "all";
}

export const FINDER_PATH = "/start";

/** 상황 하나로 분석 찾기를 여는 주소 — 홈의 상황 고르기가 쓴다. */
export function finderHref(situationId = "all", locale = "ko") {
  const base = `${locale === "en" ? "/en" : ""}${FINDER_PATH}`;
  return situationId && situationId !== "all" ? `${base}?situation=${encodeURIComponent(situationId)}#finder` : `${base}#finder`;
}
