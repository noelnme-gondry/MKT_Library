import { CANONICAL_FIELDS } from "../schema/canonicalFields";
import { scoreContextFeatures } from "./contextFeatures";
import { scoreNameFeatures } from "./nameFeatures";
import { scoreValueFeatures } from "./valueFeatures";
const clamp = (value) => Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
export function scoreSemanticCandidates(profile, profiles = []) {
  return Object.values(CANONICAL_FIELDS).map((field) => {
    const name = scoreNameFeatures(profile, field.key); const value = scoreValueFeatures(profile, field); const context = scoreContextFeatures(profile, field.key, profiles);
    return { canonicalKey: field.key, role: field.family, confidence: clamp(name.score + value.score + context.score), evidence: [...name.evidence, ...value.evidence, ...context.evidence] };
  }).filter((candidate) => candidate.confidence > 0).sort((left, right) => right.confidence - left.confidence || left.canonicalKey.localeCompare(right.canonicalKey));
}
