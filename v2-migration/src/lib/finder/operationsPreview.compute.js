import { buildOperationsHomePreview } from "@/lib/operations/operationsHomePreview";
import { fmtCurrency, fmtNum, fmtPct } from "@/utils/format";

// 빌드 준비·테스트에서만 호출한다. 브라우저의 분석 찾기는 계산된 JSON을 읽는다.
export function computeOperationsFinderPreviews() {
  return Object.fromEntries(["ko", "en"].map(locale => {
    const en = locale === "en";
    const sample = buildOperationsHomePreview(locale);
    const money = value => fmtCurrency(value, { currency: "KRW", precise: true });
    return [locale, {
      toolId: "5-31", kind: "budget",
      title: en ? `Campaign budgets · ${sample.planDays} days` : `캠페인별 ${sample.planDays}일 예산`,
      headline: en
        ? `With the same budget, modeled installs change from ${fmtNum(sample.plan.baselineResults * sample.planDays)} to ${fmtNum(sample.plan.expectedResults * sample.planDays)} (+${fmtPct(sample.plan.improvementPct / 100)}).`
        : `같은 예산에서 모형 예상 설치가 ${fmtNum(sample.plan.baselineResults * sample.planDays)}건에서 ${fmtNum(sample.plan.expectedResults * sample.planDays)}건으로 늘어납니다(+${fmtPct(sample.plan.improvementPct / 100)}).`,
      caption: en ? `Model estimate from ${sample.historyDays} days of fictional data, not guaranteed future performance.` : `${sample.historyDays}일의 가상 이력으로 계산한 모형 예상이며, 미래 성과를 보장하지 않습니다.`,
      rows: sample.plan.items.map(item => ({
        label: sample.campaigns.find(campaign => campaign.id === item.id).name,
        from: item.current * sample.planDays,
        value: item.budget * sample.planDays,
        beforeDisplay: money(item.current * sample.planDays),
        display: money(item.budget * sample.planDays),
      })),
    }];
  }));
}
