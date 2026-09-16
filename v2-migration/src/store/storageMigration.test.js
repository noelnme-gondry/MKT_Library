// 브라우저 저장 마이그레이션 가드 (2026-09-16 감사 C)
// 모르는 값을 만나면 **추측하지 말고 거절한다**는 계약을 고정한다(§8).
import { describe, it, expect } from "vitest";
import { persistMigrate, persistPartialize } from "./useDataStore.js";
import { readStoredTable } from "@/lib/workspace-storage/readTable";

const CURRENT_VERSION = 5;

describe("persistMigrate — 손상된 payload", () => {
  it.each([
    ["null", null], ["undefined", undefined], ["문자열", "corrupted"],
    ["숫자", 42], ["배열", [1, 2, 3]], ["불리언", true],
  ])("%s payload는 throw 없이 안전한 기본값이 된다", (_label, payload) => {
    const out = persistMigrate(payload, CURRENT_VERSION);
    expect(out.decisionPersistenceEnabled).toBe(false);
    expect(out.analystMode).toBe(false);
    expect(out.decisionRecords).toBeUndefined();
  });

  it("배열 payload가 인덱스 키로 오염되지 않는다", () => {
    // 예전엔 스프레드가 {0:1,1:2,2:3}을 만들어 스토어에 쓰레기 키가 들어갔다.
    expect(Object.keys(persistMigrate([1, 2, 3], CURRENT_VERSION))).not.toContain("0");
  });

  it.each([Number.NaN, undefined, null])("version=%s도 안전하게 처리한다", (version) => {
    expect(() => persistMigrate({ analystMode: true }, version)).not.toThrow();
    expect(persistMigrate({ analystMode: true }, version).analystMode).toBe(false);
  });
});

describe("persistMigrate — 미래 버전에서 되돌아온 payload(배포 롤백)", () => {
  const future = {
    analystMode: true,
    decisionPersistenceEnabled: true,
    decisionPersistencePreferenceSet: true,
    decisionRecords: [{ id: "d1", action: "예산 증액", conclusion: "CPA 개선" }],
  };

  it.each([6, 7, 99])("version=%s의 저장 동의를 그대로 믿지 않고 다시 묻는다", (version) => {
    const out = persistMigrate(future, version);
    // 미래 버전의 ON이 무엇에 대한 동의였는지 알 수 없다 — v2~v4 확대 때와 같은 자세.
    expect(out.decisionPersistenceEnabled).toBe(false);
    expect(out.decisionPersistencePreferenceSet).toBe(false);
    // 기존 기록은 종전 범위로 보존한다(동의를 되묻는 것이지 데이터를 버리는 게 아니다).
    expect(out.decisionRecords).toHaveLength(1);
  });

  it("현재 버전은 영향받지 않는다 — 가드가 과잉이 아님을 고정", () => {
    const out = persistMigrate(future, CURRENT_VERSION);
    expect(out.decisionPersistenceEnabled).toBe(true);
    expect(out.decisionPersistencePreferenceSet).toBe(true);
  });

  it("미래 버전이라도 저장 동의가 없었으면 되물을 것이 없다", () => {
    const out = persistMigrate({ ...future, decisionPersistenceEnabled: false }, 9);
    expect(out.decisionPersistenceEnabled).toBe(false);
  });
});

describe("persist 불변식 — 원본 CSV는 절대 localStorage에 가지 않는다", () => {
  it("partialize 출력에 업로드 원본이 없다", () => {
    const persisted = persistPartialize({
      activeProjectId: "p1", viewConfig: {}, customMetrics: [], customCharts: [],
      analystMode: true, decisionPersistenceEnabled: true, decisionPersistencePreferenceSet: true,
      eventMarkers: [], decisionRecords: [{ id: "d1", action: "A" }],
      csvData: { raw: [{ Cost: "1000", Campaign: "LEAK_CANARY" }], headers: ["Cost"], mapping: { Cost: "cost" } },
      csvGroups: { efficiency: { raw: [{ Campaign: "LEAK_CANARY" }] } },
      mappedRows: [{ cost: "1000", campaign: "LEAK_CANARY" }],
    });
    expect(JSON.stringify(persisted)).not.toContain("LEAK_CANARY");
    expect(persisted.csvData).toBeUndefined();
    expect(persisted.csvGroups).toBeUndefined();
    expect(persisted.mappedRows).toBeUndefined();
  });
});

describe("저장된 데이터셋 — 모르는 변환은 거절한다", () => {
  const entry = (transform) => ({
    sourceBlob: new Blob(["a,b\n1,2\n"], { type: "text/csv" }),
    sourceKind: "csv", headers: ["a", "b"], transform,
  });

  it("미래 버전이 쓴 변환을 조용히 건너뛰지 않는다", async () => {
    // 건너뛰면 변환 안 된 표가 정상인 것처럼 나온다(헤더 수가 같으면 검증도 통과).
    await expect(readStoredTable(entry("long_to_wide")))
      .rejects.toThrow("WORKSPACE_DATASET_UNKNOWN_TRANSFORM");
  });

  it("변환 없는 레코드는 그대로 읽힌다", async () => {
    const table = await readStoredTable(entry(undefined));
    expect(table.headers).toEqual(["a", "b"]);
    expect(table.raw).toHaveLength(1);
  });
});
