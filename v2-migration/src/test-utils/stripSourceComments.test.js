import { describe, expect, it } from "vitest";

import { stripSourceComments } from "./stripSourceComments";

describe("stripSourceComments", () => {
  it("removes block and full-line comments without deleting URL strings", () => {
    const source = `/* <Mounted /> */\n// <Mounted />\nconst url = "https://example.com/a";\n<Mounted />;`;
    const stripped = stripSourceComments(source);
    expect(stripped.match(/<Mounted \/>/g)).toHaveLength(1);
    expect(stripped).toContain("https://example.com/a");
  });
});
