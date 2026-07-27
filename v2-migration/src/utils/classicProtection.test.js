import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROTECTED_FILES = {
  "src/utils/mmmMathPr416.js": "6f4b40ec0aa90cf81cb3018ac76d02b910b547f5d0193c9ce0bd00b00637dfba",
  "src/components/tools/MarketingResponse.jsx": "df1466f2187e42085bdf195cf85a6de011ed09a9e2db0b245edd29f266d98137",
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
