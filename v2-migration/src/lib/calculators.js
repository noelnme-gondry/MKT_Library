import { STATS } from "@/utils/abTestMath";
import { LTVCAC_MATH } from "@/utils/ltvMath";
import { METRIC_BY_ID } from "@/utils/metrics/metricRegistry";

export const CALCULATOR_ORDER = [
  "ltv-cac",
  "break-even-roas",
  "target-cpa",
  "ab-test-sample-size",
  "expected-installs",
];

const COMMON = {
  "ltv-cac": {
    toolId: "5-2",
    toolHref: "/dashboard",
    inputs: [
      { id: "ltv", type: "currency", defaultValue: 150000 },
      { id: "cac", type: "currency", defaultValue: 50000 },
      { id: "monthlyArpu", type: "currency", defaultValue: 15000 },
      { id: "grossMarginPct", type: "percent", defaultValue: 70 },
    ],
  },
  "break-even-roas": {
    toolId: "5-3",
    toolHref: "/tools/budget-allocation",
    inputs: [
      { id: "grossMarginPct", type: "percent", defaultValue: 60 },
      { id: "variableFeePct", type: "percent", defaultValue: 5 },
    ],
  },
  "target-cpa": {
    toolId: "5-3",
    toolHref: "/tools/budget-allocation",
    inputs: [
      { id: "aov", type: "currency", defaultValue: 50000 },
      { id: "grossMarginPct", type: "percent", defaultValue: 60 },
      { id: "targetProfitPct", type: "percent", defaultValue: 15 },
    ],
  },
  "ab-test-sample-size": {
    toolId: "5-4",
    toolHref: "/tools/experiment-analysis",
    inputs: [
      { id: "baselinePct", type: "percent", defaultValue: 5 },
      { id: "mdeRelativePct", type: "percent", defaultValue: 10 },
      { id: "alphaPct", type: "percent", defaultValue: 5 },
      { id: "powerPct", type: "percent", defaultValue: 80 },
      { id: "dailyTraffic", type: "count", defaultValue: 1000 },
    ],
  },
  "expected-installs": {
    toolId: "5-3",
    toolHref: "/tools/budget-allocation",
    inputs: [
      { id: "budget", type: "currency", defaultValue: 10000000 },
      { id: "expectedCpi", type: "currency", defaultValue: 5000 },
      { id: "uncertaintyPct", type: "percent", defaultValue: 15 },
    ],
  },
};

const COPY = {
  ko: {
    "ltv-cac": {
      name: "LTV:CAC 계산기",
      eyebrow: "수익성 단위경제",
      title: "LTV:CAC 비율과 페이백 기간 계산기",
      description: "고객생애가치(LTV), 고객획득비용(CAC), 월 ARPU와 매출총이익률을 입력해 LTV:CAC 비율과 광고비 회수 기간을 바로 계산합니다.",
      summary: "한 고객을 데려오는 데 쓴 돈을 고객 가치가 얼마나 덮는지 확인합니다.",
      labels: { ltv: "고객 LTV", cac: "고객 CAC", monthlyArpu: "월 ARPU", grossMarginPct: "매출총이익률" },
      primaryLabel: "LTV:CAC",
      secondaryLabel: "예상 페이백",
      formula: "LTV ÷ CAC · CAC ÷ (월 ARPU × 매출총이익률)",
      caveat: "LTV가 예측값이면 비율도 예측입니다. 코호트가 충분히 성숙했는지 함께 확인하세요.",
      toolCta: "CSV로 채널별 LTV:CAC 분석",
      guide: [
        ["3배 이상", "획득비용 대비 가치가 충분한 편입니다. 성장 여력을 추가 점검하세요."],
        ["1~3배", "흑자 가능성은 있으나 회수 기간과 운영비를 함께 봐야 합니다."],
        ["1배 미만", "현재 가정에서는 고객 가치가 획득비용을 덮지 못합니다."],
      ],
      faq: [
        ["LTV는 매출 기준인가요, 이익 기준인가요?", "가능하면 매출이 아니라 매출총이익 기준 LTV를 쓰세요. 매출 LTV를 쓰면 수익성이 과대평가될 수 있습니다."],
        ["좋은 LTV:CAC 비율은 몇 배인가요?", "3배는 흔히 쓰는 참고선일 뿐 업종·회수 기간·고정비에 따라 달라집니다. 절대 합격선으로 사용하지 마세요."],
      ],
    },
    "break-even-roas": {
      name: "손익분기 ROAS 계산기",
      eyebrow: "광고 손익 기준",
      title: "손익분기 ROAS 계산기",
      description: "매출총이익률과 결제·플랫폼 변동비율을 입력해 광고비를 잃지 않기 위한 최소 ROAS를 계산합니다.",
      summary: "매출이 아니라 남는 이익을 기준으로 광고의 최소 ROAS를 잡습니다.",
      labels: { grossMarginPct: "매출총이익률", variableFeePct: "추가 변동비율" },
      primaryLabel: "최소 ROAS",
      secondaryLabel: "광고 기여이익률",
      formula: "1 ÷ (매출총이익률 − 추가 변동비율)",
      caveat: "인건비·임대료 같은 고정비는 포함하지 않습니다. 실제 목표 ROAS는 손익분기보다 높게 잡아야 합니다.",
      toolCta: "채널별 ROAS로 예산 배분",
      guide: [
        ["현재 ROAS가 기준보다 높음", "변동비를 덮을 가능성이 있습니다. 증분성과와 규모 한계를 추가 확인하세요."],
        ["현재 ROAS가 기준보다 낮음", "매출은 생겨도 광고 기여이익은 음수일 수 있습니다."],
      ],
      faq: [
        ["ROAS 300%는 몇 배인가요?", "3배입니다. 광고비 1원당 매출 3원이 발생했다는 뜻입니다."],
        ["매출총이익률이 왜 필요한가요?", "ROAS는 매출 기준이라 원가를 보지 않습니다. 손익분기점을 찾으려면 매출 중 실제로 남는 비율이 필요합니다."],
      ],
    },
    "target-cpa": {
      name: "목표 CPA 계산기",
      eyebrow: "획득단가 역산",
      title: "목표 CPA 역산 계산기",
      description: "객단가, 매출총이익률과 목표 이익률을 입력해 광고에서 허용할 수 있는 목표 CPA와 손익분기 CPA를 계산합니다.",
      summary: "판매 1건에서 남겨야 할 이익을 먼저 빼고 허용 가능한 획득비용을 정합니다.",
      labels: { aov: "평균 객단가", grossMarginPct: "매출총이익률", targetProfitPct: "목표 이익률" },
      primaryLabel: "목표 CPA 상한",
      secondaryLabel: "손익분기 CPA",
      formula: "객단가 × (매출총이익률 − 목표 이익률)",
      caveat: "반품·쿠폰·결제 수수료가 객단가나 이익률에 반영되지 않았다면 별도로 차감하세요.",
      toolCta: "목표 CPA로 예산 시뮬레이션",
      guide: [
        ["실제 CPA가 목표 이하", "설정한 목표 이익률을 남길 가능성이 있습니다."],
        ["목표와 손익분기 사이", "적자는 아닐 수 있지만 목표 이익률에는 못 미칩니다."],
        ["손익분기 초과", "현재 객단가·마진 가정에서는 판매할수록 광고 기여손실이 날 수 있습니다."],
      ],
      faq: [
        ["목표 이익률은 무엇을 기준으로 하나요?", "매출 대비 남기고 싶은 이익 비율입니다. 매출총이익률보다 낮아야 계산할 수 있습니다."],
        ["구매 전환이 아닌 가입 CPA에도 쓸 수 있나요?", "가입 1건의 기대가치를 객단가 대신 넣을 수 있지만, 그 가치가 검증된 값인지 반드시 구분해야 합니다."],
      ],
    },
    "ab-test-sample-size": {
      name: "A/B 테스트 표본수 계산기",
      eyebrow: "실험 사전 설계",
      title: "A/B 테스트 표본수·기간 계산기",
      description: "기준 전환율, 최소 감지 효과(MDE), 유의수준, 검정력과 일 트래픽으로 그룹별 필요 표본수와 예상 실험 기간을 계산합니다.",
      summary: "결과를 보기 전에 필요한 표본과 기간을 고정해 조기 종료 오류를 줄입니다.",
      labels: { baselinePct: "기준 전환율", mdeRelativePct: "상대 MDE", alphaPct: "유의수준 α", powerPct: "검정력", dailyTraffic: "하루 총 트래픽" },
      primaryLabel: "그룹별 필요 표본",
      secondaryLabel: "예상 실험 기간",
      formula: "두 비율 차이의 정규근사 표본수 · 양측 검정",
      caveat: "트래픽이 요일별로 크게 다르거나 사용자 중복 노출이 있으면 실제 기간을 더 길게 잡으세요.",
      toolCta: "실험 설계와 결과 판독 계속하기",
      guide: [
        ["MDE를 작게 잡을수록", "작은 차이를 찾기 위해 표본수가 급격히 늘어납니다."],
        ["검정력을 높일수록", "놓치는 효과를 줄이는 대신 더 많은 표본이 필요합니다."],
      ],
      faq: [
        ["MDE는 무엇인가요?", "실무적으로 의미 있다고 미리 정한 최소 변화폭입니다. 결과를 본 뒤 바꾸면 검정의 신뢰가 깨집니다."],
        ["표본을 채우기 전에 유의하면 끝내도 되나요?", "반복 확인 후 조기 종료하면 거짓 양성률이 커집니다. 순차검정 설계가 아니라면 사전 표본을 채우세요."],
      ],
    },
    "expected-installs": {
      name: "예산별 예상 설치수 계산기",
      eyebrow: "단일 채널 계획",
      title: "광고 예산별 예상 설치수 계산기",
      description: "광고 예산과 예상 CPI를 입력해 기대 설치수와 CPI 변동을 반영한 계획 범위를 계산합니다.",
      summary: "예산을 CPI로 나눠 기본 설치수와 보수·낙관 범위를 빠르게 잡습니다.",
      labels: { budget: "광고 예산", expectedCpi: "예상 CPI", uncertaintyPct: "CPI 변동폭" },
      primaryLabel: "기대 설치수",
      secondaryLabel: "계획 범위",
      formula: "예산 ÷ CPI · 범위는 CPI ± 변동폭",
      caveat: "예산이 커질수록 CPI가 그대로 유지된다는 보장은 없습니다. 과거 범위를 넘는 증액은 포화도 분석이 필요합니다.",
      toolCta: "채널별 포화도·예산 배분 분석",
      guide: [
        ["과거 집행 범위 안", "최근 CPI 변동폭을 적용한 계획 범위를 참고할 수 있습니다."],
        ["과거보다 큰 증액", "CPI 고정 가정이 낙관적일 수 있으므로 한계 효율을 따로 확인하세요."],
      ],
      faq: [
        ["왜 결과가 정확한 예측이 아닌가요?", "CPI는 입찰 경쟁·소재·계절성·예산 규모에 따라 변합니다. 이 계산기는 입력한 CPI가 유지된다는 조건부 산술입니다."],
        ["CPI 변동폭은 어떻게 정하나요?", "최근 4~8주의 주별 CPI 편차를 참고하세요. 근거가 없다면 기본값을 계획 안전범위로만 사용하세요."],
      ],
    },
  },
  en: {
    "ltv-cac": {
      name: "LTV:CAC calculator",
      eyebrow: "Unit economics",
      title: "LTV:CAC ratio and payback calculator",
      description: "Enter customer lifetime value, acquisition cost, monthly ARPU, and gross margin to calculate LTV:CAC and estimated payback.",
      summary: "Check how much customer value covers the cost of acquiring that customer.",
      labels: { ltv: "Customer LTV", cac: "Customer CAC", monthlyArpu: "Monthly ARPU", grossMarginPct: "Gross margin" },
      primaryLabel: "LTV:CAC",
      secondaryLabel: "Estimated payback",
      formula: "LTV ÷ CAC · CAC ÷ (monthly ARPU × gross margin)",
      caveat: "If LTV is forecast, the ratio is also a forecast. Check cohort maturity before acting on it.",
      toolCta: "Analyze LTV:CAC by channel",
      guide: [["3× or more", "Value comfortably exceeds acquisition cost; check whether it can scale."], ["1–3×", "Potentially viable, but payback and operating costs still matter."], ["Below 1×", "Customer value does not cover acquisition cost under these assumptions."]],
      faq: [["Should LTV use revenue or profit?", "Use gross-profit LTV when possible. Revenue LTV can overstate profitability."], ["Is 3× always a good LTV:CAC ratio?", "No. It is a common reference, not a universal pass line; payback, fixed costs, and industry economics differ."]],
    },
    "break-even-roas": {
      name: "Break-even ROAS calculator",
      eyebrow: "Advertising economics",
      title: "Break-even ROAS calculator",
      description: "Use gross margin and variable fees to calculate the minimum ROAS needed to avoid a negative advertising contribution.",
      summary: "Set the minimum ROAS from the margin left after product and variable costs.",
      labels: { grossMarginPct: "Gross margin", variableFeePct: "Additional variable fees" },
      primaryLabel: "Minimum ROAS",
      secondaryLabel: "Ad contribution margin",
      formula: "1 ÷ (gross margin − variable fees)",
      caveat: "Fixed costs are excluded. Your operating target should normally sit above break-even.",
      toolCta: "Allocate budget with channel ROAS",
      guide: [["ROAS above the threshold", "Variable costs may be covered; verify incrementality and scale limits."], ["ROAS below the threshold", "Revenue can grow while advertising contribution remains negative."]],
      faq: [["What does 300% ROAS mean?", "It means 3× revenue for each unit of advertising cost."], ["Why does gross margin matter?", "ROAS measures revenue, not profit. Break-even needs the share of revenue that remains after direct costs."]],
    },
    "target-cpa": {
      name: "Target CPA calculator",
      eyebrow: "Acquisition ceiling",
      title: "Target CPA calculator",
      description: "Enter average order value, gross margin, and target profit margin to calculate a target CPA ceiling and break-even CPA.",
      summary: "Reserve the profit you need, then set the acquisition cost you can afford.",
      labels: { aov: "Average order value", grossMarginPct: "Gross margin", targetProfitPct: "Target profit margin" },
      primaryLabel: "Target CPA ceiling",
      secondaryLabel: "Break-even CPA",
      formula: "AOV × (gross margin − target profit margin)",
      caveat: "Subtract returns, discounts, and payment fees if they are not already reflected in AOV or margin.",
      toolCta: "Simulate budget with target CPA",
      guide: [["Actual CPA below target", "The target profit may be achievable."], ["Between target and break-even", "It may avoid a loss but miss the profit target."], ["Above break-even", "Each acquired order may create a negative advertising contribution."]],
      faq: [["What is target profit margin based on?", "It is the share of revenue you want to retain as profit and must be below gross margin."], ["Can this be used for a signup CPA?", "You can use validated expected value per signup in place of AOV, but label forecasts as forecasts."]],
    },
    "ab-test-sample-size": {
      name: "A/B test sample size calculator",
      eyebrow: "Experiment planning",
      title: "A/B test sample size and duration calculator",
      description: "Calculate required sample per variant and estimated duration from baseline conversion, MDE, significance, power, and daily traffic.",
      summary: "Fix sample and duration before reading results to reduce early-stopping errors.",
      labels: { baselinePct: "Baseline conversion", mdeRelativePct: "Relative MDE", alphaPct: "Significance α", powerPct: "Power", dailyTraffic: "Total daily traffic" },
      primaryLabel: "Sample per variant",
      secondaryLabel: "Estimated duration",
      formula: "Normal approximation for two proportions · two-sided test",
      caveat: "Allow more time when traffic varies heavily by weekday or users can enter more than one variant.",
      toolCta: "Continue to experiment design",
      guide: [["Smaller MDE", "Detecting a smaller change requires sharply more observations."], ["Higher power", "Reducing missed effects requires more observations."]],
      faq: [["What is MDE?", "The minimum change worth detecting, fixed before the test. Changing it after seeing results breaks the design."], ["Can I stop as soon as significance appears?", "Repeated peeking inflates false positives. Fill the planned sample unless you use a sequential design."]],
    },
    "expected-installs": {
      name: "Budget to installs calculator",
      eyebrow: "Single-channel plan",
      title: "Advertising budget to expected installs calculator",
      description: "Enter advertising budget and expected CPI to calculate expected installs and a planning range for CPI variability.",
      summary: "Divide budget by CPI to set a base install plan and a conservative-to-optimistic range.",
      labels: { budget: "Advertising budget", expectedCpi: "Expected CPI", uncertaintyPct: "CPI variation" },
      primaryLabel: "Expected installs",
      secondaryLabel: "Planning range",
      formula: "Budget ÷ CPI · range uses CPI ± variation",
      caveat: "CPI may rise as spend scales. Use saturation analysis when budget exceeds the historical range.",
      toolCta: "Analyze saturation and allocation",
      guide: [["Within historical spend", "Recent CPI variation can provide a useful planning range."], ["Material scale-up", "A fixed-CPI assumption may be optimistic; inspect marginal efficiency."]],
      faq: [["Why is this not an exact forecast?", "CPI changes with auctions, creative, seasonality, and spend. This is conditional arithmetic using the CPI you enter."], ["How should I set CPI variation?", "Use weekly CPI variation from the latest 4–8 weeks; otherwise treat the default as a planning buffer only."]],
    },
  },
};

export function getCalculator(slug, locale = "ko") {
  const common = COMMON[slug];
  const copy = COPY[locale]?.[slug];
  return common && copy ? { slug, ...common, ...copy } : null;
}

export function getAllCalculators(locale = "ko") {
  return CALCULATOR_ORDER.map((slug) => getCalculator(slug, locale)).filter(Boolean);
}

const finite = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
};

export function calculateMarketingMetric(slug, values = {}) {
  if (slug === "ltv-cac") {
    const ltv = finite(values.ltv);
    const cac = finite(values.cac);
    const monthlyArpu = finite(values.monthlyArpu);
    const margin = finite(values.grossMarginPct) / 100;
    if (!(ltv >= 0) || !(cac > 0) || !(monthlyArpu > 0) || !(margin > 0 && margin <= 1)) return null;
    return {
      primary: LTVCAC_MATH.safeDiv(ltv, cac),
      secondary: LTVCAC_MATH.safeDiv(cac, monthlyArpu * margin),
      primaryFormat: "ratio",
      secondaryFormat: "months",
    };
  }

  if (slug === "break-even-roas") {
    const grossMargin = finite(values.grossMarginPct) / 100;
    const fees = finite(values.variableFeePct) / 100;
    const contributionMargin = grossMargin - fees;
    if (!(contributionMargin > 0 && contributionMargin <= 1)) return null;
    return {
      primary: LTVCAC_MATH.safeDiv(1, contributionMargin),
      secondary: contributionMargin,
      primaryFormat: "roas",
      secondaryFormat: "percent",
    };
  }

  if (slug === "target-cpa") {
    const aov = finite(values.aov);
    const grossMargin = finite(values.grossMarginPct) / 100;
    const targetProfit = finite(values.targetProfitPct) / 100;
    if (!(aov > 0) || !(grossMargin > 0 && grossMargin <= 1) || !(targetProfit >= 0 && targetProfit < grossMargin)) return null;
    return {
      primary: aov * (grossMargin - targetProfit),
      secondary: aov * grossMargin,
      primaryFormat: "currency",
      secondaryFormat: "currency",
    };
  }

  if (slug === "ab-test-sample-size") {
    const baseline = finite(values.baselinePct) / 100;
    const mdeRelative = finite(values.mdeRelativePct) / 100;
    const alpha = finite(values.alphaPct) / 100;
    const power = finite(values.powerPct) / 100;
    const dailyTraffic = finite(values.dailyTraffic);
    if (!(dailyTraffic > 0)) return null;
    const sample = STATS.sampleSizePerArm({ baseline, mdeRelative, alpha, power, twoSided: true });
    if (!Number.isFinite(sample.n)) return null;
    return {
      primary: sample.n,
      secondary: Math.ceil((sample.n * 2) / dailyTraffic),
      primaryFormat: "count",
      secondaryFormat: "days",
    };
  }

  if (slug === "expected-installs") {
    const budget = finite(values.budget);
    const cpi = finite(values.expectedCpi);
    const uncertainty = finite(values.uncertaintyPct) / 100;
    if (!(budget >= 0) || !(cpi > 0) || !(uncertainty >= 0 && uncertainty < 1)) return null;
    const expected = LTVCAC_MATH.safeDiv(budget, cpi);
    const optimistic = LTVCAC_MATH.safeDiv(budget, cpi * (1 - uncertainty));
    const conservative = LTVCAC_MATH.safeDiv(budget, cpi * (1 + uncertainty));
    const registryCheck = METRIC_BY_ID.cpi.compute({ cost: budget, denom: expected });
    if (registryCheck == null) return null;
    return {
      primary: expected,
      secondary: [conservative, optimistic],
      primaryFormat: "count",
      secondaryFormat: "countRange",
    };
  }

  return null;
}
