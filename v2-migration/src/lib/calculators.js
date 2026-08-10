import { STATS } from "@/utils/abTestMath";
import { LTVCAC_MATH } from "@/utils/ltvMath";
import { METRIC_BY_ID } from "@/utils/metrics/metricRegistry";

export const CALCULATOR_ORDER = [
  "ltv-cac",
  "break-even-roas",
  "target-cpa",
  "ab-test-sample-size",
  "expected-installs",
  "cpa-roas-converter",
  "required-cvr",
  "budget-pacing",
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
  "cpa-roas-converter": {
    toolId: "5-3",
    toolHref: "/tools/budget-allocation",
    inputs: [
      { id: "aov", type: "currency", defaultValue: 50000 },
      { id: "cpa", type: "currency", defaultValue: 15000 },
      { id: "targetRoasPct", type: "percent", defaultValue: 300 },
    ],
  },
  "required-cvr": {
    toolId: "5-2",
    toolHref: "/dashboard",
    inputs: [
      { id: "budget", type: "currency", defaultValue: 10000000 },
      { id: "cpm", type: "currency", defaultValue: 5000 },
      { id: "targetConversions", type: "quantity", defaultValue: 500 },
      { id: "ctrPct", type: "percent", defaultValue: 1.5 },
    ],
  },
  "budget-pacing": {
    toolId: "5-2",
    toolHref: "/dashboard",
    inputs: [
      { id: "periodBudget", type: "currency", defaultValue: 30000000 },
      { id: "spentSoFar", type: "currency", defaultValue: 12000000 },
      { id: "elapsedDays", type: "days", defaultValue: 12 },
      { id: "totalDays", type: "days", defaultValue: 30 },
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
    "cpa-roas-converter": {
      name: "CPA·ROAS 환산 계산기",
      eyebrow: "지표 환산",
      title: "CPA ↔ ROAS 환산 계산기",
      description: "객단가와 CPA를 넣으면 현재 ROAS로 환산하고, 목표 ROAS를 달성하려면 CPA를 얼마까지 낮춰야 하는지 역산합니다.",
      summary: "같은 성과를 CPA로 말할지 ROAS로 말할지 헷갈릴 때 두 값을 한 번에 맞춥니다.",
      labels: { aov: "평균 객단가", cpa: "현재 CPA", targetRoasPct: "목표 ROAS" },
      primaryLabel: "현재 ROAS",
      secondaryLabel: "목표 ROAS 달성 CPA",
      formula: "ROAS = 객단가 ÷ CPA · 필요 CPA = 객단가 ÷ 목표 ROAS",
      caveat: "객단가가 기간·채널마다 다르면 환산값도 달라집니다. 구매당 매출이 아니라 평균값을 쓴다는 점을 기억하세요.",
      toolCta: "채널별 CPA·ROAS로 예산 배분",
      guide: [
        ["현재 ROAS가 목표보다 높음", "CPA에 여유가 있습니다. 증액 시 한계 효율을 함께 확인하세요."],
        ["현재 ROAS가 목표보다 낮음", "표시된 CPA까지 낮추거나 객단가를 올려야 목표에 닿습니다."],
      ],
      faq: [
        ["ROAS와 CPA는 왜 서로 환산되나요?", "두 지표 모두 같은 성과를 다른 분모로 본 값입니다. 구매당 매출(객단가)이 정해지면 하나에서 다른 하나가 계산됩니다."],
        ["가입·설치 캠페인에도 쓸 수 있나요?", "가입 1건의 기대 매출을 객단가 자리에 넣으면 됩니다. 다만 그 기대값이 검증된 수치인지 반드시 구분하세요."],
      ],
    },
    "required-cvr": {
      name: "목표 달성 CVR 계산기",
      eyebrow: "캠페인 사전 점검",
      title: "예산·CPM으로 역산하는 목표 전환율(CVR) 계산기",
      description: "예산, CPM, 목표 전환수, 예상 CTR을 넣으면 목표를 채우기 위해 필요한 전환율과 예상 클릭수를 계산합니다.",
      summary: "캠페인을 켜기 전에 목표가 산술적으로 가능한 수치인지 먼저 확인합니다.",
      labels: { budget: "캠페인 예산", cpm: "예상 CPM", targetConversions: "목표 전환수", ctrPct: "예상 CTR" },
      primaryLabel: "필요 CVR",
      secondaryLabel: "예상 클릭수",
      formula: "노출 = 예산 ÷ CPM × 1,000 · 필요 CVR = 목표 전환수 ÷ (노출 × CTR)",
      caveat: "CPM과 CTR이 캠페인 기간 내내 유지된다는 가정의 산술입니다. 실제로는 경쟁·소재·타겟에 따라 변합니다.",
      toolCta: "실제 CVR을 대시보드에서 확인",
      guide: [
        ["필요 CVR이 과거 실적보다 낮음", "현실적인 목표입니다. 소재·랜딩 개선으로 여유를 만들 수 있습니다."],
        ["필요 CVR이 과거 실적보다 높음", "예산·CPM·목표 중 하나를 바꿔야 합니다. 전환율만 올려서 메우기는 어렵습니다."],
        ["필요 CVR이 100%를 넘음", "현재 조건에서는 산술적으로 불가능한 목표입니다."],
      ],
      faq: [
        ["CTR을 모르면 어떻게 하나요?", "같은 매체·소재 유형의 최근 평균을 쓰세요. 근거가 없으면 낙관값 대신 보수적인 값을 넣는 편이 안전합니다."],
        ["필요 CVR이 100%를 넘으면 무슨 뜻인가요?", "클릭보다 목표 전환수가 많다는 뜻이라 달성이 불가능합니다. 예산을 늘리거나 목표를 낮춰야 합니다."],
      ],
    },
    "budget-pacing": {
      name: "예산 소진 페이싱 계산기",
      eyebrow: "월중 운영 점검",
      title: "광고 예산 페이싱·잔여 일예산 계산기",
      description: "기간 예산, 지금까지 소진액, 경과일과 총일수를 넣으면 이 속도로 갔을 때의 예상 총소진액과 남은 기간의 하루 예산을 계산합니다.",
      summary: "월중에 예산이 남을지 모자랄지, 남은 날 하루 얼마씩 써야 하는지 확인합니다.",
      labels: { periodBudget: "기간 예산", spentSoFar: "현재까지 소진액", elapsedDays: "경과일", totalDays: "기간 총일수" },
      primaryLabel: "이 속도의 예상 총소진",
      secondaryLabel: "남은 기간 하루 예산",
      formula: "예상 총소진 = 소진액 ÷ 경과일 × 총일수 · 잔여 일예산 = (예산 − 소진액) ÷ 남은 일수",
      caveat: "요일별 편차와 주말 트래픽 차이를 반영하지 않은 단순 선형 페이싱입니다. 시즌 이벤트가 있으면 그대로 적용하지 마세요.",
      toolCta: "대시보드에서 실제 페이싱 확인",
      guide: [
        ["예상 총소진이 예산보다 큼", "이 속도면 기간 전에 예산이 소진됩니다. 일예산을 낮추거나 예산을 늘려야 합니다."],
        ["예상 총소진이 예산보다 작음", "예산이 남습니다. 성과가 좋은 캠페인에 남은 예산을 배분할 여지가 있습니다."],
      ],
      faq: [
        ["왜 단순 비례로 계산하나요?", "월중 점검은 빠른 판단이 목적이기 때문입니다. 요일·시즌 편차까지 보려면 대시보드의 페이싱 탭을 쓰세요."],
        ["남은 일예산이 0으로 나오면?", "이미 기간 예산을 초과 소진했다는 뜻입니다. 증액하거나 캠페인을 조정해야 합니다."],
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
    "cpa-roas-converter": {
      name: "CPA to ROAS converter",
      eyebrow: "Metric conversion",
      title: "CPA ↔ ROAS conversion calculator",
      description: "Convert CPA into ROAS using average order value, and work backwards to the CPA required to hit a target ROAS.",
      summary: "Reconcile the same performance whether your team reports it as CPA or ROAS.",
      labels: { aov: "Average order value", cpa: "Current CPA", targetRoasPct: "Target ROAS" },
      primaryLabel: "Current ROAS",
      secondaryLabel: "CPA needed for target ROAS",
      formula: "ROAS = AOV ÷ CPA · required CPA = AOV ÷ target ROAS",
      caveat: "Conversion depends on average order value, which varies by period and channel. This uses the average you enter, not per-order revenue.",
      toolCta: "Allocate budget with channel CPA and ROAS",
      guide: [["Current ROAS above target", "There is CPA headroom. Check marginal efficiency before scaling."], ["Current ROAS below target", "You need the shown CPA, a higher order value, or a revised target."]],
      faq: [["Why are ROAS and CPA convertible?", "They describe the same outcome against different denominators. Once revenue per conversion is fixed, one determines the other."], ["Does this work for signups or installs?", "Yes, if you place the expected revenue per signup in the order-value field\u2014but be explicit about whether that expectation is validated."]],
    },
    "required-cvr": {
      name: "Required CVR calculator",
      eyebrow: "Pre-launch check",
      title: "Required conversion rate calculator from budget and CPM",
      description: "Enter budget, CPM, target conversions, and expected CTR to get the conversion rate required to hit the goal, plus expected clicks.",
      summary: "Check whether a campaign target is arithmetically reachable before launching it.",
      labels: { budget: "Campaign budget", cpm: "Expected CPM", targetConversions: "Target conversions", ctrPct: "Expected CTR" },
      primaryLabel: "Required CVR",
      secondaryLabel: "Expected clicks",
      formula: "Impressions = budget ÷ CPM × 1,000 · required CVR = target ÷ (impressions × CTR)",
      caveat: "This assumes CPM and CTR hold for the whole flight. In practice both move with auction pressure, creative, and audience.",
      toolCta: "Check actual CVR in the dashboard",
      guide: [["Required CVR below your history", "The target looks reachable; creative and landing work can add margin."], ["Required CVR above your history", "Change budget, CPM, or the target\u2014conversion rate alone rarely closes that gap."], ["Required CVR above 100%", "The target is arithmetically impossible under these inputs."]],
      faq: [["What if I do not know CTR?", "Use a recent average for the same channel and creative type. Without evidence, a conservative value is safer than an optimistic one."], ["What does a required CVR above 100% mean?", "It means you need more conversions than clicks, which cannot happen. Raise budget or lower the target."]],
    },
    "budget-pacing": {
      name: "Budget pacing calculator",
      eyebrow: "Mid-flight check",
      title: "Ad budget pacing and remaining daily budget calculator",
      description: "Enter period budget, spend to date, elapsed days, and total days to project end-of-period spend and the daily budget left for the remaining days.",
      summary: "See whether you will underspend or overspend, and what the remaining days can carry.",
      labels: { periodBudget: "Period budget", spentSoFar: "Spend to date", elapsedDays: "Days elapsed", totalDays: "Days in period" },
      primaryLabel: "Projected total spend",
      secondaryLabel: "Daily budget for remaining days",
      formula: "Projection = spend ÷ elapsed days × total days · remaining daily = (budget − spend) ÷ days left",
      caveat: "This is straight-line pacing and ignores weekday and weekend variation. Do not apply it as-is around seasonal events.",
      toolCta: "Review actual pacing in the dashboard",
      guide: [["Projection above budget", "At this rate the budget runs out early; lower daily caps or add budget."], ["Projection below budget", "Budget will be left over and can move to the campaigns that are performing."]],
      faq: [["Why straight-line pacing?", "Mid-flight checks favor speed. For weekday and seasonal variation, use the dashboard pacing tab."], ["What does a remaining daily budget of zero mean?", "Spend has already exceeded the period budget. Increase it or adjust the campaigns."]],
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

  if (slug === "cpa-roas-converter") {
    const aov = finite(values.aov);
    const cpa = finite(values.cpa);
    const targetRoas = finite(values.targetRoasPct) / 100;
    if (!(aov > 0) || !(cpa > 0) || !(targetRoas > 0)) return null;
    return {
      primary: LTVCAC_MATH.safeDiv(aov, cpa),
      secondary: LTVCAC_MATH.safeDiv(aov, targetRoas),
      primaryFormat: "roas",
      secondaryFormat: "currency",
    };
  }

  if (slug === "required-cvr") {
    const budget = finite(values.budget);
    const cpm = finite(values.cpm);
    const targetConversions = finite(values.targetConversions);
    const ctr = finite(values.ctrPct) / 100;
    if (!(budget > 0) || !(cpm > 0) || !(targetConversions > 0) || !(ctr > 0 && ctr <= 1)) return null;
    const impressions = LTVCAC_MATH.safeDiv(budget, cpm) * 1000;
    const clicks = impressions * ctr;
    if (!(clicks > 0)) return null;
    return {
      primary: LTVCAC_MATH.safeDiv(targetConversions, clicks),
      secondary: clicks,
      primaryFormat: "percent",
      secondaryFormat: "count",
    };
  }

  if (slug === "budget-pacing") {
    const periodBudget = finite(values.periodBudget);
    const spentSoFar = finite(values.spentSoFar);
    const elapsedDays = finite(values.elapsedDays);
    const totalDays = finite(values.totalDays);
    if (!(periodBudget > 0) || !(spentSoFar >= 0) || !(elapsedDays > 0) || !(totalDays > elapsedDays)) return null;
    return {
      primary: LTVCAC_MATH.safeDiv(spentSoFar, elapsedDays) * totalDays,
      secondary: Math.max(0, LTVCAC_MATH.safeDiv(periodBudget - spentSoFar, totalDays - elapsedDays)),
      primaryFormat: "currency",
      secondaryFormat: "currency",
    };
  }

  return null;
}
