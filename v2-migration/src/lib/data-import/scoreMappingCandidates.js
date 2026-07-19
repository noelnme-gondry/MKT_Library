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
  const byHeader = {};

  headers.forEach((header) => {
    const candidates = keys.map((key) => {
      const field = fields[key];
      const fromHeader = headerScore(header, key, field.aliases);
      const fromType = typeScore(profileByHeader[header], field.type);
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
