// 입력 진단 가드 (2026-09-16 감사 P2/P3)
// 공통 계약: **조용히 틀린 숫자를 내느니 무엇이 이상한지 말한다**(§8).
import { describe, it, expect } from "vitest";
import { buildCanonicalDataset } from "./buildCanonicalDataset";
import { buildDataQualityReport } from "./buildDataQualityReport";
import { parseDateValue } from "./normalizeValues";
import { ratio } from "@/utils/metrics/metricRegistry";
import { calculateKPIs } from "@/utils/dashboardAggregator";

const codesOf = (raw, headers, mapping) => {
  const canonical = buildCanonicalDataset({ raw, headers, mapping });
  return buildDataQualityReport(canonical, { metricKeys: [], requiresDate: false }).issues.map((i) => i.code);
};

describe("중복 매핑 — 한 항목에 두 컬럼", () => {
  const headers = ["Cost", "Spend", "Installs"];
  const rows = [{ Cost: "100", Spend: "999", Installs: "10" }];

  it("같은 표준키에 두 컬럼이 걸리면 알린다", () => {
    expect(codesOf(rows, headers, { Cost: "cost", Spend: "cost", Installs: "installs" }))
      .toContain("duplicate_mappings");
  });

  it("어느 컬럼이 겹쳤는지 이름으로 말한다", () => {
    const canonical = buildCanonicalDataset({ raw: rows, headers, mapping: { Cost: "cost", Spend: "cost", Installs: "installs" } });
    const issue = buildDataQualityReport(canonical, { metricKeys: [], requiresDate: false })
      .issues.find((i) => i.code === "duplicate_mappings");
    expect(issue.fields[0]).toContain("Cost");
    expect(issue.fields[0]).toContain("Spend");
  });

  it("정상 매핑에서는 뜨지 않는다 — 가드가 과잉이 아님", () => {
    expect(codesOf(rows, headers, { Cost: "cost", Spend: "__ignore__", Installs: "installs" }))
      .not.toContain("duplicate_mappings");
  });
});

describe("모호한 날짜 — M/D인지 D/M인지 못 가르는 값", () => {
  it("둘 다 12 이하면 모호하다고 표시한다", () => {
    expect(parseDateValue("03/04/2026").ambiguous).toBe(true);
    expect(parseDateValue("03/04/2026").isoDate).toBe("2026-03-04"); // M/D로 결정론적 고정
  });

  it("한쪽이 12를 넘으면 모호하지 않다", () => {
    expect(parseDateValue("25/04/2026").ambiguous).toBe(false);
    expect(parseDateValue("25/04/2026").isoDate).toBe("2026-04-25");
  });

  it("ISO 형식은 애초에 모호하지 않다", () => {
    expect(parseDateValue("2026-03-04").ambiguous).toBe(false);
  });

  it("모호한 날짜가 있으면 품질 리포트가 알린다", () => {
    expect(codesOf([{ Date: "03/04/2026", Cost: "100" }], ["Date", "Cost"], { Date: "date", Cost: "cost" }))
      .toContain("ambiguous_date_format");
    expect(codesOf([{ Date: "2026-03-04", Cost: "100" }], ["Date", "Cost"], { Date: "date", Cost: "cost" }))
      .not.toContain("ambiguous_date_format");
  });
});

describe("음수 분모 — 계산 불가지 '아주 저렴함'이 아니다", () => {
  it("ratio가 음수 분모를 null로 막는다", () => {
    expect(ratio(100, -50)).toBeNull();
    expect(ratio(100, 0)).toBeNull();
    expect(ratio(100, 50)).toBe(2); // 양수는 전과 같다
  });

  it("환불·조정 행이 섞여도 음수 효율을 만들지 않는다", () => {
    const k = calculateKPIs([{ cost: 100, impressions: -50, clicks: -5, installs: -2 }], 7, "installs");
    for (const metric of ["cpm", "cpc", "cpi", "ctr", "cvr"]) {
      expect(k[metric], metric).toBeNull();
    }
  });

  it("정상 데이터의 값은 바뀌지 않았다 — 골든 불변", () => {
    const k = calculateKPIs([{ cost: 100, impressions: 1000, clicks: 100, installs: 20, revenue_d7: 300 }], 7, "installs");
    expect(k.cpm).toBe(100);
    expect(k.ctr).toBe(0.1);
    expect(k.cpi).toBe(5);
    expect(k.roas).toBe(3);
  });
});
