import { describe, expect, test } from "vitest";
import Papa from "papaparse";
import { readFileSync } from "node:fs";
import { computeCsvEligibility } from "./csvEligibility";
import { buildMappingContract } from "@/lib/data-import/mappingContract";
import { classifyDataReadiness, nearReason } from "./dataReadiness";
import { groupToolsByFile } from "@/lib/dataSources";

function readinessFor(path, transform = (table) => table, locale = "ko") {
  const parsed = Papa.parse(readFileSync(path, "utf8").replace(/^﻿/, ""), { header: true, skipEmptyLines: true });
  const { headers, raw } = transform({ headers: parsed.meta.fields, raw: parsed.data });
  const mapping = buildMappingContract({ toolId: "start-gate", headers, rows: raw, source: path }).mapping;
  const eligibility = computeCsvEligibility({ raw, headers, mapping, locale });
  return { eligibility, readiness: classifyDataReadiness({ eligibility, locale }) };
}

describe("데이터 준비 세 칸", () => {
  test("모든 분석이 정확히 한 칸에 들어간다", () => {
    const { eligibility, readiness } = readinessFor("public/examples/weekly-report-three-weeks.csv");
    expect(eligibility.length).toBeGreaterThan(20);
    const placed = [...readiness.ready, ...Object.keys(readiness.near), ...readiness.other];
    expect(placed.sort()).toEqual(eligibility.map((result) => result.toolId).sort());
  });

  test("캠페인 일별 광고 파일: 소재 분석은 소재 ID 하나만 더하면 열린다", () => {
    const { readiness } = readinessFor("public/examples/weekly-report-three-weeks.csv");
    expect(readiness.ready).toEqual(expect.arrayContaining(["5-2", "5-21", "5-22", "5-3"]));
    expect(readiness.near["9-6"]).toMatchObject({ kind: "columns", labels: ["소재ID"], file: "광고 일별 성과 (소재 단위)" });
    expect(readiness.near["9-6"].text).toBe("소재ID 열을 더하면 열립니다.");
    // 주문·설문처럼 출처가 다른 파일은 "조금만 더"가 아니다.
    expect(readiness.other).toEqual(expect.arrayContaining(["5-41", "5-39", "5-38"]));
    expect(readiness.near["5-41"]).toBeUndefined();
  });

  test("소재 ID를 더하면 소재 분석이 바로 가능으로 옮겨 간다 — 광고비 cost를 소재 도구가 spend로 읽는다", () => {
    const { readiness } = readinessFor("public/examples/weekly-report-three-weeks.csv", ({ headers, raw }) => ({
      headers: [...headers, "creative_id"],
      raw: raw.map((row, index) => ({ ...row, creative_id: `c${index % 3}` })),
    }));
    expect(readiness.ready).toContain("9-6");
    expect(readiness.near["9-6"]).toBeUndefined();
  });

  test("스토어 콘솔 파일: 광고 분석은 열 개수가 비슷해도 '조금만 더'가 아니라 다른 파일이다", () => {
    // App Store Connect 내보내기 형식(lib/platformExports). 광고비 열은 스토어 파일에 생기지 않는다.
    const sources = ["App Store Search", "App Store Browse", "App Referrer"];
    const raw = Array.from({ length: 28 }, (_, day) => sources.map((source, index) => ({
      Date: `2026-08-${String(day + 1).padStart(2, "0")}`,
      "Source Type": source,
      Impressions: String(40000 - index * 9000 + day * 37),
      "Product Page Views": String(3600 - index * 800 + day * 5),
      "Total Downloads": String(900 - index * 200 + day * 3),
    }))).flat();
    const headers = Object.keys(raw[0]);
    const mapping = buildMappingContract({ toolId: "start-gate", headers, rows: raw, source: "asc.csv" }).mapping;
    const readiness = classifyDataReadiness({ eligibility: computeCsvEligibility({ raw, headers, mapping, locale: "ko" }), locale: "ko" });
    expect(readiness.ready).toContain("5-27");
    for (const toolId of ["5-2", "5-21", "5-22", "5-3"]) {
      expect(readiness.near[toolId], toolId).toBeUndefined();
      expect(readiness.other).toContain(toolId);
    }
  });

  test("열은 맞고 행이 모자라면 무엇이 몇 개 모자란지 말한다", () => {
    const { readiness } = readinessFor("public/examples/asa-mature-candidate.csv");
    expect(readiness.near["5-22"]).toEqual({ kind: "data", text: "최소 20행 필요 (현재 4행)." });
  });

  test("돌려 보고 판정을 못 낸 분석은 엔진 사유로 '조금만 더'에 둔다", () => {
    const eligibility = [{ toolId: "5-22", status: "ready", blockers: [] }];
    const readiness = classifyDataReadiness({ eligibility, notComputable: { "5-22": "판단할 만큼 일별 데이터가 쌓인 채널이 없습니다." } });
    expect(readiness.ready).toEqual([]);
    expect(readiness.near["5-22"]).toEqual({ kind: "data", text: "판단할 만큼 일별 데이터가 쌓인 채널이 없습니다." });
  });

  test("요구 열 대부분이 없으면 다른 파일이다", () => {
    // 5-41 장바구니: 주문 ID·상품 ID·수량 — 셋 다 없다.
    expect(nearReason({ toolId: "5-41", blockers: [{ code: "missing_fields" }, { code: "missing_fields" }, { code: "missing_fields" }], missing: ["order_id", "product_id", "quantity"] })).toBeNull();
    // 열 이외의 막힘(데이터 단위가 아예 다름)이 섞이면 "조금만 더"가 아니다.
    expect(nearReason({ toolId: "9-6", blockers: [{ code: "no_rows" }, { code: "missing_fields" }], missing: ["creative_id"] })).toBeNull();
  });

  test("EN도 같은 칸·같은 사유", () => {
    const { readiness } = readinessFor("public/examples/weekly-report-three-weeks.csv", undefined, "en");
    expect(readiness.near["9-6"]).toMatchObject({ kind: "columns", text: "Add Creative ID to open this." });
    expect(readiness.near["9-6"].file).toBe("Daily ad performance by creative");
  });

  test("다른 파일은 파일별로 묶고, 같은 파일을 쓰는 분석은 한 줄에 모은다", () => {
    const groups = groupToolsByFile(["5-32", "5-41", "5-35", "5-4"]);
    const ledger = groups.find((group) => group.source?.group === "customer_ledger");
    expect(ledger.toolIds).toEqual(["5-32", "5-35"]);
    // 출처 묶음 순서: 주문·고객(commerce) → 실험(experiments)
    expect(groups.map((group) => group.source.familyId)).toEqual(["commerce", "commerce", "experiments"]);
  });
});
