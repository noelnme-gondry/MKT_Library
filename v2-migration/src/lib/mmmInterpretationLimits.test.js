import { describe, expect, it } from "vitest";
import { MMM_INTERPRETATION_LIMITS, getMmmInterpretationLimits } from "./mmmInterpretationLimits";

describe("MMM interpretation limits", () => {
  it("keeps the same limits in both locales", () => {
    const ko = getMmmInterpretationLimits("ko");
    const en = getMmmInterpretationLimits("en");
    expect(ko.map((item) => item.id)).toEqual(en.map((item) => item.id));
    expect(ko.length).toBe(MMM_INTERPRETATION_LIMITS.length);
    for (const item of [...ko, ...en]) {
      expect(item.claim, item.id).toBeTruthy();
      expect(item.detail, item.id).toBeTruthy();
    }
  });

  // 한계는 결론과 같은 자리에서 읽혀야 한다 — 주장만 있고 왜인지가 없으면
  // 사용자는 무시하거나 반대로 겁먹는다(§8.6).
  it("explains each limit rather than only asserting it", () => {
    for (const item of getMmmInterpretationLimits("ko")) {
      expect(item.detail.length, item.id).toBeGreaterThan(40);
    }
  });

  // 도구 스코프다. 브랜드 사실로 승격하면 llms.txt로 나가 문맥 없이 인용된다.
  it("stays out of the brand-level facts", async () => {
    const { BRAND_FACTS, BRAND_LIMITS } = await import("./brandFacts");
    const brandIds = new Set([...BRAND_FACTS, ...BRAND_LIMITS].map((item) => item.id));
    for (const item of MMM_INTERPRETATION_LIMITS) expect(brandIds.has(item.id)).toBe(false);
  });
});
