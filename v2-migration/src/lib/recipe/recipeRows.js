import { buildLegacyRows } from "@/lib/data-import/canonical-v2/buildLegacyRows";
import { parseFieldRef, buildValueCanonicalizer } from "@/lib/vocabulary/dataContext";

export function normalizeRecipeValue(value, caseSensitive) {
  const text = String(value ?? "").trim();
  return caseSensitive ? text : text.toLowerCase();
}

/**
 * 엔진에 넣기 전 행 준비: ① 대소문자·공백만 다른 값을 대표 표기로(기본) ② 분석 범위 필터.
 * 보기 필터는 여기서 거르지 않는다 — 분해는 전체로 하고 표에서만 가린다(spec §5).
 */
export function prepareRecipeRows(rows, { levels = [], filters = [], caseSensitive = false }) {
  const analysisFilters = filters.filter((filter) => filter.scope === "analysis");
  const fields = [...new Set([...levels, ...analysisFilters.map((filter) => filter.field)])];
  let prepared = rows;
  const merged = [];
  if (!caseSensitive && prepared.length) {
    const canonicalizers = fields.map((field) => [field, buildValueCanonicalizer(prepared.map((row) => row[field]))]);
    for (const [field, canon] of canonicalizers) {
      for (const group of canon.merged) merged.push({ field, ...group });
    }
    if (merged.length) {
      prepared = prepared.map((row) => {
        const next = { ...row };
        for (const [field, canon] of canonicalizers) {
          if (row[field] != null && row[field] !== "") next[field] = canon.canonicalOf(row[field]);
        }
        return next;
      });
    }
  }
  for (const filter of analysisFilters) {
    const field = filter.field;
    const wanted = new Set(filter.values.map((value) => normalizeRecipeValue(value, caseSensitive)));
    prepared = prepared.filter((row) => wanted.has(normalizeRecipeValue(row[field], caseSensitive)) === (filter.op === "in"));
  }
  return { rows: prepared, merged };
}

/** 원본 컬럼을 추가 투영한다. 사전 계산 행은 합계/잘못된 날짜를 제외하므로 raw[i]와 붙이지 않는다. */
export function recipeRowSource(csvData, refs, toolId) {
  const columns = [...new Set(refs)].filter((ref) => parseFieldRef(ref).kind === "column");
  if (!columns.length) return csvData;
  const mapping = { ...csvData.mapping };
  // 같은 원본 컬럼이 나중에 표준 필드로 매핑돼도 두 투영을 모두 보존한다.
  const occupied = new Set([...(csvData.headers || []), ...Object.keys(mapping)]);
  const additions = columns.map((ref, index) => {
    let alias = `__recipe_column_${index}`;
    while (occupied.has(alias)) alias += "_";
    occupied.add(alias);
    mapping[alias] = ref;
    return { alias, header: parseFieldRef(ref).header };
  });
  const raw = csvData.raw.map((row) => ({ ...row, ...Object.fromEntries(additions.map(({ alias, header }) => [alias, row[header]])) }));
  return { ...csvData, mappedRows: buildLegacyRows({ raw, legacyMapping: mapping, semanticBindings: csvData.mappingBindingsV2 || [], toolId }) };
}
