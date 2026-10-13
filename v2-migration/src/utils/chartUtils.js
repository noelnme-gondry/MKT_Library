import { figureHeaderLayout, drawFigureHeader } from "./figureExportContext";
/* text/textPrimary/muted/grid/border는 index.html CHART_THEME(약 9219행) 그대로 getter 이식 —
   document.body.classList.contains("light-mode") 여부로 라이트/다크 값 분기(§7 다크모드 함정). */
export const CHART_THEME = {
  get text() {
    return getCssVar("--text-secondary") || "#9CA3AF";
  },
  get textPrimary() {
    return getCssVar("--text-primary") || "#F9FAFB";
  },
  get muted() {
    return getCssVar("--text-muted") || "#8992a3";
  },
  get grid() {
    const grid = getCssVar("--chart-grid");
    return grid !== "#999" ? grid : getCssVar("--border-subtle");
  },
  get border() {
    return getCssVar("--border") || "rgba(255,255,255,0.14)";
  },
  get primary() { return getCssVar("--chart-primary") || "#8fb1ff"; },
  get comparison() { const color = getCssVar("--chart-comparison"); return color !== "#999" ? color : this.muted; },
  get surface() { return getCssVar("--bg-1"); },
  get primaryContainer() { return getCssVar("--primary"); },
  get secondary() { return getCssVar("--chart-secondary") || "#77dcaa"; },
  get tertiary() { return getCssVar("--chart-tertiary") || "#ffc56e"; },
  get quaternary() { return getCssVar("--secondary") || "#8fb1ff"; },
  get accent() { return getCssVar("--chart-accent") || "#ff8d7e"; },
  get markerViolet() { return getCssVar("--chart-marker-violet") || "#c084fc"; },
  get markerCyan() { return getCssVar("--chart-marker-cyan") || "#22d3ee"; },
  get markerNeutral() { return getCssVar("--chart-marker-neutral") || "#e2e8f0"; },
  bg: "transparent",
  // 승인된 분류 팔레트는 상태색과 분리한다. 값은 공용 CSS가 소유하며
  // 이름·마커·직접 라벨도 함께 유지한다(색만으로 대상을 구분하지 않는다).
  get colors() {
    return Array.from({ length: 6 }, (_, index) => {
      const color = getCssVar(`--chart-category-${index + 1}`);
      return color !== "#999" ? color : this.primary;
    });
  },
  get series() { return this.colors; },
  // 판정 색(나쁨/주의/좋음). 도구들이 데이터셋에 `#f87171` 같은 리터럴을 직접 적어
  // 왔는데, 그 값은 refreshMountedChartThemes의 remap 대상이 아니라 테마를 바꿔도
  // 그대로 남았다. getter는 렌더 시점에 CSS 변수를 읽으므로 초기 렌더부터 테마를 탄다.
  // 반환값이 리터럴 hex라 `CHART_THEME.danger + "AA"` 같은 알파 접합도 그대로 쓸 수 있다
  // (§7의 hex-알파 함정은 `var()`를 넘길 때의 얘기다).
  get danger() { return getCssVar("--danger") || "#ff8178"; },
  get warning() { return getCssVar("--warning") || "#f2b84b"; },
  get success() { return getCssVar("--success") || "#65d3b3"; },
};

/* 폰트 스택 SSOT — 축 틱·범례·툴팁이 제각각 문자열을 쓰면 차트마다 글꼴이 갈린다. */
export const CHART_FONT_STACK = '"Wanted Sans Subset", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
export const CHART_MONO_STACK = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

export function reducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function chartCommonOpts() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: reducedMotion() ? 0 : 460, easing: "easeOutQuart" },
    layout: { padding: { top: 16, right: 16, bottom: 8, left: 4 } },
    plugins: {
      legend: {
        display: true,
        position: "top",
        align: "start",
        labels: {
          color: CHART_THEME.text,
          font: { family: CHART_FONT_STACK, size: 12 },
          usePointStyle: true,
          pointStyle: "circle",
          boxWidth: 8,
          boxHeight: 8,
          padding: 14,
        },
      },
      tooltip: {
        // 실제 렌더는 `utils/chartGlobals.js`의 외부 HTML 툴팁이 담당한다(전역 default).
        // 아래 값은 external 핸들러를 끄고 캔버스 툴팁으로 되돌린 차트를 위한 폴백이며,
        // 배경이 항상 어둡기 때문에 글자색도 테마와 무관하게 밝게 고정한다.
        backgroundColor: "rgba(0,0,0,0.85)",
        titleColor: "#F9FAFB",
        bodyColor: "#F9FAFB",
        bodyFont: { family: CHART_FONT_STACK, size: 12 },
        padding: 10,
        cornerRadius: 8,
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        usePointStyle: true,
      },
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        border: { color: CHART_THEME.grid },
        ticks: {
          color: CHART_THEME.muted,
          font: { family: CHART_FONT_STACK, size: 12 },
          // 라벨이 많아지면 Chart.js 기본값은 45도로 눕혀 읽기 어려워진다. 눕히지 않고
          // 자동으로 솎아낸다(날짜 축에서 특히 차이가 큼).
          maxRotation: 0,
          autoSkip: true,
          autoSkipPadding: 12,
          padding: 6,
        },
      },
      y: {
        // 실선 그리드는 데이터선과 경쟁한다. 점선 + 얇은 톤으로 뒤로 물린다.
        grid: { color: CHART_THEME.grid, drawBorder: false, drawTicks: false, lineWidth: 1, tickBorderDash: [3, 3], borderDash: [3, 3] },
        border: { display: false, dash: [3, 3] },
        ticks: { color: CHART_THEME.muted, font: { family: CHART_FONT_STACK, size: 12 }, padding: 10, maxTicksLimit: 6 },
        beginAtZero: true,
      },
    },
    // hover를 interaction과 같은 모드로 묶어야 기준선(crosshair)·툴팁·포인트 강조가
    // 같은 지점에서 동시에 반응한다.
    // `axis`는 지정하지 않는다 — Chart.js가 `indexAxis`에서 추론하므로, 여기에 "x"를
    // 박으면 가로 막대(`indexAxis:"y"`, 포레스트 플롯 등)의 히트 판정이 깨진다.
    interaction: { mode: "index", intersect: false },
    hover: { mode: "index", intersect: false },
  };
}

/* 현재 테마의 CSS 변수 값 읽기 (다크/라이트 자동). index.html getCssVar 이식. */
export function getCssVar(name) {
  if (typeof window === "undefined" || typeof document === "undefined") return "#999";
  const target = document.body || document.documentElement;
  return getComputedStyle(target).getPropertyValue(name).trim() || "#999";
}

// Existing Chart.js instances keep resolved color strings. Re-apply semantic
// chart tokens when the page theme changes without forcing every tool to
// destroy/recompute its data model.
const mountedThemeSnapshots = new WeakMap();
function themeRoles() {
  return Object.fromEntries([
    ...["primary", "secondary", "tertiary", "comparison", "danger", "warning", "success"].map(role => [role, CHART_THEME[role]]),
    ...CHART_THEME.colors.map((color, index) => [`category-${index}`, color]),
  ]);
}

export function refreshChartThemeColors(chart) {
  if (!chart) return;
  // 키는 "마운트된 차트에 남아 있을 수 있는 값" 전부 — 각 토큰의 다크·라이트 값과,
  // 도구들이 예전에 직접 적었던 리터럴까지. 하나라도 빠지면 그 데이터셋만 테마를
  // 안 따라가고 옛 색으로 굳는다.
  const replacements = new Map([
    ["#8fb1ff", CHART_THEME.primary], ["#3146d8", CHART_THEME.primary],
    ["#77dcaa", CHART_THEME.secondary], ["#087a4f", CHART_THEME.secondary],
    ["#ffc56e", CHART_THEME.tertiary], ["#9b5c00", CHART_THEME.tertiary],
    ["#ff8d7e", CHART_THEME.accent], ["#bc3f35", CHART_THEME.accent],
    ["#ff8178", CHART_THEME.danger], ["#cf3d3d", CHART_THEME.danger], ["#f87171", CHART_THEME.danger],
    ["#f2b84b", CHART_THEME.warning], ["#a76400", CHART_THEME.warning], ["#fbbf24", CHART_THEME.warning],
    ["#65d3b3", CHART_THEME.success], ["#11866e", CHART_THEME.success], ["#34d399", CHART_THEME.success],
  ]);
  // Both palette variants come from the CSS SSOT. Preserve alpha suffixes on
  // uncertainty bands and keep mounted charts synchronized after theme changes.
  for (let index = 1; index <= CHART_THEME.colors.length; index += 1) {
    for (const theme of ["light", "dark"]) {
      replacements.set(getCssVar(`--chart-category-${index}-${theme}`).toLowerCase(), CHART_THEME.colors[index - 1]);
    }
  }
  for (const theme of ["light", "dark"]) replacements.set(getCssVar(`--chart-comparison-${theme}`).toLowerCase(), CHART_THEME.comparison);
  const remap = (value, colors) => {
    if (Array.isArray(value)) return value.map(item => remap(item, colors));
    if (typeof value !== "string") return value;
    const lower = value.toLowerCase();
    if (/^#[0-9a-f]{8}$/.test(lower)) return (colors.get(lower.slice(0, 7)) || lower.slice(0, 7)) + lower.slice(7);
    return colors.get(lower) || value;
  };
  const colors = new Map(replacements);
  const previous = mountedThemeSnapshots.get(chart), current = themeRoles();
  for (const [role, color] of Object.entries(previous || {})) colors.set(color.toLowerCase(), current[role]);
  const options = chart.options || {};
  Object.entries(options.scales || {}).forEach(([id, scale]) => {
    if (scale.ticks) scale.ticks.color = CHART_THEME.muted;
    const grid = chart.config?.options?.scales?.[id]?.grid || scale.grid;
    if (scale.grid && typeof grid?.color !== "function") scale.grid.color = CHART_THEME.grid;
    if (scale.title) scale.title.color = CHART_THEME.muted;
  });
  if (options.plugins?.legend?.labels) options.plugins.legend.labels.color = CHART_THEME.muted;
  (chart.data?.datasets || []).forEach((dataset) => {
    dataset.borderColor = remap(dataset.borderColor, colors);
    dataset.backgroundColor = remap(dataset.backgroundColor, colors);
    dataset.pointBackgroundColor = remap(dataset.pointBackgroundColor, colors);
    dataset.pointBorderColor = remap(dataset.pointBorderColor, colors);
  });
  mountedThemeSnapshots.set(chart, current);
}

export function refreshMountedChartThemes(ChartCtor) {
  if (!ChartCtor?.instances) return;
  Object.values(ChartCtor.instances).forEach((chart) => {
    refreshChartThemeColors(chart);
    chart.update("none");
  });
}

/* Chart.js 캔버스를 PNG로 다운로드. Chart.js는 기본 transparent → 테마 배경 합성 후 export.
   index.html downloadChartAsPNG 이식(§7 dark 배경 명시 합성). */
export function downloadChartAsPNG(canvas, fileName, { context = null } = {}) {
  if (typeof document === "undefined" || !canvas) return false;
  // 캔버스 픽셀이 CSS 픽셀의 몇 배인지(배율) — 출처 줄도 같은 배율로 키워야 고해상도 저장에서 글자가 작아지지 않는다.
  const scale = Math.max(1, canvas.width / (canvas.clientWidth || canvas.width));
  const footerHeight = Math.round(24 * scale);
  const tmp = document.createElement("canvas");
  tmp.width = canvas.width;
  const ctx = tmp.getContext("2d");
  const header = figureHeaderLayout(ctx, context, canvas.width / scale, CHART_FONT_STACK);
  const headerHeight = Math.round(header.height * scale);
  tmp.height = canvas.height + footerHeight + headerHeight;
  const bg = getCssVar("--bg-1") || "#121212";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, tmp.width, tmp.height);
  if (header.height) {
    ctx.save();
    ctx.scale(scale, scale);
    drawFigureHeader(ctx, header, CHART_THEME.text);
    ctx.restore();
  }
  ctx.drawImage(canvas, 0, headerHeight);
  ctx.fillStyle = CHART_THEME.muted;
  ctx.font = `${Math.round(10 * scale)}px ${CHART_FONT_STACK}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText("Growth Opt Playbook · growthoptplaybook.com", tmp.width - Math.round(10 * scale), canvas.height + headerHeight + footerHeight / 2);

  const url = tmp.toDataURL("image/png");
  const a = document.createElement("a");
  const ts = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${fileName}_${ts}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}
