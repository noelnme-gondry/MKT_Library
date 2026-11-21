// Both periods use the same zero baseline. A missing observation has no bar.
export default function PeriodBars({ title, rows, max, threshold, note }) {
  return <figure className="period-bars">
    <figcaption>{title}</figcaption>
    {rows.map(({ label, value, display, detail }, index) => <div className="period-bars__row" key={label}>
      <span>{label}</span>
      <span className="period-bars__track" aria-hidden="true">
        {Number.isFinite(value) && max > 0 && <i style={{ width: `${(value / max) * 100}%` }} />}
        {index === 1 && Number.isFinite(threshold) && max > 0 && <b style={{ left: `${(threshold / max) * 100}%` }} />}
      </span>
      <strong>{display}</strong>
      {detail && <small>{detail}</small>}
    </div>)}
    {note && <small>{note}</small>}
  </figure>;
}
