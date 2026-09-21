import { describe, expect, it } from "vitest";
import { ARCHIVE_FIELDS, accountEntitlement, archiveMemo, PRO_TRIAL_DAYS, PRO_TRIAL_MS, trialMsFor, trialRemainingBucket } from "./archiveContract";
import { DECISION_REVIEW_SAFE_FIELDS, decisionGuardrailList } from "@/lib/decisionReview";
describe("account archive boundary", () => {
  it("never starts a trial just by logging in", () => expect(accountEntitlement({ email: "reader@example.com" })).toBeNull());
  it("expires exactly one week after the first save", () => {
    const start = Date.parse("2026-09-21T00:00:00Z");
    const account = { trial_started_at: new Date(start).toISOString() };
    expect(PRO_TRIAL_DAYS).toBe(7);
    expect(accountEntitlement(account, start + PRO_TRIAL_MS - 1)?.trial).toBe(true);
    expect(accountEntitlement(account, start + PRO_TRIAL_MS)).toBeNull();
  });
  // 길이는 전 계정 공통이다 — 시작 시점으로 갈리지 않는다(소급 적용).
  // 갈리기 시작하면 화면·메일·결제 기산일이 각각 다른 날짜를 말하게 된다.
  it("applies the same length no matter when the trial started", () => {
    const old = Date.parse("2026-08-01T00:00:00Z");
    const account = { trial_started_at: new Date(old).toISOString() };
    expect(trialMsFor(account.trial_started_at)).toBe(PRO_TRIAL_MS);
    expect(accountEntitlement(account, old + PRO_TRIAL_MS - 1)?.trial).toBe(true);
    // 예전 14일 기준이면 아직 남아 있었을 시점에도 만료다.
    expect(accountEntitlement(account, old + PRO_TRIAL_MS)).toBeNull();
    expect(accountEntitlement(account, old + 14 * 86400000 - 1)).toBeNull();
  });
  it("reports remaining time as a coarse bucket, never a raw date", () => {
    const start = Date.parse("2026-09-21T00:00:00Z");
    expect(trialRemainingBucket(null)).toBe("not_started");
    expect(trialRemainingBucket(new Date(start).toISOString(), start + PRO_TRIAL_MS)).toBe("expired");
    expect(trialRemainingBucket(new Date(start).toISOString(), start + 5 * 86400000)).toBe("under_3d");
    expect(trialRemainingBucket(new Date(start).toISOString(), start)).toBe("3_7d");
    // 7일 초과 구간은 더 이상 나올 수 없다.
    const older = start - 30 * 86400000;
    expect(trialRemainingBucket(new Date(older).toISOString(), start)).toBe("expired");
  });
  it("uses purchased account access after a trial", () => expect(accountEntitlement({ paid_until: "2026-10-01T00:00:00Z", trial_started_at: "2026-08-01" }, Date.parse("2026-09-11"))?.trial).toBe(false));
  it("allows the same offline verification window without extending the actual expiry", () => {
    const now = Date.parse("2026-09-11T00:00:00Z");
    expect(accountEntitlement({ paid_until: "2026-10-01" }, now).offlineUntil).toBe(now + 72 * 3600000);
    expect(accountEntitlement({ paid_until: "2026-09-12" }, now).offlineUntil).toBe(Date.parse("2026-09-12"));
    expect(accountEntitlement({ paid_until: "2026-09-11" }, now)).toBeNull();
  });
  it("projects only selected memo fields and never sends raw data or local snapshots", () => {
    const projected = archiveMemo({ id: "decision-1", action: "Review", raw: [{ secret: "row" }], datasetSnapshot: "private", comparisonScope: { secret: true }, fileName: "customer.csv" });
    expect(projected.action).toBe("Review");
    for (const field of ["raw", "datasetSnapshot", "comparisonScope", "fileName"]) expect(projected).not.toHaveProperty(field);
  });
});

describe("ARCHIVE_FIELDS는 판정에 필요한 필드를 빠뜨리지 않는다", () => {
  // 결정 필드는 세 목록에 나뉘어 있다 — 저장(SAFE_FIELDS)·내보내기(COLUMNS)·계정 보관
  // (ARCHIVE_FIELDS). 한 곳에만 넣으면 그 경로에서만 조용히 사라진다.
  // 실제로 v10 `guardrails`가 앞의 둘에만 들어가, 계정에 보관했다 복원하면
  // 총량 가드레일이 없어진 채로 "성공" 판정이 나올 수 있었다.
  const SCORING_FIELDS = [
    "actionKind", "actionTarget", "actionAmount",
    "goalMetric", "goalDirection",
    "guardrailMetric", "guardrailOp", "guardrailValue", "guardrails",
    "metric", "targetDirection", "baseline", "baselineDate",
  ];

  it("판정에 쓰이는 필드가 전부 보관 대상이다", () => {
    const missing = SCORING_FIELDS.filter((key) => !Object.hasOwn(ARCHIVE_FIELDS, key));
    expect(missing).toEqual([]);
  });

  it("보관 필드는 전부 저장 스키마의 안전 필드이기도 하다", () => {
    // 반대 방향 — 보관만 하고 저장 스키마엔 없는 필드는 복원 시 sanitize에서 버려진다.
    const stray = Object.keys(ARCHIVE_FIELDS).filter((key) => !DECISION_REVIEW_SAFE_FIELDS.includes(key) && key !== "target");
    expect(stray).toEqual([]);
  });

  it("가드레일 목록이 보관·복원을 통과한다", () => {
    const memo = archiveMemo({
      id: "d1", action: "Meta 30% 감액",
      guardrailMetric: "conversions", guardrailOp: "gte", guardrailValue: "5000",
      guardrails: "cpa|lte|8000",
    });
    expect(memo.guardrails).toBe("cpa|lte|8000");
    expect(decisionGuardrailList(memo)).toEqual([
      { metric: "conversions", op: "gte", value: "5000" },
      { metric: "cpa", op: "lte", value: "8000" },
    ]);
  });
});
