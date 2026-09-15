// `@/x` → <repo>/src/x 해석 + 확장자 없는 상대 import 해석 전용 ESM 로더.
// 감사 스크립트가 vitest 없이 프로덕션 모듈을 그대로 import 하기 위한 것
// (정적 정규식 파싱은 주석·들여쓰기에 속는다 — §7).
import { pathToFileURL } from "node:url";
import path from "node:path";

const SRC = pathToFileURL(path.resolve(import.meta.dirname, "../../src/")).href + "/";
const EXTS = ["", ".js", ".jsx", ".mjs", "/index.js", "/index.jsx"];

async function tryAll(base, context, nextResolve) {
  for (const ext of EXTS) {
    try { return await nextResolve(base + ext, context); } catch {}
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const hit = await tryAll(new URL(specifier.slice(2), SRC).href, context, nextResolve);
    if (hit) return hit;
  }
  if (specifier.startsWith(".") && !path.extname(specifier)) {
    const hit = await tryAll(new URL(specifier, context.parentURL).href, context, nextResolve);
    if (hit) return hit;
  }
  return nextResolve(specifier, context);
}
