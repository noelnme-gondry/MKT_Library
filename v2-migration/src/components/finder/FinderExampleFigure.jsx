import { fmtNum } from "@/utils/format";

export default function FinderExampleFigure({ preview, locale = "ko" }) {
  if (!preview) return null;
  const en = locale === "en";
  const { rows } = preview;
  const minimum = Math.min(0, ...rows.map(row => row.low ?? row.value));
  const maximum = preview.isRate ? 1 : Math.max(0, ...rows.flatMap(row => [row.high ?? row.value, row.from ?? row.value]));
  const span = maximum - minimum || 1;
  const position = value => (value - minimum) / span * 100;
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const highlighted = rows.find(row => row.highlight);

  return <figure className={`finder-preview finder-preview--${preview.kind}`} aria-label={preview.title}>
    <figcaption><strong>{preview.title}</strong><span>{en ? "Fictional data" : "가상 데이터"}</span></figcaption>
    {preview.kind === "budget" ? <>
      <p className="finder-preview__budget-key"><span>{en ? "Current" : "현재 배분"}</span><span>{en ? "Proposed" : "조정안"}</span></p>
      <ul className="finder-preview__rows">{rows.map(row => <li key={row.label}>
        <div className="finder-preview__row-label"><span>{row.label}</span></div>
        <div className="finder-preview__budget-values"><span>{row.beforeDisplay}</span><span aria-hidden="true">→</span><strong>{row.display}</strong></div>
        <div className="finder-preview__budget-bars" aria-hidden="true"><i style={{ width: `${row.from / maximum * 100}%` }} /><i style={{ width: `${row.value / maximum * 100}%` }} /></div>
      </li>)}</ul>
    </> : preview.kind === "parts" ? <>
      <div className="finder-preview__parts-labels">{rows.map(row => <div key={row.label}><strong>{row.display}</strong><span>{row.label}</span></div>)}</div>
      <div className="finder-preview__parts" aria-hidden="true">{rows.map((row, index) => <i key={row.label} data-primary={index === 0 ? "true" : undefined} style={{ width: `${row.value / total * 100}%` }} />)}</div>
    </> : preview.kind === "counts" ? <>
      <div className="finder-preview__count-layout">
        <div className="finder-preview__count-grid" aria-hidden="true">{Array.from({ length: total }, (_, index) => <i key={index} data-primary={index < (highlighted?.value || 0) ? "true" : undefined} />)}</div>
        <div className="finder-preview__count-total"><strong>{fmtNum(highlighted?.value || 0)} / {fmtNum(total)}</strong><span>{highlighted?.label}</span><small>{en ? "One square = one creative" : "1칸 = 소재 1개"}</small></div>
      </div>
      <ul className="finder-preview__count-legend">{rows.map(row => <li key={row.label}>{row.label} <b>{row.display}</b></li>)}</ul>
    </> : preview.kind === "intervals" ? <>
      <p className="finder-preview__interval-label">{en ? "Estimate and 95% interval" : "점추정과 95% 구간"}</p>
      <ul className="finder-preview__rows">{rows.map(row => <li key={row.label}>
        <div className="finder-preview__row-label"><span>{row.label}</span><strong>{row.display}</strong></div>
        <div className="finder-preview__interval-track" aria-hidden="true"><i className="finder-preview__zero" style={{ left: `${position(0)}%` }} /><i className="finder-preview__interval" style={{ left: `${position(row.low)}%`, width: `${(row.high - row.low) / span * 100}%` }} /><i className="finder-preview__point" style={{ left: `${position(row.value)}%` }} /></div>
        <div className="finder-preview__interval-values"><span>{row.lowDisplay}</span><span>{row.highDisplay}</span></div>
      </li>)}</ul>
      <p className="finder-preview__interval-label">{en ? "Vertical reference: 0" : "세로 기준선: 0"}</p>
    </> : preview.kind === "range" ? <>
      <div className="finder-preview__range-values">{rows.map(row => <div key={row.label}><span>{row.label}</span><strong>{row.display}</strong></div>)}</div>
      <div className="finder-preview__interval-track" aria-hidden="true"><i className="finder-preview__interval" style={{ left: `${position(rows[0].value)}%`, width: `${(rows[1].value - rows[0].value) / span * 100}%` }} /></div>
      <p className="finder-preview__interval-label">{en ? "Arithmetic bounds, not a confidence interval. Exact deduplicated reach is unavailable." : "산술 경계이며 신뢰구간이 아닙니다. 식별자 기준 중복 제거 도달은 계산 불가입니다."}</p>
    </> : preview.kind === "metric" ? <div className="finder-preview__metric"><strong>{rows[0].display}</strong></div> : <>
      <ul className="finder-preview__rows">{rows.map(row => <li key={row.label}>
        <div className="finder-preview__row-label"><span>{row.label}</span><strong>{row.display}{row.suffix ? ` (${row.suffix})` : ""}</strong></div>
        <div className="finder-preview__bar-track" aria-hidden="true">
          {minimum < 0 && <i className="finder-preview__zero" style={{ left: `${position(0)}%` }} />}
          <i className="finder-preview__bar" data-primary={row.highlight ? "true" : undefined} style={{ left: `${position(Math.min(0, row.value))}%`, width: `${Math.abs(row.value) / span * 100}%` }} />
        </div>
      </li>)}</ul>
      {preview.note === "log-scale" && <p className="finder-preview__interval-label">{en ? "Bar length uses log10(VIF); labels show VIF." : "막대 길이는 log10(VIF), 숫자는 원래 VIF입니다."}</p>}
    </>}
  </figure>;
}
