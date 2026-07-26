import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROTECTED_FILES = {
  "src/utils/mmmMathPr416.js": "2ace4b96e788b152d9733399a4cf09e868edf7b7cb343961cfc3de95e3d79a85",
  "src/components/tools/MarketingResponse.jsx": "66d750c6d33b186bab497f4019c5e9bd6d9dc2e83acaccd49ac9b5e5730d92c9",
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
