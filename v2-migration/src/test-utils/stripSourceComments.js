/**
 * Source-contract tests must not accept explanatory comments as evidence that
 * a selector, component, or copy string is actually wired into the product.
 * Full-line comments and block comments cover the contract tests without
 * corrupting URL-like `//` sequences inside source strings.
 */
export function stripSourceComments(source = "") {
  return String(source)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}
