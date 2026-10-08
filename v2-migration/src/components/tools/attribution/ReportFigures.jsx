"use client";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { FigureHead } from "@/components/ds/FigurePngButton";
import { multitouchFlow } from "@/utils/multitouchMath";
import { fmtNum, fmtCompact } from "@/utils/format";
export function TouchFlowFigure({ paths, locale, context = null }) {
  const tr = (ko, en) => locale === "en" ? en : ko, ref = useRef(null);
  const svgRef = useRef(null), [width, setWidth] = useState(1000);
  useEffect(() => {
    if (typeof ResizeObserver === "undefined" || !svgRef.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width || 1000));
    observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, []);
  // Keep labels readable at the user's actual content width. Flow thickness
  // still uses one common scale; only label space changes with the viewport.
  const labelScale = Math.max(1, 1000 / Math.max(320, width));
  const graph = useMemo(() => {
    const flow = multitouchFlow(paths), total = paths.reduce((n, p) => n + p.installs, 0);
    const categoryVolume = new Map();
    flow.nodes.filter(node => !node.isMissing).forEach(node => categoryVolume.set(node.label, (categoryVolume.get(node.label) || 0) + node.volume));
    const palette = ["var(--chart-primary)", "var(--chart-secondary)", "var(--chart-tertiary)", "var(--chart-accent)", "var(--chart-marker-violet)", "var(--chart-marker-cyan)", "var(--chart-marker-neutral)", "color-mix(in srgb, var(--chart-primary) 50%, var(--chart-secondary))"];
    const categories = [...categoryVolume.keys()].sort((a, b) => categoryVolume.get(b) - categoryVolume.get(a) || a.localeCompare(b));
    const colors = new Map(categories.map((name, n) => [name, palette[n] || `hsl(${(n * 137.5) % 360} 55% 48%)`]));
    const lanes = [0, 1, 2, 3].map(lane => flow.nodes.filter(n => n.lane === lane));
    const maxNodes = Math.max(...lanes.map(lane => lane.length));
    const gap = 40 * labelScale;
    const height = Math.max(440, maxNodes * gap + 320);
    // Reserve label rows independently of flow thickness. Tiny nodes retain
    // their true proportional height rather than inflating their volume.
    const scale = (height - 80 - maxNodes * gap) / Math.max(1, total);
    const nodes = new Map();
    lanes.forEach((lane, index) => {
      let y = 50;
      lane.forEach(node => {
        const thickness = node.volume * scale;
        nodes.set(node.id, { ...node, x: 15 + index * 270, y: y + 28 * labelScale, labelY: y + 16 * labelScale, height: thickness, sourceOffset: 0, targetOffset: 0 });
        y += thickness + gap;
      });
    });
    const links = flow.links.map(link => {
      const a = nodes.get(link.source), b = nodes.get(link.target), width = link.value * scale;
      const sy = a.y + a.sourceOffset + width / 2, ty = b.y + b.targetOffset + width / 2;
      a.sourceOffset += width; b.targetOffset += width;
      const origin = a.isMissing ? a.history[0] : a.label;
      return { ...link, width, color: colors.get(origin) || "var(--chart-primary)", path: `M ${a.x + 18} ${sy} C ${a.x + 160} ${sy}, ${b.x - 140} ${ty}, ${b.x} ${ty}` };
    });
    return { nodes: [...nodes.values()].map(node => ({ ...node, color: colors.get(node.label) })), links, height };
  }, [paths, labelScale]);
  const titles = [tr("첫 기여 접촉", "First contributor"), tr("둘째", "Second"), tr("셋째", "Third"), tr("설치 귀속 매체", "Install source")];
  return <div>
    <FigureHead exportTitle={tr("기여 접촉 시각순 → 설치 귀속 매체", "Contributors by time → install source")} context={context} target={ref} fileName="multitouch_flow" locale={locale} />
    <div className="report-figure-scroll" tabIndex={0} role="region" aria-label={tr("접촉 경로 그림", "Touch flow figure")} ref={ref}>
      <svg ref={svgRef} className="report-flow" viewBox={`0 0 1000 ${graph.height}`} role="img" aria-label={tr("유효 시각의 클릭 contributor 경로", "Recorded click-contributor paths with valid timestamps")}>
        {titles.map((title, n) => <text key={title} x={15 + n * 270} y={22 * labelScale} className="report-svg-label" style={{ fontSize: 12 * labelScale }}>{title}</text>)}
        {graph.links.map((link, n) => <path key={n} d={link.path} stroke={link.color} strokeOpacity="0.22" strokeWidth={link.width} fill="none"><title>{fmtNum(link.value)}{tr("설치", " installs")}</title></path>)}
        {graph.nodes.map(node => <g key={node.id}>
          <rect x={node.x} y={node.y} width="18" height={node.height} fill={node.isMissing ? "var(--bg-3)" : node.color} fillOpacity={node.isMissing ? 1 : 0.8} />
          <text x={node.x} y={node.labelY} className="report-svg-node" style={{ fontSize: 14 * labelScale }}>{node.isMissing ? tr("없음", "None") : node.label.length > Math.floor(16 / labelScale) ? `${node.label.slice(0, Math.floor(16 / labelScale))}…` : node.label}</text>
          <text x={node.x + 165} y={node.labelY} textAnchor="end" className="report-svg-count" style={{ fontSize: 12 * labelScale }}>{fmtNum(node.volume)}</text>
          {node.isMissing && <text x={node.x + 24} y={node.y + 12 * labelScale} className="report-svg-history" style={{ fontSize: 10 * labelScale }}>{tr("이후: ", "After: ")}{node.history.filter(name => name !== "None").at(-1)?.slice(0, 10)}</text>}
          <title>{node.isMissing ? `${node.history.join(" → ")} → ${tr("없음", "None")}` : node.label} · {fmtNum(node.volume)}</title>
        </g>)}
      </svg>
    </div>
  </div>;
}
export function MovementFigure({ points, title, locale, context = null }) {
  const ref = useRef(null), tr = (ko, en) => locale === "en" ? en : ko;
  const bound = Math.max(1, ...points.flatMap(p => [Math.abs(p.paidDelta), Math.abs(p.organicDelta)]));
  const x = n => 70 + n / Math.max(1, points.length - 1) * 650, y = v => 175 - v / bound * 120;
  const series = ["paidDelta", "organicDelta"].map(key => ({ key, path: points.map((p, n) => `${n ? "L" : "M"} ${x(n)} ${y(p[key])}`).join(" ") }));
  return <div>
    <FigureHead exportTitle={title} context={context} target={ref} fileName="cannibal_weekly_moves" locale={locale} />
    <div className="report-figure-scroll" ref={ref} tabIndex={0} role="region" aria-label={title}>
      <svg className="report-line" viewBox="0 0 800 350" role="img" aria-label={title}>
        {[-1, 0, 1].map(tick => <g key={tick}><line x1="70" x2="720" y1={y(bound * tick)} y2={y(bound * tick)} stroke={tick ? "var(--border)" : "var(--text-muted)"} strokeDasharray={tick ? "3 3" : undefined} /><text x="62" y={y(bound * tick) + 5} textAnchor="end" className="report-svg-label">{locale === "en" ? fmtNum(bound * tick) : fmtCompact(bound * tick)}</text></g>)}
        {series.map(({ key, path }) => <path key={key} d={path} stroke={key === "paidDelta" ? "var(--chart-primary)" : "var(--chart-secondary)"} strokeWidth="3" strokeDasharray={key === "organicDelta" ? "7 4" : undefined} fill="none" />)}
        {points.filter((_, n) => n % Math.max(1, Math.ceil(points.length / 8)) === 0 || n === points.length - 1).map(point => <text key={point.week} x={x(points.indexOf(point))} y="314" textAnchor="middle" className="report-svg-label">W{point.week}</text>)}
        <text x="70" y="22" className="report-svg-label">{tr("변화량 (건) · 실선 Paid / 점선 Organic", "Change (count) · solid Paid / dashed Organic")}</text>
        <text x="395" y="344" textAnchor="middle" className="report-svg-label">{tr("ISO 주차", "ISO week")}</text>
      </svg>
    </div>
  </div>;
}
export function CampaignMovementFigure({ campaigns, points, locale, context = null }) {
  const ref = useRef(null), prefix = useId().replaceAll(":", ""), tr = (ko, en) => locale === "en" ? en : ko;
  const shown = campaigns.filter(c => c.move != null).slice(0, 5);
  const values = points.map(p => ({ week: p.week, organic: p.organicDelta, moves: shown.map(c => c.points.find(row => row.week === p.week)?.delta ?? null) }));
  const bound = Math.max(1, ...values.flatMap(p => [Math.abs(p.organic), p.moves.reduce((a, v) => a + Math.max(0, v || 0), 0), Math.abs(p.moves.reduce((a, v) => a + Math.min(0, v || 0), 0))]));
  const x = n => 80 + (n + 0.5) / Math.max(1, points.length) * 630, y = v => 175 - v / bound * 120;
  const width = Math.min(28, 430 / Math.max(1, points.length));
  const colors = ["var(--chart-primary)", "var(--chart-secondary)", "var(--chart-tertiary)", "var(--text-muted)", "var(--chart-primary)"];
  return <div>
    <FigureHead exportTitle={tr("캠페인 변화 상위 5개와 Organic", "Top five campaign moves and Organic")} context={context} target={ref} fileName="cannibal_campaign_moves" locale={locale} />
    <div ref={ref}>
      <div className="report-campaign-legend">{shown.map((c, n) => <span key={c.name}><i style={{ background: colors[n] }} />C{n + 1} · {c.channel} · {c.campaign}</span>)}<span>{tr("점선 = Organic 변화", "Dashed line = Organic move")}</span></div>
      <div className="report-figure-scroll" tabIndex={0} role="region" aria-label={tr("캠페인 주별 변화", "Weekly campaign moves")}>
        <svg className="report-line" viewBox="0 0 800 350" role="img" aria-label={tr("선택 구간의 캠페인 변화량과 Organic", "Campaign moves and Organic within the selected stretch")}>
          <defs><pattern id={prefix} width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 0 L6 6" stroke="var(--text-primary)" strokeWidth="1" /></pattern></defs>
          {[-1, 0, 1].map(tick => <g key={tick}><line x1="70" x2="720" y1={y(bound * tick)} y2={y(bound * tick)} stroke={tick ? "var(--border)" : "var(--text-muted)"} /><text x="62" y={y(bound * tick) + 5} textAnchor="end" className="report-svg-label">{locale === "en" ? fmtNum(bound * tick) : fmtCompact(bound * tick)}</text></g>)}
          {values.map((p, weekIndex) => {
            let positive = 0, negative = 0;
            return p.moves.map((value, n) => {
              if (value == null) return null;
              const from = value >= 0 ? positive : negative, to = from + value;
              if (value >= 0) positive = to; else negative = to;
              return <g key={n}><rect x={x(weekIndex) - width / 2} y={Math.min(y(from), y(to))} width={width} height={Math.abs(y(to) - y(from))} fill={colors[n]} /><rect x={x(weekIndex) - width / 2} y={Math.min(y(from), y(to))} width={width} height={Math.abs(y(to) - y(from))} fill={n === 4 ? `url(#${prefix})` : "none"} /><title>W{p.week} · C{n + 1} · {fmtNum(value)}</title></g>;
            });
          })}
          <path d={values.map((p, n) => `${n ? "L" : "M"} ${x(n)} ${y(p.organic)}`).join(" ")} stroke="var(--text-primary)" strokeWidth="3" strokeDasharray="7 4" fill="none" />
          {values.filter((_, n) => n % Math.max(1, Math.ceil(values.length / 8)) === 0 || n === values.length - 1).map(p => <text key={p.week} x={x(values.indexOf(p))} y="314" textAnchor="middle" className="report-svg-label">W{p.week}</text>)}
          <text x="70" y="22" className="report-svg-label">{tr("변화량 (건) · 표와 같은 기준", "Change (count) · same baseline as the table")}</text>
          <text x="395" y="344" textAnchor="middle" className="report-svg-label">{tr("ISO 주차", "ISO week")}</text>
        </svg>
      </div>
    </div>
  </div>;
}
