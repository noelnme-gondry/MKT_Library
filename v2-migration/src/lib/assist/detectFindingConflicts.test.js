import { describe, expect, it } from "vitest";
import { detectFindingConflicts, directionOfFinding } from "./detectFindingConflicts";

const finding = (over) => ({
  schemaVersion: 1,
  id: over.id,
  toolId: over.toolId,
  dataGroup: "efficiency",
  kind: over.kind,
  severity: "watch",
  score: 70,
  headline: over.headline,
  detail: over.detail || "",
  evidence: [],
  scope: {},
  suggestedTargets: [],
  inputSignature: "sig",
  locale: "ko",
});

describe("directionOfFinding", () => {
  it("reads an action direction out of the conclusion sentence", () => {
    expect(directionOfFinding({ headline: "아직 여유가 있습니다. 증액 여력 점검." })).toBe("expand");
    expect(directionOfFinding({ headline: "포화 구간입니다. 감액을 검토하세요." })).toBe("contract");
    expect(directionOfFinding({ headline: "큰 변화 없습니다." })).toBe(null);
  });
});

describe("detectFindingConflicts", () => {
  const expandOne = finding({ id: "a", toolId: "5-22", kind: "saturation", headline: "Meta는 아직 여유가 있어 증액 여력이 있습니다." });
  const contractOne = finding({ id: "b", toolId: "5-3", kind: "allocation", headline: "Meta 예산을 감액하고 Google로 옮기세요." });

  it("pairs two conclusions that point in opposite directions", () => {
    const conflicts = detectFindingConflicts([expandOne, contractOne]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].left.toolId).toBe("5-22");
    expect(conflicts[0].right.toolId).toBe("5-3");
    // 어느 쪽이 옳은지 정하지 않는다 — 확인 순서만 말한다.
    expect(conflicts[0].detail).toContain("확인하세요");
    expect(conflicts[0].headline).not.toMatch(/틀렸|무시/);
  });

  it("does not pair two conclusions from the same tool", () => {
    const sameTool = finding({ id: "c", toolId: "5-22", kind: "saturation", headline: "Google은 감액이 필요합니다." });
    expect(detectFindingConflicts([expandOne, sameTool])).toEqual([]);
  });

  it("does not pair conclusions that agree or carry no direction", () => {
    const neutral = finding({ id: "d", toolId: "5-2", kind: "anomaly", headline: "큰 변화 없습니다." });
    expect(detectFindingConflicts([expandOne, neutral])).toEqual([]);
    const alsoExpand = finding({ id: "e", toolId: "5-2", kind: "anomaly", headline: "증액 여력 점검을 권합니다." });
    expect(detectFindingConflicts([expandOne, alsoExpand])).toEqual([]);
  });

  it("localizes without changing what it claims", () => {
    const [conflict] = detectFindingConflicts([expandOne, contractOne], { locale: "en" });
    expect(conflict.headline).toContain("Saturation");
    expect(conflict.headline).toContain("Budget allocation");
    expect(conflict.detail).toContain("Neither is corrected here");
  });

  it("is deterministic and stable in order", () => {
    const third = finding({ id: "f", toolId: "5-2", kind: "anomaly", headline: "지출을 줄이세요(감액)." });
    const first = detectFindingConflicts([expandOne, contractOne, third]);
    const second = detectFindingConflicts([third, contractOne, expandOne]);
    expect(first).toEqual(second);
    expect(first).toHaveLength(2);
  });

  it("handles empty and malformed input without throwing", () => {
    expect(detectFindingConflicts(null)).toEqual([]);
    expect(detectFindingConflicts([null, {}, { toolId: "5-2" }])).toEqual([]);
  });
});
