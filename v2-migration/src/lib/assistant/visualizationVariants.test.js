import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { RESULT_CHART_VARIANTS } from "@/components/assistant/ResultCharts";

// 결과 작업대의 막대는 분석마다 모양이 달라야 한다. PVM·포화도·예산·VIF·소재 피로도가
// 전부 같은 가로 막대로 그려져 "무슨 분석인지"가 그림에서 사라졌었다(2026-09-25).
// 어댑터 소스에서 파생해, 막대 그림은 반드시 존재하는 variant를 선언하게 한다.
const dir = path.resolve(__dirname);
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
// 도구 화면과 공유하는 그림 사양(coreFigures.js)도 같은 규칙을 받는다.
const adapterFiles = readdirSync(dir).filter((file) => /AnalysisAdapters\.js$|^coreFigures\.js$/.test(file));

function barSpecs(source) {
  const specs = [];
  const pattern = /kind:\s*"bar"/g;
  let match;
  while ((match = pattern.exec(source))) {
    // 같은 시각화 객체 안(다음 visualizations 항목·manifest 전)까지만 본다.
    const rest = source.slice(match.index, match.index + 1200);
    const end = rest.search(/\n\s*\}\s*,?\s*\{\s*\n|\n\s*\}\s*\]\s*,|manifest:/);
    specs.push(end > 0 ? rest.slice(0, end) : rest);
  }
  return specs;
}

describe("결과 막대 그림은 분석별 variant를 선언한다", () => {
  const known = new Set([...Object.keys(RESULT_CHART_VARIANTS), "period-comparison"]);
  const specs = adapterFiles.flatMap((file) => barSpecs(stripComments(readFileSync(path.join(dir, file), "utf8"))).map((spec) => ({ file, spec })));

  it("스캐너가 막대 그림을 실제로 찾는다", () => {
    expect(adapterFiles.length).toBeGreaterThanOrEqual(6);
    expect(adapterFiles).toContain("coreFigures.js");
    expect(specs.length).toBeGreaterThanOrEqual(6);
  });

  it("모든 막대 그림이 존재하는 variant를 쓴다", () => {
    for (const { file, spec } of specs) {
      const variant = spec.match(/variant:\s*"([^"]+)"/)?.[1];
      expect(variant, `${file}: ${spec.slice(0, 120)}`).toBeTruthy();
      expect(known.has(variant), `${file}: ${variant}`).toBe(true);
    }
  });
});
