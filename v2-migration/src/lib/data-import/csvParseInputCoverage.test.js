import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TOOL_UPLOADERS = [
  "../../components/tools/AhaMomentFinder.jsx",
  "../../components/tools/BrandCampaignIncrementality.jsx",
  "../../components/tools/ContentElementAnalyzer.jsx",
  "../../components/tools/Incrementality.jsx",
  "../../components/tools/PaidOrganicTrend.jsx",
  "../../components/tools/StoreEventLog.jsx",
];

describe("custom CSV uploader coverage", () => {
  it("routes every audited custom CSV input through the shared size and CP949 parser", () => {
    for (const relativePath of TOOL_UPLOADERS) {
      const source = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
      expect(source, relativePath).toContain("prepareCsvParseInput");
    }
  });
});
