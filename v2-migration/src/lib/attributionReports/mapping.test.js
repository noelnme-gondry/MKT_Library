import { describe, it, expect } from "vitest";
import { buildMappingContract } from "../data-import/mappingContract";
import { mapDataset } from "../data-import/semantic-mapper/mapDataset";
import { evaluateV2Eligibility } from "../data-import/schema/toolDataRequirements";
import { buildCanonicalDataset } from "../data-import/buildCanonicalDataset";
import { evaluateEligibility } from "../analysis-router/evaluateEligibility";
import { buildMultitouchDemo } from "./demo";
import { MULTITOUCH_FIELDS } from "./fields";
describe("AppsFlyer original export import contracts", () => {
  it("satisfies the original mapping, semantic roles and analysis gate with native headers", () => {
    const demo = buildMultitouchDemo(), raw = demo.raw.slice(0, 12);
    const contract = buildMappingContract({ toolId: "5-30", headers: demo.headers, rows: raw });
    const mapped = new Set(Object.values(contract.mapping));
    for (const [key, field] of Object.entries(MULTITOUCH_FIELDS)) if (field.required) expect(mapped.has(key), key).toBe(true);
    const semantic = mapDataset({ headers: demo.headers, rows: raw });
    expect(evaluateV2Eligibility({ toolId: "5-30", bindings: semantic.bindings }).status).toBe("ready");
    const canonical = buildCanonicalDataset({ raw, headers: demo.headers, mapping: contract.mapping });
    expect(evaluateEligibility({ toolId: "5-30", mapping: contract.mapping, canonicalData: canonical }).status).not.toBe("blocked");
    expect(canonical.records[0].dimensions.af_id).toBeTruthy();
    expect(canonical.records[0].metrics.af_id).toBeUndefined();
  });
});
