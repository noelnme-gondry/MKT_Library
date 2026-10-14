// Search entry: keep the question, input requirements and destination together.
export const MARKETING_ANALYSIS_UPDATED = "2026-10-14";
export const MARKETING_ANALYSIS_TASKS = [
  { slug: "ad-performance-diagnosis", toolId: "5-21", ko: { question: "광고 성과가 떨어졌다면", needs: "비교할 두 기간의 날짜·채널·비용·설치 또는 전환", outcome: "전체 단가 변화에서 채널 구성과 채널 내부 효율의 몫을 구분합니다.", action: "성과 변동 분석하기" }, en: { question: "When ad performance falls", needs: "Date, channel, spend and installs or conversions for two comparable periods", outcome: "Separate channel mix from within-channel efficiency in the unit-cost change.", action: "Analyze performance changes" } },
  { slug: "roas-improvement", toolId: "5-3", calculator: "roas", ko: { question: "ROAS가 떨어졌다면", needs: "같은 집계 기간과 통화의 광고비·귀속 매출", outcome: "광고비 대비 매출을 계산한 뒤 수익성 기준과 채널별 예산을 점검합니다.", action: "내 광고비·매출로 ROAS 계산" }, en: { question: "When ROAS falls", needs: "Ad spend and attributed revenue in the same currency and reporting window", outcome: "Calculate revenue relative to spend, then review profitability thresholds and channel budgets.", action: "Calculate ROAS from my totals" } },
  { slug: "budget-marginal-efficiency", toolId: "5-3", ko: { question: "다음 예산을 나눠야 한다면", needs: "채널별 여러 날짜·지출 수준의 비용과 전환 또는 매출", outcome: "평균 효율과 추가 지출의 효율을 비교하고, 관측 범위 안에서 배분안을 검토합니다.", action: "예산 배분 분석하기" }, en: { question: "When planning the next budget", needs: "Spend and conversions or revenue across dates and spend levels within each channel", outcome: "Compare average and marginal efficiency, then inspect allocations within the observed range.", action: "Analyze budget allocation" } },
];

const COPY = {
  ko: {
    title: "마케팅 분석, 숫자에서 다음 결정까지",
    description: "마케팅 분석을 성과 하락·ROAS·예산 배분 질문에서 시작하세요. 필요한 데이터와 분석 방법을 비교하고 무료 도구로 직접 확인합니다.",
    intro: "퍼포먼스 마케팅에서 광고비·전환·매출이 달라졌다면, 먼저 확인할 질문을 고르세요. 결과 예시를 살펴보고 내 데이터로 분석을 이어갈 수 있습니다.",
    lead: "퍼포먼스 마케팅에서 지금 결정할 일을 고르세요. 필요한 데이터와 확인할 결과를 함께 보고, 해당 분석으로 이어갈 수 있습니다.",
    tasks: "지금 해결할 질문에서 시작하세요", needs: "준비할 데이터", outcome: "확인할 결과", example: "계산 예시와 점검 순서", methods: "마케팅 분석 방법은 언제 다르게 써야 할까?",
    methodsLead: "운영 변화의 분해, 예산 시뮬레이션, 광고의 증분 효과는 서로 다른 질문입니다. 보유 데이터와 비교 설계에 맞는 방법을 선택하세요.",
    workflow: "퍼포먼스 마케팅의 목표부터 분석까지", workflowText: "목표와 전환 정의를 정하고, CPA·ROAS를 같은 기준으로 비교한 뒤 변동 분석과 예산 검토로 넘어갑니다. 실행 후에는 같은 조건으로 결과를 다시 확인합니다.", workflowLink: "퍼포먼스 마케팅 실무 순서 읽기",
    start: "어떤 분석부터 할지 모르겠다면", startText: "CSV의 열과 데이터 형태를 확인해 가능한 분석을 안내합니다. 가입 없이 무료로 시작하며 파일은 브라우저에서 처리합니다.", startAction: "내 CSV로 가능한 분석 찾기",
    faq: [
      { q: "마케팅 분석이란 무엇인가요?", a: "광고비·유입·전환·매출을 비교해 성과 변화와 다음 의사결정을 검토하는 일입니다. 먼저 기간·전환 정의·통화를 맞추고, 관측 변화의 설명과 인과효과 검증을 구분합니다." },
      { q: "퍼포먼스 마케팅에서는 어떤 지표를 봐야 하나요?", a: "캠페인 목표에 맞는 전환수와 CPA, 매출이 연결되면 ROAS를 봅니다. 노출·클릭·전환율은 변화가 생긴 단계를 좁히는 데 사용합니다. 높은 ROAS만으로 이익이나 광고의 순증 효과를 확정할 수는 없습니다." },
      { q: "분석 도구를 쓰려면 어떤 파일이 필요한가요?", a: "일별 날짜·채널·비용·전환 또는 매출이 있는 CSV로 운영 점검을 시작할 수 있습니다. 예산 반응 추정에는 채널별 지출 변화가, 증분 효과 추정에는 비교 설계와 대조군 정보가 추가로 필요합니다." },
    ],
  },
  en: {
    title: "Marketing analysis, from numbers to decisions",
    description: "Start marketing analysis with performance drops, ROAS or budget allocation. Compare data requirements and methods, then use the matching free analysis tool.",
    intro: "When spend, conversions or revenue change in performance marketing, start with a question. Explore an example result, then bring the same analysis to your data.",
    lead: "Choose the decision you need to make in performance marketing. Check the required data and output, then continue to the matching analysis.",
    tasks: "Start with the question you need to answer", needs: "Data to prepare", outcome: "What you can inspect", example: "Calculation example and review steps", methods: "When should you use different marketing analysis methods?",
    methodsLead: "Decomposing operating changes, simulating budgets and estimating incremental effects answer different questions. Choose a method that matches your data and comparison design.",
    workflow: "From performance marketing goals to analysis", workflowText: "Define the goal and conversion, compare CPA and ROAS consistently, then investigate changes and review budgets. After acting, revisit the outcome under the same conditions.", workflowLink: "Read the performance marketing workflow",
    start: "Unsure which analysis to run first?", startText: "Check your CSV columns and data shape to find supported analyses. Start free without signing in; files are processed in your browser.", startAction: "Find analyses for my CSV",
    faq: [
      { q: "What is marketing analysis?", a: "It compares spend, traffic, conversions and revenue to examine performance changes and decisions. Align periods, conversion definitions and currency first, and distinguish describing observed changes from testing causal effects." },
      { q: "Which metrics matter in performance marketing?", a: "Track conversions and CPA for the campaign goal, and ROAS when revenue is linked. Use impressions, clicks and conversion rates to narrow the stage that changed. High ROAS alone establishes neither profit nor incremental advertising impact." },
      { q: "What data do the analysis tools need?", a: "A CSV with daily dates, channels, spend and conversions or revenue can support operating checks. Budget response estimates also need within-channel spend variation; incrementality estimates need a comparison design and control information." },
    ],
  },
};
export const marketingAnalysisCopy = (locale = "ko") => COPY[locale === "en" ? "en" : "ko"];
