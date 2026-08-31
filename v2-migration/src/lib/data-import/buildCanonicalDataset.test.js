import { describe, expect, it } from "vitest";
import { buildCanonicalDataset } from "./buildCanonicalDataset";

describe("buildCanonicalDataset", () => {
  it("normalizes mapped values while retaining unknown columns as extras", () => {
    const dataset = buildCanonicalDataset({
      headers: ["일자", "소진액", "채널", "비고"],
      mapping: { 일자: "date", 소진액: "cost", 채널: "channel", 비고: "__ignore__" },
      raw: [{ 일자: "2026.07.19", 소진액: "₩1,200,000", 채널: "Meta", 비고: "프로모션" }],
    });
    expect(dataset.records).toEqual([{
      date: "2026-07-19",
      dimensions: { channel: "Meta" },
      metrics: { cost: 1200000 },
      source: { rowNumber: 2 },
      extras: { 비고: "프로모션" },
    }]);
  });

  it("removes only structurally obvious blank and summary rows", () => {
    const dataset = buildCanonicalDataset({
      headers: ["날짜", "비용"],
      mapping: { 날짜: "date", 비용: "cost" },
      raw: [{ 날짜: "", 비용: "" }, { 날짜: "합계", 비용: "합계" }, { 날짜: "2026-07-20", 비용: "100" }],
    });
    expect(dataset.summary).toMatchObject({ outputRows: 1, emptyRowsRemoved: 1, summaryRowsRemoved: 1 });
  });

  it("removes numeric total rows without deleting a real campaign named Total", () => {
    const dataset = buildCanonicalDataset({
      headers: ["날짜", "캠페인", "비용"],
      mapping: { 날짜: "date", 캠페인: "campaign_name", 비용: "cost" },
      raw: [
        { 날짜: "합계", 캠페인: "", 비용: "900" },
        { 날짜: "", 캠페인: "Grand Total", 비용: "900" },
        { 날짜: "2026-08-31", 캠페인: "Total", 비용: "100" },
      ],
    });
    expect(dataset.summary).toMatchObject({ outputRows: 1, summaryRowsRemoved: 2 });
    expect(dataset.records[0]).toMatchObject({ date: "2026-08-31", dimensions: { campaign_name: "Total" }, metrics: { cost: 100 } });
  });

  it("keeps invalid values out of metrics and reports them", () => {
    const dataset = buildCanonicalDataset({
      headers: ["날짜", "비용"],
      mapping: { 날짜: "date", 비용: "cost" },
      raw: [{ 날짜: "not-a-date", 비용: "알 수 없음" }],
    });
    expect(dataset.records[0]).toMatchObject({ date: null, metrics: { cost: null } });
    expect(dataset.issues).toHaveLength(2);
  });

  it("keeps a snapshot date as metadata instead of replacing the cohort date", () => {
    const dataset = buildCanonicalDataset({
      headers: ["코호트일", "추출일", "설치"],
      mapping: { 코호트일: "date", 추출일: "snapshot_date", 설치: "installs" },
      raw: [{ 코호트일: "2026-07-19", 추출일: "2026-07-26", 설치: "100" }],
    });
    expect(dataset.records[0]).toMatchObject({
      date: "2026-07-19",
      dimensions: { snapshot_date: "2026-07-26" },
      metrics: { installs: 100 },
    });
  });
});
