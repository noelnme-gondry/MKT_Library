// 저장 데이터셋 세대 가드 (2026-09-17)
// 계약: 원본 파일은 언제나 살린다. 저장 당시 표준키 어휘로 굳은 **매핑만**
// 구세대일 때 버리고 현재 규칙으로 다시 인식한다(§7 — 모르는 세대를 그대로
// 믿으면 파일은 열리는데 숫자만 빠진다).
import { describe, expect, it } from "vitest";
import { WORKSPACE_DATASET_SCHEMA_VERSION, isCurrentDatasetSchema } from "./datasets";
import { buildMappingContract } from "@/lib/data-import/mappingContract";

describe("세대 판정", () => {
  it("현재 세대만 통과한다", () => {
    expect(isCurrentDatasetSchema({ schemaVersion: WORKSPACE_DATASET_SCHEMA_VERSION })).toBe(true);
  });

  it("표식이 없거나 다르면 구세대다", () => {
    // 이 필드 도입 전 저장분은 schemaVersion이 아예 없다.
    expect(isCurrentDatasetSchema({})).toBe(false);
    expect(isCurrentDatasetSchema({ schemaVersion: 0 })).toBe(false);
    expect(isCurrentDatasetSchema({ schemaVersion: WORKSPACE_DATASET_SCHEMA_VERSION + 1 })).toBe(false);
    expect(isCurrentDatasetSchema(null)).toBe(false);
    expect(isCurrentDatasetSchema(undefined)).toBe(false);
  });
});

describe("구세대 매핑 재인식이 실제로 값을 되살린다", () => {
  // 저장 당시 헤더는 그대로인데 매핑이 지금 엔진이 안 읽는 키를 가리키는 상황.
  const headers = ["Date", "Cost", "Impressions", "Clicks", "Installs"];
  const rows = [
    { Date: "2026-07-01", Cost: "1000", Impressions: "10000", Clicks: "500", Installs: "100" },
    { Date: "2026-07-02", Cost: "1200", Impressions: "11000", Clicks: "520", Installs: "110" },
  ];

  it("현재 규칙으로 다시 인식하면 비용·설치가 표준키로 잡힌다", () => {
    const refreshed = buildMappingContract({ toolId: "5-2", headers, rows, source: "stale.csv" }).mapping;
    const fields = new Set(Object.values(refreshed).filter((field) => field && field !== "__ignore__"));
    expect(fields.has("cost")).toBe(true);
    expect(fields.has("installs")).toBe(true);
    expect(fields.has("date")).toBe(true);
  });

  it("옛 매핑이 가리키던 폐기 키는 재인식 결과에 남지 않는다", () => {
    const staleMapping = { Cost: "legacy_cost_key", Installs: "legacy_installs_key", Date: "date" };
    const refreshed = buildMappingContract({ toolId: "5-2", headers, rows, source: "stale.csv" }).mapping;
    expect(Object.values(staleMapping)).toContain("legacy_cost_key");
    expect(Object.values(refreshed)).not.toContain("legacy_cost_key");
    expect(Object.values(refreshed)).not.toContain("legacy_installs_key");
  });

  it("재인식이 아무것도 못 잡으면 빈 매핑이라 저장본을 유지할 근거가 된다", () => {
    // 복원 로직은 "재인식 결과에 유효 필드가 하나라도 있을 때만" 교체한다.
    // 알 수 없는 헤더뿐이면 교체하지 않는 편이 낫다(아무것도 못 읽는 것보다 옛 매핑이 낫다).
    const refreshed = buildMappingContract({
      toolId: "5-2", headers: ["zzz", "qqq"], rows: [{ zzz: "a", qqq: "b" }], source: "unknown.csv",
    }).mapping;
    const usable = Object.values(refreshed).filter((field) => field && field !== "__ignore__");
    expect(usable).toHaveLength(0);
  });
});
