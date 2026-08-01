// 블로그의 "짧은 답"·적용 범위·검토 정보를 원고와 분리한 편집 레지스트리.
// 검색 메타와 CTA를 섞지 않고, SSR 본문과 JSON-LD가 동일한 답변을 쓰게 한다.
const KO_ANSWERS = {
  "ab-testing": "A/B 테스트는 무작위 배정과 사전 표본 계획으로 두 안의 차이가 우연인지 판정하는 방법입니다. 중간 결과가 좋아 보여도 정한 종료 기준 전에는 승자를 확정하지 않는 편이 안전합니다.",
  "ad-creative-specs-guide": "소재 규격은 매체별 지면과 안전영역이 달라 하나의 파일로 통일하면 노출 품질이 떨어질 수 있습니다. 집행 전 매체별 규격과 실제 미리보기를 함께 확인하세요.",
  "ad-machine-learning": "광고 머신러닝은 충분한 전환 신호를 바탕으로 학습하므로 잦은 타겟·예산·소재 변경은 학습을 흔들 수 있습니다. 변경은 한 번에 하나씩, 충분한 관찰 기간을 두고 평가합니다.",
  "ad-performance-diagnosis": "성과 하락은 소재만의 문제가 아닐 수 있으므로 집계 기준, 전환량, 트래픽 품질, 소재 순으로 원인을 좁혀야 합니다. 같은 기간과 같은 전환 정의로 비교하는 것이 첫 단계입니다.",
  "adjust-vs-appsflyer": "Adjust와 AppsFlyer 중 하나가 모든 팀에 절대적으로 낫지는 않습니다. 필요한 측정 범위, 연동 매체, 데이터 접근 방식, 운영 지원을 실제 요구사항에 맞춰 비교하세요.",
  "aha-event-ad-optimization": "Aha Event는 설치 직후의 행동 중 장기 리텐션이나 가치와 연결될 가능성이 높은 신호입니다. 설치 수만 늘리는 대신, 그 행동이 실제 장기 결과와 함께 움직이는지 검증해야 합니다.",
  "aha-moment-retention": "Aha Moment는 사용자가 가치를 체감했다는 단일 정답이 아니라, 리텐션과 연관된 초기 행동 후보입니다. 행동 시점·횟수·코호트를 나눠 보고 실험으로 검증하세요.",
  "ai-era-marketer": "AI가 반복 작업을 줄여도 목표 정의, 데이터 검증, 인과 해석, 실험 설계는 마케터의 판단이 필요합니다. 도구 숙련보다 문제를 측정 가능한 질문으로 바꾸는 역량이 핵심입니다.",
  "apple-search-ads-guide": "Apple Search Ads 캠페인을 목적과 검색어 성격에 따라 나누면 입찰·예산·검색어 학습을 분리해 관리하기 쉽습니다. 계정 구조는 앱의 브랜드 인지도와 키워드 수에 맞춰 단순하게 시작하세요.",
  "aso-basics-guide": "ASO는 광고 유입 이후 스토어에서 일어나는 전환을 개선하는 작업입니다. 키워드만 늘리기보다 타깃 국가의 검색 의도, 메타데이터, 스크린샷, 평점을 함께 점검해야 합니다.",
  "attribution-data-mismatch": "매체·GA4·MMP의 전환 수가 다른 것은 흔하며, 서로 다른 귀속 창과 집계 시점·정의가 원인인 경우가 많습니다. 숫자 하나를 고르기 전에 각 시스템의 기준을 표로 맞추세요.",
  "audience-broad-vs-narrow": "브로드와 세밀 타겟 중 정답은 상품·신호량·예산에 따라 달라집니다. 학습에 필요한 전환 신호가 충분한지와 제외해야 할 명확한 집단이 있는지를 먼저 판단하세요.",
  "budget-marginal-efficiency": "예산 증액·삭감 판단은 평균 ROAS나 CPA보다 다음 단위 예산의 한계 효율을 봐야 합니다. 추가 지출에서 성과가 얼마나 변하는지 추정할 수 없으면 작은 단계로 실험하세요.",
  "campaign-anomaly-detection": "캠페인 이상은 숫자가 변했다는 사실보다 무엇이 변했는지 분해할 때 원인을 찾을 수 있습니다. 기간·전환량·비용·매체 변경 이력을 같은 표에서 먼저 확인하세요.",
  "cannibalization-organic-paid": "유료 광고가 오가닉 성과를 늘렸는지, 기존 수요를 가져왔는지는 귀속 데이터만으로 확정하기 어렵습니다. 홀드아웃·지역 실험·추세 비교처럼 반사실을 만드는 방법이 필요합니다.",
  "cohort-analysis-guide": "코호트 분석은 같은 시작 시점의 사용자를 묶어 시간이 지나도 얼마나 남는지 보는 방법입니다. 전체 평균 대신 코호트 크기와 관찰 기간을 함께 보아야 최근 코호트를 오해하지 않습니다.",
  "correlation-vs-causation": "두 지표가 함께 움직인다는 사실만으로 한쪽이 다른 쪽의 원인이라고 말할 수는 없습니다. 의사결정에는 대조군이나 무작위 실험처럼 다른 설명을 줄이는 설계가 필요합니다.",
  "cpi-cpa-cpm-difference": "CPI·CPA·CPM·CPC는 각각 설치·전환·노출·클릭 한 단위당 비용입니다. 어느 지표를 최적화할지는 현재 사업 단계에서 실제로 만들고 싶은 결과에 맞춰 정해야 합니다.",
  "event-taxonomy-guide": "이벤트 택소노미는 같은 사용자 행동을 GA4·MMP·광고 매체가 일관된 이름과 속성으로 읽게 하는 약속입니다. 이름보다 먼저 이벤트 정의, 발생 조건, 소유자, 검증 방법을 고정하세요.",
  "funnel-dropoff-analysis": "퍼널 이탈은 가장 낮은 전환율 하나를 고르는 일이 아니라, 단계별 모수와 사용자 의도를 함께 확인하는 진단입니다. 병목 가설을 정한 뒤 한 번에 하나의 개선안을 실험하세요.",
  "ga4-data-traps": "GA4 수치는 처리 시간, 시간대, 식별자, 보고서 범위가 다르면 다른 값이 나올 수 있습니다. 오류로 단정하기 전에 비교 중인 보고서의 날짜·측정 기준·필터를 맞추세요.",
  "google-uac-optimization": "Google 앱 캠페인에서는 수동 조정 범위가 제한적이므로 전환 이벤트, 측정 품질, 예산 안정성, 소재 공급이 핵심 레버입니다. 변경 후에는 학습 기간을 고려해 성과를 읽어야 합니다.",
  "hook-3-seconds-framework": "첫 3초는 시청자가 계속 볼 이유를 판단하는 구간이지만, 모든 소재에 같은 공식이 적용되지는 않습니다. 타깃의 문제·메시지·형식을 바꾼 소재를 비교해 실제 이탈률로 검증하세요.",
  "incrementality-measurement": "증분성 측정은 광고에 귀속된 전환이 아니라 광고가 없었어도 생기지 않았을 추가 성과를 추정합니다. 통제군의 비교 가능성과 사전 설계가 결과의 신뢰도를 좌우합니다.",
  "ios-att-skan-guide": "ATT와 SKAdNetwork 환경에서는 iOS 성과가 과거처럼 사용자 단위로 완전하게 보이지 않을 수 있습니다. 관측 가능한 신호와 누락 가능성을 분리해 읽고, 지표 변화의 원인을 단정하지 마세요.",
  "ltv-cac-ratio": "LTV:CAC는 고객이 만드는 장기 가치와 획득 비용의 관계를 보는 지표입니다. 동일한 고객 범위·기간·비용 범위로 계산하지 않으면 3:1 같은 기준도 잘못된 결론이 될 수 있습니다.",
  "marketing-mix-modeling": "MMM은 시간에 따른 채널·기본 수요·외부 요인의 관계를 모델링해 기여도를 추정하는 방법입니다. 관측 데이터의 연관성만으로 인과를 확정하지 말고 실험과 함께 해석하세요.",
  "meta-advantage-plus-guide": "Meta Advantage+ App 캠페인에서 광고주가 통제할 수 있는 영역은 목표 이벤트, 예산, 소재, 측정 설정처럼 제한적입니다. 학습을 방해하는 잦은 편집보다 명확한 신호와 소재 실험이 중요합니다.",
  "performance-marketer-skills": "퍼포먼스 마케터에게 필요한 역량은 매체 기능 암기보다 문제 정의, 데이터 품질 확인, 실험 설계, 결과 해석입니다. 자동화가 늘수록 판단 근거를 설명하는 능력이 더 중요해집니다.",
  "performance-marketing-metrics": "퍼포먼스 마케팅 지표는 비용·전환·매출·리텐션을 목표에 맞춰 연결해 읽어야 합니다. CPA나 ROAS 하나만으로는 성장의 질이나 장기 가치를 판단하기 어렵습니다.",
  "postback-integration-guide": "포스트백 연동 문제는 이벤트 정의, 식별자 전달, 전송 조건, 매체 수신 상태를 순서대로 확인하면 좁힐 수 있습니다. 0건은 곧바로 성과 0을 뜻하지 않으므로 각 구간의 로그를 분리해 점검하세요.",
  "retargeting-reengagement-guide": "리타겟팅은 신규 획득과 다른 사용자 상태와 목표를 다루므로 같은 캠페인 안에서 섞어 읽으면 효율을 오해하기 쉽습니다. 제외 기준과 증분 효과를 함께 관리해야 합니다.",
};

const EN_ANSWERS = {
  "ab-testing": "A/B testing uses random assignment and a pre-set sample plan to judge whether a difference is likely to be real. Do not declare a winner from an encouraging interim result before the planned stopping rule.",
  "ad-creative-specs-guide": "Creative specifications differ by placement and safe area, so one universal asset can degrade delivery quality. Check each platform specification and a live preview before launch.",
  "ad-machine-learning": "Ad-delivery models learn from conversion signals, so frequent changes to targeting, budget, or creative can disrupt learning. Change one variable at a time and allow a meaningful observation window.",
  "ad-performance-diagnosis": "A performance drop is not necessarily a creative problem. Align the reporting definition first, then narrow the diagnosis through conversion volume, traffic quality, and creative evidence.",
  "adjust-vs-appsflyer": "Neither Adjust nor AppsFlyer is universally better. Compare measurement coverage, media integrations, data access, and operating support against the team’s actual requirements.",
  "aha-event-ad-optimization": "An Aha Event is an early behavior that may be associated with longer-term retention or value. Validate that relationship before optimizing ads for the event instead of installs alone.",
  "aha-moment-retention": "An Aha Moment is not a single universal answer; it is a candidate early behavior associated with retention. Compare timing, frequency, and cohorts, then validate the hypothesis with an experiment.",
  "ai-era-marketer": "AI can reduce repetitive work, but goal definition, data validation, causal interpretation, and experiment design still require judgment. The durable skill is turning a problem into a measurable question.",
  "apple-search-ads-guide": "Separating Apple Search Ads campaigns by intent and query type makes bids, budgets, and search-term learning easier to manage. Start with a structure that matches brand awareness and keyword volume.",
  "aso-basics-guide": "ASO improves the store conversion that happens after acquisition. Review local search intent, metadata, screenshots, and ratings together rather than only adding more keywords.",
  "attribution-data-mismatch": "Different conversion counts across media platforms, GA4, and an MMP are common because attribution windows, timing, and definitions differ. Align those rules in one table before choosing a number.",
  "audience-broad-vs-narrow": "There is no universal winner between broad and narrow targeting. Start by judging available conversion signal and whether there is a clear audience that must be excluded.",
  "budget-marginal-efficiency": "Budget decisions should use marginal efficiency—the outcome from the next unit of spend—not only average ROAS or CPA. If it cannot be estimated, test the next move in small increments.",
  "campaign-anomaly-detection": "An anomaly becomes diagnosable when the changed component is decomposed, not merely observed. Review the date range, conversion volume, spend, and platform change history together.",
  "cannibalization-organic-paid": "Attribution data alone cannot prove whether paid ads created demand or captured existing organic demand. Use a counterfactual approach such as holdouts, geo tests, or trend comparisons.",
  "cohort-analysis-guide": "Cohort analysis groups users by a common starting point to see how many remain over time. Read cohort size and observation window alongside the average to avoid misreading recent cohorts.",
  "correlation-vs-causation": "Two metrics moving together does not show that one caused the other. A decision needs a design—such as a control group or randomization—that rules out competing explanations.",
  "cpi-cpa-cpm-difference": "CPI, CPA, CPM, and CPC are costs per install, conversion, impression, and click. Choose the optimization metric that represents the outcome the business needs at its current stage.",
  "event-taxonomy-guide": "An event taxonomy is the agreement that lets GA4, an MMP, and ad platforms read the same user behavior with consistent names and properties. Define the event, trigger, owner, and validation method before naming it.",
  "funnel-dropoff-analysis": "Funnel analysis is not simply choosing the lowest conversion rate. Compare step-level denominators and user intent, then test one improvement hypothesis at a time.",
  "ga4-data-traps": "GA4 reports can differ when processing time, time zone, identity, or report scope differs. Align dates, measurement rules, and filters before treating a difference as an error.",
  "google-uac-optimization": "In Google app campaigns, the strongest levers are conversion events, measurement quality, budget stability, and creative supply. Read results with the learning period in mind after a change.",
  "hook-3-seconds-framework": "The first three seconds are where viewers decide whether to continue, but one formula will not fit every creative. Test messages and formats against actual drop-off data.",
  "incrementality-measurement": "Incrementality estimates the additional outcome caused by advertising, not merely attributed conversions. A comparable control group and pre-specified design determine whether the estimate is trustworthy.",
  "ios-att-skan-guide": "In the ATT and SKAdNetwork environment, iOS performance may not be visible at the same user level as before. Separate observable signals from possible missingness before assigning a cause to a change.",
  "ltv-cac-ratio": "LTV:CAC compares long-term customer value with acquisition cost. Even a familiar benchmark such as 3:1 is misleading unless customer scope, time window, and cost scope are aligned.",
  "marketing-mix-modeling": "MMM models the relationship of channels, base demand, and external factors over time to estimate contribution. Treat it as observational evidence and interpret it alongside experiments.",
  "meta-advantage-plus-guide": "With Meta Advantage+ App campaigns, the main advertiser controls are the goal event, budget, creative, and measurement setup. Clear signals and creative experiments matter more than frequent edits that interrupt learning.",
  "performance-marketer-skills": "The core performance-marketing skills are problem definition, data-quality checks, experiment design, and interpretation—not memorizing platform controls. Automation makes the ability to explain a decision more valuable.",
  "performance-marketing-metrics": "Performance metrics need to connect cost, conversion, revenue, and retention to the business goal. CPA or ROAS alone cannot describe growth quality or long-term value.",
  "postback-integration-guide": "Troubleshoot postbacks in order: event definition, identifier transfer, send condition, and platform receipt. Zero received events do not automatically mean zero performance, so isolate each stage with logs.",
  "retargeting-reengagement-guide": "Retargeting addresses a different user state and goal from acquisition, so combining them can distort efficiency. Manage exclusion rules and incremental effect alongside attributed results.",
};

const DEFAULTS = {
  ko: {
    conditions: "이 답은 일반적인 운영 원칙입니다. 매체 설정, 데이터 기준, 표본 규모가 다르면 결론도 달라질 수 있으니 실제 데이터와 공식 문서를 함께 확인하세요.",
    reviewer: "Growth Opt Playbook 편집 검토",
  },
  en: {
    conditions: "This is a general operating principle. Platform settings, data definitions, and sample size can change the conclusion, so check your data and the current official documentation.",
    reviewer: "Growth Opt Playbook editorial review",
  },
};

export function getBlogEditorial(locale, slug, source = {}) {
  const lang = locale === "en" ? "en" : "ko";
  const answer = source.answer || (lang === "en" ? EN_ANSWERS[slug] : KO_ANSWERS[slug]) || "";
  const conditions = source.conditions || DEFAULTS[lang].conditions;
  return {
    answer,
    conditions,
    reviewer: source.reviewer || DEFAULTS[lang].reviewer,
    // 글별로 실제 검토일이 없으면 발행일만 표시한다. 편집 레지스트리를 추가한
    // 날짜를 모든 글의 사실 검토일처럼 쓰지 않는다.
    reviewedAt: source.reviewedAt || source.updated || source.date || "",
    sources: Array.isArray(source.sources) ? source.sources.filter((item) => item?.title && item?.url) : [],
  };
}

export function publishedEditorialSlugs(locale) {
  return Object.keys(locale === "en" ? EN_ANSWERS : KO_ANSWERS)
    .filter((slug) => slug !== "adjust-vs-appsflyer");
}
