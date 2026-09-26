// Preserve whole dates while letting each labelled period flow independently.
export default function ComparisonPeriods({ periodA, periodB, locale = "ko" }) {
  const periods = [
    { key: "current", label: locale === "en" ? "Current period" : "분석 기간", range: periodB },
    { key: "prior", label: locale === "en" ? "Prior period" : "비교 기간", range: periodA },
  ];
  return <dl className="result-periods">{periods.filter(item => item.range?.start && item.range?.end).map(({ key, label, range }) =>
    <div key={key}><dt>{label}</dt><dd><time dateTime={range.start}>{range.start}</time><span>–</span><time dateTime={range.end}>{range.end}</time></dd></div>
  )}</dl>;
}
