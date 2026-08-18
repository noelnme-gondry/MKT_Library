// 방법 비교 페이지(`/compare/<slug>`)의 SSOT.
//
// 왜 "브랜드 vs 브랜드"가 아니라 "방법 vs 방법"인가:
// 마케터가 실제로 묻는 것은 "A툴이랑 B툴 중 뭐가 나아요"보다 "증분 실험이랑 MMM 중
// 뭘 먼저 해야 하나요"에 가깝다. 그리고 우리가 검증할 수 없는 남의 제품 사양을
// 표로 단정하는 건 §8 정직성에 어긋난다. 방법 비교는 우리가 근거를 댈 수 있고,
// 답이 곧 도구 선택으로 이어진다.
//
// 각 페이지 구조:
//  - question/answer : 예상 질문과 한 문장 답. **본문 맨 앞**에 두고 FAQ JSON-LD의
//                      첫 항목으로도 쓴다(답을 앞에 두는 것이 이 페이지의 목적).
//  - table           : 비교표. 표는 추출 단위가 명확해 인용에 강하다.
//  - guidance        : "이럴 때는 이것" 목록. 표만으로는 결론이 안 나온다.
//  - faq             : 3개. 도구 롱폼과 같은 형식이라 JSON-LD 생성기를 공유한다.
//  - toolIds         : 관련 도구. 링크와 라벨은 routeSeo에서 파생한다(하드코딩 금지).

const CONTENT = {
  "incrementality-methods": {
    toolIds: ["5-23", "5-24", "5-4"],
    ko: {
      eyebrow: "방법 비교",
      title: "증분 측정 3가지 방법 비교 — 홀드아웃·온오프·ITS",
      question: "광고의 증분 효과는 어떤 방법으로 측정하나요?",
      answer: "통제군 홀드아웃이 가장 정확합니다. 불가능하면 전후 비교나 ITS를 씁니다.",
      lead: "증분은 광고가 실제로 만들어낸 몫입니다. 측정 방법은 크게 셋입니다. 무작위 통제군을 두는 홀드아웃, 캠페인을 켜거나 끄고 전후를 보는 방식, 그리고 시계열 개입 분석(ITS)입니다. 정확도 순서는 분명하지만 실행 난이도도 같은 순서입니다.",
      table: {
        caption: "증분 측정 방법 비교",
        columns: ["방법", "설계", "인과 주장", "필요 조건", "주의점"],
        rows: [
          ["통제군 홀드아웃", "동시·무작위로 광고 노출 집단과 미노출 집단을 나눔", "가능", "매체의 홀드아웃 기능 또는 지역 분할", "표본이 작으면 구간이 넓어 결론이 안 남"],
          ["신규 켜기 / 종료", "캠페인 시작·중단 전후를 비교", "제한적", "개입 시점과 충분한 전후 기간", "같은 시기의 시즌·프로모션이 섞임"],
          ["ITS (시계열 개입)", "개입 전 추세를 연장해 반사실을 추정", "제한적", "개입 전 관측치 다수와 안정적 추세", "자기상관을 보정하지 않으면 구간이 과소추정됨"],
        ],
      },
      guidance: [
        ["매체가 홀드아웃을 지원한다면", "홀드아웃을 씁니다. 무작위 배정이 있어야 인과를 주장할 수 있습니다."],
        ["브랜드 캠페인처럼 끌 수 없는 경우", "ITS로 개입 전 추세를 연장해 비교합니다. 자기상관 보정이 필요합니다."],
        ["예산이 적어 통제군을 못 만들 때", "전후 비교로 시작하되 대조군을 함께 두어 차분-차분으로 읽습니다."],
        ["결과가 무유의로 나왔다면", "효과 없음으로 단정하지 않습니다. 검정력이 부족했을 가능성을 먼저 확인합니다."],
      ],
      faq: [
        { q: "전후 비교만으로 증분을 주장할 수 있나요?", a: "권장하지 않습니다. 같은 기간의 시즌성·프로모션·경쟁 변화가 함께 섞이기 때문입니다. 대조군을 두고 차분-차분으로 읽으면 편향을 상당히 줄일 수 있습니다." },
        { q: "홀드아웃 결과가 무유의면 광고가 효과 없다는 뜻인가요?", a: "아닙니다. 표본이 작거나 효과가 작으면 실제 효과가 있어도 탐지되지 않습니다. 신뢰구간의 폭을 함께 보고 검정력이 충분했는지 확인해야 합니다." },
        { q: "ITS는 몇 개의 사전 관측치가 필요한가요?", a: "정해진 최소값은 없지만 추세와 계절성을 분리할 수 있을 만큼은 필요합니다. 사전 구간이 짧으면 반사실 추정이 불안정해지고 구간이 넓어집니다." },
      ],
    },
    en: {
      eyebrow: "Method comparison",
      title: "Three ways to measure incrementality — holdout, on/off, ITS",
      question: "How do I measure the incremental effect of advertising?",
      answer: "A randomized holdout is the most accurate. Otherwise use pre/post or ITS.",
      lead: "Incrementality is the outcome advertising actually created. There are three main designs. A randomized holdout, a pre/post comparison around turning a campaign on or off, and interrupted time series (ITS). The accuracy ranking is clear, and so is the difficulty ranking.",
      table: {
        caption: "Incrementality measurement methods",
        columns: ["Method", "Design", "Causal claim", "Requirements", "Caution"],
        rows: [
          ["Control holdout", "Split exposed and unexposed groups at random, at the same time", "Supported", "Platform holdout feature or geo split", "Small samples give intervals too wide to conclude"],
          ["Turn on / turn off", "Compare before and after a campaign starts or stops", "Limited", "A clear intervention date and enough pre/post data", "Seasonality and promotions are mixed in"],
          ["ITS (interrupted time series)", "Extend the pre-intervention trend to estimate the counterfactual", "Limited", "Many pre-period observations and a stable trend", "Ignoring autocorrelation understates the interval"],
        ],
      },
      guidance: [
        ["If your platform supports holdouts", "Use a holdout. Randomization is what allows a causal claim."],
        ["If the campaign cannot be paused, such as brand", "Use ITS to extend the pre-period trend, with autocorrelation correction."],
        ["If the budget is too small for a control group", "Start with pre/post, but add a control series and read it as difference-in-differences."],
        ["If the result is non-significant", "Do not conclude no effect. Check whether power was sufficient first."],
      ],
      faq: [
        { q: "Can pre/post alone prove incrementality?", a: "It is not recommended. Seasonality, promotions, and competitive shifts land in the same window. Adding a control series and reading it as difference-in-differences removes much of that bias." },
        { q: "If a holdout is non-significant, does advertising not work?", a: "No. Small samples or small effects go undetected even when a real effect exists. Read the width of the confidence interval and check whether the test had enough power." },
        { q: "How many pre-period points does ITS need?", a: "There is no fixed minimum, but you need enough to separate trend from seasonality. A short pre-period makes the counterfactual unstable and widens the interval." },
      ],
    },
  },

  "mmm-vs-experiment": {
    // 5-25(다중공선성)를 넣는다 — 이 페이지의 "채널 지출이 늘 같이 움직였다면 MMM이
    // 분리하지 못한다"에 실제로 답하는 도구가 그것이다.
    toolIds: ["5-18-mmm", "5-23", "5-4", "5-25"],
    ko: {
      eyebrow: "방법 비교",
      title: "MMM과 증분 실험 중 무엇을 먼저 해야 하나",
      question: "MMM과 증분 실험 중에 뭘 먼저 해야 하나요?",
      answer: "실험을 먼저 합니다. MMM은 실험이 불가능한 채널을 메우는 용도입니다.",
      lead: "둘은 대체재가 아니라 역할이 다릅니다. 실험은 무작위 배정으로 인과를 확인하지만 한 번에 하나씩만 볼 수 있습니다. MMM은 모든 채널을 동시에 다루지만 관측 데이터라 인과가 아닙니다. 순서를 정하자면 실험이 먼저이고, MMM은 실험할 수 없는 영역을 메웁니다.",
      table: {
        caption: "MMM과 증분 실험 비교",
        columns: ["기준", "증분 실험", "MMM (마케팅 반응 회귀)"],
        rows: [
          ["근거의 성격", "무작위 배정이면 인과", "관측 연관 — 인과 아님"],
          ["한 번에 보는 범위", "채널 또는 캠페인 하나", "모든 채널 동시"],
          ["필요 데이터", "실험 기간의 노출·전환", "주 단위 채널별 지출과 결과 패널"],
          ["필요 기간", "설계에 따라 2~4주", "최소 1년 이상 권장"],
          ["못 하는 것", "여러 채널의 상호작용", "인과 주장, 공선인 채널 분리"],
          ["결과로 하는 일", "그 채널을 늘릴지 결정", "예산 배분의 초안을 잡음"],
        ],
      },
      guidance: [
        ["채널 하나의 효과가 궁금할 때", "실험을 씁니다. 무작위 배정이 있으면 인과를 주장할 수 있습니다."],
        ["전체 예산을 어떻게 나눌지 정할 때", "MMM으로 초안을 잡고 큰 이동은 실험으로 확인합니다."],
        ["채널 지출이 늘 같이 움직였다면", "MMM이 두 채널을 분리하지 못합니다. 다중공선성부터 점검하세요."],
        ["데이터가 1년 미만이라면", "MMM 대신 실험과 변동 분해로 시작하는 편이 안전합니다."],
      ],
      faq: [
        { q: "MMM 결과로 예산을 바로 옮겨도 되나요?", a: "큰 이동은 권장하지 않습니다. MMM은 관측 데이터의 연관을 추정한 것이라 인과가 아닙니다. 초안으로 삼고 이동 폭이 크면 실험으로 확인한 뒤 반영하세요." },
        { q: "채널 계수가 음수로 나왔습니다. 잠식인가요?", a: "대개는 아닙니다. 지출이 희소하거나 다른 채널과 공선이면 계수 부호가 불안정해집니다. 잠식으로 읽기 전에 다중공선성과 표본을 먼저 확인하세요." },
        { q: "실험을 못 하는 채널은 어떻게 하나요?", a: "브랜드 캠페인처럼 끌 수 없는 채널은 ITS로 개입 효과를 추정하거나 MMM의 기여 분해로 근사합니다. 두 경우 모두 인과로 단정하지 않고 범위로 보고합니다." },
      ],
    },
    en: {
      eyebrow: "Method comparison",
      title: "MMM or an incrementality experiment — which comes first",
      question: "Should I run MMM or an incrementality experiment first?",
      answer: "Run the experiment first. MMM fills in channels you cannot test.",
      lead: "These are not substitutes; they play different roles. An experiment establishes cause through randomization but covers one thing at a time. MMM covers every channel at once but rests on observational data, so it is not causal. If you need an order, experiments come first and MMM fills the gaps.",
      table: {
        caption: "MMM versus incrementality experiments",
        columns: ["Criterion", "Incrementality experiment", "MMM (marketing response regression)"],
        rows: [
          ["Nature of evidence", "Causal when randomized", "Observational association — not causal"],
          ["Scope per run", "One channel or campaign", "All channels at once"],
          ["Data required", "Exposure and conversions during the test", "Weekly per-channel spend and outcome panel"],
          ["Time required", "Two to four weeks depending on design", "At least one year recommended"],
          ["What it cannot do", "Interactions across many channels", "Claim causation, or separate collinear channels"],
          ["What you do with it", "Decide whether to scale that channel", "Draft an initial budget split"],
        ],
      },
      guidance: [
        ["When you need one channel's effect", "Run an experiment. Randomization is what supports a causal claim."],
        ["When you need to split the whole budget", "Draft it with MMM and confirm large moves with an experiment."],
        ["When channel spends always moved together", "MMM cannot separate them. Check multicollinearity first."],
        ["When you have less than a year of data", "Start with experiments and variance decomposition instead of MMM."],
      ],
      faq: [
        { q: "Can I move budget directly on MMM output?", a: "Large moves are not recommended. MMM estimates association in observational data, not causation. Treat it as a draft and confirm sizable shifts with an experiment before committing." },
        { q: "A channel coefficient came out negative. Is that cannibalization?", a: "Usually not. Sparse spend or collinearity with another channel makes coefficient signs unstable. Check multicollinearity and sample size before reading it as cannibalization." },
        { q: "What about channels I cannot experiment on?", a: "For channels you cannot pause, such as brand, estimate the intervention effect with ITS or approximate it with MMM attribution. In both cases report a range rather than a point claim." },
      ],
    },
  },

  "budget-allocation-methods": {
    toolIds: ["5-3", "5-22", "5-21"],
    ko: {
      eyebrow: "방법 비교",
      title: "광고 예산 배분 방법 비교 — 균등·과거 CPA·한계효율",
      question: "광고 예산은 채널별로 어떻게 나누는 게 맞나요?",
      answer: "평균 효율이 아니라 한계 효율 기준으로 나눕니다.",
      lead: "예산 배분에서 가장 흔한 실수는 평균 CPA가 낮은 채널에 더 넣는 것입니다. 채널은 대개 수확체감을 겪기 때문에, 지금 만원을 더 넣었을 때의 효율(한계 효율)은 평균과 다릅니다. 배분 기준을 평균에서 한계로 바꾸는 것이 이 비교의 핵심입니다.",
      table: {
        caption: "예산 배분 방법 비교",
        columns: ["방법", "기준", "장점", "실패하는 지점"],
        rows: [
          ["균등 배분", "채널 수로 나눔", "설명이 쉽고 편향이 없음", "효율 차이를 전부 무시함"],
          ["과거 실적 비례", "지난 기간 지출 비중 유지", "변동이 작고 운영이 안정적", "이미 포화된 채널을 계속 키움"],
          ["평균 CPA 가중", "평균 CPA가 낮은 쪽에 더 배정", "직관적이고 계산이 단순", "수확체감을 무시해 과투자 유발"],
          ["한계 효율 기준", "추가 1원의 효율이 같아지도록 배분", "총 결과를 최대화하는 방향", "채널별 반응 곡선 추정이 필요"],
        ],
      },
      guidance: [
        ["채널별 지출 변동이 충분할 때", "한계 효율로 배분합니다. 곡선을 추정할 수 있습니다."],
        ["지출이 거의 고정이었다면", "곡선이 안 나옵니다. 먼저 지출을 의도적으로 흔들어 관측 범위를 넓히세요."],
        ["채널 간 효율 차이가 1.2배 미만이면", "재배분 여지가 작습니다. 억지로 옮기지 말고 소재나 타겟을 보세요."],
        ["큰 폭으로 옮기기 전에", "포화도 진단으로 그 채널이 이미 포화 구간인지 확인합니다."],
      ],
      faq: [
        { q: "평균 CPA가 가장 낮은 채널에 몰아주면 안 되나요?", a: "권장하지 않습니다. 대부분의 채널은 지출을 늘릴수록 효율이 떨어지므로, 평균이 좋아도 추가 지출의 효율은 이미 나쁠 수 있습니다. 판단 기준은 평균이 아니라 한계 효율입니다." },
        { q: "한계 효율은 어떻게 추정하나요?", a: "채널별 지출과 결과의 관계를 곡선으로 적합한 뒤, 현재 지출점에서 지출을 조금 늘렸을 때의 변화율로 계산합니다. 과거 지출이 거의 변하지 않았다면 곡선 추정이 불안정해집니다." },
        { q: "추천 배분을 그대로 실행해도 되나요?", a: "한 번에 전부 옮기는 것은 권장하지 않습니다. 곡선은 관측 범위 안에서만 신뢰할 수 있으므로, 단계적으로 옮기고 결과를 확인하며 재추정하는 편이 안전합니다." },
      ],
    },
    en: {
      eyebrow: "Method comparison",
      title: "Ways to split ad budget — even, historical, marginal efficiency",
      question: "How should I split ad budget across channels?",
      answer: "Split on marginal efficiency, not average efficiency.",
      lead: "The most common budget mistake is adding spend to the channel with the lowest average CPA. Channels usually face diminishing returns, so the efficiency of the next dollar differs from the average. Moving the allocation rule from average to marginal is the point of this comparison.",
      table: {
        caption: "Budget allocation methods",
        columns: ["Method", "Rule", "Strength", "Where it breaks"],
        rows: [
          ["Even split", "Divide by number of channels", "Easy to explain and unbiased", "Ignores efficiency differences entirely"],
          ["Historical share", "Keep last period's spend shares", "Low variance and operationally stable", "Keeps growing already-saturated channels"],
          ["Average CPA weighting", "Give more to the lowest average CPA", "Intuitive and simple to compute", "Ignores diminishing returns and overinvests"],
          ["Marginal efficiency", "Equalize the efficiency of the next unit of spend", "Maximizes total outcome", "Requires estimating a response curve per channel"],
        ],
      },
      guidance: [
        ["When spend varied enough per channel", "Allocate on marginal efficiency. The curve is estimable."],
        ["When spend was nearly flat", "No curve emerges. Vary spend deliberately first to widen the observed range."],
        ["When channels differ by less than 1.2x", "There is little to reallocate. Look at creative or targeting instead."],
        ["Before shifting a large amount", "Check saturation to see whether the channel is already in the flat region."],
      ],
      faq: [
        { q: "Why not put everything into the lowest average CPA channel?", a: "It is not recommended. Most channels lose efficiency as spend rises, so a good average can coexist with poor efficiency on the next dollar. The decision rule is marginal, not average, efficiency." },
        { q: "How is marginal efficiency estimated?", a: "Fit a curve to the relationship between spend and outcome per channel, then take the rate of change at the current spend level. If past spend barely varied, that curve estimate is unstable." },
        { q: "Can I execute the recommended split as-is?", a: "Moving everything at once is not recommended. A fitted curve is only trustworthy inside the observed spend range, so shift gradually, observe the result, and re-estimate." },
      ],
    },
  },

  "dashboard-vs-spreadsheet": {
    toolIds: ["5-2", "5-21", "9-6"],
    ko: {
      eyebrow: "방법 비교",
      title: "캠페인 성과 분석 — 스프레드시트와 전용 도구 비교",
      question: "캠페인 성과 분석을 스프레드시트로 계속해도 되나요?",
      answer: "집계는 됩니다. 변동 분해와 신뢰구간은 스프레드시트에서 어렵습니다.",
      lead: "스프레드시트는 집계와 시각화까지는 충분합니다. 문제는 그다음입니다. CPA가 왜 올랐는지 물량·효율·믹스로 나누거나, 이상치를 통계적으로 판정하거나, 추정에 신뢰구간을 붙이는 작업은 수식으로 매번 다시 짜야 합니다. 전용 도구를 쓰는 이유는 시각화가 아니라 이 재현성입니다.",
      table: {
        caption: "스프레드시트와 전용 분석 도구 비교",
        columns: ["작업", "스프레드시트", "전용 도구"],
        rows: [
          ["기간별 집계와 차트", "충분함", "동일"],
          ["변동 원인 분해", "수식을 매번 다시 설계해야 함", "물량·효율·믹스로 자동 분해"],
          ["이상치 판정", "눈으로 보거나 임의 임계값", "통계적 기준과 신뢰구간"],
          ["단계별 합계 정합", "롤업에서 합이 어긋나기 쉬움", "최소 단위 1회 분해 후 합산이라 항등식 유지"],
          ["재현성", "파일마다 수식이 달라짐", "같은 입력에 같은 결과"],
          ["데이터 보안", "파일 공유 경로에 따라 다름", "브라우저에서만 처리, 전송 없음"],
        ],
      },
      guidance: [
        ["단순 집계와 보고용 차트만 필요하면", "스프레드시트로 충분합니다. 도구를 새로 배울 필요가 없습니다."],
        ["'왜 변했는지'를 매주 설명해야 한다면", "변동 분해가 있는 도구가 시간을 크게 아낍니다."],
        ["추정에 불확실성을 표시해야 한다면", "신뢰구간을 자동으로 계산하는 쪽이 안전합니다."],
        ["데이터가 사내 민감 자료라면", "브라우저에서만 처리되고 서버로 가지 않는지 확인하세요."],
      ],
      faq: [
        { q: "스프레드시트로도 변동 분해를 할 수 있나요?", a: "가능합니다. 다만 단계마다 따로 분해하면 상위 합계가 어긋나기 쉽습니다. 최소 단위에서 한 번만 분해하고 상위는 단순 합산해야 어느 단계에서 보든 합이 맞습니다." },
        { q: "CSV를 올리면 데이터가 어디에 저장되나요?", a: "저장되지 않습니다. 파싱과 계산이 브라우저 안에서만 실행되고 원본 행은 서버로 전송하거나 보관하지 않습니다. 새로고침하면 사라집니다." },
        { q: "광고 계정에 직접 연동되나요?", a: "연동되지 않습니다. 각 매체에서 내려받은 CSV를 올리는 방식입니다. 실시간 API 연결은 제공하지 않습니다." },
      ],
    },
    en: {
      eyebrow: "Method comparison",
      title: "Campaign analysis — spreadsheets versus a dedicated tool",
      question: "Can I keep doing campaign analysis in a spreadsheet?",
      answer: "Aggregation works fine. Variance decomposition and confidence intervals do not.",
      lead: "Spreadsheets are enough for aggregation and charts. The difficulty starts after that. Splitting a CPA change into volume, efficiency, and mix, judging outliers statistically, or attaching confidence intervals means rebuilding formulas every time. The reason to use a dedicated tool is reproducibility, not visualization.",
      table: {
        caption: "Spreadsheets versus a dedicated analysis tool",
        columns: ["Task", "Spreadsheet", "Dedicated tool"],
        rows: [
          ["Period aggregation and charts", "Sufficient", "Same"],
          ["Decomposing a change", "Formulas must be redesigned each time", "Automatic split into volume, efficiency, mix"],
          ["Outlier judgment", "By eye or an arbitrary threshold", "Statistical criteria with confidence intervals"],
          ["Totals across levels", "Roll-ups easily stop adding up", "One decomposition at the finest grain, then summed"],
          ["Reproducibility", "Formulas drift between files", "Same input, same result"],
          ["Data handling", "Depends on how files are shared", "Processed in the browser, never transmitted"],
        ],
      },
      guidance: [
        ["If you only need aggregation and reporting charts", "A spreadsheet is enough. No new tool is required."],
        ["If you must explain what changed every week", "A tool with variance decomposition saves substantial time."],
        ["If estimates need uncertainty attached", "Automatic confidence intervals are the safer path."],
        ["If the data is internally sensitive", "Confirm it is processed in the browser and never transmitted."],
      ],
      faq: [
        { q: "Can a spreadsheet do variance decomposition?", a: "Yes, but decomposing separately at each level makes upper-level totals disagree. Decompose once at the finest grain and sum upward so the identity holds at every level." },
        { q: "Where is my CSV stored after upload?", a: "It is not stored. Parsing and computation run in your browser, and source rows are never transmitted or retained. Refreshing the page clears them." },
        { q: "Does it connect directly to my ad accounts?", a: "No. You upload a CSV exported from each platform. Live API integrations are not provided." },
      ],
    },
  },
};

export const COMPARE_SLUGS = Object.keys(CONTENT);

export function getComparePage(slug, locale = "ko") {
  const entry = CONTENT[slug];
  if (!entry) return null;
  const key = locale === "en" ? "en" : "ko";
  return { slug, toolIds: entry.toolIds, ...entry[key] };
}

// FAQ JSON-LD용. 페이지의 핵심 질문을 첫 항목으로 올린다 —
// 답을 앞에 두는 것이 이 페이지들의 존재 이유다.
export function getCompareFaq(slug, locale = "ko") {
  const page = getComparePage(slug, locale);
  if (!page) return [];
  return [{ q: page.question, a: page.answer }, ...page.faq];
}

// 도구 → 비교 페이지 역인덱스. `toolIds`에서 **파생**한다(목록을 두 곳에 나열 금지).
// 비교 페이지가 도구로 나가는 링크만 있고 들어오는 길이 없으면 사이트와 떨어져
// 혼자 놓인다 — 도구 화면 하단에서 이 역링크로 잇는다.
const TOOL_INDEX = (() => {
  const index = new Map();
  for (const [slug, entry] of Object.entries(CONTENT)) {
    for (const toolId of entry.toolIds) {
      if (!index.has(toolId)) index.set(toolId, []);
      index.get(toolId).push(slug);
    }
  }
  return index;
})();

// 목록에 없는 5-18 허브로 들어온 요청은 기여 분해(5-18-mmm)의 비교를 빌려 쓴다.
const normalizeToolId = (toolId) => (toolId === "5-18" ? "5-18-mmm" : toolId);

export function getComparesForTool(toolId, locale = "ko") {
  return (TOOL_INDEX.get(normalizeToolId(toolId)) || [])
    .map((slug) => getComparePage(slug, locale))
    .filter(Boolean);
}
