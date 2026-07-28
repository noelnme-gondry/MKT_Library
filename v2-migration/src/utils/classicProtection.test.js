import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROTECTED_FILES = {
  "src/utils/mmmMathPr416.js": "986decb7e6efc15b58f7b3c909e813d7aa383c4af8a8bc54449d4a4ceaf24f41",
  // Forecast routing/export UI changed; frozen Classic math engines remain byte-identical.
  "src/components/tools/MarketingResponse.jsx": "24ddf3df15ae97880c0c42b4e1a956e5e6665f22e0a321456f00251f1b19e32d",
  "src/utils/mmmMath.js": "9bd6b44c11c01829628bf9211d7bceb9297399b7d96a8141a8e288a600f91c0a",
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
