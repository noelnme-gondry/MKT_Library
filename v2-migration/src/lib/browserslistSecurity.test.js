import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// The browser entry point does not load custom stats. Exercise the actual Node
// build dependency so the advisory cannot be hidden by browser-field resolution.
const require = createRequire(import.meta.url);
const browserslist = require("browserslist");

describe("Browserslist custom stats security", () => {
  it.each(["__proto__", "toString", "valueOf", "constructor", "hasOwnProperty", "isPrototypeOf"])(
    "does not crash an ordinary query on inherited key %s",
    (key) => {
      const expected = browserslist("defaults", { stats: {} });
      const stats = JSON.parse(JSON.stringify({ [key]: { onekey: 5 }, chrome: { 100: 50 } }));
      expect(expected.length).toBeGreaterThan(0);
      expect(browserslist("defaults", { stats })).toEqual(expected);
    },
  );
});
