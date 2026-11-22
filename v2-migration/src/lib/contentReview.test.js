import { describe, expect, it } from "vitest";
import { executeAdvanced } from "./advanced-marketing/execute";
import { advancedDemoOptions, advancedDemoRows } from "./advanced-marketing/demo";

describe("content guidance follows actual behavior", () => {
  it.each(["5-33", "5-38"])("requires timezone timestamps as documented for %s", (id) => {
    const rows = advancedDemoRows(id), options = advancedDemoOptions(id);
    expect(executeAdvanced(id, rows, options).status).toBe("ready");
    expect(() => executeAdvanced(id, [{ ...rows[0], event_time: "2026-01-01" }, ...rows.slice(1)], options)).toThrow();
  });
  it("keeps user_id required in the existing funnel engine", () => {
    const rows = advancedDemoRows("5-33");
    expect(() => executeAdvanced("5-33", [{ ...rows[0], user_id: "" }, ...rows.slice(1)], advancedDemoOptions("5-33"))).toThrow();
  });
});
