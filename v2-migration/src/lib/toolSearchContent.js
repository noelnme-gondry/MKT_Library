import { getResponseSubtoolContent } from "./responseSubtoolContent";

// 도구 라우트의 검색 진입면 콘텐츠(SSOT).
// - 렌더: `components/ToolLongform.jsx` (eyebrow·title·lead·sections·faq)
// - 구조화 데이터: `app/(ko|en)/.../page.js`가 `faq`로 FAQPage JSON-LD 생성
// 5-18 하위 진입 라우트는 `responseSubtoolContent.js`가 그대로 소유하고 여기서 폴백으로 잇는다.
// 카피 원칙(AGENTS §8): 관측 결과를 인과로 단정하지 않고, 도구가 못 하는 것을 함께 적는다.
const CONTENT = {
  "5-2": {
    ko: {
      eyebrow: "도구 사용 가이드",
      title: "지표를 나열하지 말고, 이번 주에 볼 것 하나를 정하세요",
      question: "캠페인 CSV로 뭘 먼저 봐야 하나요?",
      answer: "최근 기간과 직전 기간을 비교해 달라진 것 하나를 고릅니다.",
      lead: "운영 대시보드는 캠페인 CSV를 브라우저에서 집계해 비용·설치·전환·CPA·ROAS의 최근 움직임과 이상 신호를 한 화면에 모읍니다. 목적은 모든 지표를 보는 것이 아니라, 이번 주에 손댈 곳 하나를 고르는 것입니다.",
      detailsLabel: "확인 순서와 해석 기준 보기",
      sections: [
        ["언제 써야 하나", "주간 성과 점검, 월중 예산 페이싱 확인, 갑작스러운 CPA 상승 원인 탐색처럼 '지금 무엇이 달라졌는지'를 먼저 알아야 할 때 사용합니다. 날짜와 비용, 결과 컬럼만 있으면 시작할 수 있고 매출·리텐션 컬럼이 있으면 ROAS와 코호트 탭이 함께 열립니다."],
        ["무엇을 확인하나", "스코어카드로 최근 기간과 직전 기간을 비교하고, 페이싱으로 남은 예산과 소진 속도를 보고, 이상탐지로 평소 범위를 벗어난 날을 찾습니다. 퍼널·코호트·LTV·계절성 탭은 같은 CSV를 다른 각도로 자르는 것이지 별도 데이터를 요구하지 않습니다."],
        ["결과를 어떻게 쓰나", "변동이 큰 채널·캠페인을 찾았다면 원인 분해는 성과 변동 분석으로, 예산 이동 판단은 포화도 진단과 예산 배분으로 넘깁니다. 대시보드는 '어디를 볼지'를 정해주는 화면이고, '왜 그런지'와 '얼마를 옮길지'는 다음 도구의 몫입니다."],
      ],
      faq: [
        { q: "매출 컬럼이 없으면 못 쓰나요?", a: "아닙니다. 비용과 결과(설치·가입·구매 등) 컬럼만 있으면 CPA·추이·이상탐지까지 확인할 수 있습니다. 매출이 매핑되면 ROAS와 LTV 관련 탭이 추가로 열립니다." },
        { q: "업로드한 데이터가 서버에 저장되나요?", a: "저장되지 않습니다. CSV 파싱과 집계는 브라우저 안에서만 실행되고 원본 행은 서버로 전송하거나 보관하지 않습니다." },
        { q: "이상 신호로 표시되면 문제가 확정된 건가요?", a: "아닙니다. 평소 변동 범위를 벗어났다는 통계적 표시일 뿐이며, 프로모션·시즌·트래킹 변경으로도 같은 신호가 나옵니다. 원인은 변동 분해나 실험으로 확인해야 합니다." },
      ],
    },
    en: {
      eyebrow: "Tool guide",
      title: "Do not read every metric—choose the one thing to act on this week",
      question: "What should I look at first in a campaign CSV?",
      answer: "Compare the recent window with the prior one and pick one change.",
      lead: "The operations dashboard aggregates a campaign CSV in your browser and puts recent movement in spend, installs, conversions, CPA, and ROAS in one view with anomaly signals. The goal is to select one thing to act on, not to display every metric.",
      detailsLabel: "See the review order and interpretation rules",
      sections: [
        ["When to use it", "Use it for weekly reviews, mid-month pacing checks, and sudden CPA changes—whenever you first need to know what changed. Date, cost, and an outcome column are enough to start; revenue and retention columns unlock the ROAS and cohort tabs."],
        ["What to inspect", "Compare the recent window with the prior one in the scorecard, check remaining budget and burn rate in pacing, and find days outside the usual range in anomaly detection. Funnel, cohort, LTV, and seasonality tabs slice the same CSV differently rather than requiring new data."],
        ["How to act", "When a channel or campaign moves sharply, hand the cause analysis to campaign variance and the budget decision to saturation and allocation. The dashboard decides where to look; why it happened and how much to move belong to the next tool."],
      ],
      faq: [
        { q: "Can I use it without a revenue column?", a: "Yes. Cost and one outcome column (installs, signups, purchases) are enough for CPA, trends, and anomaly detection. Mapping revenue additionally unlocks ROAS and LTV views." },
        { q: "Is my uploaded data stored on a server?", a: "No. Parsing and aggregation run in your browser, and source rows are never transmitted or retained." },
        { q: "Does an anomaly flag confirm a problem?", a: "No. It only marks a value outside the usual range. Promotions, seasonality, and tracking changes produce the same signal, so confirm the cause with variance analysis or an experiment." },
      ],
    },
  },
  "5-21": {
    ko: {
      eyebrow: "도구 사용 가이드",
      title: "성과가 왜 변했는지, 물량·효율·믹스로 나눠 보세요",
      question: "CPA가 올랐는데 원인을 어떻게 찾나요?",
      answer: "변화를 물량·효율·믹스 세 항으로 나눠서 봅니다.",
      lead: "성과 변동 분석은 두 기간의 차이를 잔차 없이 분해합니다. 결과가 늘었을 때 그것이 더 많이 써서인지, 효율이 좋아져서인지, 예산 비중이 옮겨가서인지를 채널·캠페인·소재 단계로 내려가며 확인합니다.",
      detailsLabel: "분해 방식과 읽는 순서 보기",
      sections: [
        ["언제 써야 하나", "주간 CPA가 올랐는데 원인을 특정하지 못할 때, 특정 채널을 늘렸는데 전체 효율이 나빠졌을 때, 보고에 '무엇 때문에'를 적어야 할 때 사용합니다. 최소한 기간을 나눌 수 있는 날짜와 비용·결과 컬럼이 필요합니다."],
        ["무엇을 계산하나", "가장 작은 단위(채널×캠페인×소재×일)에서 한 번만 분해한 뒤 상위 단계로 합산하므로, 어느 단계에서 보든 합이 어긋나지 않습니다. 믹스 효과의 비중은 비용 비중이 아니라 결과 비중이며, 전체 평균 대비로 중심화해 '비싼 쪽으로 예산이 쏠렸는지'를 부호로 읽을 수 있게 했습니다."],
        ["결과를 어떻게 쓰나", "상위 변동 요인 3개를 먼저 보고, 효율 악화가 원인이면 소재·타겟을, 믹스 이동이 원인이면 예산 배분을 검토합니다. 분해는 회계적 항등식이므로 '무엇이 얼마나 기여했는지'는 정확하지만 '왜 그렇게 됐는지'는 설명하지 않습니다."],
      ],
      faq: [
        { q: "믹스 효과의 '비중'은 비용 비중인가요?", a: "아닙니다. 결과(전환 건수) 비중입니다. 효율이 좋아진 항목은 비용이 줄어도 결과 비중은 늘 수 있어 비용 비중으로 읽으면 숫자가 틀린 것처럼 보입니다." },
        { q: "단계별 합계가 서로 다르지 않나요?", a: "다르지 않습니다. 최소 단위에서 한 번만 분해하고 상위는 단순 합산하므로 채널·캠페인·소재 어느 단계에서도 합이 일치합니다." },
        { q: "이 분해로 원인을 확정할 수 있나요?", a: "없습니다. 변동을 세 항으로 정확히 나눌 뿐이며, 그 변화를 만든 이유(입찰·경쟁·시즌)는 별도 확인이 필요합니다." },
      ],
    },
    en: {
      eyebrow: "Tool guide",
      title: "Split the change into volume, efficiency, and mix",
      question: "How do I find why CPA went up?",
      answer: "Split the change into volume, efficiency, and mix.",
      lead: "Campaign variance analysis decomposes the gap between two periods without residuals. It separates whether an outcome moved because you spent more, because efficiency changed, or because budget share shifted—down through channel, campaign, and creative.",
      detailsLabel: "See the decomposition method and reading order",
      sections: [
        ["When to use it", "Use it when weekly CPA rises without an obvious cause, when scaling one channel worsened overall efficiency, or when a report needs a defensible 'because of this'. You need a date column plus cost and outcome columns."],
        ["What it calculates", "Decomposition runs once at the finest grain (channel × campaign × creative × day) and rolls up, so totals reconcile at every level. Mix weight uses outcome share, not cost share, and is centered on the overall average so the sign shows whether budget moved toward expensive units."],
        ["How to act", "Read the top three movers first. Efficiency losses point to creative and targeting; mix shifts point to allocation. The decomposition is an accounting identity: it states how much each term contributed, not why it happened."],
      ],
      faq: [
        { q: "Is the mix 'share' a cost share?", a: "No, it is outcome share. A unit that improved efficiency can show a lower cost share and a higher outcome share, which looks wrong if read as spend." },
        { q: "Do totals differ between levels?", a: "No. The decomposition happens once at the finest grain and rolls up by summation, so channel, campaign, and creative totals reconcile." },
        { q: "Does this prove the cause?", a: "No. It attributes the change exactly to three terms; the underlying reason (bidding, competition, seasonality) still needs separate verification." },
      ],
    },
  },
  "5-22": {
    ko: {
      eyebrow: "도구 사용 가이드",
      title: "평균 효율이 좋다고 더 써도 되는 것은 아닙니다",
      question: "이 채널에 예산을 더 넣어도 되나요?",
      answer: "한계 CPA가 평균 CPA보다 크게 높으면 이미 포화입니다.",
      lead: "포화도 진단은 채널·캠페인이 지금 지출 구간에서 얼마나 여력이 남았는지를 봅니다. 판단 기준은 평균 CPA가 아니라 '다음 1원이 만드는' 한계 CPA이며, 둘의 비율로 포화·적정·여유를 구분합니다.",
      detailsLabel: "포화지수 계산과 한계 보기",
      sections: [
        ["언제 써야 하나", "증액 요청을 검토할 때, 성과가 좋은 채널을 더 밀어도 되는지 판단할 때, 예산을 늘렸는데 결과가 비례해서 늘지 않을 때 사용합니다. 채널별로 지출이 여러 수준에서 관측돼야 곡선 추정이 의미를 가집니다."],
        ["무엇을 계산하나", "관측된 지출-결과 관계로 반응곡선을 적합한 뒤 현재 지출점에서 한계 효율을 구하고, 평균 효율과의 비율을 포화지수로 씁니다. 1을 넘으면 다음 지출이 평균보다 나쁜 성과를 낸다는 뜻이고, 낮을수록 아직 여력이 있다는 신호입니다."],
        ["결과를 어떻게 쓰나", "여유로 판정된 채널은 예산 배분 시뮬레이터에서 증액 후보로, 포화 채널은 감액이나 구조 변경(타겟·소재·입찰) 후보로 넘깁니다. 관측 지출 범위를 크게 벗어난 구간의 추정은 신뢰도가 급격히 떨어지므로 곡선 끝의 예측은 참고로만 보세요."],
      ],
      faq: [
        { q: "포화라고 나오면 예산을 줄여야 하나요?", a: "즉시 감액을 뜻하지는 않습니다. 다음 지출의 효율이 평균보다 나쁘다는 의미이므로, 목표 CPA를 아직 만족한다면 유지하고 소재·타겟 구조를 먼저 바꿔볼 수 있습니다." },
        { q: "데이터가 적은 신규 채널도 판정되나요?", a: "관측 지출 수준이 몇 개뿐이면 곡선 추정이 불안정합니다. 이런 채널은 판정보다 실험 예산으로 다루는 편이 안전합니다." },
        { q: "ROAS 기준으로도 볼 수 있나요?", a: "가능합니다. ROAS는 평균÷한계로 방향이 뒤집히며, 표와 차트, 캡션 단위가 함께 전환됩니다." },
      ],
    },
    en: {
      eyebrow: "Tool guide",
      title: "Good average efficiency does not mean room to spend more",
      question: "Can I put more budget into this channel?",
      answer: "If marginal CPA far exceeds average CPA, it is already saturated.",
      lead: "Saturation analysis asks how much headroom a channel or campaign still has at its current spend level. The test is marginal CPA—what the next unit of spend produces—compared with average CPA, and the ratio separates saturated, healthy, and scalable spend.",
      detailsLabel: "See how the saturation index is computed and its limits",
      sections: [
        ["When to use it", "Use it for scale-up requests, before pushing a well-performing channel further, or when a budget increase did not produce a proportional lift. Curve estimates are meaningful only when spend has been observed at several levels."],
        ["What it calculates", "A response curve is fitted from observed spend and outcomes, the marginal efficiency is taken at the current spend point, and the ratio to average efficiency becomes the saturation index. Above one means the next unit performs worse than the average; lower values indicate remaining headroom."],
        ["How to act", "Send scalable channels to the allocation simulator as scale-up candidates, and saturated channels toward reduction or structural change in targeting, creative, and bidding. Estimates far outside the observed spend range lose reliability quickly, so treat the tail of the curve as indicative only."],
      ],
      faq: [
        { q: "Does a saturated verdict mean I must cut spend?", a: "Not necessarily. It means the next unit performs worse than the average. If the channel still meets your target CPA, holding spend while changing creative or targeting is a valid response." },
        { q: "Can new channels with little data be judged?", a: "With only a few observed spend levels the curve is unstable. Treat those channels as an experiment budget rather than a verdict." },
        { q: "Can I evaluate with ROAS instead?", a: "Yes. For ROAS the ratio inverts (average ÷ marginal), and the table, chart, and caption units switch together." },
      ],
    },
  },
  "9-6": {
    ko: {
      eyebrow: "도구 사용 가이드",
      title: "지금 교체할 소재와, 다음에 만들 소재를 함께 정하세요",
      question: "광고 소재를 언제 교체해야 하나요?",
      answer: "노출은 유지되는데 성과가 초기 대비 꺾일 때 교체합니다.",
      lead: "소재 분석은 소재별 CTR·CVR·CPA를 비교하고 노출이 쌓이며 성과가 떨어지는 피로 신호를 찾습니다. 목적은 순위표를 만드는 것이 아니라 '무엇을 내리고 무엇을 더 만들지'를 정하는 것입니다.",
      detailsLabel: "피로도 판정 기준과 주의점 보기",
      sections: [
        ["언제 써야 하나", "같은 소재를 오래 돌려 성과가 서서히 나빠질 때, 제작 리소스를 어디에 쓸지 정할 때, 신규 소재가 기존 대비 실제로 나은지 확인할 때 사용합니다. 소재 단위 일별 데이터(노출·클릭·전환·비용)가 필요합니다."],
        ["무엇을 확인하나", "노출량으로 가중한 비교로 소량 노출 소재가 우연히 상위에 오르는 것을 줄이고, 시간에 따른 지표 하락 추세로 피로 신호를 봅니다. 표본이 적은 소재는 순위가 아니라 '판단 보류'로 다루는 것이 정확합니다."],
        ["결과를 어떻게 쓰나", "교체 우선순위가 높은 소재부터 내리고, 성과가 좋은 소재의 공통 요소(후킹·형식·길이)를 다음 제작 브리프에 반영합니다. 어떤 요소가 성과와 연결됐는지 더 구조적으로 보려면 콘텐츠 요소 분석으로 넘어갑니다."],
      ],
      faq: [
        { q: "노출이 적은 신규 소재가 1위로 나오면 믿어도 되나요?", a: "권장하지 않습니다. 표본이 적으면 비율 지표가 크게 흔들립니다. 노출 가중 비교와 신뢰구간을 함께 보고, 부족하면 판단을 보류하세요." },
        { q: "피로도는 무엇을 기준으로 하나요?", a: "노출이 누적되며 반응률이 추세적으로 낮아지는 패턴을 봅니다. 다만 시즌·경쟁·타겟 변경도 같은 모양을 만들 수 있어 단독 근거로 쓰지 않습니다." },
        { q: "소재를 언제 교체해야 하나요?", a: "고정된 기준일은 없습니다. 목표 CPA를 벗어나기 시작하고 하락 추세가 일시적 변동보다 크게 이어질 때가 실무적 신호입니다." },
      ],
    },
    en: {
      eyebrow: "Tool guide",
      title: "Decide what to retire and what to make next—together",
      question: "When should I retire an ad creative?",
      answer: "Retire it when performance drops from its early level while impressions hold.",
      lead: "Creative analysis compares CTR, CVR, and CPA per asset and looks for fatigue: performance decaying as impressions accumulate. The output is a production decision, not a leaderboard.",
      detailsLabel: "See fatigue criteria and caveats",
      sections: [
        ["When to use it", "Use it when long-running assets slowly decline, when deciding where production time goes, or when checking whether a new asset truly beats the incumbent. Daily creative-level data (impressions, clicks, conversions, cost) is required."],
        ["What to inspect", "Comparisons are weighted by volume so low-impression assets do not top the list by chance, and trends over time surface fatigue. Assets with small samples are better treated as 'not yet decidable' than ranked."],
        ["How to act", "Retire the highest-priority replacements first, then feed shared traits of winning assets—hook, format, length—into the next brief. For a more structural view of which elements relate to performance, continue to content element analysis."],
      ],
      faq: [
        { q: "A new asset with few impressions ranks first—can I trust it?", a: "Not yet. Rate metrics swing widely on small samples. Read the volume-weighted comparison and confidence intervals, and defer the decision when data is thin." },
        { q: "How is fatigue determined?", a: "It looks for response rates trending down as impressions accumulate. Seasonality, competition, and targeting changes can produce the same shape, so it is not used as sole evidence." },
        { q: "When should a creative be replaced?", a: "There is no fixed lifetime. The practical signal is a sustained decline beyond normal variation combined with drifting past your target CPA." },
      ],
    },
  },
  // 아래 두 도구는 기존 `ToolLongform` 내부 COPY에서 이관(문자열 불변) + faq 신설.
  "5-18": {
    ko: {
      eyebrow: "도구 사용 가이드",
      title: "광고가 신규 성과를 만들었는지, 기존 유입을 옮겼는지 구분하세요",
      question: "채널별 기여도는 어떻게 추정하나요?",
      answer: "주간 지출·결과 패널에 회귀를 적합해 추정합니다. 인과는 아닙니다.",
      lead: "카니발라이제이션 진단은 광고가 켜진 뒤 성과가 늘었다는 사실만으로 결론내리지 않습니다. 같은 시점의 오가닉·브랜드·검색 흐름과 채널 지출 패턴을 함께 보고, 예산을 다시 검토할 채널을 좁히는 탐색 도구입니다.",
      detailsLabel: "진단 기준과 다음 조치 보기",
      sections: [
        ["언제 써야 하나", "브랜드 검색이나 오가닉 가입이 줄었는데 유료 전환은 유지되거나 늘었을 때, 리타겟팅·브랜드 캠페인을 확장하기 전, 채널별 기여도를 단순 어트리뷰션과 다르게 검토하고 싶을 때 사용합니다. 이 도구의 신호는 인과 확정이 아니라 홀드아웃 또는 on/off 검증을 설계할 후보를 고르는 근거입니다."],
        ["무엇을 확인하나", "지출을 한 번 늘린 뒤 몇 주간 결과가 어떻게 움직이는지, 오가닉·브랜드 지표와 반대로 움직이는지, 채널끼리 너무 비슷한 패턴인지, 모델이 실제 추이를 얼마나 따라가는지를 함께 확인합니다. 한 신호만으로 잠식이라고 단정하지 않고 네 가지 진단을 병렬로 읽는 이유입니다."],
        ["결과를 어떻게 쓰나", "잠식 의심이 큰 채널은 바로 끄기보다 일부 지역·오디언스·기간을 남겨 통제군으로 비교하세요. 신뢰도가 낮거나 채널 간 패턴이 겹치면 예산을 크게 이동하지 말고, 데이터를 더 모은 뒤 재검토해야 합니다. 잠식 가능성이 낮고 한계 효율이 남은 채널은 예산 배분 시뮬레이션에서 증액 후보로 비교할 수 있습니다."],
      ],
      faq: [
        { q: "회귀 계수가 크면 그 채널이 성과를 만든 건가요?", a: "아닙니다. 회귀는 연관을 보여줄 뿐이며 인과의 증거가 아닙니다. 확정하려면 홀드아웃이나 증분 분석 같은 실험 설계가 필요합니다." },
        { q: "채널 지출이 서로 비슷하게 움직이면 어떻게 되나요?", a: "다중공선성 때문에 채널별 기여를 분리할 수 없습니다. 이 경우 추정치를 만들어 보여주는 대신 분해를 거부하고 이유를 표시합니다. 사전 점검은 VIF 진단 도구로 할 수 있습니다." },
        { q: "예측 구간은 신뢰구간인가요?", a: "아닙니다. 과거 잔차에 기반한 참고 범위이며 인과적 신뢰구간이 아닙니다. 구조 변화가 있으면 실제 오차는 더 커집니다." },
      ],
    },
    en: {
      eyebrow: "Tool guide",
      title: "Separate incremental outcomes from shifted demand",
      question: "How is channel contribution estimated?",
      answer: "Fit a regression to a weekly spend and outcome panel. Not causal.",
      lead: "Cannibalization diagnosis looks beyond a paid-performance lift. It compares spend patterns with organic, brand, and search trends to narrow the channels that deserve a budget review.",
      detailsLabel: "See diagnostic criteria and next steps",
      sections: [
        ["When to use it", "Use this before scaling brand or retargeting spend, or when paid outcomes rise while organic or branded outcomes weaken. The signals prioritize a holdout or on/off test; they do not prove causality by themselves."],
        ["What to inspect", "Review delayed response after a spend increase, movement against organic and branded outcomes, overlap between channels, and model fit. Read the four signals together rather than labelling one correlation as cannibalization."],
        ["How to act", "Do not turn off a suspect channel immediately. Keep a controlled slice by geography, audience, or time, then compare the incremental outcome. Use budget allocation only after confidence and marginal efficiency support a move."],
      ],
      faq: [
        { q: "Does a large regression coefficient prove the channel drove results?", a: "No. Regression shows association, not causation. Confirming an effect requires an experimental design such as a holdout or incrementality study." },
        { q: "What happens when channel spends move together?", a: "Multicollinearity makes channel-level contribution unidentifiable. The tool refuses the decomposition and explains why instead of printing a confident-looking number. Check this in advance with the VIF diagnostic." },
        { q: "Is the forecast band a confidence interval?", a: "No. It is a reference range from historical residuals, not a causal confidence interval. Structural change widens the real error." },
      ],
    },
  },
  "5-3": {
    ko: {
      eyebrow: "도구 사용 가이드",
      title: "평균 효율이 아니라 다음 돈의 한계 효율로 예산을 옮기세요",
      question: "예산을 채널별로 얼마씩 나눠야 하나요?",
      answer: "추가 1원의 효율이 채널마다 같아지는 지점까지 옮깁니다.",
      lead: "예산 배분은 지금 가장 좋아 보이는 채널에 돈을 몰아주는 기능이 아닙니다. 채널별 반응곡선과 현재 지출 위치를 바탕으로, 다음 예산 단위가 어디에서 가장 나은 결과를 낼지 비교하는 시뮬레이션입니다.",
      detailsLabel: "계산 기준과 안전한 사용법 보기",
      sections: [
        ["언제 써야 하나", "월·주 예산을 다시 나눌 때, 특정 채널 증액 요청을 검토할 때, 평균 CPA나 ROAS는 좋아 보이지만 포화가 걱정될 때 사용합니다. 지출·결과가 기간별로 충분히 쌓인 채널일수록 반응곡선의 참고 가치가 높습니다."],
        ["무엇을 계산하나", "현재 지출 근처에서 추가 예산이 만들 것으로 추정되는 결과를 비교합니다. 따라서 평균 효율이 좋더라도 이미 포화 구간이면 우선순위가 낮아질 수 있고, 평균은 평범해도 아직 여력이 남은 채널이 후보가 될 수 있습니다. 결과는 과거 관측 기반 시뮬레이션이지 미래 보장이 아닙니다."],
        ["결과를 어떻게 쓰나", "추천 금액을 한 번에 전액 적용하지 말고 작은 단위로 나눠 적용한 뒤 실제 CPA·ROAS와 예상 범위를 비교하세요. 카니발라이제이션 의심 채널은 증액 전 먼저 통제 실험을 검토해야 합니다. 신규 채널·캠페인처럼 관측치가 적은 곳은 모델 결과보다 실험 예산으로 취급하세요."],
      ],
      faq: [
        { q: "추천 배분을 그대로 적용해도 되나요?", a: "한 번에 전액 적용하는 것은 권장하지 않습니다. 과거 관측 기반 시뮬레이션이므로 작은 단위로 옮기고 실제 결과를 예상 범위와 비교하며 조정하세요." },
        { q: "왜 평균 효율이 가장 좋은 채널에 예산을 다 주지 않나요?", a: "판단 기준이 한계 효율이기 때문입니다. 이미 포화된 채널은 다음 1원의 성과가 평균보다 나빠 우선순위가 내려갈 수 있습니다." },
        { q: "관측된 적 없는 큰 예산도 계산되나요?", a: "관측 지출 범위를 크게 벗어나면 추정 신뢰도가 급격히 떨어집니다. 도구는 채널별 관측 최대 지출을 넘지 않도록 제한을 두고 계산합니다." },
      ],
    },
    en: {
      eyebrow: "Tool guide",
      title: "Move budget by marginal efficiency, not average efficiency",
      question: "How much budget should each channel get?",
      answer: "Shift until the next unit of spend is equally efficient everywhere.",
      lead: "Budget allocation compares the likely outcome from the next unit of spend at each channel's current position. It is not a rule to concentrate budget in the channel with the best average result.",
      detailsLabel: "See calculation logic and safeguards",
      sections: [
        ["When to use it", "Use it for weekly or monthly reallocations, scale-up reviews, and saturation checks. Response curves are more useful when each channel has enough historical spend and outcome variation."],
        ["What it estimates", "The tool compares estimated incremental outcomes near current spend. A channel with strong average efficiency can rank lower when it is near saturation, while a moderate channel can rank higher when headroom remains. It is a historical simulation, not a guarantee."],
        ["How to act", "Apply recommendations in small steps, then compare actual CPA or ROAS with the estimated range. Check cannibalization before increasing a suspect channel, and treat sparse new channels as an experiment budget rather than a model-led scale decision."],
      ],
      faq: [
        { q: "Can I apply the recommended split as-is?", a: "Applying the full move at once is not recommended. It is a simulation from historical observations, so shift in small steps and compare actuals against the estimated range." },
        { q: "Why not give everything to the best average-efficiency channel?", a: "Because the decision uses marginal efficiency. A saturated channel produces a worse next unit than its average suggests, which lowers its priority." },
        { q: "Can it plan budgets far above anything observed?", a: "Reliability drops sharply outside the observed spend range, so the tool constrains recommendations to stay within each channel's observed maximum spend." },
      ],
    },
  },
  "5-4": {
    ko: {
      eyebrow: "도구 사용 가이드",
      title: "차이가 있었는지보다, 그 차이를 믿을 만한지를 먼저 보세요",
      question: "A/B 테스트 결과가 유의한지 어떻게 판단하나요?",
      answer: "신뢰구간이 0을 포함하는지 보고 표본이 충분했는지 함께 확인합니다.",
      lead: "실험 분석은 시작 전 필요한 표본을 설계하고, 끝난 뒤 두 그룹의 차이와 신뢰구간·검정력을 함께 읽습니다. 전환율이 높게 나왔다는 사실만으로 승자를 정하지 않기 위한 도구입니다.",
      detailsLabel: "설계 기준과 판독 규칙 보기",
      sections: [
        ["언제 써야 하나", "소재·랜딩·오퍼를 비교하기 전 표본을 설계할 때, 이미 끝난 테스트의 결과를 판정할 때, 기간을 더 돌려야 할지 결정할 때 사용합니다. 그룹별 노출(또는 방문)과 전환 수만 있으면 계산할 수 있습니다."],
        ["무엇을 확인하나", "관측된 차이(lift)와 신뢰구간, 그 차이를 탐지할 검정력을 함께 봅니다. 신뢰구간이 0을 걸치면 '차이 없음'이 아니라 '현재 표본으로는 판단 불가'이며, 이 구분이 잘못된 종료 결정을 막습니다."],
        ["결과를 어떻게 쓰나", "유의하고 실질 효과 크기도 충분하면 적용하고, 판단 불가면 필요한 추가 표본과 예상 기간을 확인해 계속할지 중단할지 정합니다. 실험 중 매일 들여다보며 유의해지는 순간 멈추면 거짓 양성이 크게 늘어납니다."],
      ],
      faq: [
        { q: "유의하지 않으면 효과가 없는 건가요?", a: "아닙니다. 표본이 부족해 탐지하지 못했을 수 있습니다. '효과 없음'을 주장하려면 충분한 검정력이 확보됐다는 근거가 따로 필요합니다." },
        { q: "결과가 좋아 보이면 일찍 끝내도 되나요?", a: "권장하지 않습니다. 유의해지는 시점에 중단하면 우연한 변동을 승리로 확정하기 쉬워 거짓 양성이 늘어납니다. 설계한 표본을 채우는 편이 안전합니다." },
        { q: "A/B와 증분 분석은 무엇이 다른가요?", a: "A/B는 두 안 중 무엇이 나은지를 비교하고, 증분 분석은 광고 자체가 없었어도 생겼을 성과를 제외한 순수 기여를 추정합니다. 목적이 다르므로 도구도 분리돼 있습니다." },
      ],
    },
    en: {
      eyebrow: "Tool guide",
      title: "Ask whether the difference is trustworthy, not just whether it exists",
      question: "How do I judge whether an A/B result is significant?",
      answer: "Check whether the interval excludes zero, and whether the sample was sufficient.",
      lead: "Experiment analysis plans the sample you need before the test and reads lift, confidence interval, and power together afterwards. It exists so a higher observed rate alone does not decide the winner.",
      detailsLabel: "See design rules and read-out criteria",
      sections: [
        ["When to use it", "Use it to size a creative, landing, or offer test before launch, to judge a finished test, and to decide whether to keep collecting data. Exposures (or sessions) and conversions per group are enough."],
        ["What to inspect", "Read the observed lift with its confidence interval and the power to detect that difference. An interval crossing zero means 'not decidable with this sample', not 'no effect'—the distinction prevents premature stops."],
        ["How to act", "Ship when the result is both statistically and practically meaningful. When it is undecidable, check the additional sample and time required before choosing to continue or stop. Peeking daily and stopping at significance inflates false positives."],
      ],
      faq: [
        { q: "Does a non-significant result mean no effect?", a: "No. The sample may simply have been too small to detect one. Claiming 'no effect' requires separate evidence that power was sufficient." },
        { q: "Can I stop early when results look good?", a: "Not advisable. Stopping the moment a test turns significant converts random variation into declared wins and raises false positives. Filling the planned sample is safer." },
        { q: "How is this different from incrementality?", a: "A/B compares two variants; incrementality estimates what advertising added beyond what would have happened anyway. Different questions, so they are separate tools." },
      ],
    },
  },
  "5-20": {
    ko: {
      eyebrow: "도구 사용 가이드",
      title: "어떤 초기 행동이 오래 남는 사용자와 함께 나타나는지 찾으세요",
      question: "초기 이탈을 줄이려면 어떤 행동을 유도해야 하나요?",
      answer: "정착과 가장 강하게 연결된 행동 횟수와 기간 조합을 찾습니다.",
      lead: "핵심 가치 발굴은 '며칠 안에 몇 번' 조합을 격자 탐색해, 장기 잔존·가치와 가장 강하게 연결되는 초기 행동 기준을 찾습니다. 온보딩과 캠페인 목표 이벤트를 정할 때 쓰는 탐색 도구입니다.",
      detailsLabel: "탐색 방식과 해석 한계 보기",
      sections: [
        ["언제 써야 하나", "온보딩 개선 우선순위를 정할 때, 광고 최적화 이벤트를 무엇으로 둘지 고를 때, 리텐션이 갈리는 지점을 찾을 때 사용합니다. 사용자 식별자·이벤트명·발생 시각이 담긴 이벤트 CSV가 필요합니다."],
        ["무엇을 계산하나", "윈도우(일)와 횟수 조합마다 기준 충족 여부와 장기 성과를 교차해 리프트와 F1을 계산하고, 표본이 충분한 후보만 상위로 올립니다. 세그먼트 컬럼을 지정하면 값별로 나눠 볼 수 있습니다."],
        ["결과를 어떻게 쓰나", "찾은 기준은 '이 행동을 하게 만들면 잔존이 올라간다'는 증명이 아니라 실험 가설입니다. 온보딩 변경이나 캠페인 목표 이벤트 변경으로 검증하고, 그 검증은 A/B 또는 증분 분석의 몫입니다."],
      ],
      faq: [
        { q: "이 행동을 유도하면 리텐션이 오르나요?", a: "그렇다고 단정할 수 없습니다. 관측된 연관이며, 원래 잔존할 사용자가 그 행동을 많이 했을 수도 있습니다. 인과는 실험으로 확인해야 합니다." },
        { q: "이벤트 종류가 많으면 어떻게 되나요?", a: "조합이 늘어날수록 우연히 좋아 보이는 후보도 늘어납니다. 표본 크기와 리프트 안정성을 함께 보고, 상위 1개만 맹신하지 마세요." },
        { q: "어떤 데이터가 필요한가요?", a: "사용자 식별자, 이벤트 이름, 발생 시각이 행 단위로 있는 CSV가 필요합니다. 장기 성과 판정용 컬럼이 있으면 리프트 계산이 더 정확해집니다." },
      ],
    },
    en: {
      eyebrow: "Tool guide",
      title: "Find which early action shows up alongside users who stay",
      question: "Which action should I drive to reduce early churn?",
      answer: "Find the action count and window most associated with users who stay.",
      lead: "The aha-moment finder grid-searches 'how many times within how many days' and surfaces the early-action threshold most strongly associated with lasting value. It is an exploration tool for onboarding and campaign event choices.",
      detailsLabel: "See the search method and interpretation limits",
      sections: [
        ["When to use it", "Use it to prioritize onboarding work, to choose an optimization event for campaigns, or to locate where retention diverges. You need an event CSV with user id, event name, and timestamp."],
        ["What it calculates", "For each window-and-count pair, threshold membership is crossed with long-term outcomes to compute lift and F1, and only candidates with enough sample rise to the top. Mapping a segment column splits the search by value."],
        ["How to act", "Treat the threshold as an experiment hypothesis, not proof that driving the action raises retention. Validate with an onboarding change or an event switch, and let A/B or incrementality carry the causal claim."],
      ],
      faq: [
        { q: "If I drive this action, will retention improve?", a: "Not necessarily. The relationship is observational—users who would have stayed anyway may simply perform the action more. Causality requires an experiment." },
        { q: "What if I have many event types?", a: "More combinations mean more candidates that look good by chance. Read sample size and lift stability together instead of trusting the single top row." },
        { q: "What data is required?", a: "A row-level CSV with user id, event name, and timestamp. A long-term outcome column makes the lift calculation more reliable." },
      ],
    },
  },
  "5-23": {
    ko: {
      eyebrow: "도구 사용 가이드",
      title: "광고가 없었어도 생겼을 성과를 빼고 남는 몫을 봅니다",
      question: "광고를 껐을 때 성과가 얼마나 줄어드나요?",
      answer: "홀드아웃이나 전후 비교로 광고가 만든 몫만 추정합니다.",
      lead: "증분 분석은 광고가 실제로 더 만든 성과를 추정합니다. 통제군(홀드아웃), 신규 켜기, 종료 세 가지 설계를 지원하며, 각 설계가 감당할 수 있는 결론의 강도를 함께 표시합니다.",
      detailsLabel: "세 가지 설계와 신뢰 조건 보기",
      sections: [
        ["언제 써야 하나", "어트리뷰션 숫자를 그대로 믿기 어려울 때, 브랜드·리타겟팅처럼 자연 유입과 겹치는 채널을 평가할 때, 채널 종료·신규 개시의 실제 영향을 확인할 때 사용합니다. 설계별로 필요한 데이터가 다릅니다."],
        ["무엇을 계산하나", "통제군 설계는 동시 기간의 노출군과 홀드아웃을 비교하고, 전후 설계는 시점 전후의 변화에서 반사실 기준선을 추정합니다. 대조군이 있으면 이중차분으로 공통 추세를 걷어냅니다."],
        ["결과를 어떻게 쓰나", "무작위 배정된 통제군 결과가 가장 강한 근거이고, 전후 비교는 시즌·프로모션 같은 동시 변화에 취약합니다. 도구는 이 차이를 결과 화면에 명시하므로, 결론의 강도를 데이터 설계에 맞춰 보고하세요."],
      ],
      faq: [
        { q: "전후 비교만으로 인과를 말할 수 있나요?", a: "말할 수 없습니다. 같은 시점에 시즌·프로모션·경쟁 변화가 있으면 그 영향이 섞입니다. 대조군을 붙인 이중차분이 최소 조건이고, 무작위 홀드아웃이 가장 강합니다." },
        { q: "홀드아웃은 얼마나 크게 잡아야 하나요?", a: "탐지하려는 효과 크기에 따라 다릅니다. 너무 작으면 판단 불가로 끝나므로 실험 분석의 표본 설계로 먼저 확인하는 편이 좋습니다." },
        { q: "결과가 음수로 나올 수도 있나요?", a: "나올 수 있습니다. 표본 변동이나 동시 변화 때문일 수 있으므로 신뢰구간과 함께 읽고, 단독 근거로 채널을 종료하지 마세요." },
      ],
    },
    en: {
      eyebrow: "Tool guide",
      title: "Measure what remains after removing what would have happened anyway",
      question: "How much would I lose if I turned ads off?",
      answer: "Estimate only the advertising-created share with a holdout or pre/post design.",
      lead: "Incrementality analysis estimates the outcomes advertising actually added. It supports three designs—holdout, switch-on, and switch-off—and states how strong a conclusion each design can carry.",
      detailsLabel: "See the three designs and their conditions",
      sections: [
        ["When to use it", "Use it when attribution numbers are hard to trust, when evaluating brand or retargeting spend that overlaps organic demand, or when checking the real impact of turning a channel on or off. Data requirements differ by design."],
        ["What it calculates", "The holdout design compares an exposed group with a suppressed group over the same period. Pre/post designs estimate a counterfactual baseline around the switch point, and adding a control group removes shared trend through difference-in-differences."],
        ["How to act", "A randomized holdout gives the strongest evidence; pre/post comparison is vulnerable to anything that changed at the same time. The tool states that difference on the result screen, so report conclusions at the strength your design supports."],
      ],
      faq: [
        { q: "Can pre/post comparison prove causality?", a: "No. Seasonality, promotions, and competitive shifts at the same moment are absorbed into the estimate. A difference-in-differences control is the minimum; randomized holdout is strongest." },
        { q: "How large should a holdout be?", a: "It depends on the effect size you want to detect. Too small and the test ends undecidable, so size it first with the experiment analysis tool." },
        { q: "Can the result be negative?", a: "Yes. Sampling variation or concurrent changes can produce it. Read the interval alongside the point estimate and never shut a channel on this evidence alone." },
      ],
    },
  },
  "5-24": {
    ko: {
      eyebrow: "도구 사용 가이드",
      title: "브랜드 캠페인이 만든 증가분을 시계열로 분리합니다",
      question: "브랜드 캠페인 효과는 어떻게 측정하나요?",
      answer: "끌 수 없으므로 개입 전 추세를 연장해 비교합니다.",
      lead: "브랜드 캠페인 증분 분석은 브랜드 검색·직접 유입·가입 같은 시계열에서 캠페인 시작 전후의 수준·기울기 변화를 추정합니다. 홀드아웃을 만들기 어려운 브랜드 활동을 그나마 엄밀하게 보기 위한 설계입니다.",
      detailsLabel: "ITS 추정과 신뢰 조건 보기",
      sections: [
        ["언제 써야 하나", "TV·유튜브·옥외처럼 개별 노출을 나눌 수 없는 캠페인을 평가할 때, 브랜드 검색량이 캠페인 시점에 올랐는지 확인할 때 사용합니다. 캠페인 전후로 충분히 긴 기간의 일별·주별 시계열이 필요합니다."],
        ["무엇을 계산하나", "개입 시점을 기준으로 추세를 이어 붙이는 중단 시계열(ITS) 회귀로 수준 변화와 기울기 변화를 추정하고, 시계열 자기상관을 보정해 표준오차가 과소평가되지 않도록 합니다. 대조 지표가 있으면 함께 연결할 수 있습니다."],
        ["결과를 어떻게 쓰나", "추정된 증가분은 '캠페인 시점에 이만큼 달라졌다'는 관측이며, 같은 시점의 시즌·PR·제품 출시와 구분되지 않습니다. 반복 가능한 캠페인이라면 지역 분할 홀드아웃으로 다시 확인하는 편이 훨씬 강한 근거가 됩니다."],
      ],
      faq: [
        { q: "브랜드 검색이 올랐으면 캠페인 효과인가요?", a: "단정할 수 없습니다. 같은 시기의 PR·제품 출시·시즌 수요가 같은 모양을 만듭니다. 대조 지표나 지역 분할로 공통 변화를 걷어내야 합니다." },
        { q: "기간이 얼마나 필요한가요?", a: "개입 전 추세를 추정할 수 있을 만큼은 필요합니다. 전 구간이 몇 점뿐이면 기울기 추정이 불안정해 결론을 내리기 어렵습니다." },
        { q: "왜 자기상관 보정을 하나요?", a: "시계열 데이터는 인접 시점이 서로 닮아 있어 보정 없이는 표준오차가 작게 나오고, 실제보다 유의해 보입니다." },
      ],
    },
    en: {
      eyebrow: "Tool guide",
      title: "Isolate brand-campaign lift from the time series itself",
      question: "How do I measure a brand campaign?",
      answer: "You cannot pause it, so extend the pre-period trend and compare.",
      lead: "Brand campaign incrementality estimates level and slope change around a campaign start in series like brand search, direct traffic, or signups. It is the most rigorous option available when a clean holdout cannot be built.",
      detailsLabel: "See the ITS estimate and its conditions",
      sections: [
        ["When to use it", "Use it for TV, YouTube, or out-of-home activity where individual exposure cannot be split, or to test whether brand search rose at the campaign start. Enough history on both sides of the intervention is required."],
        ["What it calculates", "An interrupted time series regression estimates the level shift and slope change at the intervention point, with autocorrelation correction so standard errors are not understated. A control series can be attached when available."],
        ["How to act", "The estimate says the series changed at that moment; it cannot separate the campaign from a product launch, PR, or seasonal demand at the same time. For repeatable campaigns, a geo-split holdout gives far stronger evidence."],
      ],
      faq: [
        { q: "Brand search rose—was it the campaign?", a: "Not provably. PR, launches, and seasonal demand create the same shape. A control series or geo split is needed to remove shared movement." },
        { q: "How much history do I need?", a: "Enough to estimate the pre-intervention trend. With only a few pre-period points the slope estimate is unstable and no conclusion is warranted." },
        { q: "Why correct for autocorrelation?", a: "Adjacent periods in a time series resemble each other, so uncorrected standard errors come out too small and results look more significant than they are." },
      ],
    },
  },
  "5-27": {
    ko: {
      eyebrow: "도구 사용 가이드",
      title: "스토어 전환율이 떨어진 이유를 페이지와 유입으로 가릅니다",
      question: "스토어 전환율이 떨어졌는데 스크린샷을 바꿔야 하나요?",
      answer: "소스별 전환율이 그대로면 페이지가 아니라 유입 구성 문제입니다.",
      lead: "ASO 스토어 전환 분석은 스토어 콘솔 CSV로 노출→제품 페이지 조회→설치 퍼널을 세우고, 두 기간의 전환율 변화를 트래픽 구성 효과와 소스별 효율 효과로 나눕니다. 처방이 정반대인 두 원인을 섞인 채로 두면 어느 쪽도 못 고치기 때문입니다.",
      detailsLabel: "분해 방식과 한계 보기",
      sections: [
        ["언제 써야 하나", "전체 스토어 전환율이 눈에 띄게 떨어졌을 때, 광고를 크게 늘린 구간에 오가닉 설치가 줄었을 때, 스크린샷을 바꿔야 할지 판단이 안 설 때 씁니다. 날짜·유입 소스·제품 페이지 조회·설치 네 열이면 됩니다."],
        ["무엇을 계산하나", "기간을 앞뒤로 갈라 소스별 전환율과 설치 비중을 구하고, 전체 전환율 변화를 구성 효과(비중 이동)와 효율 효과(소스별 전환율 변화)로 분해합니다. 분해 수학은 캠페인 성과 변동에서 쓰는 것과 같은 무잔차 분해입니다."],
        ["결과를 어떻게 쓰나", "구성 효과가 지배적이면 페이지가 아니라 유입이 왜 바뀌었는지(광고 증액·피처링·시즌)를 보고, 효율 효과가 지배적이면 아이콘·스크린샷·평점 같은 제품 페이지 요소를 봅니다. 확정은 스토어 실험으로 하세요."],
      ],
      faq: [
        { q: "노출 데이터가 없어도 쓸 수 있나요?", a: "쓸 수 있습니다. 노출 열이 없으면 탭률만 계산하지 않고, 제품 페이지 조회→설치 전환과 소스별 분해는 그대로 나옵니다." },
        { q: "구성 효과가 크면 아무것도 안 해도 되나요?", a: "아닙니다. 페이지를 고칠 일이 아니라는 뜻이지 문제가 없다는 뜻은 아닙니다. 전환이 낮은 소스의 비중이 왜 늘었는지가 다음 질문입니다." },
        { q: "이 분해로 인과를 말할 수 있나요?", a: "없습니다. 관측 데이터에서 어디를 볼지 좁혀줄 뿐이고, 같은 기간에 광고·피처링·시즌이 함께 움직였다면 원인까지는 알 수 없습니다." },
      ],
    },
    en: {
      eyebrow: "Tool guide",
      title: "Separate a store conversion drop into page and traffic causes",
      question: "Store conversion dropped — should I change the screenshots?",
      answer: "If per-source conversion held, the cause is the traffic mix, not the page.",
      lead: "ASO store conversion analysis builds the impression-to-page-to-install funnel from a store console CSV, then splits the change between two periods into a traffic-mix effect and a per-source efficiency effect. The two causes call for opposite fixes, so neither can be addressed while they stay blended.",
      detailsLabel: "See the decomposition and its limits",
      sections: [
        ["When to use it", "When blended store conversion falls noticeably, when organic installs drop during a period of paid scaling, or when you cannot tell whether screenshots need work. Four columns are enough: date, traffic source, product page views, installs."],
        ["What it computes", "It splits the period in half, computes per-source conversion and install share, and decomposes the blended change into a mix effect (share movement) and an efficiency effect (per-source conversion change). The decomposition is the same residual-free math used for campaign performance variance."],
        ["How to use the result", "If the mix effect dominates, investigate why traffic composition changed — paid scaling, featuring, seasonality — rather than the page. If the efficiency effect dominates, look at icon, screenshots, and rating. Confirm either with a store experiment."],
      ],
      faq: [
        { q: "Can I use it without impressions data?", a: "Yes. Without an impressions column only tap-through is skipped; page-to-install conversion and the per-source decomposition still compute." },
        { q: "If the mix effect dominates, is there nothing to do?", a: "No — it means the page is not the fix, not that nothing is wrong. The next question is why the share of low-converting sources grew." },
        { q: "Does this establish cause?", a: "It does not. It narrows where to look in observational data, and if ads, featuring, and seasonality all moved in the same window it cannot tell you which one did it." },
      ],
    },
  },
  "5-25": {
    ko: {
      eyebrow: "도구 사용 가이드",
      title: "채널 기여도를 나눌 수 있는 데이터인지 먼저 확인하세요",
      question: "MMM 결과가 이상한데 왜 그런가요?",
      answer: "채널 지출이 늘 같이 움직였다면 기여도를 분리할 수 없습니다.",
      lead: "다중공선성 진단은 채널별 지출이 서로 얼마나 같이 움직이는지를 VIF와 상관으로 봅니다. 채널들이 늘 함께 움직이면 어떤 모델도 기여를 채널별로 나눌 수 없기 때문에, MMM 실행 전 점검용입니다.",
      detailsLabel: "VIF 해석과 대응 방법 보기",
      sections: [
        ["언제 써야 하나", "MMM이나 회귀로 채널 기여를 나누기 전, 계수 부호가 상식과 반대로 나올 때, 표준오차가 지나치게 커서 결론이 흔들릴 때 사용합니다. 기간별 채널 지출 패널만 있으면 됩니다."],
        ["무엇을 계산하나", "각 채널 지출을 나머지 채널로 설명했을 때의 설명력에서 VIF를 계산하고, 채널 간 상관 행렬을 함께 보여줍니다. 값이 클수록 그 채널의 고유한 변동이 적어 기여 분리가 어렵다는 뜻입니다."],
        ["결과를 어떻게 쓰나", "높게 나온 채널은 묶어서 하나의 그룹으로 다루거나, 예산 스케줄을 서로 다르게 흔들어 고유 변동을 만드는 것이 근본 대응입니다. 진단 없이 나온 채널별 기여 숫자를 그대로 보고하지 마세요."],
      ],
      faq: [
        { q: "VIF가 높으면 MMM을 못 돌리나요?", a: "돌릴 수는 있지만 채널별 기여 분리를 신뢰할 수 없습니다. 그룹으로 묶어 해석하거나 지출 패턴을 다르게 만든 뒤 다시 추정하는 것이 정확합니다." },
        { q: "왜 계수가 음수로 나오나요?", a: "채널들이 함께 움직이면 추정이 불안정해져 부호가 뒤집히기도 합니다. 이 경우의 음수는 '잠식의 증거'가 아니라 '식별 불가의 징후'로 읽어야 합니다." },
        { q: "어떻게 고유 변동을 만드나요?", a: "채널별로 증감 시점을 어긋나게 하거나 일부 기간·지역에서만 켜는 식으로 지출 스케줄을 다르게 설계하면 됩니다." },
      ],
    },
    en: {
      eyebrow: "Tool guide",
      title: "Check whether your data can separate channel contribution at all",
      question: "Why does my MMM output look wrong?",
      answer: "If channel spends always moved together, contribution cannot be separated.",
      lead: "The multicollinearity check measures how much channel spends move together using VIF and correlation. When channels always rise and fall in step, no model can split their contribution—so this runs before MMM, not after.",
      detailsLabel: "See how to read VIF and what to do about it",
      sections: [
        ["When to use it", "Use it before attributing contribution with MMM or regression, when coefficient signs contradict domain knowledge, or when standard errors are so wide that conclusions flip. A per-period channel spend panel is enough."],
        ["What it calculates", "VIF is derived from how well each channel's spend is explained by the others, alongside the full correlation matrix. Higher values mean less unique variation and therefore weaker identification."],
        ["How to act", "Group highly collinear channels and interpret them together, or create unique variation by staggering budget schedules. Do not report per-channel contribution numbers produced without this check."],
      ],
      faq: [
        { q: "Does high VIF mean I cannot run MMM?", a: "You can run it, but per-channel separation will not be trustworthy. Interpreting grouped channels, or re-estimating after varying spend patterns, is the accurate path." },
        { q: "Why is a coefficient negative?", a: "Collinear inputs make estimates unstable and signs can flip. Such a negative should be read as a symptom of non-identification, not as evidence of cannibalization." },
        { q: "How do I create unique variation?", a: "Stagger increases and decreases across channels, or run a channel only in selected periods or regions, so spend schedules stop moving in lockstep." },
      ],
    },
  },
  "5-26": {
    ko: {
      eyebrow: "도구 사용 가이드",
      title: "검색어 리포트에서 승격할 키워드와 조정할 입찰을 뽑습니다",
      question: "Apple Search Ads 키워드를 어떻게 정리하나요?",
      answer: "성과가 검증된 검색어를 Exact로 올리고 CPT를 조정합니다.",
      lead: "ASA 키워드 발굴기는 Apple Search Ads 검색어 리포트를 읽어 Exact로 승격할 후보, 제외 검토 대상, 예산 소진과 목표 CPA에 따른 CPT 증감 후보를 정리합니다.",
      detailsLabel: "판정 기준과 사용 순서 보기",
      sections: [
        ["언제 써야 하나", "Discovery 캠페인에서 성과가 나온 검색어를 Exact 캠페인으로 옮길 때, 소진이 목표에 못 미치거나 CPA가 목표를 넘을 때 입찰을 손볼 근거가 필요할 때 사용합니다. ASA 검색어 리포트를 그대로 올리면 됩니다."],
        ["무엇을 계산하나", "검색어별 전환·비용·CPA를 목표와 비교해 승격·제외 후보를 나누고, 예산 소진률과 목표 CPA를 함께 보고 CPT 증액·감액 방향을 제안합니다. 전환이 적은 검색어는 판단 보류로 남깁니다."],
        ["결과를 어떻게 쓰나", "승격 후보는 Exact 캠페인에 넣고 Discovery에서는 제외해 중복 경쟁을 막습니다. 입찰 조정은 한 번에 크게 움직이지 말고 제안 방향으로 단계적으로 적용한 뒤 재측정하세요."],
      ],
      faq: [
        { q: "전환이 1~2건인 검색어도 승격하나요?", a: "권장하지 않습니다. 표본이 적으면 CPA가 크게 흔들립니다. 도구는 이런 검색어를 판단 보류로 분리해 성급한 승격을 막습니다." },
        { q: "CPT를 얼마나 올려야 하나요?", a: "고정 비율은 없습니다. 소진률과 목표 CPA 여유를 함께 보고 단계적으로 조정한 뒤 재측정하는 방식이 안전합니다." },
        { q: "승격 후 Discovery에서 제외해야 하나요?", a: "일반적으로 그렇습니다. 같은 검색어가 두 캠페인에서 경쟁하면 비용이 올라가고 성과 해석도 어려워집니다." },
      ],
    },
    en: {
      eyebrow: "Tool guide",
      title: "Turn a search-term report into promotions and bid moves",
      question: "How do I clean up Apple Search Ads keywords?",
      answer: "Promote proven search terms to Exact and adjust their CPT.",
      lead: "The ASA keyword finder reads an Apple Search Ads search-term report and separates Exact-promotion candidates, negative-keyword candidates, and CPT increases or decreases based on budget pacing and target CPA.",
      detailsLabel: "See the decision rules and working order",
      sections: [
        ["When to use it", "Use it to graduate proven Discovery search terms into Exact campaigns, or when spend is under-pacing or CPA is above target and a bid change needs justification. Upload the ASA search-term report as-is."],
        ["What it calculates", "Conversions, cost, and CPA per term are compared with your target to split promotion and exclusion candidates, while pacing and target CPA drive the suggested CPT direction. Terms with too few conversions stay undecided."],
        ["How to act", "Add promoted terms to the Exact campaign and negate them in Discovery so the two do not bid against each other. Apply bid changes in steps and re-measure instead of making one large move."],
      ],
      faq: [
        { q: "Should I promote a term with one or two conversions?", a: "Not recommended. CPA is volatile at that sample size, so the tool separates those terms as undecided to prevent premature promotion." },
        { q: "How much should I raise CPT?", a: "There is no fixed percentage. Adjust in steps using pacing and target-CPA headroom, then re-measure before the next move." },
        { q: "Do I need to negate promoted terms in Discovery?", a: "Usually yes. Letting the same term compete in both campaigns raises cost and blurs performance attribution." },
      ],
    },
  },
  "9-1": {
    ko: {
      eyebrow: "도구 사용 가이드",
      title: "어떤 요소가 성과와 연결되는지, 다른 조건을 통제하고 봅니다",
      question: "어떤 콘텐츠 요소가 성과에 영향을 주나요?",
      answer: "다른 요소를 통제한 회귀로 요소별 연관을 비교합니다.",
      lead: "콘텐츠 요소 분석은 후킹·형식·길이·메시지 같은 요소를 회귀로 비교합니다. 단순 평균 비교와 달리 다른 요소를 함께 통제하므로, '길이가 길어서'인지 '형식이 달라서'인지를 구분하려 할 때 씁니다.",
      detailsLabel: "추정 방식과 통계적 한계 보기",
      sections: [
        ["언제 써야 하나", "다음 제작 브리프에서 무엇을 바꿀지 정할 때, 잘된 콘텐츠의 공통점을 감이 아니라 데이터로 확인할 때 사용합니다. 콘텐츠별 성과와 요소 태그가 함께 있는 CSV가 필요합니다."],
        ["무엇을 계산하나", "요소별 영향력을 회귀 계수로 추정하고 이분산에 강한 표준오차와 다중검정 보정을 적용해, 요소 수가 많을 때 우연히 유의해 보이는 것을 줄입니다. 설계행렬이 불안정하면 숫자를 만들지 않고 추론을 거부합니다."],
        ["결과를 어떻게 쓰나", "강한 요소는 다음 실험에서 의도적으로 바꿔볼 후보이지 확정된 성공 공식이 아닙니다. 관측 데이터라 제작자·시기·타겟 같은 보이지 않는 요인이 섞일 수 있으므로 A/B로 확인하세요."],
      ],
      faq: [
        { q: "유의한 요소를 넣으면 성과가 오르나요?", a: "보장할 수 없습니다. 관측 데이터의 연관이며, 그 요소를 자주 쓴 제작자나 시기가 실제 원인일 수 있습니다. 확인은 실험으로 합니다." },
        { q: "무유의 요소는 효과가 없는 건가요?", a: "아닙니다. 표본이 적거나 변동이 작아 탐지하지 못한 경우가 많습니다. 증거 부족과 효과 없음은 다릅니다." },
        { q: "요소를 몇 개까지 넣을 수 있나요?", a: "콘텐츠 수 대비 요소가 너무 많으면 추정이 불안정해집니다. 이 경우 도구는 결과를 만들어내지 않고 추론 불가를 표시합니다." },
      ],
    },
    en: {
      eyebrow: "Tool guide",
      title: "See which elements relate to performance, holding the rest constant",
      question: "Which content elements affect performance?",
      answer: "Compare per-element association with a regression that controls the others.",
      lead: "Content element analysis compares hooks, formats, length, and message traits with regression. Unlike averaging by tag, it controls for the other elements, which is what separates 'longer worked' from 'the format worked'.",
      detailsLabel: "See the estimation method and statistical limits",
      sections: [
        ["When to use it", "Use it to decide what to change in the next production brief, or to check shared traits of winning content with data rather than intuition. A CSV pairing per-asset performance with element tags is required."],
        ["What it calculates", "Element influence is estimated as regression coefficients with heteroskedasticity-robust standard errors and multiple-comparison correction, which reduces elements that look significant by chance. When the design matrix is unstable the tool refuses inference instead of printing numbers."],
        ["How to act", "Strong elements are candidates to vary deliberately in the next test, not a proven formula. Observational data still carries hidden factors like creator, timing, and audience, so confirm with an A/B test."],
      ],
      faq: [
        { q: "If I add a significant element, will performance rise?", a: "Not guaranteed. The relationship is observational, and the creator or period that favored that element may be the real driver. Confirm with an experiment." },
        { q: "Does a non-significant element have no effect?", a: "No. Small samples or little variation often prevent detection. Insufficient evidence is not the same as no effect." },
        { q: "How many elements can I include?", a: "Too many elements relative to the number of assets destabilizes estimation. In that case the tool reports that inference is not possible rather than producing a result." },
      ],
    },
  },
};

export const TOOL_SEARCH_CONTENT_IDS = Object.keys(CONTENT);

export function getToolSearchContent(toolId, locale = "ko") {
  const localeKey = locale === "en" ? "en" : "ko";
  return CONTENT[toolId]?.[localeKey] || getResponseSubtoolContent(toolId, localeKey) || null;
}

// FAQPage JSON-LD용 목록. 도구가 답하는 핵심 질문을 **첫 항목**으로 올린다 —
// 화면에서 접기 바깥에 두는 것과 같은 이유다. 5-18 하위 폴백 콘텐츠에는 두 필드가
// 없을 수 있으므로 있을 때만 앞에 붙인다.
export function getToolFaq(toolId, locale = "ko") {
  const content = getToolSearchContent(toolId, locale);
  if (!content?.faq?.length) return [];
  const head = content.question && content.answer ? [{ q: content.question, a: content.answer }] : [];
  return [...head, ...content.faq];
}
