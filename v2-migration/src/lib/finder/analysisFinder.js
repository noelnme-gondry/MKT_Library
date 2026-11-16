import { toolIndexByStage, fieldLabels } from "@/lib/toolIndex";
import { idToPath } from "@/lib/routeMap";
import { TOOL_GROUP } from "@/lib/toolGroups";
import { TOOL_OPTIONAL_FIELDS } from "@/utils/csvConstants";
import { exampleHref } from "@/lib/exampleLink";
import FINDER_EXAMPLES from "@/lib/finder/finderExamples.json";
import { DATA_SOURCE_FAMILIES, DATA_SOURCE_FAMILY_IDS } from "@/lib/dataSources";

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

/*
 * 같은 파일을 쓰는 도구는 한 카드로 묶는다(product-ssot §5.1, 2026-11-06 사용자 결정 "묶기").
 * 묶인 도구는 사라지지 않는다 — 대표 카드의 목록에 이름·질문·링크로 남고, 검색·저장·상황에서도 그 카드로 찾힌다.
 * 광고 성과 파일: 운영 플래너가 출발점이고 나머지는 그 단계의 상세다(lib/operationsFlow).
 * 주간 채널 패널: 다섯 분석이 같은 파일·매핑 허브(5-18)를 쓴다 — 카드 이름은 하나의 분석이 아니라 그 묶음이다.
 */
export const FINDER_CARD_GROUPS = [
  { id: "operations", lead: "5-31", members: ["5-2", "5-21", "5-3"], membersLabel: { ko: "자세히 보기", en: "In detail" } },
  {
    id: "weekly-panel", lead: "5-18-trend", members: ["5-18-paid-organic", "5-18-cannibal", "5-18-mmm", "5-18-forecast"],
    membersLabel: { ko: "같은 파일로 하는 분석", en: "Also with this file" },
    name: { ko: "주간 채널 패널 분석", en: "Weekly channel panel analyses" },
    question: { ko: "추세·유입 변화·잠식·채널 기여·다음 기간 예측을 한 파일로 볼까?", en: "Trends, paid-organic shifts, cannibalization, channel contribution and forecasts from one file?" },
    // 다섯 분석이 함께 쓰는 매핑 허브. 내 파일은 여기서 한 번 올리고 분석을 고른다.
    hrefId: "5-18",
  },
];
const MEMBER_TO_GROUP = new Map(FINDER_CARD_GROUPS.flatMap((group) => group.members.map((id) => [id, group])));
const LEAD_TO_GROUP = new Map(FINDER_CARD_GROUPS.map((group) => [group.lead, group]));

function optionalLabels(toolId, locale) {
  const keys = (TOOL_OPTIONAL_FIELDS[toolId] || []).map((field) => (field && typeof field === "object" && Array.isArray(field.oneOf) ? field.oneOf.join("/") : field));
  const labels = [...new Set(fieldLabels(keys, locale))];
  if (labels.length <= MAX_OPTIONAL) return labels;
  const rest = labels.length - MAX_OPTIONAL;
  return [...labels.slice(0, MAX_OPTIONAL), locale === "en" ? `+${rest} more` : `외 ${rest}개`];
}

/** 상황 목록(칩) — 번호 이름표·제목·사용자의 말(질문)·그 상황의 분석 수(묶인 카드 안의 분석도 센다). */
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

/**
 * 보이는 카드에 든 분석 수. 카드 수가 아니라 분석 수를 센다 — 묶은 카드 하나에 분석이 여럿이다.
 * 상황을 골랐으면 그 상황에 속한 분석만 센다(다른 상황의 묶음 분석은 카드에 보여도 세지 않는다).
 */
export function countFinderAnalyses(cards, situation = "all", savedIds = []) {
  if (situation === "saved") return cards.reduce((sum, card) => sum + card.toolIds.filter((id) => savedIds.includes(id)).length, 0);
  const scoped = situation !== "all";
  return cards.reduce((sum, card) => sum + (scoped
    ? card.analyses.filter((analysis) => analysis.situationId === situation).length
    : card.analyses.length), 0);
}

/** 분석 카드 전체 — 상황 순서 그대로(상황 안에서는 TOOL_JOURNEY 순서). */
export function finderCards(locale = "ko") {
  const stages = toolIndexByStage(locale);
  const all = stages.flatMap((stage) => stage.tools.map((tool) => ({ tool, stage })));
  const names = Object.fromEntries(all.map(({ tool }) => [tool.id, tool.name]));
  const byId = new Map(all.map((entry) => [entry.tool.id, entry]));
  const pick = (pair) => (pair ? (locale === "en" ? pair.en : pair.ko) : "");
  return all.filter(({ tool }) => !MEMBER_TO_GROUP.has(tool.id)).map(({ tool, stage }) => {
    const group = TOOL_GROUP[tool.id];
    const cardGroup = LEAD_TO_GROUP.get(tool.id) || null;
    const members = (cardGroup?.members || []).filter((id) => byId.has(id)).map((id) => {
      const { tool: member, stage: memberStage } = byId.get(id);
      return { id, name: member.name, href: member.href, question: member.question, situationId: memberStage.id, searchText: [member.name, member.question, member.answer, member.searchText, ...member.outputs].filter(Boolean).join(" ") };
    });
    const memberIds = new Set(members.map((member) => member.id));
    // 묶음 이름이 따로 있는 카드(주간 채널 패널)는 대표 분석도 목록에 넣는다 — 카드 이름이 그 분석 하나를 가리키지 않으므로.
    const named = Boolean(cardGroup?.name);
    const leadMember = { id: tool.id, name: tool.name, href: tool.href, question: tool.question, situationId: stage.id };
    const sameFile = group
      ? all.filter(({ tool: other }) => other.id !== tool.id && !memberIds.has(other.id) && !MEMBER_TO_GROUP.has(other.id) && TOOL_GROUP[other.id] === group).map(({ tool: other }) => ({ id: other.id, name: names[other.id], href: other.href }))
      : [];
    const hrefId = cardGroup?.hrefId;
    const example = FINDER_EXAMPLES[tool.id]?.[locale === "en" ? "en" : "ko"] || null;
    const optional = optionalLabels(tool.id, locale);
    return {
      id: tool.id,
      name: pick(cardGroup?.name) || tool.name,
      href: hrefId ? idToPath(hrefId) : tool.href,
      question: pick(cardGroup?.question) || tool.question,
      // 묶음 카드는 분석 하나의 답·결과 구성을 카드 전체의 것처럼 보여 주지 않는다(목록의 질문이 대신 말한다).
      answer: named ? "" : tool.answer,
      // 결론 예시가 없을 때 "보고서에 담기는 것" — SEO 답(answer)보다 짧고 구체적이다.
      outputs: named ? [] : tool.outputs,
      situation: { id: stage.id, label: stage.label, title: stage.title },
      // 결론 예시는 예시 데이터로 실제 계산한 문장일 때만. 없으면 화면이 보고서 구성(outputs)을 쓴다.
      example: named ? null : example,
      source: tool.source,
      required: tool.needs,
      optional,
      exampleHref: exampleHref(tool.id, locale),
      sameFile,
      // 묶은 도구: 대표 카드 안의 목록. 카드는 묶인 도구가 속한 상황에서도 보인다.
      members: named ? [leadMember, ...members] : members,
      membersLabel: pick(cardGroup?.membersLabel),
      // 카드에 든 분석 전부(대표 + 묶인 분석) — 저장·상황·개수가 이 목록을 읽는다.
      analyses: [{ id: tool.id, situationId: stage.id }, ...members.map((member) => ({ id: member.id, situationId: member.situationId }))],
      toolIds: [tool.id, ...members.map((member) => member.id)],
      situationIds: [...new Set([stage.id, ...members.map((member) => member.situationId)])],
      searchText: [tool.name, pick(cardGroup?.name), pick(cardGroup?.question), tool.question, tool.answer, tool.searchText, ...tool.outputs, ...tool.needs, ...optional, ...members.map((member) => member.searchText), tool.source?.file, tool.source?.family, tool.source?.where, stage.title, stage.homeQuestion].filter(Boolean).join(" ").toLocaleLowerCase(),
    };
  });
}

/**
 * 파일 종류(출처 묶음 6종) — "어떤 파일을 갖고 계세요?"로 고르는 두 번째 입구.
 * 분석이 하나도 없는 묶음은 내지 않는다(누르면 빈 목록이 되는 버튼을 만들지 않는다).
 */
export function finderFamilies(locale = "ko") {
  const cards = finderCards(locale);
  const pick = (pair) => (locale === "en" ? pair.en : pair.ko);
  return DATA_SOURCE_FAMILY_IDS
    .map((id) => ({ id, name: pick(DATA_SOURCE_FAMILIES[id].name), where: pick(DATA_SOURCE_FAMILIES[id].where), count: cards.filter((card) => card.source?.familyId === id).length }))
    .filter((family) => family.count > 0);
}

/** 주소의 ?file= 값을 알려진 파일 종류로만 받는다(모르는 값은 null). */
export function parseFinderFamily(value) {
  return DATA_SOURCE_FAMILY_IDS.includes(value) ? value : null;
}

/**
 * 상황·파일 종류·검색어·저장 여부로 거른다. 검색어는 공백으로 나눈 모든 낱말이 들어 있어야 한다.
 * situation: 상황 id | "all" | "saved". family: 출처 묶음 id | null.
 */
export function filterFinderCards(cards, { situation = "all", family = null, query = "", savedIds = [] } = {}) {
  const terms = String(query || "").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return cards.filter((card) => {
    if (family && card.source?.familyId !== family) return false;
    if (situation === "saved" && !card.toolIds.some((id) => savedIds.includes(id))) return false;
    if (situation !== "all" && situation !== "saved" && !card.situationIds.includes(situation)) return false;
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
