import { describe, expect, it } from "vitest";
import { pvmDriverLine, pvmHeadline } from "./pvmHeadline";
import { subjectParticle } from "@/lib/vocabulary/hangulMatch";

const won = (value) => `${Math.round(value * 100) / 100}원`;

describe("pvmHeadline — conclusion sentence for campaign variance", () => {
  // 예시 데이터(5-21 ?example=1)의 실제 엔진 결과 — 2026-10-26 화면에서 읽은 값.
  const exampleRows = [
    { key: "Meta AAP", contribution: 34 },
    { key: "Google UAC", contribution: 10 },
    { key: "Apple Search Ads", contribution: 5.58 },
    { key: "TikTok", contribution: 1.94 },
    { key: "Organic Search", contribution: 0.39 },
  ];

  it("says how much the metric moved and which unit moved it most", () => {
    const result = pvmHeadline({ metric: "CPI", start: 1450, end: 1502, rows: exampleRows, formatMoney: won });
    expect(result.text).toBe("CPI가 3.6% 올랐고(1450원 → 1502원), Meta AAP가 가장 크게 올렸습니다.");
    expect(result.direction).toBe("up");
    expect(result.share).toBe(65);
  });

  it("never names a unit that moved against the overall change", () => {
    // 전체는 올랐는데 절대값이 가장 큰 기여는 내림(−80) — 그 채널을 "올린 곳"으로 지목하면 거짓이다.
    const rows = [{ key: "A", contribution: -80 }, { key: "B", contribution: 70 }, { key: "C", contribution: 30 }];
    const result = pvmHeadline({ metric: "CPA", start: 1000, end: 1020, rows, formatMoney: won });
    expect(result.lead.key).toBe("B");
    expect(result.text).toContain("B가 가장 크게 올렸습니다");
    // 같은 방향 기여(70)가 전체 변화(20)보다 크면 몫(%)은 말하지 않는다.
    expect(result.share).toBeNull();
  });

  it("mirrors the wording when the metric falls", () => {
    const rows = [{ key: "A", contribution: 5 }, { key: "B", contribution: -25 }];
    const result = pvmHeadline({ metric: "CPA", start: 1000, end: 980, rows, formatMoney: won });
    expect(result.text).toBe("CPA가 2.0% 내렸고(1000원 → 980원), B가 가장 크게 낮췄습니다.");
    expect(result.text).not.toMatch(/올/);
  });

  it("does not call a rounding-level change a rise", () => {
    const result = pvmHeadline({ metric: "CPI", start: 10000, end: 10003, rows: [{ key: "A", contribution: 3 }], formatMoney: won });
    expect(result.direction).toBe("flat");
    expect(result.lead).toBeNull();
    expect(result.text).toBe("CPI 변화는 거의 없습니다(10000원 → 10003원).");
  });

  it("writes plain English without Korean", () => {
    const result = pvmHeadline({ metric: "CPI", start: 1450, end: 1502, rows: exampleRows, formatMoney: (v) => `₩${Math.round(v)}`, locale: "en" });
    expect(result.text).toBe("CPI rose 3.6% (₩1450 → ₩1502), driven most by Meta AAP.");
    expect(/[가-힣]/.test(result.text)).toBe(false);
  });

  it("reads the particle after a user-provided name", () => {
    const result = pvmHeadline({ metric: "CPA", start: 100, end: 120, rows: [{ key: "브랜드 검색", contribution: 20 }], formatMoney: won });
    expect(result.text).toBe("CPA가 20.0% 올랐고(100원 → 120원), 브랜드 검색이 가장 크게 올렸습니다.");
  });

  it("picks the subject particle from how the metric name is read", () => {
    expect(subjectParticle("CPI")).toBe("가");
    expect(subjectParticle("ROAS")).toBe("가");
    expect(subjectParticle("CPM")).toBe("이");
    expect(subjectParticle("획득 비용")).toBe("이");
    expect(subjectParticle("전환 단가")).toBe("가");
  });
});

describe("pvmDriverLine — mix versus rate", () => {
  it("names the larger of the two components first", () => {
    expect(pvmDriverLine({ mix: -4.15, rate: 56, formatMoney: won })).toBe("채널 안의 단가 변화(+56원)가 채널 비중 변화(−4.15원)보다 컸습니다.");
    expect(pvmDriverLine({ mix: 40, rate: -3, formatMoney: won })).toBe("채널 비중 변화(+40원)가 채널 안의 단가 변화(−3원)보다 컸습니다.");
    expect(pvmDriverLine({ mix: Number.NaN, rate: 1 })).toBe("");
  });
  it("speaks in the analysis unit the user chose", () => {
    expect(pvmDriverLine({ mix: 1, rate: 9, unit: "캠페인", formatMoney: won })).toBe("캠페인 안의 단가 변화(+9원)가 캠페인 비중 변화(+1원)보다 컸습니다.");
    expect(pvmDriverLine({ mix: 9, rate: 1, unit: "Campaign", formatMoney: (v) => `$${v}`, locale: "en" })).toBe("The shift in campaign share moved it more (+$9) than unit costs within each campaign (+$1).");
  });
});
