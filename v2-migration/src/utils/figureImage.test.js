// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildFigureSvgMarkup } from "./figureImage";

describe("HTML 핵심 그림 → SVG", () => {
  it("계산된 스타일을 인라인으로 옮기고 XHTML 네임스페이스로 foreignObject에 담는다", () => {
    const figure = document.createElement("figure");
    figure.innerHTML = "<ol><li><span>직전 CPA</span><b>₩6,663</b></li></ol>";
    figure.querySelector("b").style.color = "rgb(10, 20, 30)";
    document.body.appendChild(figure);
    const markup = buildFigureSvgMarkup(figure, { width: 320, height: 120, background: "#101010" });
    expect(markup.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120">')).toBe(true);
    expect(markup).toContain("<foreignObject");
    expect(markup).toContain('xmlns="http://www.w3.org/1999/xhtml"');
    expect(markup).toContain("background:#101010");
    // 원본 스타일시트가 없는 SVG 이미지 안에서도 색이 남도록 인라인으로 옮겨져 있어야 한다.
    expect(markup).toMatch(/<b style="[^"]*color:\s*rgb\(10, 20, 30\)/);
    expect(markup).toContain("₩6,663");
    // 원본 DOM은 건드리지 않는다.
    expect(figure.querySelector("b").getAttribute("style")).toBe("color: rgb(10, 20, 30);");
  });
});
