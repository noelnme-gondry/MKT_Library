// @vitest-environment jsdom
import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ToolIntro from "@/components/ToolIntro";

const TOOLS = path.join(process.cwd(), "src/components/tools");

const walk = (dir) => readdirSync(dir).flatMap((entry) => {
  const full = path.join(dir, entry);
  if (statSync(full).isDirectory()) return walk(full);
  return full.endsWith(".jsx") && !full.includes(".test.") ? [full] : [];
});

const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

// 이 도구 화면에 상단 인트로(h1)가 함께 렌더되는가 — 렌더해 보고 판정한다.
const rendersIntro = (toolId) => {
  const { container, unmount } = render(<ToolIntro toolId={toolId} />);
  const has = Boolean(container.querySelector("h1"));
  unmount();
  return has;
};

describe("도구 화면의 제목은 하나다", () => {
  it("상단 인트로가 h1을 갖는 도구는 작업대 헤더에서 제목을 다시 그리지 않는다", () => {
    const offenders = [];
    walk(TOOLS).forEach((file) => {
      const source = stripComments(readFileSync(file, "utf-8"));
      if (!source.includes("<ToolPageShell")) return;
      const constId = source.match(/const TOOL_ID\s*=\s*"([^"]+)"/)?.[1] || null;
      [...source.matchAll(/<ToolPageShell[\s\S]{0,700}?>/g)].forEach((match) => {
        const block = match[0];
        const literal = block.match(/toolId=\{?"([^"]+)"/)?.[1];
        const toolId = literal || (block.includes("toolId={TOOL_ID}") ? constId : null);
        if (!toolId || !rendersIntro(toolId)) return;
        // titleLevel 0(제목 없음) 또는 2(h2로 강등)면 h1은 하나로 남는다.
        const level = block.match(/titleLevel=\{(\d)\}/)?.[1];
        if (level !== "0" && level !== "2") offenders.push(`${path.basename(file)}(${toolId})`);
      });
    });
    expect(offenders, "인트로와 작업대 헤더가 각각 h1을 그리면 한 화면에 제목이 둘이 된다").toEqual([]);
  });
});
