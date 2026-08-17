import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * SOP(가이드) JSON 블록 계약 가드.
 *
 * 배경: `subheading`을 `{ type, html }`로 쓴 적이 있다. 렌더러는 `block.title`만 읽고
 * `escapeHtml(block.title || "")`로 폴백하므로 **빈 <h3>가 조용히 나간다** — 빌드도
 * 테스트도 통과하고 화면에서만 사라진다. 같은 함정이 모든 블록 타입에 있다
 * (`paragraph`는 html/text, `callout`은 html, `list`는 items…).
 *
 * 그래서 렌더러가 실제로 읽는 필드를 여기 명시하고, 그 필드가 비어 있으면 실패시킨다.
 * 대상 목록은 파일에서 파생한다(§7) — 새 가이드 JSON은 자동으로 검사된다.
 */

const PAGES_DIR = path.join(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
  "../public/content/pages",
);

// SopContent.renderBlock이 읽는 필드. 하나라도 값이 있으면 렌더된다.
const REQUIRED_FIELDS = {
  paragraph: ["html", "text"],
  subheading: ["title"],
  list: ["items"],
  code: ["code"],
  table: ["rows"],
  callout: ["html", "title"],
};

function collectBlocks(node, trail, out) {
  if (Array.isArray(node)) {
    node.forEach((child, i) => collectBlocks(child, `${trail}[${i}]`, out));
    return;
  }
  if (!node || typeof node !== "object") return;
  if (typeof node.type === "string" && REQUIRED_FIELDS[node.type]) out.push({ block: node, trail });
  for (const [key, value] of Object.entries(node)) collectBlocks(value, `${trail}.${key}`, out);
}

const hasValue = (value) => (Array.isArray(value) ? value.length > 0 : value != null && String(value).trim() !== "");

describe("SOP 가이드 블록 계약", () => {
  const files = fs.existsSync(PAGES_DIR) ? fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith(".json")) : [];

  it("가이드 JSON을 실제로 수집한다", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("모든 블록이 렌더러가 읽는 필드를 채운다", () => {
    const empty = [];
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(PAGES_DIR, file), "utf8"));
      const blocks = [];
      collectBlocks(data, file, blocks);
      for (const { block, trail } of blocks) {
        const fields = REQUIRED_FIELDS[block.type];
        if (!fields.some((field) => hasValue(block[field]))) {
          empty.push(`${trail} (${block.type}): ${fields.join(" 또는 ")} 중 아무것도 없음 → 빈 블록으로 렌더됨`);
        }
      }
    }
    expect(empty, `빈 블록:\n${empty.join("\n")}`).toEqual([]);
  });

  it("목차가 본문 섹션과 1:1로 맞는다", () => {
    const mismatched = [];
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(PAGES_DIR, file), "utf8"));
      if (!Array.isArray(data.toc) || !Array.isArray(data.body)) continue;
      const bodyIds = data.body.filter((s) => s?.type === "section").map((s) => s.id);
      const tocIds = data.toc.map((t) => (typeof t === "string" ? t : t.id));
      if (JSON.stringify(bodyIds) !== JSON.stringify(tocIds)) {
        mismatched.push(`${file}: toc [${tocIds.join(", ")}] ≠ body [${bodyIds.join(", ")}]`);
      }
    }
    expect(mismatched, `목차 불일치:\n${mismatched.join("\n")}`).toEqual([]);
  });
});
