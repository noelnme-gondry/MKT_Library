import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripHtmlTags } from "@/lib/htmlText";

/**
 * 원고가 참조하는 그림 자산 가드.
 *
 * 배경: `/blog-assets/junior-metrics-guide/metric-diagnosis.svg`가 viewBox 밖으로
 * 삐져나온 문장을 담은 채 배포돼 "→ 클릭은 잘 되는데 안 사요. 랜딩·"에서 잘려 보였다.
 * 같은 그림의 EN 짝(`blog-assets-en/...`)은 이미 문장을 아랫줄 중앙정렬로 고쳐둔
 * 상태였다 — 한쪽만 고치고 짝을 안 본 전형적인 사고라 가드로 고정한다.
 *
 * 두 검사 모두 **파일에서 파생**한다(§7 "손으로 쓴 배열을 도는 가드는 가드가 아니다").
 * 원고 목록·그림 목록을 여기 나열하지 말 것 — 새 글·새 그림이 자동으로 검사된다.
 */

// 파일 위치 기준으로 잡는다 — `process.cwd()`는 실행 위치에 따라 리포 루트가 될 수
// 있고, 그러면 수집이 0건이 되어 검사가 통째로 헛돈다.
const REPO_ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const CONTENT_DIRS = ["content/blog", "content/blog-en", "content/glossary", "content/glossary-en"];
const ASSET_ROOTS = ["public/blog-assets", "public/blog-assets-en"];
const IMAGE_PATTERN = /!\[[^\]]*\]\((\/[^)\s]+)\)/g;

function walkFiles(dir, ext) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(abs, ext));
    else if (entry.name.endsWith(ext)) out.push(abs);
  }
  return out;
}

function readImageRefs() {
  const refs = [];
  for (const dir of CONTENT_DIRS) {
    const abs = path.join(REPO_ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of fs.readdirSync(abs)) {
      // `_` 프리픽스는 미발행(템플릿) — 플레이스홀더 경로를 들고 있어 제외한다.
      if (!file.endsWith(".md") || file.startsWith("_")) continue;
      const body = fs.readFileSync(path.join(abs, file), "utf8");
      for (const match of body.matchAll(IMAGE_PATTERN)) {
        refs.push({ src: match[1], from: `${dir}/${file}` });
      }
    }
  }
  return refs;
}

// SVG 텍스트 폭 추정. 정확한 폰트 메트릭은 없으므로 **과소추정**으로 잡아
// 명백한 넘침만 걸린다(한글·CJK는 실제로 거의 1em 정폭이라 그대로 1.0).
function glyphWidth(ch) {
  const code = ch.codePointAt(0);
  if ((code >= 0xac00 && code <= 0xd7a3) || (code >= 0x3040 && code <= 0x30ff) || (code >= 0x4e00 && code <= 0x9fff)) return 1;
  if (" .,'\"|:;!()[]{}·—-+%÷×→←↑↓".includes(ch)) return 0.35;
  if (ch >= "A" && ch <= "Z") return 0.65;
  return 0.5;
}

const textWidth = (text, fontSize) => [...text].reduce((sum, ch) => sum + glyphWidth(ch), 0) * fontSize;

// <text> 노드를 상속 컨텍스트(font-size·text-anchor)와 함께 훑는다. 두 속성은
// 개별 <text>가 아니라 감싸는 <g>에 걸려 있는 경우가 많아 상속을 따라가야 한다.
function collectTextNodes(svg) {
  const nodes = [];
  // 스택에 여는 태그 이름을 함께 담아 짝이 맞는 닫는 태그에서만 pop 한다.
  // (이름 없이 pop 하면 `</text>`가 감싸는 `<g>`의 컨텍스트까지 걷어내
  //  같은 그룹의 두 번째 <text>부터 text-anchor 상속이 끊긴다.)
  const stack = [{ tag: "#root", fontSize: 12, anchor: "start" }];
  const tagPattern = /<(\/?)([\w:-]+)((?:"[^"]*"|[^>"])*?)(\/?)>/g;
  let match;
  while ((match = tagPattern.exec(svg))) {
    const [, closing, tag, rawAttrs, selfClosing] = match;
    if (closing) {
      if (stack.length > 1 && stack[stack.length - 1].tag === tag) stack.pop();
      continue;
    }
    const inherited = stack[stack.length - 1];
    const attrs = Object.fromEntries([...rawAttrs.matchAll(/([\w:-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
    const ctx = {
      tag,
      fontSize: attrs["font-size"] ? Number(attrs["font-size"]) : inherited.fontSize,
      anchor: attrs["text-anchor"] || inherited.anchor,
    };
    if (tag === "text") {
      const close = svg.indexOf("</text>", tagPattern.lastIndex);
      const inner = close < 0 ? "" : svg.slice(tagPattern.lastIndex, close);
      const text = stripHtmlTags(inner).replace(/&#8594;/g, "→").replace(/&\w+;/g, "-").trim();
      // 회전 라벨(축 제목)은 x가 회전 중심이라 가로폭 계산이 성립하지 않는다.
      if (text && !attrs.transform) {
        nodes.push({ text, fontSize: ctx.fontSize, x: Number(attrs.x || 0), anchor: ctx.anchor });
      }
    }
    if (!selfClosing) stack.push(ctx);
  }
  return nodes;
}

describe("원고 그림 자산", () => {
  const imageRefs = readImageRefs();
  const svgFiles = ASSET_ROOTS.flatMap((root) => walkFiles(path.join(REPO_ROOT, root), ".svg"));

  it("검사 대상을 실제로 수집한다", () => {
    // 정규식·경로가 깨지면 0건이 되고 아래 검사가 전부 공허하게 통과한다.
    expect(imageRefs.length).toBeGreaterThan(50);
    expect(svgFiles.length).toBeGreaterThan(50);
  });

  it("원고가 참조하는 그림 파일이 전부 실재한다", () => {
    const missing = imageRefs
      .filter((ref) => !fs.existsSync(path.join(REPO_ROOT, "public", ref.src)))
      .map((ref) => `${ref.src} <- ${ref.from}`);
    expect(missing, `없는 그림 파일:\n${missing.join("\n")}`).toEqual([]);
  });

  it("원고 언어와 그림 속 글자의 언어가 맞는다", () => {
    // EN 글이 한글 도표를, KO 글이 영어 도표를 쓰고 있던 사고가 12건 있었다
    // (`ad-performance-diagnosis` EN 6장이 한글, `cohort-analysis-guide` KO 3장이 영어).
    // 파일이 어느 폴더에 있느냐가 아니라 **글자가 무슨 언어냐**로 봐야 잡힌다.
    const mismatched = [];
    for (const ref of imageRefs) {
      if (!ref.src.endsWith(".svg")) continue;
      const file = path.join(REPO_ROOT, "public", ref.src);
      if (!fs.existsSync(file)) continue;
      const svg = fs.readFileSync(file, "utf8");
      const labels = [...svg.matchAll(/>([^<]+)</g)].map((m) => m[1]).join(" ");
      const hangul = (labels.match(/[가-힣]/g) || []).length;
      const words = (labels.match(/\b[A-Za-z]{4,}\b/g) || []).length;
      const isEnglishArticle = ref.from.includes("-en/");
      if (isEnglishArticle && hangul > 10) mismatched.push(`${ref.from} → ${ref.src} (한글 ${hangul}자)`);
      // 영문 약어(CTR·CPA·SKAN)만 있는 도표는 KO에서도 정상이라 단어 수로 본다.
      if (!isEnglishArticle && hangul === 0 && words > 8) mismatched.push(`${ref.from} → ${ref.src} (영단어 ${words}개, 한글 0)`);
    }
    expect(mismatched, `원고와 그림의 언어 불일치:\n${mismatched.join("\n")}`).toEqual([]);
  });

  it("SVG 안의 글자가 viewBox 밖으로 잘리지 않는다", () => {
    const clipped = [];
    for (const file of svgFiles) {
      const svg = fs.readFileSync(file, "utf8");
      const viewBox = svg.match(/viewBox="([\d.\s-]+)"/);
      if (!viewBox) {
        clipped.push(`${path.relative(REPO_ROOT, file)}: viewBox 없음`);
        continue;
      }
      const width = Number(viewBox[1].trim().split(/\s+/)[2]);
      for (const node of collectTextNodes(svg)) {
        const nodeWidth = textWidth(node.text, node.fontSize);
        const left = node.anchor === "middle" ? node.x - nodeWidth / 2 : node.anchor === "end" ? node.x - nodeWidth : node.x;
        const overflow = left + nodeWidth - width;
        // 폭 추정 오차 여유 10px. 그보다 크게 넘치면 실제로 잘려 보인다.
        if (overflow > 10 || left < -10) {
          clipped.push(`${path.relative(REPO_ROOT, file)}: "${node.text.slice(0, 40)}" (${Math.round(overflow)}px 초과, viewBox 폭 ${width})`);
        }
      }
    }
    expect(clipped, `viewBox 밖으로 잘리는 글자:\n${clipped.join("\n")}`).toEqual([]);
  });
});
