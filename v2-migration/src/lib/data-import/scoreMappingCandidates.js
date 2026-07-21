import { profileColumns } from "./profileColumns";

const clamp = (value) => Math.max(0, Math.min(1, value));
const compact = (value) => String(value || "").toLowerCase().trim().replace(/[\s_-]/g, "");

function headerScore(header, key, aliases = []) {
  const normalized = compact(header);
  if (normalized === compact(key)) return { score: 0.82, reason: "표준 필드명 일치" };
  if (aliases.some((alias) => normalized === compact(alias))) return { score: 0.78, reason: "컬럼 별칭 일치" };
  if (aliases.some((alias) => normalized.includes(compact(alias)) || compact(alias).includes(normalized))) return { score: 0.42, reason: "컬럼명 유사" };
  return { score: 0, reason: null };
}

// 값 어휘 매칭 — 헤더명이 아니라 컬럼 "값"으로 판별하는 필드용(예: source=organic/paid).
// 컬럼의 고유 non-empty 값 중 어휘(vocab)에 드는 비율이 높으면 강한 점수를 준다.
// channel의 "source" 헤더 별칭(0.78)을 이기도록 매칭 시 0.9를 준다(값이 organic/paid면 source 우선).
function vocabScore(distinctValues, vocabulary) {
  if (!vocabulary?.length || !distinctValues?.length) return { score: 0, reason: null };
  const vocab = vocabulary.map(compact).filter(Boolean);
  const hit = distinctValues.filter((value) => {
    const v = compact(value);
    return v && vocab.some((term) => v === term || v.includes(term) || term.includes(v));
  }).length;
  const rate = hit / distinctValues.length;
  if (rate >= 0.6) return { score: 0.9, reason: "값이 소스 어휘(오가닉/페이드 등)와 일치" };
  return { score: 0, reason: null };
}

function typeScore(profile, type) {
  if (!profile) return { score: 0, reason: null };
  if (type === "date" && profile.dateRate >= 0.8) return { score: 0.18, reason: "값 형식이 날짜" };
  if (type === "percent" && profile.percentRate >= 0.5) return { score: 0.18, reason: "값 형식이 퍼센트" };
  if (type === "number" && profile.numericRate >= 0.8) return { score: 0.12, reason: "값 형식이 숫자" };
  if ((type === "string" || type === "enum") && profile.numericRate < 0.5 && profile.dateRate < 0.5) return { score: 0.08, reason: "값 형식이 범주형 텍스트" };
  return { score: 0, reason: null };
}

export function scoreMappingCandidates({ headers = [], rows = [], allowedKeys, fields = {} } = {}) {
  const profiles = profileColumns(headers, rows);
  const profileByHeader = Object.fromEntries(profiles.map((profile) => [profile.header, profile]));
  const keys = (allowedKeys?.length ? allowedKeys : Object.keys(fields)).filter((key) => fields[key]);
  const needsVocab = keys.some((key) => fields[key]?.valueVocabulary?.length);
  // 값 어휘 판별이 필요한 필드가 있을 때만 컬럼 고유값을 수집(불필요 순회 회피).
  const distinctByHeader = needsVocab ? Object.fromEntries(headers.map((header) => {
    const set = new Set();
    for (const row of (rows || []).slice(0, 500)) {
      const raw = row?.[header];
      if (raw == null) continue;
      const text = String(raw).trim();
      if (text) set.add(text);
      if (set.size > 40) break; // 저카디널리티 차원만 대상 — 고유값 많으면 소스 아님
    }
    return [header, [...set]];
  })) : {};
  const byHeader = {};

  headers.forEach((header) => {
    const candidates = keys.map((key) => {
      const field = fields[key];
      const fromHeader = headerScore(header, key, field.aliases);
      const fromType = typeScore(profileByHeader[header], field.type);
      // 값 어휘(valueVocabulary) 필드는 헤더명이 아니라 "값"으로만 자동 판별한다.
      // 예: 필드 키가 "source"라 헤더명이 "source"면 키명 일치(0.82)로 잡히지만,
      // 그 값이 구글/메타면 channel이어야 한다 → 값이 organic/paid일 때만 매핑되게
      // 헤더/타입 점수를 무시하고 어휘 점수만 쓴다(값 아니면 auto-map 안 함).
      if (field.valueVocabulary) {
        const fromVocab = vocabScore(distinctByHeader[header], field.valueVocabulary);
        return { field: key, confidence: clamp(fromVocab.score), reasons: [fromVocab.reason].filter(Boolean) };
      }
      return {
        field: key,
        confidence: clamp(fromHeader.score + fromType.score),
        reasons: [fromHeader.reason, fromType.reason].filter(Boolean),
      };
    }).filter((candidate) => candidate.confidence > 0).sort((a, b) => b.confidence - a.confidence);
    byHeader[header] = candidates;
  });

  const selections = Object.fromEntries(headers.map((header) => {
    const top = byHeader[header][0];
    return [header, top && top.confidence >= 0.6 ? top.field : "__ignore__"];
  }));
  const conflicts = findMappingConflicts(selections);

  return { profiles, candidates: byHeader, selections, conflicts };
}

export function findMappingConflicts(selections = {}) {
  return [...new Set(Object.values(selections).filter((field) => field && field !== "__ignore__"))]
    .map((field) => ({ field, headers: Object.entries(selections).filter(([, selected]) => selected === field).map(([header]) => header) }))
    .filter((conflict) => conflict.headers.length > 1);
}
