import { describe, expect, it } from "vitest";
import { workspaceResumeRouteId } from "@/lib/workspaceResume";

describe("workspace resume routes", () => {
  it("returns preparation routes for shared-grain datasets", () => {
    expect(workspaceResumeRouteId("efficiency")).toBe("start-gate");
    expect(workspaceResumeRouteId("response")).toBe("5-18");
  });

  it("derives a published tool for isolated data groups", () => {
    expect(workspaceResumeRouteId("experiment")).toBe("5-4");
    expect(workspaceResumeRouteId("incrementality")).toBe("5-23");
    expect(workspaceResumeRouteId("does-not-exist")).toBeNull();
  });
});
