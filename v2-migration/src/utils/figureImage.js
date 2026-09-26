// HTML로 그린 핵심 그림(`assistant/ResultCharts.jsx`)을 PNG로 내려받는다. 캔버스 차트는
// `downloadChartAsPNG`가 맡고, 여기서는 DOM 그림을 SVG foreignObject에 담아 캔버스로 옮긴다
// (외부 라이브러리 없이 브라우저 기본 기능만 쓴다 — html-to-image와 같은 원리).
// 계산된 스타일을 인라인으로 옮기므로 테마(라이트·다크) 색이 그대로 나오고, ::before/::after
// 장식(가운데 기준선 등)은 실제 span으로 바꿔 넣는다.
import { CHART_FONT_STACK, CHART_THEME, getCssVar } from "@/utils/chartUtils";

const XHTML = "http://www.w3.org/1999/xhtml";
const SVG = "http://www.w3.org/2000/svg";

// 글자만 담은 요소는 크기를 고정하지 않는다. 이미지 안에서는 웹 글꼴 대신 대체 글꼴로 그려져
// 글자 폭이 달라지는데, 페이지에서 잰 폭을 px로 박아 두면 이름이 두 줄로 접혀 옆 줄과 겹치고
// 오른쪽 값이 여백 밖으로 밀린다(2026-09-25 실측). 빈 요소(막대 등)는 크기가 곧 값이라 그대로 둔다.
const TEXT_BOX_PROPS = new Set(["width", "height", "inline-size", "block-size", "min-width", "min-height", "max-width", "max-height"]);

function copyStyle(computed, target, { textOnly = false } = {}) {
  let css = "";
  for (let i = 0; i < computed.length; i += 1) {
    const name = computed[i];
    if (textOnly && TEXT_BOX_PROPS.has(name)) continue;
    css += `${name}:${computed.getPropertyValue(name)};`;
  }
  if (textOnly) css += "white-space:nowrap;";
  target.setAttribute("style", css);
}

function isTextOnly(node) {
  return node.children.length === 0 && node.textContent.trim().length > 0;
}

function pseudoElement(view, source, which, doc) {
  const computed = view.getComputedStyle(source, which);
  const content = computed?.getPropertyValue("content");
  if (!content || content === "none" || content === "normal") return null;
  const span = doc.createElementNS(XHTML, "span");
  copyStyle(computed, span);
  const text = content.replace(/^["']|["']$/g, "");
  if (text) span.textContent = text;
  return span;
}

/** 원본과 사본을 나란히 걸으며 계산된 스타일을 사본에 인라인으로 적는다. */
export function inlineComputedStyles(source, clone, view = source.ownerDocument.defaultView) {
  if (source.nodeType !== 1) return;
  copyStyle(view.getComputedStyle(source), clone, { textOnly: isTextOnly(source) });
  const doc = clone.ownerDocument;
  const before = pseudoElement(view, source, "::before", doc);
  const after = pseudoElement(view, source, "::after", doc);
  const sourceChildren = [...source.childNodes];
  const cloneChildren = [...clone.childNodes];
  sourceChildren.forEach((child, index) => inlineComputedStyles(child, cloneChildren[index], view));
  if (before) clone.insertBefore(before, clone.firstChild);
  if (after) clone.appendChild(after);
}

/** 그림 요소를 SVG 문자열로 만든다(테스트 가능한 순수 단계). */
export function buildFigureSvgMarkup(element, { width, height, background, padding = 16 } = {}) {
  const clone = element.cloneNode(true);
  inlineComputedStyles(element, clone);
  // 그림 안에 놓인 조작 버튼(PNG 받기 등)은 이미지에 담지 않는다 — 스타일을 옮긴 뒤에 빼야 원본과 사본의 짝이 맞는다.
  clone.querySelectorAll("[data-figure-skip]").forEach((node) => node.remove());
  clone.style.margin = "0";
  const box = element.ownerDocument.createElementNS(XHTML, "div");
  box.setAttribute("style", `box-sizing:border-box;width:${width}px;height:${height}px;padding:${padding}px;background:${background};`);
  box.appendChild(clone);
  const serialized = new XMLSerializer().serializeToString(box);
  const outerWidth = width;
  const outerHeight = height;
  return `<svg xmlns="${SVG}" width="${outerWidth}" height="${outerHeight}"><foreignObject x="0" y="0" width="100%" height="100%">${serialized}</foreignObject></svg>`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("figure image failed to load"));
    image.src = src;
  });
}

/** 그림 요소를 테마 배경 위에 그려 PNG로 내려받는다. 성공하면 true. */
export async function downloadElementAsPNG(element, fileName, { scale = 2 } = {}) {
  if (typeof document === "undefined" || !element) return false;
  const rect = element.getBoundingClientRect();
  const padding = 16;
  const footerHeight = 24;
  const width = Math.ceil(rect.width) + padding * 2;
  const height = Math.ceil(rect.height) + padding * 2;
  const background = getCssVar("--bg-1") || "#121212";
  const markup = buildFigureSvgMarkup(element, { width, height, background, padding });
  try {
    const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`);
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = (height + footerHeight) * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height + footerHeight);
    ctx.drawImage(image, 0, 0, width, height);
    ctx.fillStyle = CHART_THEME.muted;
    ctx.font = `10px ${CHART_FONT_STACK}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("Growth Opt Playbook · growthoptplaybook.com", width - 10, height + footerHeight / 2);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${fileName}_${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch {
    return false;
  }
}
