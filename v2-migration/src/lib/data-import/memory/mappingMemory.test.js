import { describe, expect, it } from "vitest";
import { MAPPING_MEMORY_SCHEMA_VERSION, USER_RULE_SOURCE, applyCompatibleMemory, buildMappingMemoryRecord, findCompatibleMemory, isMemoryCompatible, isUserRule } from "./mappingMemory";

const profile = { inferredType: "number", missingRate: 0, cardinality: "high", rates: { numeric: 1, currencyLike: 1, percentLike: 0 } };

describe("mapping memory privacy and compatibility", () => {
  it("stores only approved profile summaries", () => {
    const record = buildMappingMemoryRecord({ normalizedColumnName: "Meta Spend", canonicalKey: "media_spend", profile, context: { representation: "wide", roleFamilies: ["MEDIA", "OUTCOME"], fileName: "must-not-store.csv" } });
    expect(record).toMatchObject({ normalizedColumnName: "meta_spend", canonicalKey: "media_spend", context: { representation: "wide", roleFamilies: ["MEDIA", "OUTCOME"] } });
    expect(JSON.stringify(record)).not.toContain("must-not-store");
  });

  it("refuses a matching name when the profile or representation changed", () => {
    const record = buildMappingMemoryRecord({ normalizedColumnName: "Meta Spend", canonicalKey: "media_spend", profile, context: { representation: "wide" } });
    expect(isMemoryCompatible(record, { normalizedColumnName: "Meta Spend", profile, context: { representation: "wide" } })).toBe(true);
    expect(isMemoryCompatible(record, { normalizedColumnName: "Meta Spend", profile: { ...profile, inferredType: "string" }, context: { representation: "wide" } })).toBe(false);
    expect(isMemoryCompatible(record, { normalizedColumnName: "Meta Spend", profile, context: { representation: "long" } })).toBe(false);
  });

  it("returns no record until compatibility is proven", () => {
    const record = buildMappingMemoryRecord({ normalizedColumnName: "Meta Spend", canonicalKey: "media_spend", profile, context: { representation: "wide" } });
    expect(findCompatibleMemory([record], { normalizedColumnName: "Other", profile, context: { representation: "wide" } })).toBeNull();
  });

  it("uses compatible memory only for an abstained current binding", () => {
    const record = buildMappingMemoryRecord({ normalizedColumnName: "Meta Spend", canonicalKey: "media_spend", profile, context: { representation: "tabular" } });
    const semanticMapping = { profile: { representation: "tabular", columns: [{ header: "Meta Spend", ...profile }] }, bindings: [{ sourceColumn: "Meta Spend", canonicalKey: null, role: "UNKNOWN", decision: "UNKNOWN" }, { sourceColumn: "Revenue", canonicalKey: "outcome_revenue", role: "OUTCOME", decision: "SUGGEST" }] };
    expect(applyCompatibleMemory(semanticMapping, [record]).bindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceColumn: "Meta Spend", canonicalKey: "media_spend", source: "personal_memory" }),
      expect.objectContaining({ sourceColumn: "Revenue", canonicalKey: "outcome_revenue", decision: "SUGGEST" }),
    ]));
  });
});

describe("사용자 규칙은 이름으로 맞고, 판정을 덮는다", () => {
  const userRule = {
    schemaVersion: MAPPING_MEMORY_SCHEMA_VERSION,
    normalizedColumnName: "mkt_country",
    canonicalKey: "country",
    // 마이페이지에서 직접 적은 규칙은 프로파일 지문이 없다.
    profile: { inferredType: "unknown", numericRateBucket: 1, missingRateBucket: 1, cardinality: "unknown", unitHint: "unknown" },
    context: { representation: "tabular", roleFamilies: [] },
    confirmationCount: 1,
    confirmedAt: 1,
    source: USER_RULE_SOURCE,
  };
  const realColumn = {
    normalizedColumnName: "mkt_country",
    profile: { inferredType: "string", cardinality: "few", rates: { numeric: 0 }, missingRate: 0 },
    context: { representation: "tabular" },
  };

  it("지문이 달라도 컬럼 이름이 같으면 맞는다", () => {
    // 지문까지 요구하면 "이 컬럼은 국가다"라고 적어 둔 규칙이 파일이 조금만
    // 달라져도 조용히 안 맞아 떨어진다 — 실제로 그래서 한 번도 적용되지 않았다.
    expect(isMemoryCompatible(userRule, realColumn)).toBe(true);
    expect(isUserRule(userRule)).toBe(true);
  });

  it("자동 확정 기억은 예전처럼 지문을 요구한다", () => {
    const autoMemory = { ...userRule, source: undefined };
    expect(isMemoryCompatible(autoMemory, realColumn)).toBe(false);
  });

  it("사용자 규칙은 이미 내려진 판정도 덮는다", () => {
    const semanticMapping = {
      profile: { representation: "tabular", columns: [{ header: "mkt_country", inferredType: "string", cardinality: "few", rates: { numeric: 0 }, missingRate: 0 }] },
      bindings: [{ sourceColumn: "mkt_country", canonicalKey: "campaign", role: "DIMENSION", decision: "SUGGEST", confidence: 0.9, evidence: [] }],
    };
    const [binding] = applyCompatibleMemory(semanticMapping, [userRule]).bindings;
    expect(binding.canonicalKey).toBe("country");
    expect(binding.source).toBe(USER_RULE_SOURCE);
    // 새 decision 값을 만들지 않는다 — 어휘는 UNKNOWN·SUGGEST 둘뿐이고,
    // 세 번째를 넣으면 그걸 모르는 저장 필터가 조용히 걸러 낸다.
    expect(binding.decision).toBe("SUGGEST");
  });

  it("자동 확정 기억은 판단 보류만 메운다", () => {
    const autoMemory = { ...userRule, source: undefined, profile: { inferredType: "string", numericRateBucket: 0, missingRateBucket: 0, cardinality: "few", unitHint: "unknown" } };
    const decided = {
      profile: { representation: "tabular", columns: [{ header: "mkt_country", inferredType: "string", cardinality: "few", rates: { numeric: 0 }, missingRate: 0 }] },
      bindings: [{ sourceColumn: "mkt_country", canonicalKey: "campaign", role: "DIMENSION", decision: "SUGGEST", confidence: 0.9, evidence: [] }],
    };
    expect(applyCompatibleMemory(decided, [autoMemory]).bindings[0].canonicalKey).toBe("campaign");
    const abstained = { ...decided, bindings: [{ ...decided.bindings[0], canonicalKey: null, decision: "UNKNOWN" }] };
    expect(applyCompatibleMemory(abstained, [autoMemory]).bindings[0].canonicalKey).toBe("country");
  });

  it("같은 컬럼에 둘 다 있으면 사용자 규칙이 이긴다", () => {
    const autoMemory = {
      ...userRule, source: undefined, canonicalKey: "campaign", confirmationCount: 99, confirmedAt: 999,
      profile: { inferredType: "string", numericRateBucket: 0, missingRateBucket: 0, cardinality: "few", unitHint: "unknown" },
    };
    expect(findCompatibleMemory([autoMemory, userRule], realColumn).canonicalKey).toBe("country");
  });
});
