import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasEnVersion, isRoutePublished, publishedToolIds } from "./routeMap";
import {
  ANALYSIS_REFERENCES, MARKETING_ANALYSIS_DOMAINS, analysisLibraryStatus, filterAnalysisLibrary,
} from "./marketingAnalysisLibrary";

const methods = MARKETING_ANALYSIS_DOMAINS.flatMap((group) => group.methods);

describe("marketing analysis library contracts", () => {
  it("covers every published tool without inventing another tool count", () => {
    expect(methods.length).toBeGreaterThan(0);
    expect([...new Set(methods.flatMap((entry) => entry.tools))].sort()).toEqual(publishedToolIds().sort());
    for (const entry of methods) {
      for (const toolId of entry.tools) {
        expect(isRoutePublished(toolId), `${entry.id}/${toolId}`).toBe(true);
        expect(hasEnVersion(toolId), toolId).toBe(true);
      }
    }
  });

  it("keeps unique anchors and complete localized scope, data and references", () => {
    expect(new Set(methods.map((entry) => entry.id)).size).toBe(methods.length);
    expect(new Set(MARKETING_ANALYSIS_DOMAINS.map((group) => group.id)).size).toBe(MARKETING_ANALYSIS_DOMAINS.length);
    for (const entry of methods) {
      for (const field of ["title", "question", "input", "limit"]) {
        expect(entry[field].ko.trim(), `${entry.id}/${field}/ko`).not.toBe("");
        expect(entry[field].en.trim(), `${entry.id}/${field}/en`).not.toBe("");
        expect(entry[field].en).not.toMatch(/[가-힣]/);
      }
      expect(entry.references.length, entry.id).toBeGreaterThan(0);
      for (const id of entry.references) {
        expect(ANALYSIS_REFERENCES[id], `${entry.id}/${id}`).toBeTruthy();
        expect(new URL(ANALYSIS_REFERENCES[id].url).protocol).toBe("https:");
      }
      for (const slug of entry.posts) {
        for (const locale of ["blog", "blog-en"]) {
          const file = path.join(process.cwd(), "content", locale, `${slug}.md`);
          expect(fs.existsSync(file), file).toBe(true);
          expect(fs.readFileSync(file, "utf8")).not.toMatch(/^draft:\s*true/m);
        }
      }
    }
  });

  it("does not advertise external methods as executable through a nearby tool", () => {
    for (const id of ["cuped", "geo-experiment", "predictive-clv", "uplift-targeting", "pricing-conjoint", "pipeline-conversion"]) {
      const entry = methods.find((item) => item.id === id);
      expect(analysisLibraryStatus(entry), id).toBe("reference");
      expect(entry.tools).toEqual([]);
    }
    expect(methods.find((entry) => entry.id === "sequential-testing").limit.en).toContain("not an always-valid inference engine");
  });

  it("finds technical terms in either language and composes availability filtering", () => {
    const search = (options) => filterAnalysisLibrary(options).flatMap((group) => group.methods.map((entry) => entry.id));
    expect(search({ query: "ＣＵＰＥＤ", locale: "ko" })).toEqual(["cuped"]);
    expect(search({ query: "중도절단", locale: "en" })).toContain("survival");
    expect(search({ query: "CUPED", status: "tool" })).toEqual([]);
    expect(search({ query: "no-such-method-91762" })).toEqual([]);
    expect(search({ query: "  ", status: "reference" })).toContain("geo-experiment");
  });
});
