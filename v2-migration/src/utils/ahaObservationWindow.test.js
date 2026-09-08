import { expect, it } from "vitest";
import { limitAhaObservationWindow } from "./ahaObservationWindow";
it("excludes contemporaneous, future and unknown windows before the Aha engine", () => {
  const mapping = { before: { role: "feature", window: 7 }, same: { role: "feature", window: 14 }, later: { role: "feature", window: 30 }, all: { role: "feature", window: Infinity }, outcome: { role: "target" } };
  const result = limitAhaObservationWindow(mapping, 14);
  expect(result.excluded).toEqual(["same", "later", "all"]);
  expect(result.colMap.before.role).toBe("feature");
  expect(result.colMap.outcome.role).toBe("target");
  expect(mapping.same.role).toBe("feature");
  expect(limitAhaObservationWindow(mapping, 0).confirmed).toBe(false);
});
