import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROTECTED_FILES = {
  "src/utils/mmmMathPr416.js": "7c5c3a51fb233fca94bb28f4e04ca537f4cb4dfd86aa870feb015aab608de0dd",
  "src/components/tools/MarketingResponse.jsx": "3ffeb665d6c0645bdd1463b8b835f1f1cd5a4cc12f4cd6f2f7024ba1c947c13f",
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
