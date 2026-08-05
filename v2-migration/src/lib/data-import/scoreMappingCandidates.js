import { profileColumns } from "./profileColumns";

// 소수 덧셈(0.82 + 0.08)이 0.899999...가 되는 경우를 막는다. 확정 기준은
// 사람이 읽는 0.90이므로, 계산도 그 단위에서 안정적으로 비교한다.
const clamp = (value) => Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
const compact = (value) => String(value || "").toLowerCase().trim().replace(/[\s_-]/g, "");
const AUTO_CONFIRM_THRESHOLD = 0.9;
const REVIEW_THRESHOLD = 0.6;
const AMBIGUITY_MARGIN = 0.12;

function headerScore(header, key, aliases = []) {
  const normalized = compact(header);
  // 정확한 표준 필드명은 별칭보다 한 단계 우선한다. 예: 5-21의 `cost` 헤더는
  // cost(표준명)와 spend(별칭)가 동점이면 안 된다.
  if (normalized === compact(key)) return { score: 0.84, reason: "표준 필드명 일치", isExactFieldName: true };
  // 검증된 별칭도 강한 의미 신호지만, 표준 필드명과의 동점은 만들지 않는다.
  if (aliases.some((alias) => normalized === compact(alias))) return { score: 0.82, reason: "컬럼 별칭 일치" };
  if (aliases.some((alias) => normalized.includes(compact(alias)) || compact(alias).includes(normalized))) return { score: 0.42, reason: "컬럼명 유사" };
  return { score: 0, reason: null };
}

// 값 어휘 매칭 — 헤더명이 아니라 컬럼 "값"으로 판별하는 필드용(예: source=organic/paid).
// 컬럼의 고유 non-empty 값 중 어휘(vocab)에 드는 비율이 높으면 강한 점수를 준다.
// channel의 "source" 헤더 별칭과 동률이 되지 않도록, 값이 organic/paid면
// source가 확실히 우선하도록 0.96을 준다.
function vocabScore(distinctValues, vocabulary, profile) {
  if (!vocabulary?.length || !distinctValues?.length) return { score: 0, reason: null };
  // 0/1처럼 숫자로만 된 열은 집행 여부인지 비용/성과인지 값만으로 확정할 수 없다.
  // 특히 짧은 토큰의 부분일치는 850000 같은 일반 숫자도 "0"과 맞는다고 오판한다.
  if (profile?.numericRate >= 0.8) return { score: 0, reason: null };
  const vocab = vocabulary.map(compact).filter(Boolean);
  const hit = distinctValues.filter((value) => {
    const v = compact(value);
    return v && vocab.some((term) => {
      if (term.length <= 2 || v.length <= 2) return v === term;
      return v === term || v.includes(term) || term.includes(v);
    });
  }).length;
  const rate = hit / distinctValues.length;
  if (rate >= 0.6) return { score: 0.96, reason: "값이 소스 어휘(오가닉/페이드 등)와 일치" };
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
        const fromVocab = vocabScore(distinctByHeader[header], field.valueVocabulary, profileByHeader[header]);
        return { field: key, confidence: clamp(fromVocab.score), reasons: [fromVocab.reason].filter(Boolean) };
      }
      return {
        field: key,
        confidence: clamp(fromHeader.score + fromType.score),
        reasons: [fromHeader.reason, fromType.reason].filter(Boolean),
        isExactFieldName: Boolean(fromHeader.isExactFieldName),
      };
    }).filter((candidate) => candidate.confidence > 0).sort((a, b) => b.confidence - a.confidence);
    byHeader[header] = candidates;
  });

  const selections = Object.fromEntries(headers.map((header) => {
    const top = byHeader[header][0];
    return [header, top && top.confidence >= REVIEW_THRESHOLD ? top.field : "__ignore__"];
  }));
  const conflicts = findMappingConflicts(selections);
  const assessments = assessMappingConfidence({ selections, candidates: byHeader });

  return { profiles, candidates: byHeader, selections, conflicts, assessments };
}

export function findMappingConflicts(selections = {}) {
  return [...new Set(Object.values(selections).filter((field) => field && field !== "__ignore__"))]
    .map((field) => ({ field, headers: Object.entries(selections).filter(([, selected]) => selected === field).map(([header]) => header) }))
    .filter((conflict) => conflict.headers.length > 1);
}

// 자동 매핑 결과를 "확정/확인 권장/반드시 확인"으로 분리한다. 사용자가 드롭다운을
// 바꾼 항목은 자동 추측이 아니라 명시적 선택이므로 수동 확인 완료로 처리한다.
export function assessMappingConfidence({ selections = {}, candidates = {}, initialSelections = {}, confirmedHeaders = new Set() } = {}) {
  const conflicts = findMappingConflicts(selections);
  const conflictHeaders = new Set(conflicts.flatMap((conflict) => conflict.headers));
  return Object.entries(selections).map(([header, field]) => {
    if (!field || field === "__ignore__") return { header, field, state: "ignored", confidence: 0, reasons: [] };
    const headerCandidates = candidates[header] || [];
    const selected = headerCandidates.find((candidate) => candidate.field === field);
    const top = headerCandidates[0];
    const runnerUp = headerCandidates.find((candidate) => candidate.field !== field);
    const wasManuallyChanged = initialSelections[header] != null && initialSelections[header] !== field;
    if (conflictHeaders.has(header)) return { header, field, state: "conflict", confidence: selected?.confidence ?? 0, reasons: selected?.reasons || [] };
    if (confirmedHeaders.has(header)) return { header, field, state: "manual", confidence: selected?.confidence ?? 1, reasons: selected?.reasons || [] };
    if (wasManuallyChanged || !selected) return { header, field, state: "manual", confidence: selected?.confidence ?? 1, reasons: selected?.reasons || [] };
    // 표준 필드명 정확일치는 별칭보다 우선하는 명시적 tie-break다. 그 외 근접 점수는
    // 기존처럼 확인을 요구해 유사 별칭의 오매핑을 막는다.
    const isAmbiguous = runnerUp
      && !selected?.isExactFieldName
      && Math.abs(selected.confidence - runnerUp.confidence) < AMBIGUITY_MARGIN;
    if (selected === top && selected.confidence >= AUTO_CONFIRM_THRESHOLD && !isAmbiguous) {
      return { header, field, state: "confirmed", confidence: selected.confidence, reasons: selected.reasons };
    }
    if (selected.confidence >= REVIEW_THRESHOLD && !isAmbiguous) {
      return { header, field, state: "review", confidence: selected.confidence, reasons: selected.reasons };
    }
    return { header, field, state: "must_confirm", confidence: selected.confidence, reasons: selected.reasons };
  });
}
