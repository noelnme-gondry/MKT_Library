// 시안 B — 글 끝의 "확인차" 상황 점검. 읽은 사람이 자기 상황을 한 번 누르면 맞는 답
// 한 줄과 이어서 볼 곳이 나온다. CSV가 없는 독자도 누를 이유가 있다.
//
// 모든 글에 붙는다: 기본은 글의 주 도구(`PUBLISHED_BLOG_TOOL_MAP`)에 맞춘 질문,
// CSV로 계산할 수 없는 글은 글 단위 질문이 우선한다(도구 질문이 글과 무관해지므로).
// 답 문장은 도구 정의와 글 본문이 이미 말한 기준만 쓴다. 대상은 `tool`(라우트 id) 또는 `path`.
// `blogSituationCheck.test.js`가 발행 글 전체의 커버리지·세 선택지·두 언어·대상 실재를 강제한다.

const T = (ko, en) => ({ ko, en });

const BY_TOOL = {
  "5-2": {
    q: T("지금 설치당 비용(CPI·CPA)은 어떤가요?", "How is your cost per install or action right now?"),
    options: [
      { label: T("어제·오늘 갑자기 튀었다", "It jumped in the last day or two"), answer: T("먼저 평소 변동 범위를 벗어났는지 보세요. 하루 노이즈를 고치면 학습만 흔들립니다.", "First check whether it left its normal range. Fixing one day of noise only disrupts learning."), tool: "5-21" },
      { label: T("몇 주째 조금씩 나빠진다", "It has crept up for weeks"), answer: T("전체 평균을 채널·캠페인으로 쪼개서 어디서 시작됐는지 보세요.", "Split the average by channel and campaign to see where it started."), tool: "5-21" },
      { label: T("괜찮은데 기준을 잡아 두고 싶다", "It's fine; I want a baseline"), answer: T("이번 주 지출·설치·단가를 한 화면에 모아 두면 다음 변화 때 비교할 기준이 됩니다.", "Put this week's spend, installs and unit cost in one view as a baseline for the next change."), tool: "5-2" },
    ],
  },
  "5-21": {
    q: T("성과가 어떻게 바뀌었나요?", "How did performance change?"),
    options: [
      { label: T("한 채널만 나빠진 것 같다", "One channel seems worse"), answer: T("채널→캠페인→소재 순으로 내려가며 변화를 만든 곳을 좁히세요.", "Drill down channel → campaign → creative to narrow where the change came from."), tool: "5-21" },
      { label: T("모든 채널이 같이 나빠졌다", "Every channel got worse"), answer: T("공통 원인(측정·시즌·경매)을 의심하세요. 추세와 계절을 먼저 떼어 보는 편이 안전합니다.", "Suspect a shared cause (measurement, season, auctions). Separate trend and seasonality first."), tool: "5-18-trend" },
      { label: T("예산을 옮긴 뒤 나빠졌다", "It got worse after moving budget"), answer: T("비싼 채널로 비중이 옮겨 갔는지(믹스)와 채널 자체 효율이 변했는지를 나눠 보세요.", "Separate a shift toward pricier channels (mix) from changes in each channel's own efficiency."), tool: "5-21" },
    ],
  },
  "5-22": {
    q: T("다음 예산, 어떻게 하려고 하나요?", "What do you plan to do with the next budget?"),
    options: [
      { label: T("잘되는 채널을 더 늘리려고 한다", "Scale the channel that works"), answer: T("평균이 아니라 추가 광고비의 단가(한계 비용)부터 확인하세요. 평균이 좋아도 이미 포화일 수 있습니다.", "Check the cost of the next unit of spend, not the average. A good average can already be saturated."), tool: "5-22" },
      { label: T("채널 간에 옮기려고 한다", "Move budget between channels"), answer: T("채널별 한계 효율을 비교해 옮길 곳을 정하세요.", "Compare marginal efficiency by channel to decide where to move."), tool: "5-3" },
      { label: T("아직 데이터가 적다", "I don't have much data yet"), answer: T("같은 채널을 여러 날짜·지출 수준에서 관측해야 판단할 수 있습니다. 먼저 기준을 잡아 두세요.", "You need the same channel observed across dates and spend levels. Set up a baseline first."), tool: "5-2" },
    ],
  },
  "5-3": null,
  "5-25": {
    q: T("채널 기여도를 어디에 쓰려고 하나요?", "What will you use channel contribution for?"),
    options: [
      { label: T("MMM을 돌리기 전 점검", "A check before running MMM"), answer: T("채널 지출이 같이 움직이면 기여를 나눌 수 없습니다. VIF부터 확인하세요.", "If channel spend moves together, contributions can't be separated. Check VIF first."), tool: "5-25" },
      { label: T("바로 기여도를 보고 싶다", "I want contribution now"), answer: T("공선성이 낮다면 MMM으로 채널·기본 수요를 나눠 볼 수 있습니다.", "If collinearity is low, MMM can split channels and base demand."), tool: "5-18-mmm" },
      { label: T("광고가 진짜 만든 몫이 궁금하다", "I want what ads truly added"), answer: T("기여도는 연관입니다. 인과를 보려면 홀드아웃 같은 증분 설계가 필요합니다.", "Contribution is association. Causation needs an incrementality design such as a holdout."), tool: "5-23" },
    ],
  },
  "5-26": {
    q: T("검색 광고 계정은 지금 어떤가요?", "Where is your search ads account now?"),
    options: [
      { label: T("검색어 보고서가 쌓였다", "Search term reports have piled up"), answer: T("성과 좋은 검색어를 Exact로 올리고, 목표 CPA로 CPT 조정 후보를 고르세요.", "Promote strong terms to Exact and pick CPT adjustments against target CPA."), tool: "5-26" },
      { label: T("전환 집계가 아직 덜 됐다", "Conversions aren't fully counted yet"), answer: T("전환 지연이 끝난 기간만 넣어야 조정 제안이 흔들리지 않습니다.", "Include only periods past the conversion delay so adjustments don't swing."), tool: "5-26" },
      { label: T("스토어 페이지 전환이 궁금하다", "I'm curious about store page conversion"), answer: T("검색 유입 뒤 페이지에서 새는지 보려면 스토어 전환을 나눠 보세요.", "To see whether search traffic leaks on the page, split store conversion."), tool: "5-27" },
    ],
  },
  "5-27": {
    q: T("스토어 전환율이 어떻게 됐나요?", "What happened to store conversion?"),
    options: [
      { label: T("전체가 떨어졌다", "It fell overall"), answer: T("소스별 전환율이 그대로인데 유입 구성만 바뀐 것일 수 있습니다. 믹스와 효율을 나눠 보세요.", "Per-source rates may be steady while the traffic mix changed. Split mix from efficiency."), tool: "5-27" },
      { label: T("스크린샷을 바꾼 뒤 떨어졌다", "It fell after changing screenshots"), answer: T("같은 기간 유입 구성 변화부터 배제하세요. 페이지 효과는 실험으로 확인하는 편이 안전합니다.", "Rule out a traffic mix change first. Page effects are safer to confirm with an experiment."), tool: "5-4" },
      { label: T("검색 유입만 떨어졌다", "Only search traffic fell"), answer: T("검색어 단위로 어디가 줄었는지 보세요.", "Look at which search terms dropped."), tool: "5-26" },
    ],
  },
  "9-6": {
    q: T("소재 성과가 어떤가요?", "How are your creatives performing?"),
    options: [
      { label: T("같은 소재 클릭률이 계속 떨어진다", "The same creative's CTR keeps falling"), answer: T("노출이 쌓이며 클릭률이 떨어지는 피로 신호인지 확인하고 교체 순서를 정하세요.", "Check for a fatigue signal as impressions pile up, then set a replacement order."), tool: "9-6" },
      { label: T("새 소재가 기존보다 못하다", "New creatives underperform"), answer: T("우연인지 가르려면 같은 기간·같은 조건으로 비교하세요.", "Compare under the same period and conditions to tell it from chance."), tool: "5-4" },
      { label: T("어떤 요소가 먹히는지 궁금하다", "Which elements work?"), answer: T("요소가 겹치는 영향을 떼어 보려면 요소별 기여를 회귀로 나눠 보세요.", "To separate overlapping elements, split their contributions with regression."), tool: "9-1" },
    ],
  },
  "9-1": {
    q: T("콘텐츠 요소를 어떻게 보고 있나요?", "How are you looking at content elements?"),
    options: [
      { label: T("요소별 평균만 비교했다", "I only compared averages by element"), answer: T("요소가 함께 쓰이면 평균 차이가 섞입니다. 회귀로 서로 떼어 보세요.", "Elements used together blur averages. Separate them with regression."), tool: "9-1" },
      { label: T("다음 제작 우선순위를 정하고 싶다", "I want to set production priorities"), answer: T("기여가 크고 구간이 좁은 요소부터 다음 제작에 넣으세요.", "Start with elements that have a large contribution and a narrow interval."), tool: "9-1" },
      { label: T("확실히 효과가 있는지 알고 싶다", "I want to know it really works"), answer: T("회귀는 연관입니다. 확실히 하려면 A/B로 확인하세요.", "Regression is association. Confirm with an A/B test."), tool: "5-4" },
    ],
  },
  "5-18-trend": {
    q: T("광고 효과를 판단하기 전에, 지금 성과 변화는?", "Before judging ads, how has performance changed?"),
    options: [
      { label: T("시즌마다 오르내린다", "It rises and falls with seasons"), answer: T("계절성과 추세를 먼저 떼어야 광고 효과를 과대해석하지 않습니다.", "Separate seasonality and trend first so you don't overstate ad effects."), tool: "5-18-trend" },
      { label: T("오가닉과 유료가 반대로 움직인다", "Organic and paid move oppositely"), answer: T("반대 움직임이 반복되는지 주별로 보세요.", "Check week by week whether the opposite movement repeats."), tool: "5-18-paid-organic" },
      { label: T("채널별 기여를 알고 싶다", "I want each channel's contribution"), answer: T("지출이 같이 움직이는지 먼저 보고 MMM으로 나눠 보세요.", "Check whether spend moves together, then split with MMM."), tool: "5-25" },
    ],
  },
  "5-18-paid-organic": {
    q: T("유료와 오가닉이 어떻게 움직이나요?", "How are paid and organic moving?"),
    options: [
      { label: T("유료를 늘리니 오가닉이 줄었다", "Organic fell when paid grew"), answer: T("반대 움직임이 여러 주 반복되는지부터 보세요. 한 주는 우연일 수 있습니다.", "First check whether the opposite movement repeats over weeks. One week can be chance."), tool: "5-18-paid-organic" },
      { label: T("잠식인지 확인하고 싶다", "I want to confirm cannibalization"), answer: T("네 가지 신호로 잠식 가능성을 점검하세요.", "Check four signals for possible cannibalization."), tool: "5-18-cannibal" },
      { label: T("광고를 꺼 볼 수 있다", "I can switch ads off"), answer: T("끄기 전후를 대조군과 비교하면 광고가 만든 몫을 볼 수 있습니다.", "Comparing before and after against a control shows what ads added."), tool: "5-23" },
    ],
  },
  "5-18-mmm": null,
  "5-4": {
    q: T("실험은 어느 단계인가요?", "Where is your experiment?"),
    options: [
      { label: T("결과가 나왔는데 차이가 작다", "Results are in but the gap is small"), answer: T("우연과 구분되는지 신뢰구간과 p값으로 확인하세요. 유의하지 않다는 것이 효과가 없다는 뜻은 아닙니다.", "Check intervals and p-values against chance. Not significant doesn't mean no effect."), tool: "5-4" },
      { label: T("아직 시작 전이다", "It hasn't started yet"), answer: T("필요한 표본수를 먼저 계산하세요. 너무 작으면 결론이 안 납니다.", "Calculate the sample size first. Too small and you won't reach a conclusion."), tool: "5-4" },
      { label: T("광고 자체의 효과가 궁금하다", "I want the effect of the ads themselves"), answer: T("안 A·B 비교가 아니라 광고를 안 본 그룹과 비교하는 증분 설계가 필요합니다.", "That needs an incrementality design against an unexposed group, not A vs B."), tool: "5-23" },
    ],
  },
  "5-23": {
    q: T("광고 효과를 어떻게 확인할 수 있나요?", "How can you check the ad effect?"),
    options: [
      { label: T("광고를 안 보여 줄 그룹을 만들 수 있다", "I can hold out a group from ads"), answer: T("무작위 홀드아웃이 가장 믿을 만한 방법입니다.", "A randomized holdout is the most reliable approach."), tool: "5-23" },
      { label: T("켜고 끈 시점만 있다", "I only have on/off dates"), answer: T("전후 비교는 계절·시장 변화와 섞입니다. 대조군이 있을 때만 효과라고 부르세요.", "Before/after mixes in seasonal and market changes. Call it an effect only with a control."), tool: "5-23" },
      { label: T("브랜드 캠페인이다", "It's a brand campaign"), answer: T("캠페인 전 추세로 예상치를 만들고 실제와 비교하세요.", "Build an expectation from the pre-campaign trend and compare it with actuals."), tool: "5-24" },
    ],
  },
  "5-24": {
    q: T("브랜드 캠페인을 어떻게 평가하려고 하나요?", "How will you evaluate the brand campaign?"),
    options: [
      { label: T("캠페인 전후 데이터가 있다", "I have data before and after"), answer: T("캠페인 전 추세로 없었을 때 예상치를 만들고 실제와의 차이를 보세요.", "Model the expectation from the pre-campaign trend and compare with actuals."), tool: "5-24" },
      { label: T("비교할 지역·그룹이 있다", "I have a comparison region or group"), answer: T("대조군을 연결하면 같은 시기 시장 변화를 걸러낼 수 있습니다.", "Linking a control filters out market changes in the same period."), tool: "5-24" },
      { label: T("검색 광고와 겹치는지 궁금하다", "Does it overlap with search ads?"), answer: T("유료와 오가닉이 반대로 움직이는지 먼저 보세요.", "First check whether paid and organic move in opposite directions."), tool: "5-18-paid-organic" },
    ],
  },
  "5-20": {
    q: T("리텐션을 올리려고 무엇을 보고 있나요?", "What are you looking at to raise retention?"),
    options: [
      { label: T("초기에 어떤 행동이 중요한지 모른다", "I don't know which early action matters"), answer: T("행동의 횟수·시점 조합을 비교해 장기 전환과 이어지는 후보를 좁히세요.", "Compare action counts and timing to narrow candidates linked to long-term conversion."), tool: "5-20" },
      { label: T("후보 행동을 찾았다", "I've found a candidate action"), answer: T("여러 조합을 훑어 고른 후보는 새 기간에서 다시 확인해야 합니다.", "A candidate picked from many combinations must be rechecked on a new period."), tool: "5-20" },
      { label: T("그 행동을 광고 최적화에 쓰고 싶다", "I want to optimize ads on it"), answer: T("최적화 이벤트로 바꾼 뒤 성과가 실제로 나아졌는지 증분으로 확인하세요.", "After switching the optimization event, verify with incrementality that results improved."), tool: "5-23" },
    ],
  },
};
BY_TOOL["5-18-cannibal"] = {
  q: T("광고가 오가닉을 잠식하는지 어떻게 보고 있나요?", "How are you checking whether paid cannibalizes organic?"),
  options: [
    { label: T("유료를 늘리니 오가닉이 줄었다", "Organic fell when paid grew"), answer: T("반대 움직임이 여러 주 반복되는지부터 보세요. 한 주는 우연일 수 있습니다.", "First check whether the opposite movement repeats over weeks. One week can be chance."), tool: "5-18-paid-organic" },
    { label: T("잠식 가능성을 점검하고 싶다", "I want to check for cannibalization"), answer: T("채널별 네 가지 신호로 잠식 가능성을 점검하세요. 신호는 가능성이지 증명이 아닙니다.", "Check four signals per channel. Signals indicate possibility, not proof."), tool: "5-18-cannibal" },
    { label: T("광고를 꺼 볼 수 있다", "I can switch ads off"), answer: T("끄기 전후를 대조군과 비교하면 광고가 만든 몫을 볼 수 있습니다.", "Comparing before and after against a control shows what ads added."), tool: "5-23" },
  ],
};
BY_TOOL["5-3"] = BY_TOOL["5-22"];
BY_TOOL["5-18-mmm"] = BY_TOOL["5-25"];

// CSV로 계산할 수 없는 글은 글 단위 질문이 우선한다.
const BY_POST = {
  "ios-att-skan-guide": {
    q: T("iOS 성과를 어떻게 판단하고 있나요?", "How are you judging iOS performance?"),
    options: [
      { label: T("매체 리포트를 그대로 믿는다", "I trust the network report as is"), answer: T("유저 단위가 흐려졌으니, 광고가 진짜 만든 몫은 증분으로 확인하세요.", "User-level detail is blurred, so check what ads truly added with incrementality."), tool: "5-23" },
      { label: T("채널 전체 기여를 보고 싶다", "I want overall channel contribution"), answer: T("유저 식별 없이 집계 데이터로 기여를 나누는 MMM이 맞습니다.", "MMM splits contribution from aggregate data without user identity."), tool: "5-18-mmm" },
      { label: T("설정부터 점검하고 싶다", "I want to check the setup first"), answer: T("ATT·SKAN 대응 체크리스트를 순서대로 따라가세요.", "Follow the ATT and SKAN checklist step by step."), path: "/guide/ios-privacy-att-skan" },
    ],
  },
  "skan-vs-mmp-attribution": {
    q: T("무엇을 알고 싶나요?", "What do you want to know?"),
    options: [
      { label: T("유저 행동·리텐션", "User behavior and retention"), answer: T("유저 단위 분석은 MMP로 봅니다. SKAN은 이걸 주지 않습니다.", "Use the MMP for user-level analysis; SKAN doesn't provide it."), path: "/guide/ios-privacy-att-skan" },
      { label: T("iOS 캠페인끼리 비교", "Comparing iOS campaigns"), answer: T("같은 창·값 정의·보호 수준을 확인한 SKAN으로 비교하세요.", "Compare with SKAN after aligning windows, value definitions and privacy tiers."), path: "/guide/ios-privacy-att-skan" },
      { label: T("채널 전체의 실제 기여", "A channel's true contribution"), answer: T("둘 다 부족합니다. 광고가 없었어도 일어났을 전환을 빼는 증분 분석이 필요합니다.", "Neither is enough. You need incrementality to subtract what would have happened anyway."), tool: "5-23" },
    ],
  },
  "skan-conversion-value-schema": {
    q: T("스키마 설계는 어디까지 왔나요?", "How far along is your schema?"),
    options: [
      { label: T("아직 설계 전이다", "Not designed yet"), answer: T("판단이 갈리는 지점만 나누는 것부터 시작하세요.", "Start by splitting only where decisions differ."), path: "/guide/ios-privacy-att-skan" },
      { label: T("설계했는데 값이 거칠게 온다", "Designed, but values come back coarse"), answer: T("볼륨이 작으면 개인정보 임계로 coarse 값만 올 수 있습니다.", "Low volume can return only coarse values under the privacy threshold."), path: "/glossary/crowd-anonymity" },
      { label: T("이 값으로 성과를 판단하고 싶다", "I want to judge performance on it"), answer: T("값은 관측된 귀속입니다. 광고가 만든 몫은 증분으로 확인하세요.", "Values are observed attribution. Check what ads added with incrementality."), tool: "5-23" },
    ],
  },
  "skan4-migration-guide": {
    q: T("전환은 어느 단계인가요?", "Where is your migration?"),
    options: [
      { label: T("첫 창 스키마를 정하는 중", "Setting the first-window schema"), answer: T("fine 값은 첫 창에서만 옵니다. 판단 구간을 여기에 먼저 담으세요.", "Fine values arrive only in the first window. Put decision points there first."), path: "/blog/skan-conversion-value-schema" },
      { label: T("캠페인 구조를 다시 짜는 중", "Rebuilding campaign structure"), answer: T("캠페인을 세분화하면 조각마다 관측량이 줄 수 있습니다. 통합 여부는 통제 손실과 함께 판단하세요.", "Splitting campaigns can thin observations per slice. Weigh consolidation against loss of control."), path: "/guide/ios-privacy-att-skan" },
      { label: T("전환 뒤 성과가 떨어진 것 같다", "Performance seems down after migrating"), answer: T("최근 35일은 아직 덜 들어온 숫자일 수 있습니다. 성숙한 기간끼리 비교하세요.", "The last 35 days may be incomplete. Compare mature periods."), path: "/blog/ios-att-skan-guide" },
    ],
  },
  "postback-integration-guide": {
    q: T("무엇이 0으로 보이나요?", "What shows zero?"),
    options: [
      { label: T("설치", "Installs"), answer: T("테스트 기기 설치·첫 실행 → MMP 기록 → 파트너 연결·앱 ID 순으로 확인하세요.", "Check test install and first open → MMP record → partner link and app ID, in order."), path: "/guide/ios-privacy-att-skan" },
      { label: T("이벤트·매출", "Events or revenue"), answer: T("이벤트명 매핑과 포스트백 대상 선택, 구매는 value·currency를 확인하세요.", "Check event name mapping, postback selection, and value/currency for purchases."), path: "/blog/event-taxonomy-guide" },
      { label: T("비용", "Cost"), answer: T("비용은 별도 흐름입니다. 매체 API 권한·계정 연결을 확인한 뒤 효율을 다시 보세요.", "Cost is a separate flow. Check API permissions and account linking, then revisit efficiency."), tool: "5-2" },
    ],
  },
  "attribution-data-mismatch": {
    q: T("어떤 숫자가 다른가요?", "Which numbers differ?"),
    options: [
      { label: T("매체와 GA4", "A network vs GA4"), answer: T("윈도우·조회 전환·날짜 기준부터 맞추세요.", "Align windows, view-through and date basis first."), path: "/blog/ga4-data-traps" },
      { label: T("SKAN과 MMP", "SKAN vs MMP"), answer: T("같은 설치일·성숙 기간으로 맞춘 뒤 비교하세요.", "Align on install date and a mature period before comparing."), path: "/blog/skan-vs-mmp-attribution" },
      { label: T("어느 쪽도 못 믿겠다", "I trust neither"), answer: T("귀속은 모두 관측값입니다. 광고가 만든 몫은 증분으로 확인하세요.", "All attribution is observed. Check what ads added with incrementality."), tool: "5-23" },
    ],
  },
  "ga4-data-traps": {
    q: T("GA4 숫자가 어떻게 이상한가요?", "How do the GA4 numbers look off?"),
    options: [
      { label: T("다른 시스템과 다르다", "They differ from another system"), answer: T("시스템 간 비교라면 윈도우·날짜·정의부터 맞추세요.", "Across systems, align windows, dates and definitions first."), path: "/blog/attribution-data-mismatch" },
      { label: T("어제 숫자가 계속 바뀐다", "Yesterday's numbers keep changing"), answer: T("처리 지연입니다. 확정될 때까지 기다려 같은 조건으로 다시 보세요.", "That's processing delay. Wait until it's final and recheck with the same settings."), path: "/blog/ga4-data-traps" },
      { label: T("전환 이벤트가 이상하다", "Conversion events look wrong"), answer: T("이벤트 설계와 태깅부터 점검하세요.", "Check event design and tagging first."), path: "/blog/event-taxonomy-guide" },
    ],
  },
  "event-taxonomy-guide": {
    q: T("이벤트 설계는 어디까지 왔나요?", "How far along is your event design?"),
    options: [
      { label: T("처음 설계한다", "Designing from scratch"), answer: T("행동은 이름, 맥락은 파라미터로 나누고 권장 이벤트부터 확인하세요.", "Name the action, put context in parameters, and check recommended events first."), path: "/blog/event-taxonomy-guide" },
      { label: T("매체에 이벤트가 안 들어간다", "Events aren't reaching networks"), answer: T("포스트백 대상 선택과 이벤트명 매핑을 확인하세요.", "Check postback selection and event name mapping."), path: "/blog/postback-integration-guide" },
      { label: T("이벤트로 리텐션을 보고 싶다", "I want retention from events"), answer: T("초기 행동의 횟수·시점과 장기 전환의 관계를 보세요.", "Look at how early action counts and timing relate to long-term conversion."), tool: "5-20" },
    ],
  },
  "ad-creative-specs-guide": {
    q: T("소재가 지금 어떤 상태인가요?", "Where are your creatives now?"),
    options: [
      { label: T("검수에서 반려됐다", "Rejected in review"), answer: T("매체별 비율·해상도·용량과 검수 사유를 확인하세요.", "Check each network's ratio, resolution, size and review reason."), path: "/blog/ad-creative-specs-guide" },
      { label: T("집행 중인데 성과가 떨어진다", "Running, but performance is falling"), answer: T("같은 소재의 클릭률이 계속 떨어지면 피로 신호입니다.", "A steadily falling CTR on the same creative is a fatigue signal."), tool: "9-6" },
      { label: T("어떤 소재가 나은지 비교하고 싶다", "I want to compare creatives"), answer: T("같은 기간·같은 조건으로 비교해야 우연과 구분됩니다.", "Compare under the same period and conditions to tell it from chance."), tool: "5-4" },
    ],
  },
  "ai-era-marketer": {
    q: T("어느 판단부터 챙기고 싶나요?", "Which judgment do you want to cover first?"),
    options: [
      { label: T("매체 성과를 믿어도 되는지", "Whether to trust platform results"), answer: T("귀속 보고와 증분을 나눠 보세요.", "Separate attributed reports from incrementality."), tool: "5-23" },
      { label: T("실험을 제대로 설계하는 법", "Designing experiments properly"), answer: T("표본수와 판정 기준을 먼저 정하세요.", "Set sample size and decision rules first."), tool: "5-4" },
      { label: T("데이터가 맞는지 확인하는 법", "Checking the data is right"), answer: T("시스템마다 숫자가 다른 이유부터 정리하세요.", "Start with why numbers differ across systems."), path: "/blog/attribution-data-mismatch" },
    ],
  },
};

export function blogSituationCheckFor(slug, toolId, locale = "ko") {
  const entry = BY_POST[slug] || BY_TOOL[toolId];
  if (!entry) return null;
  const lang = locale === "en" ? "en" : "ko";
  return {
    question: entry.q[lang],
    options: entry.options.map((option) => ({ label: option.label[lang], answer: option.answer[lang], tool: option.tool || null, path: option.path || null })),
  };
}

export const SITUATION_TOOL_IDS = Object.keys(BY_TOOL);
export const SITUATION_POST_SLUGS = Object.keys(BY_POST);
