// 운영 가이드(SOP)의 검색·AEO 진입면 SSOT.
//
// 도구는 `toolSearchContent.js`가 롱폼(sections)까지 만들지만, 가이드는 본문 자체가
// 롱폼이다. 여기서는 도구와 같은 계약 중 **접기 바깥에 둘 질문·한 문장 답**과
// FAQ, 그리고 "이 가이드를 데이터로 확인하는 분석"과 관련 글/용어만 정의한다.
//
// 이 파일이 생기기 전까지 가이드 15개는 FAQPage·BreadcrumbList·아웃바운드 링크가
// 전부 없었다. ToolPageOutro가 통째로 null을 반환해 본문 3,000줄짜리 가이드가
// 도구로도, 블로그로도 나가는 링크가 하나도 없는 막다른 페이지였다.
//
// 규칙(guideSearchContent.test.js가 강제):
//  - question은 "?"로 끝나고 가이드끼리 중복되지 않는다.
//  - answer는 90자 이하 한 문장 — 길어지면 "앞에 둔다"의 의미가 없다.
//  - faq에는 question을 다시 넣지 않는다(같은 질문이 두 번 렌더된다).
//  - tool/posts/terms는 실재하는 route id·slug여야 한다.

const CONTENT = {
  "1-1": {
    tool: "5-2",
    posts: ["attribution-data-mismatch", "event-taxonomy-guide"],
    terms: ["mmp", "deep-link"],
    ko: {
      question: "MMP SDK 연동 스펙에는 무엇을 담아야 하나요?",
      answer: "초기화 파라미터, 딥링크 라우팅, 출시 전 QA 시나리오 세 가지를 한 문서에 담습니다.",
      faq: [
        { q: "개발자에게 넘길 문서를 PRD와 따로 만들어야 하나요?", a: "따로 만들면 스펙이 갈라집니다. 트래킹 스펙을 PRD 안에 넣어 한 문서로 유지하는 편이 안전합니다." },
        { q: "SDK 연동 QA는 언제 하나요?", a: "스토어 제출 전에 설치·이벤트·딥링크를 실제 기기에서 확인합니다. 배포 후 수정은 이미 지나간 데이터를 되살리지 못합니다." },
      ],
    },
    en: {
      question: "What belongs in an MMP SDK integration spec?",
      answer: "Initialization parameters, deep-link routing, and pre-release QA scenarios.",
      faq: [
        { q: "Should the tracking spec live outside the PRD?", a: "Keeping it separate lets the two drift apart. Fold the tracking spec into the PRD so engineering builds from one document." },
        { q: "When should SDK integration QA happen?", a: "Before store submission, on real devices, covering installs, events, and deep links. Fixing it after release cannot recover the data you already lost." },
      ],
    },
  },
  "1-2": {
    tool: "5-20",
    posts: ["event-taxonomy-guide", "funnel-dropoff-analysis"],
    terms: ["funnel", "cvr"],
    ko: {
      question: "인앱 이벤트 이름은 어떤 규칙으로 정해야 하나요?",
      answer: "이름·파라미터·발화 시점을 하나의 SSOT 문서로 고정하고 팀 전체가 그것만 참조합니다.",
      faq: [
        { q: "이벤트 이름을 나중에 바꾸면 어떻게 되나요?", a: "과거 데이터는 소급되지 않아 코호트와 LTV 비교가 끊깁니다. 기존 이벤트는 유지하고 새 이름을 추가하는 편이 안전합니다." },
        { q: "매체 최적화에 쓸 이벤트는 몇 개가 적당한가요?", a: "머신러닝이 학습할 만큼 발생량이 나오는 상위 퍼널 이벤트 한두 개로 좁히는 편이 낫습니다. 희소한 이벤트는 학습을 못 채웁니다." },
      ],
    },
    en: {
      question: "How should in-app event names be defined?",
      answer: "Fix names, parameters, and firing timing in one source of truth the whole team reads.",
      faq: [
        { q: "What happens if event names change later?", a: "History is not restated, so cohort and LTV comparisons break at the rename. Add the new name and keep the old event running." },
        { q: "How many events should feed network optimization?", a: "One or two upper-funnel events with enough volume for the model to learn. Sparse events never fill the learning phase." },
      ],
    },
  },
  "1-3": {
    tool: "5-2",
    posts: ["postback-integration-guide", "attribution-data-mismatch"],
    terms: ["mmp", "probabilistic-attribution"],
    ko: {
      question: "매체 포스트백은 어떤 순서로 연동하나요?",
      answer: "매체별 매핑을 설정하고 테스트 전환으로 검증한 뒤에만 LIVE로 올립니다.",
      faq: [
        { q: "포스트백 하나가 잘못되면 무슨 일이 생기나요?", a: "그 매체의 머신러닝이 잘못된 신호로 학습해 최적화가 통째로 어긋납니다. 보통 설치 0이나 전환 급감으로 나타납니다." },
        { q: "SAN 연동과 S2S 연동은 무엇이 다른가요?", a: "SAN은 매체가 직접 집계를 돌려주고, S2S는 서버에서 이벤트를 밀어 넣습니다. 검증 방법과 실패 양상이 다릅니다." },
      ],
    },
    en: {
      question: "How do you integrate network postbacks safely?",
      answer: "Configure the per-network mapping, verify with test conversions, then go live.",
      faq: [
        { q: "What breaks when one postback is misconfigured?", a: "That network's model learns from a wrong signal and its optimization drifts. It usually surfaces as zero installs or a sudden conversion drop." },
        { q: "How do SAN and S2S integrations differ?", a: "A SAN reports its own aggregated results back, while S2S pushes events from your server. They fail in different ways and need different checks." },
      ],
    },
  },
  "1-4": {
    tool: "5-23",
    posts: ["ios-att-skan-guide"],
    terms: ["probabilistic-attribution", "cpi"],
    ko: {
      question: "iOS ATT와 SKAN은 무엇부터 준비해야 하나요?",
      answer: "ATT 동의율을 올리는 프롬프트 설계와, KPI에 맞춘 SKAN 컨버전 값 스키마입니다.",
      faq: [
        { q: "ATT 동의율은 왜 중요한가요?", a: "동의하지 않은 트래픽은 결정론적 어트리뷰션이 끊겨 iOS 성과가 실제보다 낮게 보입니다." },
        { q: "컨버전 값 스키마는 어떻게 정하나요?", a: "SKAN은 값 하나만 돌려주므로, 비즈니스 KPI에 직접 연결되는 지표를 우선순위 위쪽에 배치해야 합니다." },
      ],
    },
    en: {
      question: "What should you set up first for iOS ATT and SKAN?",
      answer: "A prompt flow that raises ATT opt-in and a conversion-value schema tied to your KPIs.",
      faq: [
        { q: "Why does the ATT opt-in rate matter so much?", a: "Traffic without consent loses deterministic attribution, so iOS performance reads lower than it actually is." },
        { q: "How do you choose a conversion-value schema?", a: "SKAN returns a single value, so the metrics tied most directly to your business KPI have to sit at the top of the priority order." },
      ],
    },
  },
  "2-1": {
    tool: "5-3",
    posts: ["google-uac-optimization", "ad-machine-learning"],
    terms: ["cpi", "roas"],
    ko: {
      question: "Google UAC에서 운영자가 실제로 조정할 수 있는 건 무엇인가요?",
      answer: "캠페인 구조, 입찰 단계 진행, 에셋 그룹 다양성 세 가지입니다.",
      faq: [
        { q: "UAC 입찰 단계는 어떤 순서로 올리나요?", a: "설치 최적화로 학습을 채운 뒤 인앱 행동, 그다음 ROAS 단계로 옮깁니다. 단계를 건너뛰면 학습이 리셋됩니다." },
        { q: "에셋을 자주 교체해도 되나요?", a: "학습 기간 중 대량 교체는 성과를 흔듭니다. 저성과 에셋만 부분 교체하는 편이 안전합니다." },
      ],
    },
    en: {
      question: "What can you actually control in Google UAC?",
      answer: "Campaign structure, bid-stage progression, and asset group diversity.",
      faq: [
        { q: "In what order should UAC bid stages progress?", a: "Fill the learning phase on install optimization, move to in-app actions, then to ROAS. Skipping a stage resets learning." },
        { q: "Is it safe to swap assets frequently?", a: "Bulk swaps during learning destabilize performance. Replacing only the weakest assets is safer." },
      ],
    },
  },
  "2-2": {
    tool: "5-21",
    posts: ["meta-advantage-plus-guide", "audience-broad-vs-narrow"],
    terms: ["roas", "cvr"],
    ko: {
      question: "Meta Advantage+ App은 어떻게 운영하나요?",
      answer: "OS를 분리하고 iOS는 SKAN 전용 캠페인으로 나눈 뒤 1일 클릭 기준으로 판단합니다.",
      faq: [
        { q: "왜 OS를 분리해서 운영하나요?", a: "iOS는 SKAN 집계라 지연과 기준이 다릅니다. 합쳐 두면 예산이 한쪽으로 쏠려도 원인을 볼 수 없습니다." },
        { q: "Meta 기본 어트리뷰션 창을 그대로 써도 되나요?", a: "기본값은 7일 클릭·1일 조회입니다. 다른 매체와 나란히 비교하려면 1일 클릭 기준을 함께 보세요." },
      ],
    },
    en: {
      question: "How should Meta Advantage+ App be operated?",
      answer: "Split by OS, run a separate iOS SKAN campaign, and judge on a 1-day click basis.",
      faq: [
        { q: "Why split campaigns by OS?", a: "iOS reports through SKAN with different delay and counting rules. Merged campaigns hide which side the budget drifted to." },
        { q: "Can you keep Meta's default attribution window?", a: "The default is 7-day click plus 1-day view. To compare Meta with other networks, read the 1-day click basis alongside it." },
      ],
    },
  },
  "2-3": {
    tool: "5-26",
    posts: ["apple-search-ads-guide"],
    terms: ["cpa", "cpi"],
    ko: {
      question: "Apple Search Ads는 어떤 구조로 운영하나요?",
      answer: "Discovery로 검색어를 모으고, 성과가 확인된 것만 Exact 캠페인으로 분리합니다.",
      faq: [
        { q: "ASA를 꼭 운영해야 하나요?", a: "App Store 검색은 iOS 앱 발견 경로의 큰 축이고, 그 검색 결과에 노출되는 광고는 ASA뿐입니다." },
        { q: "Exact로 올린 키워드의 입찰은 어떻게 정하나요?", a: "목표 CPA와 현재 예산 소진률을 함께 봅니다. 소진이 덜 되는데 CPA가 목표 아래면 증액 후보입니다." },
      ],
    },
    en: {
      question: "How should Apple Search Ads campaigns be structured?",
      answer: "Collect search terms in Discovery, then split only the proven ones into Exact.",
      faq: [
        { q: "Is Apple Search Ads worth running?", a: "App Store search is a major discovery path on iOS, and ASA is the only ad placement inside those search results." },
        { q: "How do you set bids for promoted Exact keywords?", a: "Read target CPA together with budget pacing. A keyword under target CPA that is not exhausting its budget is a raise candidate." },
      ],
    },
  },
  "2-4": {
    tool: "5-23",
    posts: ["retargeting-reengagement-guide"],
    terms: ["deep-link", "incrementality"],
    ko: {
      question: "앱 리타겟팅은 무엇부터 갖춰야 하나요?",
      answer: "오디언스 세그먼트, 정확한 화면으로 보내는 디퍼드 딥링크, 개인화 카피입니다.",
      faq: [
        { q: "리타겟팅 성과를 UA와 같이 봐도 되나요?", a: "이미 앱을 아는 사용자라 CPA가 낮게 나옵니다. 분리하지 않으면 UA 성과가 좋아 보이는 착시가 생깁니다." },
        { q: "리타겟팅이 실제로 증분을 만들었는지 어떻게 아나요?", a: "홀드아웃을 남겨 비노출 그룹과 비교해야 합니다. 노출군의 전환율만으로는 알 수 없습니다." },
      ],
    },
    en: {
      question: "What does app retargeting need first?",
      answer: "Audience segments, deferred deep links to the right screen, and personalized copy.",
      faq: [
        { q: "Can retargeting be read alongside acquisition?", a: "These users already know the app, so CPA reads low. Merged reporting makes acquisition look better than it is." },
        { q: "How do you know retargeting added anything?", a: "Hold out an unexposed group and compare. Conversion rate inside the exposed group cannot answer it on its own." },
      ],
    },
  },
  "3-1": {
    tool: "9-6",
    posts: ["aso-basics-guide"],
    terms: ["cvr", "cannibalization"],
    ko: {
      question: "ASO는 무엇부터 점검하나요?",
      answer: "메타데이터, 스토어 비주얼 A/B 테스트, 키워드 스코어카드 세 축을 주기적으로 봅니다.",
      faq: [
        { q: "ASO 성과는 어떻게 측정하나요?", a: "무료 유입이라 매체 리포트가 없습니다. 스토어 콘솔의 노출·전환율과 오가닉 설치 추이를 함께 봐야 합니다." },
        { q: "광고를 늘리면 오가닉도 같이 오르나요?", a: "같이 오를 수도 있고 광고가 오가닉을 잡아먹을 수도 있습니다. 잠식 진단으로 확인해야 합니다." },
      ],
    },
    en: {
      question: "Where do you start with App Store Optimization?",
      answer: "Metadata, store visual A/B tests, and a keyword scorecard reviewed on a cycle.",
      faq: [
        { q: "How is ASO performance measured?", a: "There is no network report for free traffic. Read store console impressions and conversion rate alongside the organic install trend." },
        { q: "Does more paid spend lift organic too?", a: "It can, or paid can absorb installs organic would have won anyway. A cannibalization check is what separates the two." },
      ],
    },
  },
  "3-2": {
    tool: "9-6",
    posts: ["ad-creative-specs-guide", "ad-creative-testing"],
    terms: ["ctr"],
    ko: {
      question: "매체별 광고 소재 규격은 왜 맞춰야 하나요?",
      answer: "규격을 벗어난 소재는 노출되지 않거나 자동 크롭돼 핵심 메시지가 잘립니다.",
      faq: [
        { q: "플레이어블 광고에 용량 제한이 있나요?", a: "5MB 제약이 일반적입니다. 넘으면 검수에서 반려되거나 로딩 중 이탈이 커집니다." },
        { q: "영상 세이프존은 무엇인가요?", a: "매체 UI가 덮는 가장자리 영역입니다. 자막과 로고를 세이프존 안에 넣어야 잘리지 않습니다." },
      ],
    },
    en: {
      question: "Why do ad creative specs matter per network?",
      answer: "Off-spec creatives fail to serve or get auto-cropped, cutting off the message.",
      faq: [
        { q: "Is there a size limit for playable ads?", a: "5MB is the common ceiling. Above it, creatives get rejected in review or lose users during loading." },
        { q: "What is a video safe zone?", a: "The edge area the network's own UI covers. Captions and logos have to sit inside it or they get clipped." },
      ],
    },
  },
  "3-3": {
    tool: "9-6",
    posts: ["hook-3-seconds-framework", "ad-creative-testing"],
    terms: ["ctr", "cvr"],
    ko: {
      question: "영상 광고의 첫 3초는 어떻게 설계하나요?",
      answer: "검증된 네 가지 훅 패턴 중 하나를 골라 첫 프레임 체크리스트로 확인합니다.",
      faq: [
        { q: "훅을 바꾸면 성과가 얼마나 달라지나요?", a: "이탈이 앞구간에 몰려 있어 첫 3초 개선은 CTR과 시청 완료율에 가장 크게 반영됩니다." },
        { q: "훅만 다른 소재를 어떻게 비교하나요?", a: "다른 요소를 고정하고 훅만 바꿔 돌린 뒤, 실험 분석으로 차이가 유의한지 확인합니다." },
      ],
    },
    en: {
      question: "How do you design the first three seconds of a video ad?",
      answer: "Pick one of four proven hook patterns and check it against a first-frame list.",
      faq: [
        { q: "How much does the hook change performance?", a: "Drop-off concentrates in the opening, so improving the first three seconds moves CTR and completion rate the most." },
        { q: "How do you compare creatives that differ only in the hook?", a: "Hold every other element fixed, vary the hook, then run experiment analysis to see whether the gap is significant." },
      ],
    },
  },
  "4-1": {
    tool: "5-2",
    posts: ["performance-marketing-metrics", "cpi-cpa-cpm-difference"],
    terms: ["cpi", "cpa", "roas"],
    ko: {
      question: "앱 마케팅 KPI는 어떤 기준으로 판단하나요?",
      answer: "정의를 먼저 통일하고 국가·OS·카테고리 벤치마크와 비교합니다.",
      faq: [
        { q: "CPI가 좋은지 나쁜지 어떻게 아나요?", a: "같은 국가·OS·카테고리 벤치마크와 비교해야 합니다. 숫자 하나만으로는 좋고 나쁨을 말할 수 없습니다." },
        { q: "CPA와 CPI 중 무엇을 봐야 하나요?", a: "설치가 목적이면 CPI, 인앱 행동이 목적이면 CPA입니다. 두 지표는 분모가 달라 섞어 쓰면 안 됩니다." },
      ],
    },
    en: {
      question: "How do you judge app marketing KPIs?",
      answer: "Unify the definitions first, then compare against country, OS, and category benchmarks.",
      faq: [
        { q: "How do you know whether a CPI is good?", a: "Only against a benchmark for the same country, OS, and category. An absolute number carries no verdict by itself." },
        { q: "Should you optimize CPA or CPI?", a: "CPI when installs are the goal, CPA when an in-app action is. Their denominators differ, so they should not be mixed." },
      ],
    },
  },
  "4-2": {
    tool: "5-2",
    posts: ["cohort-analysis-guide", "ltv-cac-ratio"],
    terms: ["cohort", "retention", "ltv"],
    ko: {
      question: "코호트 리텐션은 어떻게 읽나요?",
      answer: "설치 시점이 같은 그룹의 리텐션 곡선과 누적 ARPU를 함께 봐야 LTV를 추정할 수 있습니다.",
      faq: [
        { q: "전체 평균 리텐션으로는 왜 부족한가요?", a: "설치 시점이 다른 사용자가 섞여 좋은 코호트와 나쁜 코호트가 서로 상쇄됩니다. 평균은 이탈을 가립니다." },
        { q: "LTV는 며칠치 데이터로 추정하나요?", a: "확보된 코호트 길이가 상한입니다. D7까지만 있으면 그 이후는 외삽이라는 점을 함께 표시해야 합니다." },
      ],
    },
    en: {
      question: "How do you read cohort retention?",
      answer: "Read retention curves and cumulative ARPU per install cohort to project LTV.",
      faq: [
        { q: "Why is a blended retention average not enough?", a: "Users who installed at different times get mixed together, so strong and weak cohorts cancel out and the average hides churn." },
        { q: "How much history does an LTV projection need?", a: "The observed cohort length is the ceiling. With only D7 data, anything past it is extrapolation and should be labeled as such." },
      ],
    },
  },
  "4-3": {
    tool: "5-18-cannibal",
    posts: ["cannibalization-organic-paid", "incrementality-measurement"],
    terms: ["cannibalization", "incrementality", "holdout-test"],
    ko: {
      question: "광고가 오가닉을 잡아먹었는지 어떻게 확인하나요?",
      answer: "광고로 잡힌 설치 중 오가닉으로도 왔을 몫을 추정해 ROAS를 보정합니다.",
      faq: [
        { q: "잠식을 보정하지 않으면 어떻게 되나요?", a: "광고가 만들지 않은 성과까지 광고 몫으로 잡혀 ROAS가 실제보다 높게 보입니다." },
        { q: "잠식을 확정하려면 무엇이 필요한가요?", a: "관측 신호만으로는 상관에 그칩니다. 홀드아웃이나 켜고 끄기 실험이 있어야 인과로 말할 수 있습니다." },
      ],
    },
    en: {
      question: "How do you check whether ads cannibalized organic?",
      answer: "Estimate how many paid installs would have arrived organically, then correct ROAS.",
      faq: [
        { q: "What happens if cannibalization is left uncorrected?", a: "Outcomes advertising did not create are still counted as paid results, so ROAS reads higher than reality." },
        { q: "What does it take to confirm cannibalization?", a: "Observational signals only establish correlation. A holdout or an on/off test is what lets you state it causally." },
      ],
    },
  },
  "8-1": {
    tool: "start-gate",
    posts: ["ga4-data-traps", "performance-marketing-analysis-order"],
    terms: ["cpa", "roas"],
    ko: {
      question: "분석 도구에 올릴 CSV는 어떻게 준비하나요?",
      answer: "한 행이 하나의 관측이 되게 정리하고, 날짜·비용·성과 컬럼을 표준 이름에 매핑합니다.",
      faq: [
        { q: "컬럼 이름을 꼭 영어로 바꿔야 하나요?", a: "아닙니다. 한글 헤더도 자동 매핑되며, 자동으로 못 잡으면 업로드 화면에서 직접 지정할 수 있습니다." },
        { q: "업로드한 CSV가 서버로 전송되나요?", a: "전송되지 않습니다. 파싱과 계산 모두 브라우저 안에서 실행됩니다. 직접 올린 파일은 이 브라우저에 마지막 사용 후 90일까지 저장될 수 있으며, 서버에는 저장되지 않습니다." },
      ],
    },
    en: {
      question: "How do you prepare a CSV for these analysis tools?",
      answer: "Make one row one observation, then map date, cost, and outcome columns to standard keys.",
      faq: [
        { q: "Do column names have to be in English?", a: "No. Korean headers are auto-mapped too, and anything the mapper misses can be assigned by hand on the upload screen." },
        { q: "Is the uploaded CSV sent to a server?", a: "No. Parsing and calculation both run inside the browser. Files you upload directly can stay in this browser until 90 days after their last use, and source rows are never stored on a server." },
      ],
    },
  },
};

export const GUIDE_SEARCH_CONTENT_IDS = Object.keys(CONTENT);

export function getGuideSearchContent(guideId, locale = "ko") {
  const entry = CONTENT[guideId];
  if (!entry) return null;
  const copy = entry[locale === "en" ? "en" : "ko"];
  return copy ? { ...copy, tool: entry.tool, posts: entry.posts, terms: entry.terms } : null;
}

// FAQ JSON-LD 페이로드. 핵심 질문을 첫 항목으로 올린다(§12.29) — LLM은 페이지
// 앞쪽에서 답을 뽑으므로 핵심 질문이 목록 중간에 있으면 뽑히지 않는다.
export function getGuideFaq(guideId, locale = "ko") {
  const content = getGuideSearchContent(guideId, locale);
  if (!content) return [];
  return [{ q: content.question, a: content.answer }, ...content.faq];
}

export function getGuidePrimaryTool(guideId) {
  return CONTENT[guideId]?.tool || null;
}

export function guidePostSlugs(guideId) {
  return CONTENT[guideId]?.posts || [];
}

export function guideTermSlugs(guideId) {
  return CONTENT[guideId]?.terms || [];
}

export function isGuideRouteId(routeId) {
  return Boolean(routeId && Object.hasOwn(CONTENT, routeId));
}

// 블로그 글 → 가이드 역인덱스. 12편의 글이 같은 주제 가이드와 1:1로 겹치는데
// 양쪽이 서로를 가리키지 않으면 검색엔진이 어느 쪽을 대표로 볼지 정하지 못한다.
// 이 맵을 따로 손으로 적으면 위쪽 posts와 어긋나므로 **파생**한다(§12.29).
const POST_TO_GUIDES = Object.entries(CONTENT).reduce((acc, [guideId, entry]) => {
  for (const slug of entry.posts) {
    (acc[slug] ||= []).push(guideId);
  }
  return acc;
}, {});

export function guidesForPost(slug) {
  return POST_TO_GUIDES[slug] || [];
}
