import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROTECTED_FILES = {
  "src/utils/mmmMathPr416.js": "986decb7e6efc15b58f7b3c909e813d7aa383c4af8a8bc54449d4a4ceaf24f41",
  // Forecast routing/UI and the v2 forecast selector changed intentionally;
  // the frozen Classic engine above remains byte-identical.
  "src/components/tools/MarketingResponse.jsx": "f5a2534832b160029ec8dc2d6af2fa399b54b7fca6e627304af98e598b165132",
  "src/utils/mmmMath.js": "4eb5e131bf7e036b385bf8fb5837902427619f2c7ecbe78d60614d828ff9e79d",
};

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("Classic MMM protection gate", () => {
  it("keeps the frozen Classic engine and UI files byte-identical", () => {
    Object.entries(PROTECTED_FILES).forEach(([relativePath, expectedHash]) => {
      expect(sha256(`${ROOT}/${relativePath}`), relativePath).toBe(expectedHash);
    });
  });
});
