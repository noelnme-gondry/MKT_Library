import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { marked } from "marked";
import matter from "gray-matter";
import { getTemplatePage, TEMPLATE_PAGES } from "./templateCatalog";
import { highlightSopCode } from "./sopHighlight";
import { rememberAllocationPreview, readAllocationPreview } from "./assistant/allocationPreview";
import { runEfficiencyAnalysis } from "./assistant/efficiencyAnalysisAdapters";
import { buildSampleJourney } from "./sampleJourney";

describe("Dots audit regression coverage", () => {
  it("describes the minimum PVM roles without requiring all alternative columns", () => {
    const template = getTemplatePage(TEMPLATE_PAGES.find(p => p.toolId === "5-21").slug);
    expect(template.requiredCount).toBe(4);
    expect(template.fields.find(f => f.key === "date").required).toBe(true);
    for (const key of ["channel", "campaign_name", "installs", "actions"]) {
      expect(template.fields.find(f => f.key === key)).toMatchObject({ required: false, alternatives: expect.arrayContaining([key]) });
    }
    // A file with one grouping and one outcome is sufficient; optional columns
    // listed on the template must not become de facto required inputs.
    const csv = buildSampleJourney("ko");
    const entries = Object.entries(csv.mapping).filter(([, field]) => ["date", "channel", "cost", "installs"].includes(field));
    const minimal = { ...csv, mapping: Object.fromEntries(entries), raw: csv.raw.map(row => Object.fromEntries(entries.map(([key]) => [key, row[key]]))) };
    expect(runEfficiencyAnalysis({ toolId: "5-21", csvData: minimal, locale: "ko", inputSignature: "minimal", mappingSignature: "four-roles" }).status).toBe("success");
  });
  it.each(["5-20", "9-1", "5-23"])("publishes meaningful required roles and labels for %s", toolId => {
    const slug = TEMPLATE_PAGES.find(p => p.toolId === toolId).slug;
    for (const locale of ["ko", "en"]) {
      const template = getTemplatePage(slug, locale);
      expect(template.requiredCount).toBeGreaterThanOrEqual(2);
      expect(template.fields.every(field => field.label.length > 0)).toBe(true);
      if (toolId !== "5-23") {
        expect(template.requiredCount).toBe(2);
        expect(template.fields.find(f => f.key.endsWith("_id")).required).toBe(false);
      }
    }
  });
  it("keeps an actual allocation preview for the same dataset only", () => {
    const csv = buildSampleJourney("ko");
    const result = runEfficiencyAnalysis({ toolId: "5-3", csvData: csv, locale: "ko", inputSignature: "i", mappingSignature: "m" });
    expect(result.status).toBe("success");
    rememberAllocationPreview(csv, result);
    const preview = readAllocationPreview({ ...csv });
    expect(preview.headline).toBe(result.verdict.headline);
    expect(preview.stats).toEqual(result.verdict.stats);
    expect(preview.basis.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(preview.basis.end >= preview.basis.start).toBe(true);
    expect(readAllocationPreview({ ...csv, raw: [...csv.raw] })).toBeNull();
    expect(readAllocationPreview({ ...csv, mapping: { ...csv.mapping, extra: "cost" } })).toBeNull();
  });
  it.each(["swift", "kotlin", "json", "bash", "http"])("preserves exact code text and safe markup while highlighting %s", lang => {
    const code = '// class 12 "return"\nlet url = "https://example.com?a=1&b=2"\n{"class": "<script>alert(1)</script>", "value": true}\n# export 1\ncurl --header "A: B"';
    const dom = new JSDOM(`<pre>${highlightSopCode(code, lang)}</pre>`);
    expect(dom.window.document.querySelector("pre").textContent).toBe(code);
    expect(dom.window.document.querySelectorAll("pre script").length).toBe(0);
    expect([...dom.window.document.querySelectorAll("span")].every(span => /^[casknt]$/.test(span.className))).toBe(true);
    dom.window.close();
  });
  it("renders all published Korean and English blog emphasis without leaking markdown", () => {
    let count = 0;
    const broken = [];
    for (const dir of ["content/blog", "content/blog-en"]) {
      for (const file of readdirSync(dir).filter(f => f.endsWith(".md"))) {
        const { data, content } = matter(readFileSync(`${dir}/${file}`, "utf8"));
        if (data.draft) continue;
        const dom = new JSDOM(marked.parse(content));
        dom.window.document.querySelectorAll("pre, code").forEach(node => node.remove());
        if (/\*\*[^\n*]+\*\*/.test(dom.window.document.body.textContent)) broken.push(`${dir}/${file}`);
        dom.window.close(); count++;
      }
    }
    expect(count).toBeGreaterThan(80);
    expect(broken).toEqual([]);
  });
});
