import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripSourceComments } from "@/test-utils/stripSourceComments";

const SRC_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function componentFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) return componentFiles(target);
    return entry.name.endsWith(".jsx") && !entry.name.includes(".test.") ? [target] : [];
  });
}

describe("CSV clear contract", () => {
  it("routes component-level empty resets through clearCsvGroup", () => {
    const offenders = componentFiles(path.join(SRC_DIR, "components")).flatMap((file) => {
      const source = stripSourceComments(readFileSync(file, "utf8"));
      return [...source.matchAll(/setCsvData\(\s*\{[\s\S]{0,240}?raw\s*:\s*\[\]/g)]
        .map(() => path.relative(SRC_DIR, file));
    });

    expect(offenders, `IndexedDB 삭제를 우회한 빈 CSV 직접 쓰기:\n${offenders.join("\n")}`).toEqual([]);
  });
});
