import { fmtCurrency } from "@/utils/format";

export default function PvmEfficiencyStages({ value, metric, currency, locale = "ko", domain = "performance" }) {
  if (!value?.ok) return null;
  const en = locale === "en";
  const tr = (ko, english) => en ? english : ko;
  const names = { impressions: tr("노출", "Impressions"), clicks: tr("클릭", "Clicks"), installs: domain === "content" ? tr("방문", "Visits") : tr("설치", "Installs"), actions: domain === "content" ? tr("구독", "Subscriptions") : tr("가입", "Sign-ups") };
  const rateNames = { clicks: tr("클릭률", "Click-through rate"), installs: domain === "content" ? tr("방문율", "Visit rate") : tr("설치율", "Install rate"), actions: domain === "content" ? tr("구독률", "Subscription rate") : tr("가입률", "Sign-up rate") };
  const label = stage => stage.key === "cpm" ? tr("노출 단가 (CPM)", "Cost per 1,000 impressions") : `${names[stage.fromField]} → ${names[stage.toField]}`;
  const money = amount => fmtCurrency(amount, { currency: currency?.toUpperCase(), precise: true });
  const signedMoney = amount => `${amount > 0 ? "+" : amount < 0 ? "−" : ""}${money(Math.abs(amount))}`;
  const pct = amount => `${amount > 0 ? "+" : ""}${amount.toFixed(1)}%`;
  const level = (stage, amount) => stage.key === "cpm" ? money(amount) : `${(amount * 100).toFixed(2)}%`;
  const largest = [...value.stages].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))[0];
  const max = Math.max(...value.stages.map(stage => Math.abs(stage.contribution)), 1e-12);
  const material = Math.abs(largest.contribution) > 1e-8 * Math.max(1, value.start, value.finish);
  return <section className="pvm-efficiency-bridge pvm-stage-analysis" aria-label={tr("단계별 단가 변화", "Unit-cost change by stage")}>
    <header className="pvm-stage-analysis__head">
      <h3>{tr("어느 단계에서 단가가 달라졌나", "Where did unit cost change?")}</h3>
      <span>{metric} {money(value.start)} → {money(value.finish)}</span>
    </header>
    <p className="pvm-stage-analysis__summary">{material
      ? tr(`${label(largest)} 변화가 ${metric} ${largest.contribution > 0 ? "상승" : "하락"}에 가장 크게 기여했습니다.`, `${label(largest)} made the largest contribution, ${largest.contribution > 0 ? "increasing" : "decreasing"} ${metric}.`)
      : tr("각 단계의 단가 기여는 사실상 변화가 없습니다.", "The stages show no material unit-cost contribution.")}</p>
    <div className="pvm-stage-analysis__columns" aria-hidden="true"><span>{tr("단계 · 직전 → 최근", "Stage · previous → recent")}</span><span>{tr("지표 변화", "Metric change")}</span><span>{tr(`${metric} 변화 기여`, `Contribution to ${metric}`)}</span></div>
    <ol className="pvm-stage-analysis__rows">
      {value.stages.map(stage => <li key={stage.key}>
        <div><strong>{label(stage)}</strong><span>{level(stage, stage.before)} → {level(stage, stage.after)}</span><small>{stage.key === "cpm" ? tr("광고비 ÷ 노출 × 1,000", "Spend ÷ impressions × 1,000") : `${rateNames[stage.toField]} · ${names[stage.toField]} ÷ ${names[stage.fromField]}`}</small></div>
        <div><span className="pvm-stage-analysis__mobile-label">{tr("지표 변화", "Metric change")}</span><b>{pct(stage.changePct)}</b></div>
        <div className="pvm-stage-analysis__impact" data-tone={stage.contribution > 0 ? "bad" : stage.contribution < 0 ? "good" : "neutral"}>
          <span className="pvm-stage-analysis__mobile-label">{tr(`${metric} 변화 기여`, `Contribution to ${metric}`)}</span>
          <strong>{signedMoney(stage.contribution)}</strong><span className="pvm-stage-analysis__track" aria-hidden="true"><i style={{ width: `${Math.abs(stage.contribution) / max * 100}%` }} /></span>
        </div>
      </li>)}
    </ol>
    <div className="pvm-stage-analysis__total"><span>{tr("단계별 기여 합계", "Sum of stage contributions")}</span><strong>{signedMoney(value.delta)}</strong></div>
    {value.omitted.length > 0 && <p className="pvm-stage-analysis__missing">{tr(`${value.omitted.map(key => names[key]).join("·")} 데이터가 없거나 불완전해 해당 구간은 합쳐 표시했습니다. 세부 단계의 기여는 구분할 수 없습니다.`, `${value.omitted.map(key => names[key]).join(", ")} data is missing or incomplete, so those steps are combined. Their individual contributions cannot be separated.`)}</p>}
    <p className="pvm-stage-analysis__note">{tr("각 비율은 같은 기간의 집계 건수 기준이며, 동일 사용자의 이동을 추적한 전환율은 아닙니다. 기여 금액은 단계 변경 순서를 모두 바꿔 계산한 평균으로, 원인을 증명하지 않습니다.", "Rates use counts from the same period, not a tracked user cohort. Monetary contributions average all orders of changing the stages; they do not prove causation.")}</p>
  </section>;
}
