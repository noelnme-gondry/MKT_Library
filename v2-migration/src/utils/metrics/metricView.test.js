import { describe, it, expect } from "vitest";
import { materializeOrder, applyMetricView, moveInOrder } from "./metricView.js";

const items = [
  { key: "cost", label: "비용" },
  { key: "cpi", label: "CPI" },
  { key: "ctr", label: "CTR" },
  { key: "roas", label: "ROAS" },
];
const keys = items.map((i) => i.key);

describe("materializeOrder", () => {
  it("order 없으면 원래 순서", () => {
    expect(materializeOrder(keys, [])).toEqual(["cost", "cpi", "ctr", "roas"]);
  });
  it("부분 order → 지정분 앞, 나머지 원순서 뒤", () => {
    expect(materializeOrder(keys, ["roas"])).toEqual(["roas", "cost", "cpi", "ctr"]);
  });
  it("전체 order 반영", () => {
    expect(materializeOrder(keys, ["ctr", "roas", "cost", "cpi"])).toEqual(["ctr", "roas", "cost", "cpi"]);
  });
  it("유령 key(후보에 없음)는 드롭", () => {
    expect(materializeOrder(keys, ["ghost", "roas"])).toEqual(["roas", "cost", "cpi", "ctr"]);
  });
  it("항상 후보 전체를 정확히 1회씩 포함", () => {
    const out = materializeOrder(keys, ["ctr"]);
    expect([...out].sort()).toEqual([...keys].sort());
  });
});

describe("applyMetricView", () => {
  it("config 없으면 원본 그대로", () => {
    expect(applyMetricView(items, undefined).map((i) => i.key)).toEqual(keys);
  });
  it("hidden 제외", () => {
    const out = applyMetricView(items, { hidden: ["cpi", "ctr"] });
    expect(out.map((i) => i.key)).toEqual(["cost", "roas"]);
  });
  it("order 정렬 + hidden 동시 적용", () => {
    const out = applyMetricView(items, { hidden: ["cost"], order: ["roas", "ctr"] });
    expect(out.map((i) => i.key)).toEqual(["roas", "ctr", "cpi"]);
  });
  it("항목 객체 보존(label 등)", () => {
    const out = applyMetricView(items, { order: ["ctr"] });
    expect(out[0]).toEqual({ key: "ctr", label: "CTR" });
  });
  it("커스텀 keyOf 지원", () => {
    const arr = [{ k: "a" }, { k: "b" }];
    const out = applyMetricView(arr, { hidden: ["a"] }, (x) => x.k);
    expect(out.map((x) => x.k)).toEqual(["b"]);
  });
});

describe("moveInOrder", () => {
  it("아래로 이동(+1)", () => {
    expect(moveInOrder(keys, [], "cost", 1)).toEqual(["cpi", "cost", "ctr", "roas"]);
  });
  it("위로 이동(-1)", () => {
    expect(moveInOrder(keys, [], "ctr", -1)).toEqual(["cost", "ctr", "cpi", "roas"]);
  });
  it("맨 위에서 위로 = 변화 없음", () => {
    expect(moveInOrder(keys, [], "cost", -1)).toEqual(keys);
  });
  it("맨 아래에서 아래로 = 변화 없음", () => {
    expect(moveInOrder(keys, [], "roas", 1)).toEqual(keys);
  });
  it("기존 order 위에서 이동", () => {
    expect(moveInOrder(keys, ["roas", "ctr"], "ctr", -1)).toEqual(["ctr", "roas", "cost", "cpi"]);
  });
});
