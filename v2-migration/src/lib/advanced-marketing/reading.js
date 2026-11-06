// Editorial explanations only. Field lists, options and calculations stay in their existing contracts.
const p = (ko, en) => ({ ko, en });
export const ADVANCED_READING = {
  "5-32": {
    method: p("구매와 환불을 거래 ID로 구분한 뒤 고객별 최근 구매일·주문 횟수·순매출을 집계합니다. 획득 코호트는 같은 관측 길이로 맞추고, 누적 공헌이익이 획득비를 회수한 뒤 다시 밑돌았는지도 확인합니다.", "Separate purchases and refunds by transaction ID, then aggregate recency, order frequency and net revenue per customer. Compare acquisition cohorts at equal horizons and check whether contribution falls below acquisition cost after recovery."),
    check: p("RFM 순위와 회수 여부를 함께 읽으세요. 매출이 높은 고객도 환불·변동비·획득비를 반영하면 미회수일 수 있습니다. 관측이 짧은 코호트와 장기 고객의 누적 금액을 바로 비교하지 마세요.", "Read RFM alongside cost recovery. A high-revenue customer can remain unrecovered after refunds, variable costs and acquisition cost. Do not compare short-lived cohorts with long-observed customers on cumulative amounts."),
    prep: p("환불을 원주문에 연결하고 거래 ID는 중복 없이 유지하세요. 획득비의 고객별 귀속과 첫 구매 이전 이력의 누락 여부를 확인하세요.", "Link refunds to the original order and keep transaction IDs unique. Check customer-level acquisition-cost attribution and whether purchases before the first recorded order are missing."),
  },
  "5-33": {
    method: p("사용자 안에서 시각을 정렬하고 설정한 순서와 관측 창을 모두 충족한 경우에만 퍼널을 완료로 셉니다. 리텐션은 누적 재방문율이 아니라 정확한 D1·D7·D30 날짜의 재방문이며, 해당 날짜까지 관측한 사용자만 분모에 넣습니다.", "Order events within each user and count funnel completion only when both the declared order and window are satisfied. Retention measures returns on exact D1, D7 and D30 days, rather than cumulative returns; only fully observed users enter each denominator."),
    check: p("단계별 사용자 수와 관측 완료 분모를 먼저 확인하세요. D30 분모가 D1보다 작을 수 있으며, 같은 시각의 가입·구매는 선후관계를 증명하지 못합니다. 이벤트 수를 사용자 수로 해석하지 마세요.", "Inspect step-level user counts and mature denominators first. D30 may have fewer eligible users than D1; simultaneous signup and purchase events do not prove order. Event counts are not user counts."),
    prep: p("event_time은 2026-01-01T09:00:00+09:00처럼 시간대를 포함하세요. 날짜만 있으면 분석이 중단됩니다. user_id는 필수이며 여러 기기의 사용자를 연결하는 기준을 먼저 정하세요.", "Use a timezone-qualified event_time such as 2026-01-01T09:00:00+09:00. Date-only values stop analysis. user_id is required; define how users are linked across devices before exporting."),
  },
  "5-34": {
    method: p("동일한 배정 단위에서 원시 평균 차이와 사전 지표를 보정한 ANCOVA2 차이를 비교합니다. HC3 표준오차와 배정 비율 진단을 함께 제공하므로, 보정 후 점추정치뿐 아니라 구간 폭과 표본 구성을 확인할 수 있습니다.", "Compare the raw difference with pre-treatment ANCOVA2 adjustment on the same assigned units. HC3 uncertainty and allocation diagnostics let you inspect interval width and sample composition as well as the adjusted point estimate."),
    check: p("원시·보정 구간을 나란히 읽고 배정 비율 이상을 먼저 점검하세요. 구간이 좁아졌다고 효과가 커진 것은 아닙니다. 처치 후 행동을 사전 공변량에 넣거나 유리한 공변량만 고르면 해석이 무너집니다.", "Read raw and adjusted intervals together and check allocation imbalance first. A narrower interval is not a larger effect. Post-treatment covariates or selecting favorable covariates undermine interpretation."),
    prep: p("한 배정 단위당 한 행으로 합치고, baseline은 실험 시작 전에 관측한 같은 정의의 지표로 준비하세요. 무작위 배정 여부와 계획 배정 비율을 확인하세요.", "Aggregate to one row per assignment unit. Prepare baseline using the same metric definition before treatment, and confirm random assignment and the planned allocation probability."),
  },
  "5-35": {
    method: p("학습 종료일에서 거래를 나누어 BG/NBD로 구매 횟수, Gamma–Gamma로 양수 주문금액을 추정합니다. 학습에 쓰지 않은 이후 기간의 실제 구매와 예측을 비교하고, 선언한 공헌이익률로 고객가치를 환산합니다.", "Split the ledger at calibration end, estimate purchase frequency with BG/NBD and positive order value with Gamma–Gamma, then compare forecasts with later purchases excluded from fitting. Convert value using the declared contribution rate."),
    check: p("고객 순위보다 홀드아웃 오차와 적합 상태를 먼저 보세요. 예측 총액은 보장 매출이 아니며 평균 추정 구간을 개인 고객의 미래 범위로 읽을 수 없습니다. 구독 갱신 자료에는 이 비계약 구매 모형을 그대로 적용하지 마세요.", "Check holdout error and fit status before customer rankings. Forecast totals are not guaranteed revenue, and mean-estimation intervals are not individual future ranges. Do not apply this noncontractual model directly to subscription renewals."),
    prep: p("첫 구매부터의 이력을 준비하고 학습 종료일 뒤에 별도 평가 기간을 남기세요. 환불과 변동비를 보존하고 통화·주문금액 정의를 통일하세요.", "Start history at the first purchase and reserve a later evaluation period. Preserve refunds and variable costs, and use consistent currency and order-value definitions."),
  },
  "5-36": {
    method: p("처치 이전 기간에서 대조 지역의 가중치를 맞추고 사전 검증 구간에서 적합을 확인합니다. 처치 이후 실제 값과 합성 대조의 차이를 계산하고, 다른 지역을 가상 처치한 위약 결과와 비교합니다.", "Fit donor weights before treatment and check fit on a pre-treatment validation window. Compare post-treatment outcomes with the synthetic control, then contrast the gap with placebo treatments assigned to other regions."),
    check: p("사전 적합 오차와 위약 순위를 먼저 읽으세요. 적은 대조 지역에서 나온 순위는 정밀한 확률이 아닙니다. 지역 간 광고 누출이나 같은 날의 가격·유통 변화가 있으면 광고만의 효과로 단정할 수 없습니다.", "Inspect pre-treatment error and placebo rank first. With few donor regions, rank is not a precise probability. Spillovers or simultaneous pricing and distribution changes prevent attributing the gap solely to advertising."),
    prep: p("모든 지역에 같은 날짜 범위의 일별 행을 채우세요. 빈 날짜를 0으로 바꾸지 말고 원천 자료에서 확인하세요. 처치 지역과 시작일은 결과를 보기 전에 정하세요.", "Provide the same daily date range for every region. Investigate missing dates instead of replacing them with zero. Declare the treated region and intervention date before inspecting results."),
  },
  "5-37": {
    method: p("학습 표본에서 처치 전 세그먼트별 증분 반응을 추정해 타깃 순서를 정합니다. 별도 평가 표본에서는 그 순서를 고정해 AIPW 정책가치와 순가치를 비교하므로 학습 자료에서 고른 승자를 같은 자료로 평가하지 않습니다.", "Learn segment-level incremental response and targeting order on training data. Freeze that order on a separate evaluation sample to compare AIPW policy value and net value, avoiding evaluation on the data that selected the policy."),
    check: p("평가 표본의 정책가치·구간과 비용 가정을 확인하세요. 반응률이 높은 세그먼트가 증분 효과도 높은 것은 아닙니다. 표본이 적거나 처치 확률이 극단적인 세그먼트는 불안정할 수 있습니다.", "Read evaluation-sample policy value, uncertainty and cost assumptions. High response is not necessarily high incremental response. Small segments or extreme treatment probabilities can be unstable."),
    prep: p("unit_id를 중복 없이 두고 train과 evaluation을 분리하세요. 세그먼트는 발송·처치 이전 정보로 만들고, 미반응자도 outcome=0인 행으로 포함하세요.", "Keep unit_id unique and separate train from evaluation. Define segments before treatment and include nonresponders as rows with outcome=0."),
  },
  "5-38": {
    method: p("딜별 단계 변경을 시간순으로 이어 붙여 최초 유입 코호트의 기간 내 첫 수주율을 계산합니다. 단계 후퇴와 재개를 별도로 다루고, 현재 단계에 머문 시간에는 관측 종료일까지 미종결인 딜을 포함합니다.", "Reconstruct each deal’s stage history to calculate first-win rates within the declared acquisition-cohort horizon. Distinguish regressions and reopenings; time in the current stage includes deals still open at observation end."),
    check: p("현재 수주 건수와 관측 완료 코호트의 수주율을 구분하세요. 미종결 딜을 실패로 확정하면 최근 유입 채널이 불리해집니다. 금액을 가중한 파이프라인은 인식 매출과 다릅니다.", "Separate current won counts from mature-cohort win rates. Treating open deals as final failures disadvantages recent acquisition channels. An amount-weighted pipeline is not recognized revenue."),
    prep: p("현재 상태만 내보내지 말고 단계 변경 이력을 준비하세요. event_time은 2026-01-01T09:00:00+09:00처럼 시간대까지 포함해야 하며 날짜만으로는 순서를 판정하지 않습니다.", "Export stage changes rather than current status alone. event_time must include a timezone, for example 2026-01-01T09:00:00+09:00; dates alone cannot establish order."),
  },
  "5-39": {
    method: p("선택 과제 안의 대안들을 조건부 로짓으로 비교해 가격·속성 계수를 적합합니다. 응답자를 학습·평가로 나누고, 평가 과제의 선택 확률과 오차를 확인한 뒤 가격 계수에 대한 지불의향 비율을 읽습니다.", "Fit price and attribute coefficients using conditional logit within choice tasks. Separate respondents into training and evaluation, inspect held-out choice probabilities and error, then read willingness-to-pay ratios against the price coefficient."),
    check: p("가격 계수의 부호·불확실성과 홀드아웃 성능을 먼저 보세요. 가격 반응이 식별되지 않으면 지불의향을 숫자로 확정할 수 없습니다. 설문 내 선택 확률은 실제 시장점유율이 아닙니다.", "Check price-coefficient sign, uncertainty and held-out performance first. Unidentified price response cannot support a definite willingness-to-pay value. Survey choice probability is not real market share."),
    prep: p("1행은 응답자×과제×대안입니다. 각 과제에 chosen=1이 정확히 하나 있어야 합니다. 같은 응답자를 학습과 평가 양쪽에 넣지 말고 속성 코딩과 가격 통화를 통일하세요.", "Use one row per respondent, task and alternative, with exactly one chosen=1 per task. Keep respondents out of both splits and use consistent attribute coding and price currency."),
  },
  "5-40": {
    method: p("독립 배정 단위별 순매출에서 변동비를 빼고 처치·대조군의 평균 공헌이익 차이를 계산합니다. 구매하지 않은 단위도 분모에 남겨 할인으로 늘어난 매출과 실제 이익 증가를 구분합니다.", "Subtract variable cost from net revenue for each independent assignment unit, then compare mean contribution between treatment and control. Keep nonbuyers in the denominator to distinguish sales growth from incremental profit."),
    check: p("매출 차이와 공헌이익 차이를 함께 읽으세요. 할인 때문에 매출이 늘어도 이익은 줄 수 있습니다. 반품·혜택 비용의 반영 범위와 배정 비율 진단을 확인한 뒤 확대 여부를 결정하세요.", "Read revenue and contribution differences together: discounts can raise sales while reducing profit. Check returns, benefit-cost coverage and allocation diagnostics before scaling."),
    prep: p("비구매자도 매출·변동비 0인 행으로 포함하세요. unit_id는 배정 단위와 같아야 하고, 순매출에 이미 반영한 할인액을 비용에서 다시 빼지 마세요.", "Include nonbuyers with zero revenue and variable cost. Match unit_id to the assignment unit and avoid subtracting discounts again when net revenue already includes them."),
  },
  "5-41": {
    method: p("같은 주문의 상품을 묶고 상품쌍의 동시 구매 빈도로 지지도·신뢰도·향상도를 계산합니다. 같은 주문 안의 중복 상품을 독립 구매로 늘리지 않으며, 규칙 방향에 따라 신뢰도의 분모가 달라집니다.", "Group products by order and compute pair support, confidence and lift from co-purchases. Repeated items within an order do not become independent baskets, and confidence uses a different denominator for each rule direction."),
    check: p("향상도가 높은 규칙도 주문 수와 지지도를 먼저 보세요. 드문 상품쌍의 높은 비율은 불안정할 수 있습니다. 함께 산다는 사실만으로 추천 배너가 추가 구매를 일으킨다고 말할 수 없습니다.", "Check order counts and support even for high-lift rules. Rare pairs can have unstable ratios. Co-purchase alone does not prove a recommendation banner causes extra purchases."),
    prep: p("주문×상품별로 행을 준비하고 취소 주문 포함 기준을 맞추세요. 상품명보다 안정적인 product_id를 쓰고, 다른 주문의 상품을 같은 바구니로 합치지 마세요.", "Prepare order-by-product rows and align cancellation rules. Use stable product_id values and never merge products from separate orders into one basket."),
  },
  "5-42": {
    method: p("채널·기간별 빈도 구간의 audience_count를 합쳐 도달과 노출, 평균 빈도를 구합니다. 공통 사용자 식별자가 없는 히스토그램은 채널 사이 중복을 제거할 수 없으므로 합산 도달을 확정하지 않습니다.", "Sum frequency-bin audience_count within each channel and period to derive reach, impressions and mean frequency. Histograms without common user identity cannot deduplicate across channels, so combined reach remains unidentified."),
    check: p("채널 내부의 빈도 분포와 과다 노출 구간부터 확인하세요. 채널별 도달 합계를 전체 순도달로 읽지 마세요. 중복을 알 수 없는 상태는 0명 중복이라는 뜻이 아닙니다.", "Inspect within-channel frequency and high-exposure bins first. The sum of channel reach is not total unique reach. Unknown overlap does not mean zero overlap."),
    prep: p("같은 기간의 서로 겹치지 않는 정수 빈도 구간과 인원수를 준비하세요. 플랫폼마다 도달·사용자 정의가 같은지 확인하고 공통 식별자가 없으면 해당 조건을 선택하지 마세요.", "Provide nonoverlapping integer-frequency bins and audience counts for the same period. Check platform audience definitions and do not claim common identity when it is unavailable."),
  },
  "5-43": {
    method: p("날짜·채널별로 무효 클릭 비율과 전환율을 계산하고 과거 분포에 비해 특이한 날짜를 표시합니다. 원천 자료가 집계값이므로 개별 클릭의 유효성이나 전환의 진위를 판별하지는 않습니다.", "Calculate invalid-click rates and conversion rates by date and channel, flagging dates unusual relative to historical distribution. Aggregate data cannot establish whether an individual click or conversion is genuine."),
    check: p("이상 날짜의 클릭 수·무효 클릭·전환을 원천 로그와 대조하세요. 이상 신호는 조사 우선순위이며 부정 트래픽 확정 판정이 아닙니다. 태깅 변경과 전환 지연도 확인하세요.", "Compare flagged dates’ clicks, invalid clicks and conversions with source logs. Flags prioritize investigation rather than confirm fraud. Also check tagging changes and conversion delay."),
    prep: p("일별 날짜와 채널을 같은 시간대·집계 기준으로 맞추세요. invalid_clicks는 clicks의 부분집합이어야 합니다. 누락 날짜와 실제 클릭 0인 날짜를 구분하세요.", "Align daily dates and channels to the same timezone and aggregation rules. invalid_clicks must be a subset of clicks. Distinguish missing dates from observed zero-click dates."),
  },
};
