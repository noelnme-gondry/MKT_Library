import { readReviewEvidence, reviewScopeRows } from "@/lib/reviewEvidence";

export default function DecisionEvidence({ record, locale = "ko" }) {
  const en = locale === "en";
  const evidence = readReviewEvidence(record.evidence);
  if (!evidence) return <p className="wr-note">{en ? "The original analysis evidence was not saved with this record. Reopen the source tool to verify its basis." : "이 기록에는 저장 당시의 분석 근거가 보관되어 있지 않습니다. 원본 도구에서 기준을 다시 확인하세요."}</p>;
  return <details className="decision-evidence">
    <summary>{en ? "Evidence at decision time" : "결정 당시 분석 근거"}{evidence.capturedAt && ` · ${evidence.capturedAt.slice(0, 10)}`}</summary>
    <p>{evidence.headline}</p>
    <dl className="analysis-report-preview__metrics">{evidence.stats.map((stat, index) => <div key={index}><dt>{stat.label}</dt><dd><strong>{stat.value}</strong>{stat.detail && <p>{stat.detail}</p>}</dd></div>)}</dl>
    <dl>{reviewScopeRows(evidence.scope, locale).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <ul>{evidence.points.map((point, index) => <li key={index}>{[point.label, point.text, point.detail].filter(Boolean).join(" · ")}</li>)}</ul>
    <p className="wr-note">{en ? "This is the saved analysis basis, not a new calculation or proof that the action caused the outcome." : "저장 시점의 분석 근거입니다. 새로 계산한 결과나 해당 행동의 인과효과를 뜻하지 않습니다."}</p>
  </details>;
}
