// 블로그의 "짧은 답"·적용 범위·검토 정보를 원고와 분리한 편집 레지스트리.
// 검색 메타와 CTA를 섞지 않고, SSR 본문과 JSON-LD가 동일한 답변을 쓰게 한다.
const KO_ANSWERS = {
  "ab-testing": "A/B 테스트는 무작위 배정과 사전 표본 계획으로 두 안의 차이가 우연인지 판정하는 방법입니다. 중간 결과가 좋아 보여도 정한 종료 기준 전에는 승자를 확정하지 않는 편이 안전합니다.",
  "ad-creative-specs-guide": "소재가 반려되거나 크롭되는 이유는 대개 매체별 규격과 안전영역이 달라서입니다. 하나의 파일로 통일하면 노출 품질이 떨어질 수 있으니, 집행 전 매체별 규격과 실제 미리보기를 함께 확인하세요.",
  "ad-creative-testing": "동시 테스트 소재 수는 테스트 배치 예산을 소재당 판정 예산으로 나눈 뒤 소수점을 버려 정합니다. 이 값은 운영 가능한 슬롯 수이지 통계적 표본 크기가 아닙니다.",
  "ad-machine-learning": "광고 머신러닝은 충분한 전환 신호를 바탕으로 학습하므로 잦은 타겟·예산·소재 변경은 학습을 흔들 수 있습니다. 변경은 한 번에 하나씩, 충분한 관찰 기간을 두고 평가합니다.",
  "ad-performance-diagnosis": "성과 하락은 소재만의 문제가 아닐 수 있으므로 집계 기준, 전환량, 트래픽 품질, 소재 순으로 원인을 좁혀야 합니다. 같은 기간과 같은 전환 정의로 비교하는 것이 첫 단계입니다.",
  "adjust-vs-appsflyer": "Adjust와 AppsFlyer 중 하나가 모든 팀에 절대적으로 낫지는 않습니다. 필요한 측정 범위, 연동 매체, 데이터 접근 방식, 운영 지원을 실제 요구사항에 맞춰 비교하세요.",
  "aha-event-ad-optimization": "Aha Event는 설치 직후의 행동 중 장기 리텐션이나 가치와 연결될 가능성이 높은 신호입니다. 설치 수만 늘리는 대신, 그 행동이 실제 장기 결과와 함께 움직이는지 검증해야 합니다.",
  "aha-moment-retention": "Aha Moment는 사용자가 가치를 체감했다는 단일 정답이 아니라, 리텐션과 연관된 초기 행동 후보입니다. 행동 시점·횟수·코호트를 나눠 보고 실험으로 검증하세요.",
  "ai-era-marketer": "AI가 반복 작업을 줄여도 목표 정의, 데이터 검증, 인과 해석, 실험 설계는 마케터의 판단이 필요합니다. 도구 숙련보다 문제를 측정 가능한 질문으로 바꾸는 역량이 핵심입니다.",
  "apple-search-ads-guide": "Apple Search Ads(ASA)에서는 검색어 리포트에서 충분한 탭·설치와 목표 CPA를 함께 충족한 비-Exact 검색어를 Exact 후보로 올리세요. 예산을 덜 쓰면서 성과가 좋으면 CPT를 조금 높이고, 많이 쓰면서 성과가 나쁘면 낮춥니다.",
  "asa-keyword-expansion": "ASA 키워드 확장은 Discovery로 검색어를 발굴한 뒤, 판단할 만큼 전환이 쌓이면서 목표 CPA도 만족한 검색어만 Exact로 승격하는 과정입니다. 승격한 검색어는 Discovery에 네거티브로 추가해 같은 검색어에 두 캠페인이 동시에 입찰하지 않게 하세요.",
  "aso-basics-guide": "ASO는 광고 유입 이후 스토어에서 일어나는 전환을 개선하는 작업입니다. 키워드만 늘리기보다 타깃 국가의 검색 의도, 메타데이터, 스크린샷, 평점을 함께 점검해야 합니다.",
  "attribution-data-mismatch": "어트리뷰션 데이터 불일치, 즉 매체·GA4·MMP의 전환 수가 서로 다른 것은 흔한 일이며 귀속 창과 집계 시점·정의가 달라서 생깁니다. 숫자 하나를 고르기 전에 각 시스템의 기준을 표로 맞추세요.",
  "audience-broad-vs-narrow": "브로드와 세밀 타겟 중 정답은 상품·신호량·예산에 따라 달라집니다. 학습에 필요한 전환 신호가 충분한지와 제외해야 할 명확한 집단이 있는지를 먼저 판단하세요.",
  "brand-campaign-lift": "브랜드 캠페인은 클릭으로 전환이 잡히지 않으므로, 브랜드 검색량·직접 유입 시계열을 집행 전 추세와 비교해 증가분을 추정합니다. 대조군이 없으면 계절성·PR이 섞이므로 같은 기간의 다른 사건과 함께 '추정 증가분'으로 표기하세요.",
  "budget-marginal-efficiency": "예산 증액·삭감 판단은 평균 ROAS나 CPA보다 다음 단위 예산의 한계 효율을 봐야 합니다. 추가 지출에서 성과가 얼마나 변하는지 추정할 수 없으면 작은 단계로 실험하세요.",
  "budget-scaling-limit": "증액 여력은 평균 CPA가 아니라 다음 단위 예산의 한계 CPA로 판단합니다. 한계 CPA가 평균과 비슷하면 아직 여력이 있고, 평균보다 크게 높아졌다면 이미 포화 구간이라 증액분이 비싸집니다.",
  "campaign-anomaly-detection": "캠페인 이상은 숫자가 변했다는 사실보다 무엇이 변했는지 분해할 때 원인을 찾을 수 있습니다. 기간·전환량·비용·매체 변경 이력을 같은 표에서 먼저 확인하세요.",
  "cannibalization-organic-paid": "유료 광고가 오가닉 성과를 늘렸는지, 기존 수요를 가져왔는지는 귀속 데이터만으로 확정하기 어렵습니다. 홀드아웃·지역 실험·추세 비교처럼 반사실을 만드는 방법이 필요합니다.",
  "cohort-analysis-guide": "코호트 분석은 같은 시작 시점의 사용자를 묶어 시간이 지나도 얼마나 남는지 보는 방법입니다. 전체 평균 대신 코호트 크기와 관찰 기간을 함께 보아야 최근 코호트를 오해하지 않습니다.",
  "content-element-analysis": "후킹·길이·형식처럼 함께 움직이는 요소는 하나씩 보면 서로 구분되지 않습니다. 여러 요소를 동시에 넣어 다른 요소를 같은 수준으로 맞춘 뒤 비교하고, 상위로 올라온 한두 개만 실험으로 확정하세요.",
  "correlation-vs-causation": "상관관계는 두 지표가 함께 움직였다는 관찰이고, 인과관계는 한쪽이 다른 쪽을 만들었다는 주장입니다. 함께 움직인다는 사실만으로 인과를 말할 수 없고, 의사결정에는 대조군이나 무작위 실험처럼 다른 설명을 줄이는 설계가 필요합니다.",
  "cpi-cpa-cpm-difference": "CPM은 노출 1,000회당 비용이고 CPC는 클릭당 비용입니다. 앞단 비용이 바뀌면 광고 반응과 경매 단가를 분리해 보고, CPI·CPA·ROAS의 전체 최적화 기준은 지표 사슬에서 확인하세요.",
  "creative-attribute-regression": "썸네일·제목을 A/B 없이 비교하려면 이미 집행한 소재의 속성을 열로 만들어 한꺼번에 회귀로 봅니다. 배분 알고리즘의 선택 편향이 섞이므로 방향을 좁히는 용도로만 쓰고, 확정은 실험으로 하세요.",
  "event-taxonomy-guide": "이벤트 택소노미는 같은 사용자 행동을 GA4·MMP·광고 매체가 일관된 이름과 속성으로 읽게 하는 약속입니다. 이름보다 먼저 이벤트 정의, 발생 조건, 소유자, 검증 방법을 고정하세요.",
  "funnel-dropoff-analysis": "퍼널 이탈은 가장 낮은 전환율 하나를 고르는 일이 아니라, 단계별 모수와 사용자 의도를 함께 확인하는 진단입니다. 병목 가설을 정한 뒤 한 번에 하나의 개선안을 실험하세요.",
  "ga4-data-traps": "GA4 수치는 처리 시간, 시간대, 식별자, 보고서 범위가 다르면 다른 값이 나올 수 있습니다. 오류로 단정하기 전에 비교 중인 보고서의 날짜·측정 기준·필터를 맞추세요.",
  "google-uac-optimization": "Google 앱 캠페인에서는 수동 조정 범위가 제한적이므로 전환 이벤트, 측정 품질, 예산 안정성, 소재 공급이 핵심 레버입니다. 변경 후에는 학습 기간을 고려해 성과를 읽어야 합니다.",
  "hook-3-seconds-framework": "광고 첫 3초 후킹은 시청자가 계속 볼지 판단하는 구간이지만, 모든 소재에 같은 공식이 적용되지는 않습니다. 타깃의 문제·메시지·형식을 바꾼 소재를 비교해 실제 이탈률로 검증하세요.",
  "incrementality-measurement": "증분성 측정은 광고에 귀속된 전환이 아니라 광고가 없었어도 생기지 않았을 추가 성과를 추정합니다. 통제군의 비교 가능성과 사전 설계가 결과의 신뢰도를 좌우합니다.",
  "ios-att-skan-guide": "ATT와 SKAdNetwork 환경에서는 iOS 성과가 과거처럼 사용자 단위로 완전하게 보이지 않을 수 있습니다. 관측 가능한 신호와 누락 가능성을 분리해 읽고, 지표 변화의 원인을 단정하지 마세요.",
  "ltv-cac-ratio": "LTV:CAC는 고객이 만드는 장기 가치와 획득 비용의 관계를 보는 지표입니다. 동일한 고객 범위·기간·비용 범위로 계산하지 않으면 3:1 같은 기준도 잘못된 결론이 될 수 있습니다.",
  "marketing-mix-modeling": "MMM은 시간에 따른 채널·기본 수요·외부 요인의 관계를 모델링해 기여도를 추정하는 방법입니다. 관측 데이터의 연관성만으로 인과를 확정하지 말고 실험과 함께 해석하세요.",
  "multicollinearity-mmm-guide": "다중공선성이 높으면 MMM은 채널별 기여도를 안정적으로 나누기 어렵습니다. VIF와 함께 움직인 채널을 먼저 확인하고, 독립적인 예산 변동이나 실험으로 근거를 보완하세요.",
  "meta-advantage-plus-guide": "Meta Advantage+ App 캠페인에서 광고주가 통제할 수 있는 영역은 목표 이벤트, 예산, 소재, 측정 설정처럼 제한적입니다. 학습을 방해하는 잦은 편집보다 명확한 신호와 소재 실험이 중요합니다.",
  "offline-ad-online-impact": "TV·옥외 광고는 노출 구간과 비노출 구간의 온라인 수요 차이로 효과를 추정합니다. 전후 비교만으로는 같은 기간의 다른 변화를 분리할 수 없으므로, 지역을 나눠 홀드아웃을 만들 수 있으면 그쪽이 훨씬 낫습니다.",
  "performance-marketer-skills": "퍼포먼스 마케터에게 필요한 역량은 매체 기능 암기보다 문제 정의, 데이터 품질 확인, 실험 설계, 결과 해석입니다. 자동화가 늘수록 판단 근거를 설명하는 능력이 더 중요해집니다.",
  "performance-marketing-analysis-order": "퍼포먼스 마케팅 분석은 분석 이름부터 고르지 말고, 지금 답해야 할 질문과 가진 데이터의 단위부터 확인하세요. 일별 성과는 대시보드와 변동 분해, 지출 변화가 충분하면 포화도와 예산 배분, 대조군이 있으면 증분 분석, 52주 이상 채널 패널이 있으면 VIF를 거쳐 MMM으로 이어가는 순서가 안전합니다.",
  "performance-marketing-metrics": "퍼포먼스 마케팅 지표는 비용·전환·매출·리텐션을 목표에 맞춰 연결해 읽어야 합니다. CPA나 ROAS 하나만으로는 성장의 질이나 장기 가치를 판단하기 어렵습니다.",
  "postback-integration-guide": "포스트백 연동 문제는 이벤트 정의, 식별자 전달, 전송 조건, 매체 수신 상태를 순서대로 확인하면 좁힐 수 있습니다. 0건은 곧바로 성과 0을 뜻하지 않으므로 각 구간의 로그를 분리해 점검하세요.",
  "retargeting-reengagement-guide": "리타겟팅은 신규 획득과 다른 사용자 상태와 목표를 다루므로 같은 캠페인 안에서 섞어 읽으면 효율을 오해하기 쉽습니다. 제외 기준과 증분 효과를 함께 관리해야 합니다.",
  "roas-improvement": "ROAS 하락은 평균 수치만으로 예산을 줄일 문제가 아닙니다. 데이터 성숙도와 채널별 효율·전환 이후 매출 흐름을 나눈 뒤, 다음 예산의 한계 효율을 작은 단계로 검증하세요.",
  "uplift-holdout-guide": "광고 업리프트는 노출 그룹과 광고를 보지 않은 홀드아웃 그룹의 차이로 광고가 실제로 추가한 성과를 추정합니다. 좋은 CPA만으로 증액하지 말고 절대 증가분과 불확실성을 함께 확인하세요.",
};

const EN_ANSWERS = {
  "ab-testing": "A/B testing uses random assignment and a pre-set sample plan to judge whether a difference is likely to be real. Do not declare a winner from an encouraging interim result before the planned stopping rule.",
  "ad-creative-specs-guide": "Creative specifications differ by placement and safe area, so one universal asset can degrade delivery quality. Check each platform specification and a live preview before launch.",
  "ad-creative-testing": "Calculate concurrent creative slots by dividing the test-batch budget by the decision budget per creative, then round down. This is an operational capacity rule, not a statistical sample-size calculation.",
  "ad-machine-learning": "Ad-delivery models learn from conversion signals, so frequent changes to targeting, budget, or creative can disrupt learning. Change one variable at a time and allow a meaningful observation window.",
  "ad-performance-diagnosis": "A performance drop is not necessarily a creative problem. Align the reporting definition first, then narrow the diagnosis through conversion volume, traffic quality, and creative evidence.",
  "adjust-vs-appsflyer": "Neither Adjust nor AppsFlyer is universally better. Compare measurement coverage, media integrations, data access, and operating support against the team’s actual requirements.",
  "aha-event-ad-optimization": "An Aha Event is an early behavior that may be associated with longer-term retention or value. Validate that relationship before optimizing ads for the event instead of installs alone.",
  "aha-moment-retention": "An Aha Moment is not a single universal answer; it is a candidate early behavior associated with retention. Compare timing, frequency, and cohorts, then validate the hypothesis with an experiment.",
  "ai-era-marketer": "AI can reduce repetitive work, but goal definition, data validation, causal interpretation, and experiment design still require judgment. The durable skill is turning a problem into a measurable question.",
  "apple-search-ads-guide": "In Apple Search Ads (ASA), promote non-Exact search terms only after they have enough taps and installs and meet target CPA. Raise CPT slightly when pacing is low and performance is good; lower it when spend is high and performance misses target.",
  "asa-keyword-expansion": "ASA keyword expansion means using Discovery to find search terms, then promoting to Exact only those with enough conversions to judge on and a CPA inside target. Add each promoted term as a negative in Discovery so two campaigns do not bid on it at once.",
  "aso-basics-guide": "ASO improves the store conversion that happens after acquisition. Review local search intent, metadata, screenshots, and ratings together rather than only adding more keywords.",
  "attribution-data-mismatch": "Different conversion counts across media platforms, GA4, and an MMP are common because attribution windows, timing, and definitions differ. Align those rules in one table before choosing a number.",
  "audience-broad-vs-narrow": "There is no universal winner between broad and narrow targeting. Start by judging available conversion signal and whether there is a clear audience that must be excluded.",
  "brand-campaign-lift": "Brand campaigns do not capture conversions through clicks, so estimate lift by comparing brand search and direct traffic against the pre-campaign trend. Without a control group, seasonality and PR mix in, so report it as an estimated lift alongside the other events in the window.",
  "budget-marginal-efficiency": "Budget decisions should use marginal efficiency—the outcome from the next unit of spend—not only average ROAS or CPA. If it cannot be estimated, test the next move in small increments.",
  "budget-scaling-limit": "Headroom is judged on marginal CPA—the cost of the next unit of spend—not on average CPA. When marginal CPA sits close to the average there is still room; when it rises well above the average the channel is already saturated and each added unit is expensive.",
  "campaign-anomaly-detection": "An anomaly becomes diagnosable when the changed component is decomposed, not merely observed. Review the date range, conversion volume, spend, and platform change history together.",
  "cannibalization-organic-paid": "Attribution data alone cannot prove whether paid ads created demand or captured existing organic demand. Use a counterfactual approach such as holdouts, geo tests, or trend comparisons.",
  "cohort-analysis-guide": "Cohort analysis groups users by a common starting point to see how many remain over time. Read cohort size and observation window alongside the average to avoid misreading recent cohorts.",
  "content-element-analysis": "Elements that travel together—hook, length, format—cannot be separated one at a time. Put them in simultaneously so each is compared with the others held level, then confirm only the top one or two with an experiment.",
  "correlation-vs-causation": "Correlation is the observation that two metrics moved together; causation is the claim that one produced the other. Moving together is not enough, and a decision needs a design—such as a control group or randomization—that rules out competing explanations.",
  "cpi-cpa-cpm-difference": "CPM is cost per thousand impressions and CPC is cost per click. When front-of-funnel cost changes, separate auction price from response, then use the metric chain for the full CPI, CPA, and ROAS choice.",
  "creative-attribute-regression": "When you cannot run an A/B test, turn the attributes of creatives you already served into columns and compare them at once. The delivery algorithm's selection bias is mixed in, so use it to narrow direction and confirm with an experiment.",
  "event-taxonomy-guide": "An event taxonomy is the agreement that lets GA4, an MMP, and ad platforms read the same user behavior with consistent names and properties. Define the event, trigger, owner, and validation method before naming it.",
  "funnel-dropoff-analysis": "Funnel analysis is not simply choosing the lowest conversion rate. Compare step-level denominators and user intent, then test one improvement hypothesis at a time.",
  "ga4-data-traps": "GA4 reports can differ when processing time, time zone, identity, or report scope differs. Align dates, measurement rules, and filters before treating a difference as an error.",
  "google-uac-optimization": "In Google app campaigns, the strongest levers are conversion events, measurement quality, budget stability, and creative supply. Read results with the learning period in mind after a change.",
  "hook-3-seconds-framework": "The first three seconds are where viewers decide whether to continue, but one formula will not fit every creative. Test messages and formats against actual drop-off data.",
  "incrementality-measurement": "Incrementality estimates the additional outcome caused by advertising, not merely attributed conversions. A comparable control group and pre-specified design determine whether the estimate is trustworthy.",
  "ios-att-skan-guide": "In the ATT and SKAdNetwork environment, iOS performance may not be visible at the same user level as before. Separate observable signals from possible missingness before assigning a cause to a change.",
  "ltv-cac-ratio": "LTV:CAC compares long-term customer value with acquisition cost. Even a familiar benchmark such as 3:1 is misleading unless customer scope, time window, and cost scope are aligned.",
  "marketing-mix-modeling": "Marketing mix modeling (MMM) models the relationship of channels, base demand, and external factors over time to estimate each channel's contribution. Treat it as observational evidence and interpret it alongside experiments.",
  "multicollinearity-mmm-guide": "High multicollinearity makes MMM unable to separate channel contribution reliably. Check VIF and linked channels first, then create independent budget movement or an experiment to strengthen the evidence.",
  "meta-advantage-plus-guide": "With Meta Advantage+ App campaigns, the main advertiser controls are the goal event, budget, creative, and measurement setup. Clear signals and creative experiments matter more than frequent edits that interrupt learning.",
  "offline-ad-online-impact": "TV and out-of-home impact is estimated from the difference in online demand between exposed and unexposed windows. A before-and-after comparison cannot separate other changes in the same window, so a regional holdout is far better whenever it is possible.",
  "performance-marketer-skills": "The core performance-marketing skills are problem definition, data-quality checks, experiment design, and interpretation—not memorizing platform controls. Automation makes the ability to explain a decision more valuable.",
  "performance-marketing-analysis-order": "Performance marketing analysis starts with the decision and the grain of the data, not the name of a method. Use daily performance for monitoring and variance decomposition, spend variation for saturation and allocation, a control for incrementality, and a 52+ week channel panel with a VIF check before MMM.",
  "performance-marketing-metrics": "Performance metrics need to connect cost, conversion, revenue, and retention to the business goal. CPA or ROAS alone cannot describe growth quality or long-term value.",
  "postback-integration-guide": "Troubleshoot postbacks in order: event definition, identifier transfer, send condition, and platform receipt. Zero received events do not automatically mean zero performance, so isolate each stage with logs.",
  "retargeting-reengagement-guide": "Retargeting addresses a different user state and goal from acquisition, so combining them can distort efficiency. Manage exclusion rules and incremental effect alongside attributed results.",
  "roas-improvement": "A ROAS decline is not a reason to cut budget from the average alone. Separate data maturity, channel efficiency, and post-conversion revenue, then validate the next unit of spend in small steps.",
  "uplift-holdout-guide": "Advertising uplift estimates the outcome an ad truly added from the difference between exposed and holdout groups. Do not scale on CPA alone; check absolute lift and uncertainty as well.",
};

const CONDITION_GROUP_BY_SLUG = {
  "ab-testing": "experiment", "aha-event-ad-optimization": "causal", "aha-moment-retention": "causal",
  "cannibalization-organic-paid": "causal", "correlation-vs-causation": "causal", "incrementality-measurement": "causal",
  "marketing-mix-modeling": "causal", "ad-creative-specs-guide": "platform", "ad-creative-testing": "creative", "ad-machine-learning": "platform",
  "multicollinearity-mmm-guide": "causal",
  "brand-campaign-lift": "causal", "offline-ad-online-impact": "causal", "budget-scaling-limit": "economics",
  "content-element-analysis": "creative", "creative-attribute-regression": "creative", "asa-keyword-expansion": "platform",
  "adjust-vs-appsflyer": "platform", "apple-search-ads-guide": "platform", "aso-basics-guide": "platform",
  "google-uac-optimization": "platform", "ios-att-skan-guide": "platform", "meta-advantage-plus-guide": "platform",
  "postback-integration-guide": "platform", "ad-performance-diagnosis": "measurement", "attribution-data-mismatch": "measurement",
  "campaign-anomaly-detection": "measurement", "cohort-analysis-guide": "measurement", "cpi-cpa-cpm-difference": "measurement",
  "event-taxonomy-guide": "measurement", "funnel-dropoff-analysis": "measurement", "ga4-data-traps": "measurement",
  "performance-marketing-metrics": "measurement", "budget-marginal-efficiency": "economics", "ltv-cac-ratio": "economics",
  "performance-marketing-analysis-order": "measurement",
  "audience-broad-vs-narrow": "creative", "hook-3-seconds-framework": "creative", "retargeting-reengagement-guide": "creative",
  "ai-era-marketer": "editorial", "performance-marketer-skills": "editorial",
  "roas-improvement": "economics",
  "uplift-holdout-guide": "causal",
};

const CONDITIONS = {
  ko: {
    experiment: "무작위 배정, 사전 종료 기준, 서로 독립인 관측치가 확보된 실험에 적용합니다. 표본이 작거나 중간 결과를 반복 확인했다면 판정을 보수적으로 해석하세요.",
    causal: "관측 데이터의 연관성만으로 인과를 확정할 수 없습니다. 대조군의 비교 가능성, 동시 변화, 표본 규모를 확인하고 중요한 결정은 실험으로 검증하세요.",
    platform: "매체 정책과 제품 기능은 바뀔 수 있습니다. 계정 유형·국가·측정 설정을 확인하고 집행 시점의 공식 문서를 최종 기준으로 사용하세요.",
    measurement: "같은 기간, 시간대, 전환 정의, 집계 단위를 맞춘 비교에 적용합니다. 모수와 누락 데이터를 확인하지 않은 비율 비교는 결론에서 제외하세요.",
    economics: "비용·매출·고객 범위와 관찰 기간을 동일하게 맞춘 데이터에 적용합니다. 미래 효율은 추정치이므로 작은 예산 단계로 검증하세요.",
    creative: "타깃, 지면, 메시지, 노출 빈도가 비슷한 조건의 비교에 적용합니다. 매체 평균보다 실제 계정의 전환량과 소재 실험 결과를 우선하세요.",
    editorial: "팀의 역할과 제품 단계에 따라 우선순위가 달라지는 편집 관점입니다. 채용 요건이나 조직 설계를 위한 보편적 기준으로 단정하지 마세요.",
  },
  en: {
    experiment: "This applies to experiments with random assignment, a pre-set stopping rule, and independent observations. Treat the result conservatively if the sample is small or repeatedly inspected mid-test.",
    causal: "Observational association alone does not establish causality. Check control-group comparability, simultaneous changes, and sample size, then validate consequential decisions with an experiment.",
    platform: "Platform policies and product behavior can change. Check account type, country, and measurement setup, and use the current official documentation as the final operating reference.",
    measurement: "This applies when date range, time zone, conversion definition, and aggregation grain are aligned. Exclude ratio comparisons whose denominator or missingness has not been checked.",
    economics: "Align cost, revenue, customer scope, and observation window. Future efficiency is an estimate, so validate it through small budget steps.",
    creative: "Compare like-for-like audiences, placements, messages, and frequency. Prefer conversion volume and creative-test evidence from the actual account over platform-wide averages.",
    editorial: "This is an editorial perspective whose priorities depend on team role and product stage. Do not treat it as a universal hiring or organization-design standard.",
  },
};

export function getBlogEditorial(locale, slug, source = {}) {
  const lang = locale === "en" ? "en" : "ko";
  const answer = source.answer || (lang === "en" ? EN_ANSWERS[slug] : KO_ANSWERS[slug]) || "";
  const conditionGroup = CONDITION_GROUP_BY_SLUG[slug] || "measurement";
  const conditions = source.conditions || CONDITIONS[lang][conditionGroup];
  return {
    answer,
    conditions,
    // 실제 검토 정보가 원고에 있을 때만 노출한다. 발행일을 검토일로 바꾸지 않는다.
    reviewer: source.reviewer || "",
    reviewedAt: source.reviewedAt || "",
    sources: Array.isArray(source.sources) ? source.sources.filter((item) => item?.title && item?.url) : [],
  };
}

export function publishedEditorialSlugs(locale) {
  return Object.keys(locale === "en" ? EN_ANSWERS : KO_ANSWERS)
    .filter((slug) => slug !== "adjust-vs-appsflyer");
}
