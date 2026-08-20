import { describe, expect, it } from "vitest";
import { validateProjectFile } from "./projectSchema";
import { headerFingerprint, parseProjectText, serializeProject } from "./serializeProject";

describe(".gop.json project settings", () => {
  it("헤더 순서·Unicode 표현과 무관한 fingerprint를 만든다", async () => {
    const a = await headerFingerprint([" Cost ", "ＣＨＡＮＮＥＬ"]);
    const b = await headerFingerprint(["channel", "cost"]);
    expect(a).toBe(b);
  });

  it("allowlist 설정만 직렬화하고 raw secret을 제외한다", async () => {
    const project = await serializeProject({
      csvGroups: {
        efficiency: {
          headers: ["date", "cost"],
          mapping: { date: "date", cost: "cost" },
          raw: [{ secret: "DO_NOT_EXPORT" }],
          fileName: "client-secret.csv",
        },
      },
      dashboardFilterGroups: {
        efficiency: { dateStart: "2026-07-01", channels: new Set(["Google"]) },
      },
      viewConfig: {},
      customMetrics: {},
      customCharts: {},
    });
    const text = JSON.stringify(project);
    expect(text).not.toContain("DO_NOT_EXPORT");
    expect(text).not.toContain("client-secret.csv");
    expect(project.groups.efficiency.filters.channels).toEqual(["Google"]);
  });

  it("prototype pollution 키와 미래 버전을 거부한다", () => {
    expect(() => parseProjectText('{"schemaVersion":1,"product":"growthopt-playbook","__proto__":{"polluted":true}}')).toThrow("PROJECT_UNSAFE_KEY");
    expect(() => validateProjectFile({ schemaVersion: 3, product: "growthopt-playbook" })).toThrow("PROJECT_FUTURE_VERSION");
  });

  it("migrates a V1 mapping to reviewable V2 bindings without source rows", () => {
    const project = validateProjectFile({
      schemaVersion: 1,
      product: "growthopt-playbook",
      groups: { efficiency: { mapping: { Cost: "cost", Actions: "actions" } } },
    });
    expect(project).toMatchObject({ schemaVersion: 2 });
    expect(project.groups.efficiency.mappingBindingsV2).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceColumn: "Cost", canonicalKey: "media_spend", decision: "SUGGEST" }),
      expect.objectContaining({ sourceColumn: "Actions", canonicalKey: "outcome_generic", decision: "SUGGEST" }),
    ]));
  });
});
