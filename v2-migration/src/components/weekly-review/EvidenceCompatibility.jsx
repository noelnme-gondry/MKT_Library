export default function EvidenceCompatibility({ match, locale = "ko" }) {
  const en = locale === "en";
  return <div className="wr-notice"><p>{en ? "Check decision → analysis conditions. Matching labels do not validate the experiment." : "결정 → 분석 조건을 확인하세요. 표기가 같아도 실험 타당성을 보장하지 않습니다."}</p><dl>{match.rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.expected || (en ? "Not recorded" : "미기록")} → {row.actual || (en ? "Not recorded" : "미기록")} · {row.state === "match" ? (en ? "Same label" : "표기 일치") : row.state === "different" ? (en ? "Different — check" : "다름 · 확인 필요") : (en ? "Unverified" : "미확인")}</dd></div>)}</dl></div>;
}
