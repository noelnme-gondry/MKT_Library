import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROTECTED_FILES = {
  "src/utils/mmmMathPr416.js": "55849f8ab2afabaf6e4fe615d52f8419c6cb40cf49fc57cfdefd3c4006e1da84",
  "src/components/tools/MarketingResponse.jsx": "ada6eb94ab8b9a2cb6bc06a54e1d1c1eb981d257b6c78a1912a736261b1745f8",
  "src/utils/mmmMath.js": "64a3cb574f96cc711efa94c21d0375f79310897984c0bb295cc724ffe9e84547",
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
