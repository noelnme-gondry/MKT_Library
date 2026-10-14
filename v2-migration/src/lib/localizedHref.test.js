import { expect, it } from "vitest";
import { englishSwitchHref, localizedHref } from "./localizedHref";
import { COMPARE_SLUGS } from "./compareContent";

it.each(["/compare", ...COMPARE_SLUGS.map(slug => `/compare/${slug}`)])("preserves the marketing analysis destination when changing language: %s", path => {
  expect(englishSwitchHref(path)).toBe(`/en${path}`);
  expect(localizedHref(path, "en")).toBe(`/en${path}`);
  expect(localizedHref(`${path}#methods`, "en")).toBe(`/en${path}#methods`);
  expect(localizedHref(path, "ko")).toBe(path);
});
