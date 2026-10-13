import { describe, expect, it } from "vitest";
import { analysisDataDetail, dataGuideQuestions, dataGuideTemplateCsv, INCREMENTALITY_METHODS } from "./analysisDataGuide";
import { publishedToolIds, hasEnVersion, idToSlug } from "./routeMap";
import { buildToolTemplateCsv } from "@/components/ds/csvTemplate";
import { journeySurface } from "./siteJourney";
import { buildPaidOrganicTrend, guessPaidOrganicColumns } from "@/utils/paidOrganicTrend";

describe("analysis data preparation contracts", () => {
  it.each(["ko", "en"])("covers every published analysis with usable guidance (%s)", locale => {
    const questions = dataGuideQuestions(locale);
    expect(questions.length).toBeGreaterThan(1);
    expect(questions.flatMap(item => item.tools.map(tool => tool.id)).sort()).toEqual(publishedToolIds().sort());
    for (const id of publishedToolIds()) {
      const detail = analysisDataDetail(id, locale);
      expect(detail.name).not.toBe(id);
      expect(detail.source).not.toBe("");
      expect(detail.guide.grain).toBeTruthy();
      expect(detail.guide.needs.length).toBeGreaterThan(0);
      expect(detail.guide.prep.length).toBeGreaterThan(0);
      expect(detail.example.rows.length).toBeGreaterThan(0);
      for (const need of detail.guide.needs) expect(need.why).toBeTruthy();
      expect(JSON.stringify(detail.guide)).not.toMatch(/5-[23](?:[/·]|와| —)/);
      expect(detail.template).toBeTruthy();
      expect(buildToolTemplateCsv(id).trim().split("\r\n")).toHaveLength(1);
    }
  });
  it("uses the same creative domain as the published tool's uploader", () => {
    expect(analysisDataDetail("9-6").guideId).toBe("5-6");
    expect(analysisDataDetail("9-6").guide.grain).toContain("소재");
  });
  it("prepares Paid/Organic outcomes rather than confusing them with ad spend", () => {
    const detail = analysisDataDetail("5-18-paid-organic");
    const headers = dataGuideTemplateCsv(detail).trim().replace(/^\uFEFF/, "").split(",");
    expect(headers).toEqual(["date", "signups", "paid_signups"]);
    const mapping = guessPaidOrganicColumns(headers);
    expect(mapping.paid).toBe("paid_signups");
    expect(mapping.total).toBe("signups");
    expect(mapping.organic).toBe("");
    const result = buildPaidOrganicTrend(detail.example.rows, mapping);
    expect(result.points).toHaveLength(2);
    expect(detail.guide.needs.map(need => need.col)).not.toContain("cost");
    expect(detail.source).not.toContain("지출");
    expect(analysisDataDetail("5-18-paid-organic", "en").source).not.toMatch(/spend/i);
  });
  it.each(INCREMENTALITY_METHODS)("uses the $id input contract and only offers a compatible template", ({ id }) => {
    const detail = analysisDataDetail("5-23", "ko", id);
    expect(detail.guideId).toBe(`5-23:${id}`);
    expect(detail.example.columns.map(column => column.key)).toContain(id === "suppression" ? "holdout_group" : "conversions");
    expect(Boolean(detail.template)).toBe(id === "suppression");
    expect(dataGuideTemplateCsv(detail)).toContain(id === "suppression" ? "holdout_group" : "conversions");
    expect(dataGuideTemplateCsv(detail).trim().split(/\r?\n/)).toHaveLength(1);
  });
  it("registers bilingual guide routing and categorizes its entry journey", () => {
    expect(idToSlug["data-guide"]).toBe("/data-guide");
    expect(hasEnVersion("data-guide")).toBe(true);
    expect(journeySurface("/data-guide")).toBe("guide");
    expect(journeySurface("/en/data-guide")).toBe("guide");
    expect(analysisDataDetail("unknown")).toBeNull();
  });
});
