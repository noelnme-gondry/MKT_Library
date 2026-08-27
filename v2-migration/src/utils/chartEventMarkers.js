import { CHART_THEME } from "@/utils/chartUtils";

/* ============================================================
 * chartEventMarkers — 차트 위 세로 이벤트 선 + 라벨.
 *
 * chartjs-plugin-annotation을 쓰지 않는다. 새 의존성을 추가하는 대신(§11)
 * 인라인 플러그인 하나로 끝난다 — 필요한 건 세로선·꼭지 라벨뿐이다.
 *
 * options.plugins.eventMarkers.events = [{ index, label, type }]
 * index는 x축 라벨 배열의 위치다(alignEventsToAxis가 붙여 준다).
 * ============================================================ */

const EVENT_MARKER_STYLE = Object.freeze({
  listing: { colorRole: "primary", colorToken: "--chart-primary", dash: [] },
  creative: { colorRole: "markerViolet", colorToken: "--chart-marker-violet", dash: [4, 3] },
  price: { colorRole: "tertiary", colorToken: "--chart-tertiary", dash: [2, 2] },
  campaign: { colorRole: "markerCyan", colorToken: "--chart-marker-cyan", dash: [8, 3] },
  release: { colorRole: "secondary", colorToken: "--chart-secondary", dash: [10, 3, 2, 3] },
  external: { colorRole: "danger", colorToken: "--danger", dash: [1, 3] },
  other: { colorRole: "markerNeutral", colorToken: "--chart-marker-neutral", dash: [6, 4] },
});

// 색만으로 종류를 가르지 않는다. 비슷한 테마 색이나 색각 차이가 있어도 dash 패턴으로 구분한다.
export function eventMarkerStyle(type) {
  const style = EVENT_MARKER_STYLE[type] || EVENT_MARKER_STYLE.other;
  return { ...style, color: CHART_THEME[style.colorRole] };
}

export function eventMarkerColor(type) {
  return eventMarkerStyle(type).color;
}

export const eventMarkersPlugin = {
  id: "eventMarkers",
  afterDatasetsDraw(chart, _args, opts) {
    const events = opts?.events;
    if (!Array.isArray(events) || events.length === 0) return;
    const xScale = chart.scales?.x;
    const area = chart.chartArea;
    if (!xScale || !area) return;

    const ctx = chart.ctx;
    ctx.save();
    ctx.font = "600 10px system-ui, -apple-system, sans-serif";
    ctx.textBaseline = "top";

    // 라벨이 서로 겹치지 않도록 이미 쓴 x구간을 기억하며 층을 내린다.
    const occupied = [];
    for (const event of events) {
      const x = xScale.getPixelForValue(event.index);
      if (!Number.isFinite(x) || x < area.left - 1 || x > area.right + 1) continue;
      const style = eventMarkerStyle(event.type);
      const color = style.color;

      ctx.beginPath();
      ctx.setLineDash(style.dash);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = color;
      ctx.moveTo(x, area.top);
      ctx.lineTo(x, area.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      const text = event.label;
      const width = ctx.measureText(text).width + 10;
      // 오른쪽으로 넘치면 선 왼쪽에 붙인다.
      let left = x + 4;
      if (left + width > area.right) left = x - width - 4;
      let row = 0;
      while (occupied.some((box) => box.row === row && left < box.right && left + width > box.left)) row += 1;
      occupied.push({ row, left, right: left + width });
      const top = area.top + 2 + row * 15;

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.14;
      ctx.fillRect(left, top, width, 13);
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.fillText(text, left + 5, top + 2);
    }
    ctx.restore();
  },
};
