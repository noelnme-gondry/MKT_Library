import { describe, it, expect } from "vitest";
import { pvmGenerateDiagnosis, buildPvmResultCsv } from "./pvmExport.js";

const fmt = (v) => Math.round(v).toLocaleString() + "원";

describe("pvmGenerateDiagnosis", () => {
  it("creative level mentions 최하위 + both effects", () => {
    const txt = pvmGenerateDiagnosis(
      { mix: 100, rate: -40, contribution: 60 },
      "creative",
      fmt,
    );
    expect(txt).toContain("최하위");
    expect(txt).toContain("믹스 효과");
    expect(txt).toContain("레이트 효과");
  });

  // rollup 설계상 mix ≡ subMix(하위합)라 옛 '배달사고/최적화 작동' 분기는 도달 불가·오도.
  // 진단은 실제로 구분되는 믹스·레이트 두 축으로 서술한다(같은 값을 두 효과인 척 금지).
  it("channel mix>0 rate>0 → 믹스·레이트 두 효과 정직 서술", () => {
    const txt = pvmGenerateDiagnosis(
      { mix: 100, cmpSumMix: 100, rate: 40, contribution: 140 },
      "channel",
      fmt,
    );
    expect(txt).toContain("채널");
    expect(txt).toContain("믹스 효과");
    expect(txt).toContain("레이트 효과");
    expect(txt).not.toContain("하위 세그먼트합 믹스"); // 같은 값을 두 효과인 척하던 오도 제거
    expect(txt).not.toContain("배달 사고");
  });

  it("campaign mix<0 rate<0 → 효율 개선, 유지 안내", () => {
    const txt = pvmGenerateDiagnosis(
      { mix: -80, creativeSumMix: -80, rate: -20, contribution: -100 },
      "campaign",
      fmt,
    );
    expect(txt).toContain("캠페인");
    expect(txt).toContain("유지");
  });

  it("mix·rate 반대 방향 → 복합(서로 다른 방향) 서술", () => {
    const txt = pvmGenerateDiagnosis(
      { mix: 80, cmpSumMix: 80, rate: -30, contribution: 50 },
      "channel",
      fmt,
    );
    expect(txt).toContain("서로 다른 방향");
  });
});

describe("buildPvmResultCsv", () => {
  const cache = {
    analysisStatus: "COMPLETE",
    identity: { ok: true, error: 0 },
    currency: "krw",
    weekBasis: "calendar",
    lookback: 1,
    p1Range: ["2026-01-01", "2026-01-07"],
    p2Range: ["2026-01-08", "2026-01-14"],
    CPA1: 10,
    CPA2: 12,
    Cost1: 1000,
    Cost2: 1200,
    Result1: 100,
    Result2: 100,
    deltaCpa: 2,
    campaignMapped: true,
    crUrlMap: null,
    finest: [
      { chKey: "A", cmpKey: "A1", crKey: "cr1", cost1: 600, cost2: 700, result1: 60, result2: 58, cpa1: 10, cpa2: 12.07, s1: 0.6, s2: 0.58, mix: 0.5, rate: 1.2, contribution: 1.7 },
      { chKey: "A", cmpKey: "A1", crKey: "cr2", cost1: 400, cost2: 500, result1: 40, result2: 42, cpa1: 10, cpa2: 11.9, s1: 0.4, s2: 0.42, mix: -0.2, rate: 0.8, contribution: 0.6 },
    ],
    layer2: [
      { chKey: "A", cmpKey: "A1", key: "A1", contribution: 2.3, mix: 0.3, rate: 2.0 },
    ],
    layer1: [
      { key: "A", contribution: 2.0, mix: 0.3, rate: 1.7 },
    ],
  };

  it("emits BOM + CRLF joined lines", () => {
    const csv = buildPvmResultCsv(cache, "CPA");
    expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM
    expect(csv).toContain("\r\n");
  });

  it("includes META, SCORECARD, CREATIVE_FULL, CAMPAIGN, CHANNEL sections", () => {
    const csv = buildPvmResultCsv(cache, "CPA");
    expect(csv).toContain("META");
    expect(csv).toContain("SCORECARD");
    expect(csv).toContain("CREATIVE_FULL");
    expect(csv).toContain("CAMPAIGN");
    expect(csv).toContain("CHANNEL");
  });

  it("emits live spreadsheet formulas for mix/rate/impact", () => {
    const csv = buildPvmResultCsv(cache, "CPA");
    expect(csv).toContain("mix=(cpaBar-Cbar)*(share2-share1)");
    // finest row impact formula =Q+R+S
    expect(/=Q\d+\+R\d+\+S\d+/.test(csv)).toBe(true);
    // scorecard delta formula
    expect(/=D\d+-C\d+/.test(csv)).toBe(true);
  });

  it("skips CAMPAIGN block when campaign not mapped", () => {
    const noCmp = { ...cache, campaignMapped: false };
    const csv = buildPvmResultCsv(noCmp, "CPA");
    expect(csv).not.toContain("CAMPAIGN");
    expect(csv).toContain("CHANNEL");
  });

  it("refuses to export a NOT_IDENTIFIED or failed-identity decomposition", () => {
    expect(() => buildPvmResultCsv({
      ...cache,
      analysisStatus: "NOT_IDENTIFIED",
      identity: { ok: false, error: 1 },
    }, "CPA")).toThrow(/identity-verified/i);
  });

  it("fails closed unless both COMPLETE and identity.ok=true are explicit", () => {
    expect(() => buildPvmResultCsv({ ...cache, analysisStatus: undefined }, "CPA")).toThrow(/identity-verified/i);
    expect(() => buildPvmResultCsv({ ...cache, identity: undefined }, "CPA")).toThrow(/identity-verified/i);
    expect(() => buildPvmResultCsv({ ...cache, analysisStatus: "BLOCKED" }, "CPA")).toThrow(/identity-verified/i);
  });
});
