/* Chart.js 전역 셋업 — 모든 차트가 같은 인터랙션·룩을 상속하는 단일 지점.
 *
 * 왜 전역인가: 도구별 차트가 50곳이 넘고 대부분 `chartCommonOpts()`의 `scales`·
 * `plugins`를 자기 옵션으로 덮어쓴다. 공용 옵션 함수만 고치면 덮어쓴 차트는 그대로
 * 남아 룩이 갈린다. 그래서 **옵션이 아니라 defaults + 플러그인**으로 붙인다.
 *
 * 사용법: `import Chart from "chart.js/auto"` 대신 `import Chart from "@/utils/chartGlobals"`.
 * chart.js/auto 자체가 싱글턴이라 이 모듈을 거치면 셋업이 보장된다.
 *
 * 주의(§7):
 *  - 색은 절대 하드코딩하지 않는다. 그리기 시점에 `CHART_THEME`/`getCssVar`로 해석해야
 *    다크·라이트 토글에서 깨지지 않는다.
 *  - 툴팁 DOM은 `document.body`에 붙인다. sticky 글래스 바(`backdrop-filter`) 안에서는
 *    `position:fixed`가 뷰포트 기준이 아니게 되기 때문.
 *  - 라벨 문자열에는 사용자 CSV 값(캠페인명 등)이 들어온다. **innerHTML 금지**,
 *    textContent로만 주입한다.
 */

import Chart from "chart.js/auto";

import { CHART_FONT_STACK, CHART_THEME, getCssVar, reducedMotion } from "@/utils/chartUtils";

const TOOLTIP_ID = "gop-chart-tooltip";

/* ── 1. 기준선(crosshair) 플러그인 ──────────────────────────────────────────
   index 모드 툴팁과 짝을 이루는 세로(가로) 기준선. 어느 지점을 읽고 있는지가
   눈으로 고정돼 시계열 판독이 쉬워진다. */
const NON_CARTESIAN = new Set(["pie", "doughnut", "polarArea", "radar"]);

export const crosshairPlugin = {
  id: "gopCrosshair",
  afterDatasetsDraw(chart) {
    if (chart.options?.plugins?.gopCrosshair?.enabled === false) return;
    if (NON_CARTESIAN.has(chart.config?.type)) return;

    const active = typeof chart.tooltip?.getActiveElements === "function" ? chart.tooltip.getActiveElements() : [];
    if (!active.length) return;

    const { ctx, chartArea } = chart;
    if (!ctx || !chartArea) return;

    const point = active[0].element;
    const horizontal = chart.options?.indexAxis === "y";
    const pos = horizontal ? point?.y : point?.x;
    if (typeof pos !== "number" || Number.isNaN(pos)) return;

    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = getCssVar("--border") || CHART_THEME.border;
    if (horizontal) {
      ctx.moveTo(chartArea.left, pos);
      ctx.lineTo(chartArea.right, pos);
    } else {
      ctx.moveTo(pos, chartArea.top);
      ctx.lineTo(pos, chartArea.bottom);
    }
    ctx.stroke();
    ctx.restore();
  },
  afterDestroy() {
    hideTooltipEl();
  },
};

/* ── 2. 외부 HTML 툴팁 ─────────────────────────────────────────────────────
   캔버스 기본 툴팁은 한글 폰트·색 토큰·계층 표현이 제한된다. DOM으로 그리면
   제품 전체 카드 스타일과 같은 언어를 쓰게 된다. */
function ensureTooltipEl() {
  if (typeof document === "undefined") return null;
  let el = document.getElementById(TOOLTIP_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = TOOLTIP_ID;
    el.className = "gop-chart-tooltip";
    el.setAttribute("role", "presentation");
    document.body.appendChild(el);
  }
  return el;
}

function hideTooltipEl() {
  if (typeof document === "undefined") return;
  const el = document.getElementById(TOOLTIP_ID);
  if (el) el.style.opacity = "0";
}

function renderTooltipRows(el, tooltip) {
  el.replaceChildren();

  const titleLines = tooltip.title || [];
  if (titleLines.length) {
    const head = document.createElement("div");
    head.className = "gop-chart-tooltip__title";
    head.textContent = titleLines.join(" ");
    el.appendChild(head);
  }

  const bodyLines = (tooltip.body || []).flatMap((item) => item.lines || []);
  if (bodyLines.length) {
    const list = document.createElement("ul");
    list.className = "gop-chart-tooltip__list";
    bodyLines.forEach((line, index) => {
      const row = document.createElement("li");
      const colors = (tooltip.labelColors || [])[index];
      const swatch = document.createElement("i");
      swatch.className = "gop-chart-tooltip__swatch";
      // 배경이 없는 라인 차트는 borderColor가 실제 시리즈 색이다.
      const tone = colors?.backgroundColor || colors?.borderColor;
      if (typeof tone === "string") swatch.style.background = tone;
      else swatch.style.visibility = "hidden";
      const text = document.createElement("span");
      text.textContent = line;
      row.append(swatch, text);
      list.appendChild(row);
    });
    el.appendChild(list);
  }

  const footerLines = tooltip.footer || [];
  if (footerLines.length) {
    const foot = document.createElement("div");
    foot.className = "gop-chart-tooltip__footer";
    foot.textContent = footerLines.join(" ");
    el.appendChild(foot);
  }
}

export function externalTooltipHandler(context) {
  const { chart, tooltip } = context;
  const el = ensureTooltipEl();
  if (!el) return;

  if (!tooltip || tooltip.opacity === 0) {
    el.style.opacity = "0";
    return;
  }

  renderTooltipRows(el, tooltip);

  // 위치 계산은 렌더 후에(크기를 알아야 화면 밖으로 나가는 것을 막을 수 있음).
  el.style.opacity = "1";
  const rect = chart.canvas.getBoundingClientRect();
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  const gap = 12;

  let left = rect.left + tooltip.caretX + gap;
  if (left + width > window.innerWidth - 8) left = rect.left + tooltip.caretX - width - gap;
  left = Math.max(8, left);

  let top = rect.top + tooltip.caretY - height / 2;
  top = Math.min(Math.max(8, top), window.innerHeight - height - 8);

  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

/* ── 3. defaults ──────────────────────────────────────────────────────────
   덮어쓰기 위험이 낮은 항목만 손댄다. 특히 `pointRadius`는 도구마다 의미가 달라
   (이상치 마커·산점도) 전역 변경 금지 — 대신 hover/hit 반경만 키운다. */
/* 생성자 단위로 1회만 적용(중복 register 방지). 전역 플래그 하나로 잠그면 다른
   Chart 인스턴스/테스트 더블에 적용할 길이 막힌다. */
const configured = new WeakSet();

export function applyChartGlobals(ChartCtor = Chart) {
  if (!ChartCtor?.defaults || configured.has(ChartCtor)) return ChartCtor;
  configured.add(ChartCtor);

  const d = ChartCtor.defaults;
  d.font.family = CHART_FONT_STACK;
  d.font.size = 11;

  // 애니메이션: 등장은 부드럽게, 모션 축소 설정이면 즉시.
  d.animation.easing = "easeOutQuart";
  d.animation.duration = reducedMotion() ? 0 : 460;

  // 포인터가 정확히 점 위에 없어도 잡히게 — 순수 인터랙션 개선(시각 변화 없음).
  d.elements.point.hitRadius = 12;
  d.elements.point.hoverRadius = 5;
  d.elements.point.hoverBorderWidth = 2;
  d.elements.line.borderCapStyle = "round";
  d.elements.line.borderJoinStyle = "round";
  d.elements.bar.borderRadius = 3;

  d.plugins.tooltip.enabled = false;
  d.plugins.tooltip.external = externalTooltipHandler;
  d.plugins.tooltip.position = "nearest";

  ChartCtor.register(crosshairPlugin);
  return ChartCtor;
}

applyChartGlobals(Chart);

export default Chart;
