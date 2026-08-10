import { describe, expect, it } from "vitest";

import { buildSharePayload, decodeSharePayload, encodeSharePayload, shareUrlFromPayload, toolHrefForShare } from "./decisionShare";

const base = {
  toolId: "5-3",
  toolTitle: "예산 배분",
  headline: "검색 일반 키워드 예산을 10% 줄이세요.",
  points: [{ label: "근거", text: "한계 CPA가 평균의 1.8배" }, { text: "전체 CPA는 안정" }],
  stats: [{ label: "이동 예산", value: "₩3,200,000" }],
  locale: "ko",
};

describe("decisionShare", () => {
  it("round-trips conclusion text through the token", () => {
    const token = encodeSharePayload(base);
    const decoded = decodeSharePayload(token);
    expect(decoded.h).toBe(base.headline);
    expect(decoded.p[0]).toBe("근거 · 한계 CPA가 평균의 1.8배");
    expect(decoded.s[0]).toEqual({ l: "이동 예산", v: "₩3,200,000" });
    expect(decoded.t).toBe("5-3");
    expect(decoded.l).toBe("ko");
  });

  // 링크에 원본 데이터가 실리면 §2.2 위반이다. 입력을 펼치지 않고 재조립하는지 확인한다.
  it("drops any field outside the allowed summary shape", () => {
    const decoded = decodeSharePayload(encodeSharePayload({
      ...base,
      raw: [["2026-01-01", "1000"]],
      fileName: "campaign_2026.csv",
      mapping: { cost: "spend" },
      canonicalData: { rows: 12000 },
    }));
    expect(Object.keys(decoded).sort()).toEqual(["h", "l", "n", "p", "s", "t", "v"]);
    expect(JSON.stringify(decoded)).not.toContain("campaign_2026");
    expect(JSON.stringify(decoded)).not.toContain("2026-01-01");
  });

  it("keeps non-Latin text intact through base64url", () => {
    const decoded = decodeSharePayload(encodeSharePayload({ ...base, headline: "브랜드 검색 증분이 확인되지 않았습니다 ±3%" }));
    expect(decoded.h).toBe("브랜드 검색 증분이 확인되지 않았습니다 ±3%");
  });

  it("caps length and item counts instead of emitting a huge URL", () => {
    const decoded = decodeSharePayload(encodeSharePayload({
      ...base,
      headline: "가".repeat(500),
      points: Array.from({ length: 20 }, (_, i) => ({ text: `근거 ${i}` })),
      stats: Array.from({ length: 20 }, (_, i) => ({ label: `지표 ${i}`, value: `${i}` })),
    }));
    expect(decoded.h.length).toBe(240);
    expect(decoded.p.length).toBe(6);
    expect(decoded.s.length).toBe(6);
  });

  it("refuses payloads without a real tool route or headline", () => {
    expect(encodeSharePayload({ ...base, toolId: "not-a-route" })).toBeNull();
    expect(encodeSharePayload({ ...base, toolId: "" })).toBeNull();
    expect(encodeSharePayload({ ...base, headline: "   " })).toBeNull();
    expect(buildSharePayload({})).toBeNull();
  });

  it("returns null for malformed or tampered tokens rather than throwing", () => {
    expect(decodeSharePayload("not-base64!!")).toBeNull();
    expect(decodeSharePayload("")).toBeNull();
    expect(decodeSharePayload(null)).toBeNull();
    expect(decodeSharePayload("x".repeat(5000))).toBeNull();
    expect(decodeSharePayload(btoa(JSON.stringify({ v: 99, t: "5-3", h: "hi" })))).toBeNull();
  });

  it("builds locale-correct share and tool links", () => {
    expect(shareUrlFromPayload("abc", "ko")).toBe("/share?d=abc");
    expect(shareUrlFromPayload("abc", "en", "https://x.test")).toBe("https://x.test/en/share?d=abc");
    expect(shareUrlFromPayload(null, "ko")).toBeNull();
    expect(toolHrefForShare({ t: "5-3", l: "ko" })).toBe("/tools/budget-allocation");
    expect(toolHrefForShare({ t: "5-3", l: "en" })).toBe("/en/tools/budget-allocation");
    expect(toolHrefForShare({})).toBeNull();
  });
});
