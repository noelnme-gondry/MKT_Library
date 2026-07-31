import { describe, expect, it } from "vitest";
import { findingFromResultCard } from "./findingProducers";
import { findingHasForbiddenData, validateFinding } from "./findingSchema";
import { rankFindings } from "./rankFindings";

const base = {
  schemaVersion: 1,
  dataGroup: "efficiency",
  kind: "anomaly",
  severity: "watch",
  score: 70,
  headline: "Watch this",
  detail: "Evidence",
  evidence: [],
  scope: {},
  suggestedTargets: [],
  inputSignature: "sig",
  locale: "en",
};

describe("structured assist findings", () => {
  it("입력 순서와 무관하게 결정론적으로 정렬한다", () => {
    const a = { ...base, id: "a", toolId: "5-2", severity: "action", score: 10 };
    const b = { ...base, id: "b", toolId: "5-21", severity: "watch", score: 99 };
    expect(rankFindings([b, a]).map((item) => item.id)).toEqual(["a", "b"]);
    expect(rankFindings([a, b]).map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("원본 데이터 키가 있으면 발행을 거부한다", () => {
    const unsafe = { ...base, id: "unsafe", toolId: "5-2", evidence: [{ raw: [{ secret: 1 }] }] };
    expect(findingHasForbiddenData(unsafe)).toBe(true);
    expect(validateFinding(unsafe)).toBe(false);
  });

  it("결과 카드의 표시값만 finding으로 변환한다", () => {
    const finding = findingFromResultCard({
      toolId: "5-22",
      tone: "bad",
      headline: "포화 구간입니다",
      points: [{ text: "증액을 멈추세요" }],
      stats: [{ label: "한계 CPA", value: "₩20,000" }],
      inputSignature: "sig",
      locale: "ko",
      dataGroup: "efficiency",
    });
    expect(validateFinding(finding)).toBe(true);
    expect(finding.kind).toBe("saturation");
    expect(JSON.stringify(finding)).not.toContain("csvData");
  });

  it("구조화된 첫 근거를 라벨·대상·수치까지 finding에 보존한다", () => {
    const finding = findingFromResultCard({
      toolId: "5-2",
      tone: "neutral",
      headline: "큰 변화 없습니다",
      points: [{ label: "지출 최대 변동", text: "Apple Search Ads", detail: "+₩3,610,678 · 설치 변화 없음" }],
      stats: [{ label: "CPI", value: "₩1,506" }],
      inputSignature: "structured",
      locale: "ko",
      dataGroup: "efficiency",
    });
    expect(finding.detail).toBe("지출 최대 변동 · Apple Search Ads · +₩3,610,678 · 설치 변화 없음");
  });
});
