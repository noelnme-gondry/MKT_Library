"use client";
import { useId } from "react";
import { fmtNum, fmtPct } from "@/utils/format";
import { localized } from "@/lib/advanced-marketing/registry";

export default function AdvancedFigure({ report, locale }) {
  const id = useId(), spec = report.figure;
  const source = report.tables.find((table) => table.id === spec?.tableId);
  if (!source) return null;
  if (spec.series) {
    const groups = [...new Set(source.rows.map(row => row[spec.series]))];
    return <section aria-label={localized(source.title, locale)}>{groups.slice(0, 12).map(group => <AdvancedFigure key={group} locale={locale}
      report={{ ...report, figure: { ...spec, series: null }, tables: [{ ...source, title: `${localized(source.title, locale)} · ${group}`, rows: source.rows.filter(row => row[spec.series] === group) }] }} />)}
      {groups.length > 12 && <p>{locale === "en" ? "The first 12 series are plotted; the table contains all series." : "처음 12개 계열을 그렸습니다. 전체 계열은 표에서 확인하세요."}</p>}</section>;
  }
  const allRows = source.rows.filter((row) => Number.isFinite(row[spec.value]) && (spec.kind !== "scatter" || Number.isFinite(row[spec.label])));
  const valueColumn = source.columns.find(column => column.key === spec.value);
  const formatValue = value => valueColumn?.type === "rate" ? fmtPct(value, 1) : fmtNum(value, 2);
  const rows = spec.kind === "bar" || spec.kind === "interval" ? allRows.slice(0, 12) : allRows.slice(0, 1000);
  if (!rows.length) return null;
  const numericX = spec.kind === "scatter", horizontal = spec.kind === "bar" || spec.kind === "interval";
  const values = rows.flatMap((row) => [row[spec.value], row[spec.comparison], row[spec.low], row[spec.high]]).filter(Number.isFinite);
  const min = Math.min(0, ...values), max = Math.max(0, ...values), range = max - min || 1;
  const dateX = !horizontal && !numericX && rows.every(row => /^\d{4}-\d{2}-\d{2}$/.test(row[spec.label]));
  const pointX = (row, index) => numericX ? row[spec.label] : dateX ? Date.parse(row[spec.label]) : index;
  const xValues = rows.map(pointX);
  const xMin = Math.min(...xValues), xMax = Math.max(...xValues), xRange = xMax - xMin || 1;
  const x = (v) => 125 + (v - xMin) / xRange * 430;
  const y = (v) => 215 - (v - min) / range * 180;
  const hx = (v) => 125 + (v - min) / range * 430;
  const position = (i) => 35 + i * 180 / Math.max(1, rows.length - 1);
  const title = localized(source.title, locale), en = locale === "en";
  return <figure className="advanced-figure">
    <figcaption>{title}</figcaption>
    <svg data-analysis-svg="true" viewBox="0 0 600 250" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-desc`}>{en ? "Values come from the result table below. Lines are 95% intervals where available; missing intervals are not drawn." : "아래 결과 표의 값을 그렸습니다. 구간이 있는 경우 선은 95% 구간이며 없는 구간은 그리지 않습니다."}</desc>
      {horizontal ? <>
        <line x1={hx(0)} x2={hx(0)} y1="20" y2="225" className="advanced-figure__axis" />
        {rows.map((row, i) => <g key={i}>
          <text x="115" y={position(i) + 4} textAnchor="end">{String(localized(row[spec.label], locale)).slice(0, 18)}</text>
          {spec.kind === "bar" ? <rect x={Math.min(hx(0), hx(row[spec.value]))} y={position(i) - 5} width={Math.abs(hx(row[spec.value]) - hx(0))} height="10" className="advanced-figure__value" />
            : <>
              {Number.isFinite(row[spec.low]) && Number.isFinite(row[spec.high]) && <line x1={hx(row[spec.low])} x2={hx(row[spec.high])} y1={position(i)} y2={position(i)} className="advanced-figure__interval" />}
              <circle cx={hx(row[spec.value])} cy={position(i)} r="4" className="advanced-figure__value" />
            </>}
        </g>)}
        <text x="125" y="244">{formatValue(min)}</text><text x="555" y="244" textAnchor="end">{formatValue(max)}</text>
      </> : <>
        <line x1="125" x2="555" y1={y(0)} y2={y(0)} className="advanced-figure__axis" />
        {numericX ? rows.filter((row) => Number.isFinite(row[spec.label])).map((row, i) => <circle key={i} cx={x(row[spec.label])} cy={y(row[spec.value])} r="2.5" className="advanced-figure__value" />)
          : <>
            <polyline points={rows.map((row, i) => `${x(pointX(row, i))},${y(row[spec.value])}`).join(" ")} className="advanced-figure__line" />
            {spec.comparison && <polyline points={rows.filter((row) => Number.isFinite(row[spec.comparison])).map((row) => `${x(pointX(row, rows.indexOf(row)))},${y(row[spec.comparison])}`).join(" ")} className="advanced-figure__comparison" />}
          </>}
        <text x="115" y="39" textAnchor="end">{formatValue(max)}</text><text x="115" y="219" textAnchor="end">{formatValue(min)}</text>
        <text x="125" y="244">{numericX ? fmtNum(xMin, 2) : String(localized(rows[0][spec.label], locale))}</text><text x="555" y="244" textAnchor="end">{numericX ? fmtNum(xMax, 2) : String(localized(rows.at(-1)[spec.label], locale))}</text>
      </>}
    </svg>
    <p className="text-muted">{localized(source.columns.find((c) => c.key === spec.value)?.label, locale)}
      {spec.comparison ? ` / ${localized(source.columns.find((c) => c.key === spec.comparison)?.label, locale)}` : ""}
      {allRows.length > rows.length ? ` · ${en ? "Displayed" : "표시"} ${fmtNum(rows.length)} / ${fmtNum(allRows.length)}` : ""}</p>
  </figure>;
}
