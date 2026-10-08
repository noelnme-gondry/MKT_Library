// Tokenize the original code once. Never run another regex over generated HTML:
// keywords such as `class` in a comment must not corrupt a span's attributes.
const escape = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
const keywords = new Set("import let var val fun func class object return if else for while self this true false nil null companion override private public internal suspend curl export echo cd grep adjust adb xcrun GET POST PUT PATCH DELETE".split(" "));
export function highlightSopCode(code, lang) {
  const source = String(code ?? "");
  if (!["swift", "kotlin", "json", "bash", "http"].includes(lang)) return escape(source);
  const tokens = /\/\/[^\n]*|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b[A-Za-z_]\w*\b|\b\d+(?:\.\d+)?\b|--?[A-Za-z][\w-]*/g;
  let out = "", end = 0;
  for (const match of source.matchAll(tokens)) {
    const token = match[0];
    out += escape(source.slice(end, match.index));
    const style = token.startsWith("//") || token.startsWith("#") ? "c"
      : /^["']/.test(token) ? (lang === "json" && /^\s*:/.test(source.slice(match.index + token.length)) ? "a" : "s")
      : keywords.has(token) ? "k" : /^\d/.test(token) ? "n" : token.startsWith("-") ? "t" : null;
    out += style ? `<span class="${style}">${escape(token)}</span>` : escape(token);
    end = match.index + token.length;
  }
  return out + escape(source.slice(end));
}
