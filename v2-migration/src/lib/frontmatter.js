// 서버/빌드의 Markdown 메타데이터만 읽는다. 실행 가능한 frontmatter 엔진은 받지 않는다.
import { load } from "js-yaml";

export default function parseFrontmatter(raw) {
  const source = String(raw).replace(/^\uFEFF/, "");
  const opening = /^---[ \t]*\r?\n/.exec(source);
  if (!opening) return { data: {}, content: source };
  const rest = source.slice(opening[0].length);
  const closing = /^---[ \t]*(?:\r?\n|$)/m.exec(rest);
  if (!closing) throw new SyntaxError("Markdown frontmatter is missing its closing delimiter.");
  const data = load(rest.slice(0, closing.index)) ?? {};
  if (typeof data !== "object" || Array.isArray(data)) {
    throw new TypeError("Markdown frontmatter must be a mapping.");
  }
  return { data, content: rest.slice(closing.index + closing[0].length) };
}
