import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// 화면에 그리는 차트(<canvas>)마다 같은 PNG 받기(ds/FigurePngButton)가 붙어 있어야 한다.
// 도구마다 받기 버튼 모양이 갈려 있었고(칩 "⬇ PNG"·결과 받기 메뉴·버튼 없음), 차트 50개 중
// 받을 수 있는 것이 7개뿐이었다. 목록을 손으로 쓰지 않고 소스에서 캔버스를 세어 파생한다.
const ROOT = join(process.cwd(), "src/components");

// 예외는 사유와 함께 여기서만 — 결과 그림이 아닌 캔버스.
export const FIGURE_PNG_EXEMPT = Object.freeze({
  "blog/BlogInsightChart.jsx": "블로그 본문 삽화 — 분석 결과가 아니라 글의 예시 그림이다(받을 결과물이 아님)",
  "ds/ModelDiagnosticsPanel.jsx": "모형 진단용 작은 보조 그림(잔차 등) — 접힌 진단 영역 안에서 적합 상태를 확인하는 용도다",
});

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.jsx$/.test(name) && !/\.test\.jsx$/.test(name) ? [path] : [];
  });
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1").replace(/\{\s*\}/g, "");
}

const files = walk(ROOT).map((path) => {
  const source = stripComments(readFileSync(path, "utf8"));
  return {
    file: relative(ROOT, path),
    canvases: (source.match(/<canvas\b/g) || []).length,
    buttons: (source.match(/<(FigurePngButton|FigureHead)\b/g) || []).length,
  };
}).filter((entry) => entry.canvases > 0);

describe("차트 PNG 받기 커버리지", () => {
  it("캔버스를 실제로 센다(스캐너가 깨지면 0건으로 조용히 통과하지 않게)", () => {
    expect(files.length).toBeGreaterThan(20);
    expect(files.reduce((sum, entry) => sum + entry.canvases, 0)).toBeGreaterThan(40);
  });

  it("캔버스를 그리는 파일은 캔버스 수만큼 PNG 받기를 둔다", () => {
    const missing = files
      .filter((entry) => !FIGURE_PNG_EXEMPT[entry.file])
      .filter((entry) => entry.buttons < entry.canvases)
      .map((entry) => `${entry.file}: canvas ${entry.canvases} / PNG ${entry.buttons}`);
    expect(missing).toEqual([]);
  });

  it("예외는 지금도 캔버스가 있는 파일이다(낡은 예외는 예외가 아니다)", () => {
    for (const file of Object.keys(FIGURE_PNG_EXEMPT)) {
      expect(files.find((entry) => entry.file === file)?.canvases, file).toBeGreaterThan(0);
    }
  });

  it("옛 받기 버튼(칩 '⬇ PNG'·차트 직접 호출)은 남기지 않는다", () => {
    const legacy = walk(ROOT)
      .filter((path) => !/ds\/FigurePngButton\.jsx$/.test(path))
      .filter((path) => /downloadChartAsPNG\(/.test(stripComments(readFileSync(path, "utf8"))))
      .map((path) => relative(ROOT, path));
    expect(legacy).toEqual([]);
  });
});
