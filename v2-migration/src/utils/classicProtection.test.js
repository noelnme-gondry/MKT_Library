import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROTECTED_FILES = {
  "src/utils/mmmMathPr416.js": "986decb7e6efc15b58f7b3c909e813d7aa383c4af8a8bc54449d4a4ceaf24f41",
  // Forecast routing/UI and the v2 forecast selector changed intentionally;
  // the frozen Classic engine above remains byte-identical.
  "src/components/tools/MarketingResponse.jsx": "bc8c48b3028a674cadc58fc62a79368212cb942ddc1bb64533feedb50e60f76c",
  "src/utils/mmmMath.js": "46362c11209fd234d81ddab4e1cbe8344435a96487478bac5b5a25a5feb6b65d",
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
