import { dateOrdinal } from "@/lib/analysisPeriod";
import { fmtCurrency, fmtNum, fmtPct } from "@/utils/format";

// 모형값을 관측 기준값으로 저장하지 않는다. 대상별 자동 비교 계약이 없는
// 캠페인·소재 후보에는 자동 비교를 허용하지 않는다.
export function operationsReviewCandidates({ brief, plan, currency, locale = "ko" }) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  const metric = brief.metric === "actions" ? "CPA" : "CPI";
  const money = value => Number.isFinite(value) ? fmtCurrency(value, { currency, precise: true }) : tr("계산 불가", "Unavailable");
  const sourcePeriod = `${brief.periods.current.start} – ${brief.periods.current.end}`;
  const end = dateOrdinal(brief.periods.current.end);
  const reviewDate = end != null && brief.days > 0 ? new Date((end + brief.days) * 86400000).toISOString().slice(0, 10) : "";
  const common = { metric, goalMetric: metric.toLowerCase(), goalDirection: "down", targetDirection: "lower",
    baselineDate: brief.periods.current.end, comparisonWindowDays: brief.days, sourcePeriod, reviewDate };
  const candidates = [];
  if (plan.ok && brief.current.cpr != null) {
    const shifts = plan.items.filter(row => Math.abs(row.budget - row.current) > 1e-6).map(row => {
      const campaign = brief.campaigns.find(item => item.id === row.id);
      return `${campaign.name} ${money(row.current)} → ${money(row.budget)}`;
    });
    candidates.push({ id: "budget", kind: "budget", label: tr("예산 조정", "Budget adjustment"), target: tr("선택 범위 전체", "Whole selected scope"),
      automatic: true, actionLines: shifts, prefill: { ...common, baseline: money(brief.current.cpr), actionKind: shifts.length ? "replace" : "hold",
        actionTarget: tr("선택 범위 전체의 하루 예산", "Daily budget for the selected scope"),
        actionAmount: tr(`총 ${money(plan.totalBudget)} 유지 · 변경 한도 ±${fmtPct(plan.changeLimit, 0)}`, `Keep ${money(plan.totalBudget)} total · cap ±${fmtPct(plan.changeLimit, 0)}`),
        conclusion: tr(`동일 예산의 모형 예상 성과가 ${fmtNum(plan.baselineResults, 1)} → ${fmtNum(plan.expectedResults, 1)}입니다.`, `Same-budget modeled outcomes are ${fmtNum(plan.baselineResults, 1)} → ${fmtNum(plan.expectedResults, 1)}.`),
        action: shifts.length ? shifts.join("; ") : tr("현재 하루 예산 배분을 유지합니다.", "Keep the current daily allocation."),
        hypothesis: tr("관측·안전 범위 안의 재배분이 실제 전체 단가 개선으로 이어지는지 확인합니다.", "Check whether reallocation within observed safe ranges improves actual portfolio unit cost."),
        reviewQuestion: tr(`같은 범위의 다음 ${brief.days}일 실측 ${metric}가 기준 ${money(brief.current.cpr)}보다 낮아졌나요? 성과량과 총지출도 확인하세요.`, `Is actual ${metric} for the next ${brief.days} days below ${money(brief.current.cpr)} for the same scope? Also check outcomes and total spend.`) } });
  }
  for (const row of brief.campaigns) {
    if (row.current.cpr == null) continue;
    candidates.push({ id: `campaign:${row.id}`, kind: "campaign", label: tr("캠페인 점검", "Campaign review"), target: row.name, automatic: false,
      prefill: { ...common, baseline: money(row.current.cpr), actionKind: "investigate", actionTarget: `${row.name} · ${row.context}`,
        conclusion: tr(`${row.name}의 최근 ${metric}는 ${money(row.current.cpr)}입니다.`, `${row.name} recent ${metric} is ${money(row.current.cpr)}.`),
        action: tr(`${row.name}의 단계별 단가 변화와 소재 구성을 확인하고 변경 내용을 기록합니다.`, `Inspect ${row.name} stage costs and creative mix, and record the chosen changes.`),
        hypothesis: tr("악화된 단계와 소재 변화에 맞춘 조치 뒤 같은 캠페인의 실측 단가를 확인합니다.", "After changes informed by stage and creative observations, review the same campaign's actual unit cost."),
        reviewQuestion: tr(`새 데이터에서 ${row.name}만 선택해 ${metric}와 성과량을 다시 확인했나요?`, `Did you reanalyze ${row.name} in the new data and check its ${metric} and outcomes?`) } });
  }
  for (const row of brief.creatives.filter(item => item.isNew && item.cpr != null)) {
    candidates.push({ id: `creative:${row.id}`, kind: "creative", label: tr("소재 관찰", "Creative follow-up"), target: row.creative, automatic: false,
      prefill: { ...common, baseline: money(row.cpr), actionKind: "investigate", actionTarget: `${row.campaign} · ${row.creative} · ${row.context}`,
        conclusion: tr(`${row.creative}: 첫 관측 ${row.firstDate}, ${row.days}일 · 성과 ${fmtNum(row.results)} · ${metric} ${money(row.cpr)}.`, `${row.creative}: first seen ${row.firstDate}, ${row.days} days · ${fmtNum(row.results)} outcomes · ${metric} ${money(row.cpr)}.`),
        action: tr(`${row.creative}를 같은 캠페인의 기존 소재와 함께 관찰하고 다음 기간 실적을 비교합니다.`, `Observe ${row.creative} alongside established creatives in the same campaign and compare the next period.`),
        hypothesis: tr("낮은 관측 단가가 다음 기간에도 유지되는지 살핍니다. 소재의 인과 효과는 별도 테스트가 필요합니다.", "Check whether the observed unit cost persists. Causal creative effects require a separate test."),
        reviewQuestion: tr(`${row.creative}의 다음 기간 비용·성과·${metric}는 얼마이며 관측일 수는 충분한가요?`, `What are ${row.creative}'s next-period spend, outcomes and ${metric}, and is coverage sufficient?`) } });
  }
  return candidates;
}

export function stageWaterfall(value, label) {
  if (!value?.ok) return [];
  let level = value.start;
  return [{ label: label("previous"), range: [0, level], amount: level, total: true },
    ...value.stages.map(stage => {
      const from = level; level += stage.contribution;
      return { label: label(stage), range: [from, level], amount: stage.contribution, total: false };
    }), { label: label("current"), range: [0, value.finish], amount: value.finish, total: true }];
}
