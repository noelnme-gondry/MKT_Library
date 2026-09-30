import { MATCH_RANK, matchText } from "./hangulMatch";

// 명령 입력창의 단어 사전(docs/result-autonomy-spec.md §3.3). 사전 항목은 두 종류다.
// ① 고정 단어("직전주와 비교") ② 틀 단어 — expand(context)가 올린 데이터에서 후보를 만든다
//    ("Meta만 분석"·"OS별"). 두 종류 모두 고르면 레시피 단계 {id, params}가 된다.
// 단어는 레시피만 바꾼다. 엔진 숫자를 바꾸는 단어는 두지 않는다(§5 정직성).

export const VOCAB_KINDS = Object.freeze(["level", "metric", "period", "filter", "data", "view", "export"]);

// 입력 순위: 라벨 접두 > 라벨 자모 접두 > 라벨 초성 > 별칭 > 부분 포함(§3.2).
export const SUGGEST_RANK = Object.freeze({
  LABEL_PREFIX: 0,
  LABEL_JAMO_PREFIX: 1,
  LABEL_CHOSUNG: 2,
  ALIAS: 3,
  CONTAINS: 4,
});

export const DEFAULT_SUGGEST_LIMIT = 8;

/** 사전을 검증해 id → 항목 Map으로 만든다. 사전은 코드가 쓰므로 틀리면 바로 throw. */
export function buildVocabulary(entries) {
  const map = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry.id !== "string" || !entry.id) throw new Error("vocabulary entry needs an id");
    if (map.has(entry.id)) throw new Error(`duplicate vocabulary id: ${entry.id}`);
    if (!VOCAB_KINDS.includes(entry.kind)) throw new Error(`unknown vocabulary kind: ${entry.id}`);
    if (typeof entry.apply !== "function") throw new Error(`vocabulary entry needs apply(): ${entry.id}`);
    if (!entry.label) throw new Error(`vocabulary entry needs a label: ${entry.id}`);
    map.set(entry.id, entry);
  }
  return map;
}

/** 조건 중 충족되지 않은 것. 문자열 = 그 필드, {oneOf} = 그중 하나. */
export function missingRequirements(requires = [], mappedFields = new Set()) {
  return requires.filter((req) => (typeof req === "string"
    ? !mappedFields.has(req)
    : !(req?.oneOf || []).some((field) => mappedFields.has(field))));
}

/** 라벨은 객체이거나 (params, context) → 객체. 칩·후보 모두 이 함수로 읽는다. */
export function resolveLabel(entry, params = {}, context = {}) {
  const label = typeof entry.label === "function" ? entry.label(params, context) : entry.label;
  return { ko: String(label?.ko ?? ""), en: String(label?.en ?? label?.ko ?? "") };
}

function resolveAliases(entry, params, context) {
  const aliases = typeof entry.aliases === "function" ? entry.aliases(params, context) : entry.aliases;
  if (!aliases) return [];
  if (Array.isArray(aliases)) return aliases.map(String);
  return [...(aliases.ko || []), ...(aliases.en || [])].map(String);
}

/** 사전 → 이 도구·이 데이터에서 고를 수 있는 후보 목록(순서 = 사전 순서 = 추천 순). */
export function listCandidates(vocabulary, context = {}) {
  const toolId = context.toolId ?? null;
  const out = [];
  for (const entry of vocabulary.values()) {
    if (toolId && Array.isArray(entry.tools) && !entry.tools.includes(toolId)) continue;
    const paramsList = typeof entry.expand === "function" ? entry.expand(context) : [{}];
    for (const params of paramsList) {
      out.push({
        id: entry.id,
        params,
        entry,
        label: resolveLabel(entry, params, context),
        aliases: resolveAliases(entry, params, context),
      });
    }
  }
  return out;
}

function rankCandidate(query, candidate, locale) {
  const other = locale === "en" ? "ko" : "en";
  const primary = matchText(query, candidate.label[locale]);
  if (primary === MATCH_RANK.PREFIX) return SUGGEST_RANK.LABEL_PREFIX;
  if (primary === MATCH_RANK.JAMO_PREFIX) return SUGGEST_RANK.LABEL_JAMO_PREFIX;
  if (primary === MATCH_RANK.CHOSUNG) return SUGGEST_RANK.LABEL_CHOSUNG;
  // 한국어 화면에서 "channel"을 쳐도 찾게 — 다른 언어 라벨은 별칭으로 본다.
  const aliasRanks = [candidate.label[other], ...candidate.aliases]
    .map((text) => matchText(query, text))
    .filter((rank) => rank != null);
  if (aliasRanks.some((rank) => rank < MATCH_RANK.CONTAINS)) return SUGGEST_RANK.ALIAS;
  if (primary === MATCH_RANK.CONTAINS || aliasRanks.length) return SUGGEST_RANK.CONTAINS;
  return null;
}

/**
 * 입력 → 후보. 못 쓰는 단어도 숨기지 않고 enabled:false + missing(필요한 컬럼)을 돌려준다
 * (§12.31 "못 쓰는 도구는 숨기지 말고"). 같은 순위 안에서는 쓸 수 있는 단어가 먼저다.
 */
export function suggest(vocabulary, query, context = {}) {
  const locale = context.locale === "en" ? "en" : "ko";
  const mappedFields = context.mappedFields instanceof Set ? context.mappedFields : new Set(context.mappedFields || []);
  const limit = Number.isInteger(context.limit) && context.limit > 0 ? context.limit : DEFAULT_SUGGEST_LIMIT;
  return listCandidates(vocabulary, context)
    .map((candidate, order) => {
      const rank = rankCandidate(query, candidate, locale);
      if (rank == null) return null;
      const missing = missingRequirements(candidate.entry.requires, mappedFields);
      return { order, suggestion: { ...candidate, rank, enabled: missing.length === 0, missing } };
    })
    .filter(Boolean)
    .sort((a, b) => a.suggestion.rank - b.suggestion.rank
      || Number(b.suggestion.enabled) - Number(a.suggestion.enabled)
      || a.order - b.order)
    .slice(0, limit)
    .map((item) => item.suggestion);
}
