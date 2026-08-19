export const RESPONSE_SUBTOOL_IDS = ["5-18-paid-organic", "5-18-trend", "5-18-cannibal", "5-18-mmm", "5-18-forecast"];

const CONTENT = {
  "5-18-paid-organic": {
    ko: {
      h1: "Paid·Organic 변화맵",
      intro: "최근 주차일수록 진해지는 궤적으로 Paid와 Organic의 주간 움직임을 빠르게 확인합니다.",
      question: "광고를 늘렸는데 오가닉이 줄어든 것 같은데 맞나요?",
      answer: "Paid↑·Organic↓ 주가 반복되는지 한 궤적에서 봅니다. 한두 주는 근거가 아닙니다.",
      outputs: ["주간 WoW 궤적", "반대 방향 주차 수", "정밀 진단 필요 여부"],
      eyebrow: "Paid·Organic 변화 가이드",
      title: "정밀 모델을 실행하기 전에 반대 움직임이 반복되는지 먼저 보세요",
      lead: "Paid 성과가 늘고 Organic이 줄어드는 주가 반복되면 측정 이동이나 잠식 가능성을 더 확인할 이유가 생깁니다. 변화맵은 원인을 확정하지 않고, 정밀 진단으로 넘길 패턴을 빠르게 찾는 탐색 도구입니다.",
      detailsLabel: "변화맵의 범위와 다음 검증 보기",
      sections: [
        ["무엇을 보여주나", "주별 Organic WoW를 X축, Paid WoW를 Y축에 놓고 시간순으로 연결합니다. 오래된 주는 연하게, 최근 주는 진하게 표시합니다."],
        ["어떻게 읽나", "왼쪽 위는 Paid가 늘고 Organic이 줄어든 주입니다. 이런 움직임이 반복되는지 확인하되, 작은 등락과 한 번의 이상치는 잠식으로 단정하지 않습니다."],
        ["다음에는 무엇을 하나", "반대 움직임이 반복되면 지출·계절성·시차를 포함한 카니발 정밀 진단으로 이동합니다. 실제 인과 효과는 홀드아웃이나 증분 분석으로 검증합니다."],
      ],
      faq: [
        { q: "Organic 컬럼이 꼭 필요한가요?", a: "아닙니다. 전체 성과와 Paid 성과가 있으면 Organic을 전체−Paid로 계산할 수 있습니다." },
        { q: "왼쪽 위 점이 나오면 잠식인가요?", a: "아닙니다. 어트리뷰션 변경, 프로모션, 시즌성도 같은 모양을 만들 수 있어 정밀 진단이 필요합니다." },
      ],
    },
    en: {
      h1: "Paid · Organic Movement Map",
      intro: "Use a darker-is-newer weekly path to quickly inspect how Paid and Organic outcomes move together.",
      question: "Did Organic fall as I scaled Paid?",
      answer: "See whether Paid-up and Organic-down weeks repeat; one or two weeks prove nothing.",
      outputs: ["Weekly WoW path", "Opposite-move weeks", "Whether to dig deeper"],
      eyebrow: "Paid and Organic movement guide",
      title: "Look for repeated opposite movement before running a deeper model",
      lead: "Repeated weeks where Paid rises while Organic falls create a reason to inspect attribution movement or displacement. The map is an exploratory handoff, not a causal conclusion.",
      detailsLabel: "See the map's scope and next validation",
      sections: [
        ["What it shows", "Organic WoW is placed on the X axis and Paid WoW on the Y axis, connected in time. Older weeks are lighter and recent weeks are darker."],
        ["How to read it", "The upper-left quadrant contains weeks where Paid rose and Organic fell. Look for repetition; do not treat small movements or one unusual week as proof."],
        ["What to do next", "When the pattern repeats, continue to the detailed cannibalization diagnosis with spend, seasonality, and lag evidence. Validate causality with a holdout or incrementality study."],
      ],
      faq: [
        { q: "Do I need an Organic column?", a: "No. When Total and Paid outcomes are available, Organic can be calculated as Total minus Paid." },
        { q: "Does an upper-left point prove cannibalization?", a: "No. Attribution changes, promotions, and seasonality can produce the same shape, so deeper validation is required." },
      ],
    },
  },
  "5-18-trend": {
    ko: {
      h1: "마케팅 추세·계절성 분석",
      intro: "광고 효과를 판단하기 전에 자연 추세, 계절성, 이상 주차를 분리해 비교 기준선을 만듭니다.",
      question: "성과 변화가 광고 때문인지 어떻게 아나요?",
      answer: "자연 추세와 계절성을 먼저 분리해 기준선을 만들고, 그 위에 남는 변화만 봅니다.",
      outputs: ["주간 기준선·추세", "반복되는 계절 패턴", "기준 밖 이상 주차"],
      eyebrow: "추세 분석 가이드",
      title: "광고 성과 변화와 원래 움직이던 추세를 먼저 구분하세요",
      lead: "매출이나 전환이 함께 움직였다는 사실만으로 광고 효과를 확정할 수 없습니다. 주간 기준선과 계절성을 먼저 분리하면 이후 잠식 진단·MMM·예측이 같은 일시적 변동을 광고 효과로 오해할 가능성이 줄어듭니다.",
      detailsLabel: "기준선 계산과 해석 방법 보기",
      sections: [
        ["언제 써야 하나", "프로모션·공휴일·시즌 변화가 크거나 광고비를 바꾼 시점과 성과 변동 시점이 겹칠 때 사용합니다. 최소 여러 주의 연속 데이터가 있어야 요일·주차 패턴과 장기 추세를 구분할 수 있습니다."],
        ["무엇을 확인하나", "원자료와 평활 추세, 반복되는 계절 패턴, 기준선에서 크게 벗어난 이상 주차를 함께 봅니다. 추세선은 광고가 원인이라는 결론이 아니라 다음 분석이 비교할 기준입니다."],
        ["결과를 어떻게 쓰나", "이상 주차의 데이터 누락과 이벤트를 먼저 확인하고, 설명되지 않은 변화만 잠식 진단이나 MMM으로 넘기세요. 미래예측에서는 같은 기간 정의와 목표 지표를 유지해야 합니다."],
      ],
      faq: [
        { q: "일별 데이터도 사용할 수 있나요?", a: "가능합니다. 일별 데이터는 주간 단위로 정리해 요일 노이즈를 줄인 뒤 추세와 계절성을 비교합니다." },
        { q: "추세가 광고 효과를 증명하나요?", a: "아닙니다. 추세 분석은 기준선과 이상 구간을 찾는 탐색 단계이며, 광고의 인과 효과는 홀드아웃이나 증분 분석으로 검증해야 합니다." },
      ],
    },
    en: {
      h1: "Marketing trend and seasonality analysis",
      intro: "Separate baseline trend, seasonality, and unusual weeks before attributing a performance change to advertising.",
      question: "How do I know whether a change came from marketing?",
      answer: "Separate trend and seasonality first, then read only what is left above that baseline.",
      outputs: ["Weekly baseline", "Seasonal pattern", "Outlier weeks"],
      eyebrow: "Trend analysis guide",
      title: "Separate advertising movement from the trend already in motion",
      lead: "A simultaneous change in spend and outcomes does not prove advertising impact. Establishing the weekly baseline and seasonal pattern first reduces the chance that cannibalization, MMM, or forecasting treats a temporary swing as media contribution.",
      detailsLabel: "See how to build and interpret the baseline",
      sections: [
        ["When to use it", "Use it when promotions, holidays, or seasonal demand overlap with a spend change. Several continuous weeks are needed to distinguish recurring patterns from longer-term movement."],
        ["What to inspect", "Compare the raw series, smoothed trend, recurring seasonal pattern, and weeks that depart materially from the baseline. The trend is a reference for the next analysis, not proof of advertising causality."],
        ["How to act", "Check missing data and known events for unusual weeks, then pass only unexplained movement to cannibalization diagnosis or MMM. Keep the same period definition and outcome when moving into forecasting."],
      ],
      faq: [
        { q: "Can I use daily data?", a: "Yes. Daily rows are aggregated to a weekly view to reduce day-of-week noise before trend and seasonality are compared." },
        { q: "Does a trend prove advertising impact?", a: "No. Trend analysis finds a baseline and unusual periods. Use a holdout or incrementality analysis to test causal advertising impact." },
      ],
    },
  },
  "5-18-cannibal": {
    ko: {
      h1: "광고 카니발라이제이션 진단",
      intro: "유료 성과가 늘 때 오가닉·브랜드 성과가 줄었는지 네 가지 신호로 점검하고 검증할 채널을 좁힙니다.",
      question: "유료 광고가 오가닉 성과를 잠식하고 있나요?",
      answer: "지출·시차·상관 네 신호로 점검합니다. 신호가 모여도 인과는 홀드아웃으로 확인합니다.",
      outputs: ["잠식 신호 4종 판정", "채널별 의심 순위", "홀드아웃 후보"],
      eyebrow: "잠식 진단 가이드",
      title: "유료 광고가 신규 성과를 만들었는지 기존 수요를 가져왔는지 점검하세요",
      lead: "네트워크 어트리뷰션이 늘어도 전체 수요가 그대로라면 광고가 원래 발생할 오가닉 성과를 가져왔을 수 있습니다. 이 진단은 시차·반대 움직임·채널 중첩·모델 적합도를 함께 읽어 홀드아웃이 필요한 채널을 선별합니다.",
      detailsLabel: "잠식 신호와 검증 순서 보기",
      sections: [
        ["언제 써야 하나", "브랜드 검색·오가닉 가입이 줄었는데 유료 전환만 늘었을 때, 리타겟팅이나 브랜드 캠페인을 확대하기 전, 라스트클릭 ROAS가 전체 매출 변화와 맞지 않을 때 사용합니다."],
        ["무엇을 확인하나", "지출 변화 뒤의 시차 반응, 유료와 오가닉의 반대 움직임, 채널끼리 비슷하게 움직이는 정도, 모델이 실제 추이를 설명하는 정도를 함께 봅니다. 한 신호만으로 잠식이라고 단정하지 않습니다."],
        ["결과를 어떻게 쓰나", "의심 채널을 바로 끄지 말고 지역·오디언스·기간 중 하나를 통제군으로 남겨 순수 증분을 확인하세요. 데이터가 짧거나 채널이 함께 움직이면 예산 이동보다 추가 관측이 우선입니다."],
      ],
      faq: [
        { q: "잠식 의심은 광고를 중단하라는 뜻인가요?", a: "아닙니다. 관측 신호는 실험 후보를 고르는 근거입니다. 일부 구간을 통제군으로 남겨 전체 성과의 순수 증분을 확인한 뒤 예산을 조정하세요." },
        { q: "유료와 오가닉이 반대로 움직이면 잠식이 확정되나요?", a: "확정되지 않습니다. 계절성, 프로모션, 측정 변경도 같은 패턴을 만들 수 있으므로 추세 점검과 홀드아웃 검증이 필요합니다." },
      ],
    },
    en: {
      h1: "Ad cannibalization diagnosis",
      intro: "Check four signals that paid outcomes may be replacing organic or branded demand, then narrow the channels that need validation.",
      question: "Is paid advertising displacing organic outcomes?",
      answer: "Four signals check it; even when they line up, causality needs a holdout test.",
      outputs: ["Four displacement signals", "Channels ranked by suspicion", "Holdout candidates"],
      eyebrow: "Cannibalization guide",
      title: "Check whether paid media created outcomes or captured existing demand",
      lead: "A lift in attributed conversions can occur while total demand stays flat. This diagnosis combines lag, paid-organic movement, channel overlap, and model fit to prioritize the channels that deserve a holdout test.",
      detailsLabel: "See the signals and validation sequence",
      sections: [
        ["When to use it", "Use it when paid conversions rise while organic or branded outcomes weaken, before scaling retargeting or brand campaigns, or when last-click ROAS does not match total business movement."],
        ["What to inspect", "Review delayed response after spend changes, movement against organic outcomes, similarity across channel patterns, and how well the model follows the observed series. No single signal confirms cannibalization."],
        ["How to act", "Do not switch off a suspect channel immediately. Keep a controlled slice by geography, audience, or time and measure the incremental outcome. When data is short or channels move together, collect more evidence before reallocating budget."],
      ],
      faq: [
        { q: "Does a cannibalization signal mean I should stop the campaign?", a: "No. It identifies a test candidate. Preserve a control slice and measure the incremental outcome before changing the budget." },
        { q: "Does opposite paid and organic movement prove cannibalization?", a: "No. Seasonality, promotions, and measurement changes can create the same pattern, so trend checks and a holdout are still required." },
      ],
    },
  },
  "5-18-mmm": {
    ko: {
      h1: "MMM 채널 기여도 분석",
      intro: "채널 지출, 기본 수요, 이벤트가 성과와 어떻게 연결됐는지 마케팅 믹스 모델로 분해합니다.",
      question: "각 채널이 성과를 얼마나 만들었나요?",
      answer: "주간 지출·성과 패널에 adstock·포화를 넣어 채널·기본 수요·이벤트 몫으로 나눕니다.",
      outputs: ["채널별 기여 분해", "기본 수요 대비 몫", "채널별 한계 효율"],
      eyebrow: "MMM 기여 분석 가이드",
      title: "광고 채널과 기본 수요의 기여를 같은 기준으로 분해하세요",
      lead: "MMM은 주간 집계 데이터에서 채널 지출의 잔류효과와 포화를 반영해 성과 기여를 추정합니다. 라스트클릭과 달리 채널·시즌·이벤트를 함께 보지만, 관측 데이터 모델이므로 인과 효과를 확정하지는 않습니다.",
      detailsLabel: "모델 조건과 안전한 해석 보기",
      sections: [
        ["언제 써야 하나", "여러 채널을 장기간 함께 운영했고 사용자 단위 귀속이 불완전할 때, 중기 예산 방향과 기본 수요를 함께 보고 싶을 때 사용합니다. 계절을 구분할 수 있는 충분한 주차가 중요합니다."],
        ["무엇을 확인하나", "채널별 adstock·포화 반응, 기본 수요와 이벤트 기여, 계수의 불확실성, 실제값과 적합값의 차이를 함께 봅니다. 공선성이 높으면 채널별 절대 기여를 분리하지 않습니다."],
        ["결과를 어떻게 쓰나", "기여 순위는 다음 예산 가설로 사용하고 작은 증액 실험으로 검증하세요. 단기 캠페인 배분은 예산 배분 시뮬레이터를, 순수 인과 효과는 증분 분석을 사용합니다."],
      ],
      faq: [
        { q: "MMM 결과가 채널의 인과 기여도인가요?", a: "아닙니다. 관측 데이터에서 추정한 조건부 연관입니다. 실제 증분 효과는 홀드아웃이나 지역 실험으로 확인해야 합니다." },
        { q: "데이터는 얼마나 필요한가요?", a: "주간 데이터는 최소 52주를 권장합니다. 계절성과 채널 변동이 충분하지 않으면 기여도 분리가 불안정해집니다." },
      ],
    },
    en: {
      h1: "MMM channel contribution analysis",
      intro: "Decompose how channel spend, base demand, and events relate to outcomes with a marketing mix model.",
      question: "How much did each channel contribute to the outcome?",
      answer: "Adstock and saturation split the panel into channel, base demand, and event shares.",
      outputs: ["Channel contribution split", "Base-demand share", "Marginal efficiency"],
      eyebrow: "MMM contribution guide",
      title: "Estimate media and base-demand contribution on one consistent basis",
      lead: "MMM uses weekly aggregate data to estimate contribution while accounting for carryover and saturation. It evaluates channels, seasonality, and events together, but remains an observational model rather than causal proof.",
      detailsLabel: "See model requirements and interpretation safeguards",
      sections: [
        ["When to use it", "Use it when several channels have run together for a long period, user-level attribution is incomplete, and you need a medium-term view of media and base demand. Enough weeks to identify seasonality are essential."],
        ["What to inspect", "Review channel adstock and saturation, base-demand and event contribution, coefficient uncertainty, and the gap between fitted and observed outcomes. Do not force channel-level attribution when multicollinearity is high."],
        ["How to act", "Use the contribution ranking as a budget hypothesis and validate it with a small spend test. Use Budget Allocation for short-term campaign moves and Incrementality for causal impact."],
      ],
      faq: [
        { q: "Is MMM contribution causal?", a: "No. It is a conditional association estimated from observational data. Confirm incremental impact with a holdout or geo experiment." },
        { q: "How much data do I need?", a: "At least 52 weeks of weekly data is recommended. Limited seasonal or channel variation makes contribution estimates unstable." },
      ],
    },
  },
  "5-18-forecast": {
    ko: {
      h1: "마케팅 회귀·미래예측",
      intro: "과거 데이터로 다음 기간을 예측하고, 학습에 쓰지 않은 봉인 구간에서 오차와 불확실성을 확인합니다.",
      question: "다음 기간 성과는 얼마나 나올까요?",
      answer: "예측 전용 회귀로 다음 구간을 추정하고, 봉인 OOS 검증으로 믿을 만한지 함께 냅니다.",
      outputs: ["기간별 예측값·구간", "봉인 OOS 검증 결과", "시나리오별 비교"],
      eyebrow: "회귀 예측 가이드",
      title: "예측값보다 먼저 학습 밖 데이터에서 오차를 확인하세요",
      lead: "미래예측은 과거 관계가 다음 기간에도 유지된다는 가정 위에 있습니다. 학습 구간과 검증 구간을 분리하고 예측 범위를 함께 제시해, 그럴듯한 한 점 예측보다 실제 운영에 사용할 수 있는 불확실성을 보여줍니다.",
      detailsLabel: "예측 조건과 검증 기준 보기",
      sections: [
        ["언제 써야 하나", "다음 몇 주의 성과 범위를 계획하거나 예산 시나리오를 비교할 때 사용합니다. 목표 지표 정의와 집계 주기가 과거와 미래에 동일해야 합니다."],
        ["무엇을 확인하나", "학습에 사용하지 않은 OOS 구간의 오차, 실제값이 예측 범위 안에 들어오는 비율, 변수 누락과 구조 변화 신호를 봅니다. 적합도가 높아도 봉인 검증이 나쁘면 미래값을 사용하지 않습니다."],
        ["결과를 어떻게 쓰나", "중앙 예측 하나가 아니라 하한·상한 범위로 목표와 예산 여유를 잡으세요. 실제값이 들어오면 같은 기간 정의로 기록해 다음 검토에서 예측 오차를 채점합니다."],
      ],
      faq: [
        { q: "예측값이 실제 성과를 보장하나요?", a: "아닙니다. 과거 패턴을 바탕으로 한 범위 추정입니다. 시장·가격·캠페인 구조가 바뀌면 오차가 커질 수 있습니다." },
        { q: "봉인 OOS 검증은 왜 필요한가요?", a: "모델이 이미 본 데이터를 잘 맞추는 것과 미래를 맞추는 것은 다릅니다. 학습에 쓰지 않은 기간으로 일반화 오차를 확인해야 과적합을 걸러낼 수 있습니다." },
      ],
    },
    en: {
      h1: "Marketing regression and forecasting",
      intro: "Forecast the next period, then inspect error and uncertainty on a sealed window that was not used for training.",
      question: "What will next period's performance look like?",
      answer: "Forecast-only regression estimates the next window; sealed OOS validation checks it.",
      outputs: ["Period forecast and band", "Sealed OOS result", "Scenario comparison"],
      eyebrow: "Forecasting guide",
      title: "Validate error on unseen data before trusting the forecast",
      lead: "A forecast assumes that historical relationships continue into the next period. Separating training and validation windows and showing an interval makes uncertainty usable, instead of presenting one precise-looking number.",
      detailsLabel: "See forecast requirements and validation checks",
      sections: [
        ["When to use it", "Use it to plan a range for the next few weeks or compare budget scenarios. The outcome definition and aggregation period must remain consistent between historical and future data."],
        ["What to inspect", "Review error on the sealed OOS window, interval coverage, omitted-variable risk, and signs of structural change. Do not use a future estimate when sealed validation is poor, even if in-sample fit looks strong."],
        ["How to act", "Plan targets and budget headroom from the lower and upper bounds, not only the midpoint. When actuals arrive, record them on the same period basis and score forecast error in the next review."],
      ],
      faq: [
        { q: "Does the forecast guarantee future performance?", a: "No. It is a range estimated from historical patterns. Market, pricing, or campaign-structure changes can increase error." },
        { q: "Why use a sealed OOS validation window?", a: "Fitting data the model has already seen is not the same as forecasting. An unseen period reveals generalization error and helps detect overfitting." },
      ],
    },
  },
};

export function getResponseSubtoolContent(toolId, locale = "ko") {
  return CONTENT[toolId]?.[locale === "en" ? "en" : "ko"] || null;
}

export function isResponseSubtool(toolId) {
  return RESPONSE_SUBTOOL_IDS.includes(toolId);
}
