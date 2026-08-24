import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stripSourceComments } from "@/test-utils/stripSourceComments";

const CSS = stripSourceComments(readFileSync(new URL("./globals.css", import.meta.url), "utf8"));

function ruleFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return CSS.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] || "";
}

describe("card copy width", () => {
  it.each([
    ".dc-question-card h3",
    ".dc-question-card p",
    ".dc-library-card p",
    ".content-card.is-featured .card-title",
    ".content-card.is-featured .card-desc",
    ".result-action-card__headline",
    ".tool-connection-card > p",
  ])("lets %s use the available card width", (selector) => {
    const rule = ruleFor(selector);
    expect(rule).not.toBe("");
    expect(rule).not.toMatch(/max-width\s*:/);
  });

  it("reserves the question card footer for the arrow instead of narrowing copy", () => {
    expect(ruleFor(".dc-question-card")).toMatch(/padding\s*:\s*20px 20px 52px/);
  });
});
