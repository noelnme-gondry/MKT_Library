import { describe, expect, it } from "vitest";
import {
  DECISION_ACTION_KINDS,
  DECISION_REVIEW_COLUMNS,
  DECISION_REVIEW_SAFE_FIELDS,
  assessDecisionOutcome,
  decisionGuardrailList,
  decisionMetricDirection,
  decisionNumericComparison,
  decisionReviewAgeBucket,
  decisionReviewFollowUpMode,
  getDecisionReviewBucket,
  getDecisionReviewStatus,
  normalizeDecisionReviewRows,
  parseDecisionGuardrails,
  sanitizeDecisionReviewRecord,
  sanitizeDecisionReviewRecords,
  serializeDecisionGuardrails,
  serializeDecisionReviewCsv,
  serializeDecisionReviewIcs,
  summarizeDecisionOutcomes,
  toLocalDecisionDate,
} from "@/lib/decisionReview";

describe("decision review CSV contract", () => {
  it("compares sanitized summary values without inferring good or bad", () => {
    expect(decisionNumericComparison({ baseline: "CPA 5,240원", actual: "CPA 4,980원" })).toMatchObject({ delta: -260, changePct: -260 / 5240, isPercentPoint: false });
    const percentage = decisionNumericComparison({ baseline: "18.2%", actual: "15.0%" });
    expect(percentage.isPercentPoint).toBe(true);
    expect(percentage.delta).toBeCloseTo(-3.2);
    expect(decisionNumericComparison({ baseline: "18.2%", actual: "4,980원" })).toBeNull();
    expect(decisionNumericComparison({ baseline: "D7 ROAS 1.2", actual: "1.5 · D7 ROAS" })).toMatchObject({ baseline: 1.2, actual: 1.5 });
  });

  it("scores only a declared or conservative metric direction", () => {
    expect(decisionMetricDirection("평균 CPA")).toBe("lower");
    expect(decisionMetricDirection("ROAS forecast")).toBe("higher");
    expect(decisionMetricDirection("OOS 오차")).toBe("lower");
    expect(decisionMetricDirection("매출")).toBe("");

    expect(assessDecisionOutcome({ metric: "CPA", baseline: "5,240", actual: "4,980" })).toMatchObject({ state: "improved", direction: "lower" });
    expect(assessDecisionOutcome({ metric: "ROAS", baseline: "1.4", actual: "1.1" })).toMatchObject({ state: "declined", direction: "higher" });
    expect(assessDecisionOutcome({ metric: "전환수", targetDirection: "higher", baseline: "100", actual: "120" })).toMatchObject({ state: "improved", direction: "higher" });
    expect(assessDecisionOutcome({ metric: "CPA", targetDirection: "neutral", baseline: "5,240", actual: "4,980" })).toMatchObject({ state: "unscored", direction: "neutral" });
    expect(assessDecisionOutcome({ metric: "매출", baseline: "100", actual: "120" })).toMatchObject({ state: "unscored", direction: "" });
    expect(assessDecisionOutcome({ metric: "CPA", baseline: "5,240", actual: "" }).state).toBe("incomplete");

    expect(summarizeDecisionOutcomes([
      { metric: "CPA", baseline: "5,240", actual: "4,980" },
      { metric: "ROAS", baseline: "1.4", actual: "1.1" },
      { metric: "매출", baseline: "100", actual: "120" },
      { metric: "CPA", baseline: "5,240", actual: "" },
    ])).toEqual({ improved: 1, declined: 1, unchanged: 0, unscored: 1, comparable: 3 });
  });

  it("exports Excel-safe UTF-8 BOM + CRLF rows without losing commas", () => {
    const csv = serializeDecisionReviewCsv([{
      id: "decision_7",
      toolId: "5-3",
      action: "Meta 예산 20% 감액",
      hypothesis: "CPA가 5,000원 아래로 유지된다",
      metric: "CPA",
      targetDirection: "lower",
      baseline: "5,240",
      reviewDate: "2026-08-03",
      actual: "4,980",
      learning: "=SUM(A1:A2)는 값이 아니라 가설 텍스트",
    }]);

    expect(csv.startsWith("\uFEFF\"tool_id\"")).toBe(true);
    expect(csv).toContain("\r\n");
    expect(csv).toContain("\"5,240\"");
    expect(csv).toContain("\"target_direction\"");
    expect(csv).toContain("\"lower\"");
    expect(csv).toContain("\"2026-08-03\"");
    expect(csv).toContain("'=SUM(A1:A2)");
    expect(csv).toContain("\"decision_7\"");
  });

  it("keeps only actionable imported rows and derives review state honestly", () => {
    const rows = normalizeDecisionReviewRows([
      { action: "", metric: "CPA" },
      { "\uFEFFtool_id": "5-2", action: "주간 예산 확인", reviewDate: "2026-08-03", actual: "", learning: "" },
      { action: "소재 교체", actual: "CTR 1.8%", learning: "훅 테스트 지속", status: "reviewed" },
    ], "9-6");

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ toolId: "5-2", reviewDate: "2026-08-03", status: "pending" });
    expect(rows[1]).toMatchObject({ toolId: "9-6", status: "reviewed" });
    expect(getDecisionReviewStatus({ actual: "CPA 4,980" })).toBe("pending");
    expect(getDecisionReviewStatus({ reviewedAt: "2026-08-01T00:00:00.000Z" })).toBe("reviewed");
  });

  it("keeps only a valid local dataset continuity snapshot", () => {
    const [record] = normalizeDecisionReviewRows([{
      action: "예산 유지",
      dataset_snapshot: JSON.stringify({
        version: 1,
        dataGroup: "efficiency",
        dateStart: "2026-08-01",
        dateEnd: "2026-08-07",
        dateCount: 7,
        grain: "day",
        mappingSignature: "abc",
        dateDigest: "def",
        rawValues: "must not survive",
      }),
    }]);
    expect(record.datasetSnapshot).toContain('"dateDigest":"def"');
    expect(record.datasetSnapshot).not.toContain("rawValues");
    expect(normalizeDecisionReviewRows([{ action: "나쁜 스냅샷", dataset_snapshot: "{not-json" }])[0].datasetSnapshot).toBe("");
  });

  it("preserves only a valid internal source route and labels the later review method honestly", () => {
    const [record] = normalizeDecisionReviewRows([{
      tool_id: "5-18",
      action: "MMM 결과 재확인",
      metric: "CPA",
      baseline_date: "2026-08-01",
      comparison_scope: JSON.stringify({ dataGroup: "response", dimensions: {} }),
      source_path: "/en/tools/marketing-response?stage=mmm&unsafe=1",
    }]);
    expect(record.sourcePath).toBe("/tools/marketing-response?stage=mmm");
    expect(decisionReviewFollowUpMode(record)).toBe("period_auto");
    expect(decisionReviewFollowUpMode({ metric: "최대 VIF" })).toBe("rerun_manual");
    expect(decisionReviewFollowUpMode({ metric: "CPA" })).toBe("period_setup");
    expect(decisionReviewFollowUpMode({ comparisonKind: "forecast_actual" })).toBe("forecast_auto");
    expect(normalizeDecisionReviewRows([{ action: "외부 링크", source_path: "https://example.com" }])[0].sourcePath).toBe("");
  });

  it("classifies review dates without treating missing dates as upcoming", () => {
    expect(getDecisionReviewBucket({ reviewDate: "2026-07-31" }, "2026-08-01")).toBe("overdue");
    expect(getDecisionReviewBucket({ reviewDate: "2026-08-01" }, "2026-08-01")).toBe("today");
    expect(getDecisionReviewBucket({ reviewDate: "2026-08-02" }, "2026-08-01")).toBe("upcoming");
    expect(getDecisionReviewBucket({ reviewDate: "" }, "2026-08-01")).toBe("unscheduled");
    expect(getDecisionReviewBucket({ reviewDate: "2026-08-02", actual: "CPA 4,980" }, "2026-08-01")).toBe("upcoming");
    expect(getDecisionReviewBucket({ reviewDate: "2026-08-02", actual: "CPA 4,980", status: "reviewed" }, "2026-08-01")).toBe("upcoming");
    expect(getDecisionReviewBucket({ reviewDate: "2026-08-02", status: "reviewed", reviewedAt: "2026-08-01T00:00:00.000Z" }, "2026-08-01")).toBe("reviewed");
    expect(toLocalDecisionDate(new Date(2026, 7, 1, 0, 30))).toBe("2026-08-01");
  });

  it("buckets return timing without exposing raw timestamps to analytics", () => {
    const createdAt = "2026-08-01T00:00:00.000Z";
    expect(decisionReviewAgeBucket({ createdAt }, { now: new Date("2026-08-01T03:00:00.000Z"), isSameSession: true })).toBe("same_session");
    expect(decisionReviewAgeBucket({ createdAt }, { now: new Date("2026-08-03T00:00:00.000Z") })).toBe("1-3d");
    expect(decisionReviewAgeBucket({ createdAt }, { now: new Date("2026-08-07T00:00:00.000Z") })).toBe("4-9d");
    expect(decisionReviewAgeBucket({ createdAt }, { now: new Date("2026-08-12T00:00:00.000Z") })).toBe("10d+");
    expect(decisionReviewAgeBucket({})).toBe("unknown");
  });

  it("exports a privacy-safe all-day calendar reminder", () => {
    const ics = serializeDecisionReviewIcs({
      id: "decision_7",
      reviewDate: "2026-08-11",
      action: "Sensitive campaign name",
      hypothesis: "Private operating note",
    });
    expect(ics).toContain("DTSTART;VALUE=DATE:20260811\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20260812\r\n");
    expect(ics).toContain("URL:https://growthoptplaybook.com/weekly-review");
    expect(ics).not.toContain("Sensitive campaign name");
    expect(ics).not.toContain("Private operating note");
  });

  it("restores the exported record id for idempotent imports", () => {
    const [record] = normalizeDecisionReviewRows([{ record_id: "decision_7", tool_id: "5-3", action: "Hold budget" }]);
    expect(record.id).toBe("decision_7");
  });

  it("persists only the decision allowlist and rejects raw analysis payloads", () => {
    const [record] = sanitizeDecisionReviewRecords([{
      id: "decision_1",
      toolId: "5-2",
      locale: "en",
      conclusion: "CPA increased",
      action: "Reduce spend",
      reviewQuestion: "Did CPA recover?",
      reviewDate: "2026-02-30",
      raw: [{ secret: "customer-row" }],
      csvData: { raw: [{ secret: "customer-row" }] },
      inputSignature: "private-file.csv|200",
      chart: { datasets: [1, 2, 3] },
    }]);

    expect(Object.keys(record)).toEqual(DECISION_REVIEW_SAFE_FIELDS);
    expect(record.reviewDate).toBe("");
    expect(record.locale).toBe("en");
    const json = JSON.stringify(record);
    expect(json).not.toContain("customer-row");
    expect(json).not.toContain("private-file.csv");
    expect(json).not.toContain("datasets");
  });

  it("keeps only a canonical one-period forecast snapshot", () => {
    const [record] = normalizeDecisionReviewRows([{
      tool_id: "5-18",
      action: "첫 예측 주 실제값 확인",
      comparison_kind: "forecast_actual",
      forecast_period: "2026-08-03",
      forecast_target: "Regs",
      forecast_platform: "all",
      forecast_value: "1,240",
      forecast_lower: "1100",
      forecast_upper: "1380",
      forecast_source_through: "2026-07-27",
      raw: [{ customer: "secret" }],
    }]);
    expect(record).toMatchObject({
      comparisonKind: "forecast_actual",
      forecastPeriod: "2026-08-03",
      forecastTarget: "Regs",
      forecastPlatform: "all",
      forecastValue: "1240",
      forecastLower: "1100",
      forecastUpper: "1380",
      forecastSourceThrough: "2026-07-27",
    });
    expect(JSON.stringify(record)).not.toContain("secret");

    const [invalid] = normalizeDecisionReviewRows([{
      tool_id: "5-18",
      action: "잘못된 예측",
      comparison_kind: "forecast_actual",
      forecast_period: "next week",
      forecast_target: "CustomerEmail",
      forecast_platform: "web",
      forecast_value: "=SUM(A1:A2)",
    }]);
    expect(invalid).toMatchObject({ forecastPeriod: "", forecastTarget: "", forecastPlatform: "", forecastValue: "" });
  });
});

describe("v9 자동 판정 필드", () => {
  const base = { action: "Google UAC A 예산 감액 -10%", toolId: "weekly-review" };

  it("구조화 필드를 그대로 보존한다", () => {
    const record = sanitizeDecisionReviewRecord({
      ...base,
      actionKind: "decrease_budget", actionTarget: "Google / UAC A", actionAmount: "-10%",
      goalMetric: "conversions", goalDirection: "hold",
      guardrailMetric: "cpa", guardrailOp: "lte", guardrailValue: "8.5",
    });
    expect(record.actionKind).toBe("decrease_budget");
    expect(record.actionTarget).toBe("Google / UAC A");
    expect(record.actionAmount).toBe("-10%");
    expect(record.goalDirection).toBe("hold");
    expect(record.guardrailOp).toBe("lte");
    expect(record.guardrailValue).toBe("8.5");
  });

  it("snake_case CSV 컬럼으로도 읽는다", () => {
    const record = sanitizeDecisionReviewRecord({
      ...base, action_kind: "increase_budget", guardrail_op: "gte", guardrail_value: "2",
    });
    expect(record.actionKind).toBe("increase_budget");
    expect(record.guardrailOp).toBe("gte");
  });

  it("모르는 값은 빈 문자열로 떨어진다 — 자유 문자열이면 판정이 분기할 수 없다", () => {
    const record = sanitizeDecisionReviewRecord({
      ...base, actionKind: "예산 늘리기", goalDirection: "위로", guardrailOp: "<=", guardrailValue: "여덟",
    });
    expect(record.actionKind).toBe("");
    expect(record.goalDirection).toBe("");
    expect(record.guardrailOp).toBe("");
    expect(record.guardrailValue).toBe("");
  });

  it("v8 레코드는 v9 자리가 비어 있고, 그래서 판정 불가로 남는다", () => {
    const record = sanitizeDecisionReviewRecord({ ...base });
    for (const key of ["actionKind", "goalMetric", "guardrailMetric", "guardrailValue"]) {
      expect(record[key]).toBe("");
    }
  });

  it("허용 목록과 스키마 필드가 어긋나지 않는다", () => {
    const record = sanitizeDecisionReviewRecord({ ...base, actionKind: DECISION_ACTION_KINDS[0] });
    for (const key of DECISION_REVIEW_SAFE_FIELDS) expect(record).toHaveProperty(key);
    expect(DECISION_ACTION_KINDS.length).toBeGreaterThan(1);
  });
});

describe("v10 가드레일 목록", () => {
  it("빈 항목·중복·형식 밖 값은 재조립에서 떨어진다", () => {
    // 저장된 문자열이 변조돼도 허용 필드만 새로 조립한다(§12.29).
    expect(parseDecisionGuardrails("cpa|lte|8000;conversions|gte|1200")).toEqual([
      { metric: "cpa", op: "lte", value: "8000" },
      { metric: "conversions", op: "gte", value: "1200" },
    ]);
    // 값 없음 · 지표 없음 · 연산자 밖 — 셋 다 버려지고, 뒤의 온전한 항목은 살아남는다.
    expect(parseDecisionGuardrails("cpa|lte|;|gte|5;roas|bogus|2;cvr|gte|9")).toEqual([
      { metric: "cvr", op: "gte", value: "9" },
    ]);
    expect(parseDecisionGuardrails("cpa|lte|;|gte|5;roas|bogus|2")).toEqual([]);
    expect(parseDecisionGuardrails("cpa|lte|8000;cpa|gte|1")).toEqual([{ metric: "cpa", op: "lte", value: "8000" }]);
    expect(parseDecisionGuardrails("")).toEqual([]);
    expect(parseDecisionGuardrails(null)).toEqual([]);
  });

  it("4개를 넘으면 자른다", () => {
    const many = ["cpa|lte|1", "cpi|lte|2", "ctr|gte|3", "cvr|gte|4", "roas|gte|5"].join(";");
    expect(parseDecisionGuardrails(many)).toHaveLength(4);
  });

  it("직렬화는 파싱의 역이고, 형식 밖 입력은 통과하지 못한다", () => {
    const list = [{ metric: "cpa", op: "lte", value: "8000" }, { metric: "conversions", op: "gte", value: "1200" }];
    expect(serializeDecisionGuardrails(list)).toBe("cpa|lte|8000;conversions|gte|1200");
    expect(serializeDecisionGuardrails([{ metric: "cpa", op: "nope", value: "1" }])).toBe("");
    expect(serializeDecisionGuardrails("not-an-array")).toBe("");
  });

  it("옛 v9 단수 레코드도 같은 목록 모양으로 읽힌다", () => {
    // 두 세대를 스코어러가 같은 코드로 읽어야 한다 — 분기를 만들면 한쪽만 고쳐진다.
    expect(decisionGuardrailList({ guardrailMetric: "cpa", guardrailOp: "lte", guardrailValue: "8000" }))
      .toEqual([{ metric: "cpa", op: "lte", value: "8000" }]);
    expect(decisionGuardrailList({})).toEqual([]);
    // 반쪽 가드레일(값 없음)은 목록에 들어가지 않는다.
    expect(decisionGuardrailList({ guardrailMetric: "cpa", guardrailOp: "lte", guardrailValue: "" })).toEqual([]);
  });

  it("같은 지표가 양쪽에 있으면 단수 필드가 이긴다", () => {
    // 화면이 보여 주던 값이 단수 쪽이므로, 그걸 목록이 조용히 덮으면 안 된다.
    expect(decisionGuardrailList({
      guardrailMetric: "cpa", guardrailOp: "lte", guardrailValue: "8000",
      guardrails: "cpa|gte|1;conversions|gte|1200",
    })).toEqual([
      { metric: "cpa", op: "lte", value: "8000" },
      { metric: "conversions", op: "gte", value: "1200" },
    ]);
  });

  it("sanitize가 guardrails를 재조립해 저장한다", () => {
    const record = sanitizeDecisionReviewRecord({
      action: "Meta 30% 감액",
      guardrails: "conversions|gte|1200;bogus||;cpa|lte|8000",
    }, "5-18-cannibal");
    expect(record.guardrails).toBe("conversions|gte|1200;cpa|lte|8000");
  });

  it("guardrails가 CSV 열과 안전 필드 양쪽에 있다", () => {
    // 한쪽에만 넣으면 내보낸 CSV를 다시 올렸을 때 조용히 사라진다.
    expect(DECISION_REVIEW_SAFE_FIELDS).toContain("guardrails");
    expect(DECISION_REVIEW_COLUMNS).toContain("guardrails");
  });
});

describe("v10 후속 검토 모드는 선언을 먼저 본다", () => {
  it("rerun: 목표는 라벨과 무관하게 재실행으로 간다", () => {
    // 라벨이 우연히 "CPA"를 포함해도 선언이 이긴다. 라벨은 번역·리네임으로 바뀐다.
    expect(decisionReviewFollowUpMode({ goalMetric: "rerun:organic_conversions", metric: "CPA" })).toBe("rerun_manual");
  });

  it("선언이 없는 옛 레코드는 기존 라벨 판정으로 폴백한다", () => {
    expect(decisionReviewFollowUpMode({ metric: "CPA", baselineDate: "2026-09-01", comparisonScope: "" })).toBe("period_setup");
    expect(decisionReviewFollowUpMode({ metric: "강한 잠식 후보" })).toBe("rerun_manual");
  });

  it("계산 가능한 목표는 재실행으로 강등되지 않는다", () => {
    expect(decisionReviewFollowUpMode({ goalMetric: "cpa", metric: "CPA" })).toBe("period_setup");
  });
});
