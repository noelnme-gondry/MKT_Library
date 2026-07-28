import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROTECTED_FILES = {
  "src/utils/mmmMathPr416.js": "986decb7e6efc15b58f7b3c909e813d7aa383c4af8a8bc54449d4a4ceaf24f41",
  // Forecast routing/export UI changed; frozen Classic math engines remain byte-identical.
  "src/components/tools/MarketingResponse.jsx": "a5aef77a55c8ac9b235535d65b26e25b775a8205c0780c6892cd5ab99c245d77",
  "src/utils/mmmMath.js": "bf6cb84d00d428dbebf41aa22386c5b1c6bda405f0f205aaa182818894146e9f",
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
