import { describe, expect, it } from "vitest";
import { evaluateV2Eligibility } from "../schema/toolDataRequirements";
import { mapDataset } from "./mapDataset";

// 실제 플랫폼 export의 표시 헤더를 보존한 비식별 최소 fixture다. 숫자·식별값은
// 합성값이며, 이 검사는 V1 데모의 표준키 헤더에 기대지 않는다.
const FIXTURES = [
  {
    name: "App Store Connect source report",
    toolId: "5-27",
    headers: ["Date", "Source Type", "Impressions", "Product Page Views", "Total Downloads"],
    rows: [{ Date: "2026-03-01", "Source Type": "App Store Search", Impressions: "12900", "Product Page Views": "4300", "Total Downloads": "1935" }],
    expected: {
      Date: "date", "Source Type": "store_source", Impressions: "media_impressions",
      "Product Page Views": "store_product_page_views", "Total Downloads": "outcome_installs",
    },
  },
  {
    name: "Apple Ads search terms",
    toolId: "5-26",
    headers: ["Date", "Search Term", "Total Cost", "Taps", "Installs"],
    rows: [{ Date: "2026-08-01", "Search Term": "sample planner", "Total Cost": "₩420", Taps: "42", Installs: "8" }],
    expected: { Date: "date", "Search Term": "asa_search_term", "Total Cost": "media_spend", Taps: "media_clicks", Installs: "outcome_installs" },
  },
];

describe("semantic mapper calibration fixtures", () => {
  it.each(FIXTURES)("maps every declared platform role for $name", (fixture) => {
    const result = mapDataset({ headers: fixture.headers, rows: fixture.rows });
    const actual = Object.fromEntries(result.bindings.map((binding) => [binding.sourceColumn, binding.canonicalKey]));
    expect(actual).toMatchObject(fixture.expected);
    expect(evaluateV2Eligibility({ toolId: fixture.toolId, bindings: result.bindings }).status).toBe("ready");
  });

  it("keeps the measured fixture precision at 100% without AUTO promotion", () => {
    const comparisons = FIXTURES.flatMap((fixture) => {
      const actual = Object.fromEntries(mapDataset({ headers: fixture.headers, rows: fixture.rows }).bindings.map((binding) => [binding.sourceColumn, binding.canonicalKey]));
      return Object.entries(fixture.expected).map(([header, canonicalKey]) => actual[header] === canonicalKey);
    });
    expect(comparisons.filter(Boolean)).toHaveLength(comparisons.length);
    expect(FIXTURES.flatMap((fixture) => mapDataset({ headers: fixture.headers, rows: fixture.rows }).bindings).every((binding) => binding.decision !== "AUTO")).toBe(true);
  });
});
