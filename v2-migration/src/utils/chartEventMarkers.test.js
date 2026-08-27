import { describe, expect, it } from "vitest";
import { eventMarkerStyle } from "@/utils/chartEventMarkers";

describe("chart event marker styles", () => {
  it("gives every supported event type a distinct semantic color and line pattern", () => {
    const types = ["listing", "creative", "price", "campaign", "release", "external", "other"];
    const styles = types.map(eventMarkerStyle);

    expect(new Set(styles.map((style) => style.colorRole)).size).toBe(types.length);
    expect(new Set(styles.map((style) => JSON.stringify(style.dash))).size).toBe(types.length);
    expect(eventMarkerStyle("listing")).not.toMatchObject(eventMarkerStyle("creative"));
  });

  it("uses the explicit fallback style for an unknown type", () => {
    expect(eventMarkerStyle("unknown")).toMatchObject({ colorRole: "muted", dash: [6, 4] });
  });
});
