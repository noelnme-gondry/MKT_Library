import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROTECTED_FILES = {
  "src/utils/mmmMathPr416.js": "0127e78b893974ec6b811e080e0febe8b1dcabe29a12bd297bf9c0b45f541a7e",
  "src/components/tools/MarketingResponse.jsx": "d0f7cacbc134d0b09082df91269d2c65221b1470733dd8de4b0673946c40996f",
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
