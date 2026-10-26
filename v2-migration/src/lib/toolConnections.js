import { advancedMap } from "@/lib/advanced-marketing/registry";
import { idToSlug } from "@/lib/routeMap";
import { groupForRoute } from "@/lib/toolGroups";

export const CONNECTED_TOOLS = {
  ...advancedMap((tool) => ({ title: tool.name, question: tool.question, keywords: { ko: tool.outputs.map((item) => item.ko).join(" "), en: tool.outputs.map((item) => item.en).join(" ") } })),
  "5-30": { title: { ko: "멀티터치 맵", en: "Multi-touch map" }, question: { ko: "어떤 클릭 채널이 함께 기록됐을까?", en: "Which click channels were recorded together?" }, keywords: { ko: "AppsFlyer 멀티터치 contributor 어시스트 경로 CTIT 지면", en: "AppsFlyer multi-touch contributor assist paths CTIT placement" } },
  "5-31": { title: { ko: "운영 플래너", en: "Operations planner" }, question: { ko: "예산·캠페인·소재에서 무엇부터 바꿀까?", en: "What should change across budgets, campaigns and creatives?" }, keywords: { ko: "통합 운영 계획 예산 추천 최근 효율 신규 소재 PVM", en: "integrated operations plan budget recent efficiency new creatives PVM" } },
  "5-2": {
    title: { ko: "운영 대시보드", en: "Operations dashboard" },
    question: { ko: "이번 주 전체 성과는 어디서 흔들렸을까?", en: "Where did overall performance move this week?" },
    keywords: { ko: "이번 주 성과 이상 CPA CPI ROAS 페이싱 예산 소진 대시보드", en: "weekly performance anomaly CPA CPI ROAS pacing budget spend dashboard" },
  },
  "5-21": {
    title: { ko: "캠페인 성과 변동 탐지", en: "Campaign performance variance" },
    question: { ko: "변화를 물량·효율·믹스로 나누면 원인은 뭘까?", en: "Was the change driven by volume, efficiency, or mix?" },
    keywords: { ko: "CPA CPI ROAS 왜 올랐나 왜 떨어졌나 원인 비용 물량 효율 믹스 변동", en: "CPA CPI ROAS why increase decrease cause volume efficiency mix variance" },
  },
  "5-22": {
    title: { ko: "캠페인 포화도 탐지", en: "Campaign saturation" },
    question: { ko: "효율을 해치지 않고 더 늘릴 수 있을까?", en: "Can we scale further without hurting efficiency?" },
    keywords: { ko: "예산 늘렸더니 ROAS 떨어짐 떨어졌어요 CPA 상승 포화 한계효율 증액 과소진 성과 안좋음", en: "ROAS dropped falling after scaling raised budget CPA rose saturation marginal efficiency increase overspend poor performance" },
  },
  "5-3": {
    title: { ko: "예산 배분", en: "Budget allocation" },
    question: { ko: "줄인 예산을 어디로 옮기는 게 좋을까?", en: "Where should the pulled-back budget move next?" },
    keywords: { ko: "예산 어디로 이동 증액 감액 배분 재배분 시뮬레이션", en: "move budget increase decrease allocation reallocation simulation" },
  },
  "9-6": {
    title: { ko: "소재 분석", en: "Creative analysis" },
    question: { ko: "무엇을 교체하고 다음에 어떤 소재를 만들까?", en: "What should we replace and create next?" },
    keywords: { ko: "소재 피로 교체 CTR 하락 크리에이티브 광고", en: "creative fatigue replace CTR decline ad" },
  },
  "5-4": {
    title: { ko: "실험 분석", en: "Experiment analysis" },
    question: { ko: "관찰된 차이를 실제 효과라고 볼 수 있을까?", en: "Is the observed difference a real effect?" },
    keywords: { ko: "A/B 테스트 유의성 표본수 차이 실험", en: "AB test significance sample size difference experiment" },
  },
  "5-23": {
    title: { ko: "증분 분석", en: "Incrementality analysis" },
    question: { ko: "광고가 실제로 추가로 만든 성과는 얼마일까?", en: "How much outcome did marketing truly add?" },
    keywords: { ko: "광고 순수효과 순수 효과 홀드아웃 인과 증분", en: "true causal ad effect holdout incrementality" },
  },
  "5-24": {
    title: { ko: "브랜드 캠페인 증분 분석", en: "Brand campaign incrementality" },
    question: { ko: "브랜딩이 브랜드 검색·직접 유입을 실제로 더 만들었을까?", en: "Did branding actually add brand search or direct traffic?" },
    keywords: { ko: "브랜드 광고 효과 검색량 직접유입 ITS 브랜딩", en: "brand advertising lift search volume direct traffic ITS" },
  },
  "5-25": {
    title: { ko: "VIF 다중공선성 점검", en: "VIF multicollinearity check" },
    question: { ko: "MMM으로 채널 기여도를 나눌 만큼 지출이 독립적으로 움직였을까?", en: "Did spend move independently enough to separate channel contribution in MMM?" },
    keywords: { ko: "MMM 전 다중공선성 VIF 채널 지출 같이 움직임", en: "before MMM multicollinearity VIF channel spend moves together" },
  },
  "5-27": {
    title: { ko: "ASO 스토어 전환 분석", en: "ASO store conversion" },
    question: { ko: "스토어 전환율이 떨어진 게 페이지 탓일까, 유입 구성이 바뀐 탓일까?", en: "Did store conversion fall because of the page, or because the traffic mix shifted?" },
    keywords: { ko: "ASO 스토어 전환율 하락 제품 페이지 조회 설치 전환 유입 소스 Search Browse 앱스토어 최적화 스크린샷 아이콘", en: "ASO store conversion rate drop product page views installs traffic source Search Browse app store optimization screenshots icon" },
  },
  "5-29": {
    title: { ko: "구성 변화 분석", en: "Composition change" },
    question: { ko: "전체 지표가 움직였을 때 어떤 사용자 구성이 바뀌었나?", en: "When the overall metric moved, which audience composition changed?" },
    keywords: { ko: "세그먼트 구성 변화 오디언스 믹스 비중 성별 연령 플랜 이동 분해", en: "segment composition change audience mix share gender age plan movement decomposition" },
  },
  "5-28": {
    title: { ko: "핵심 액션 생존·이탈 분석", en: "Action survival & drop-off" },
    question: { ko: "핵심 액션은 언제 가장 자주 끊기고, 어느 군을 먼저 실험할까?", en: "When does a key action drop off, and which group should be tested first?" },
    keywords: { ko: "핵심 액션 이탈 생존분석 해저드 리텐션 중도절단 반복가치 구독", en: "action survival drop-off analysis hazard retention censoring recurring value subscription" },
  },
  "5-26": {
    title: { ko: "ASA 키워드 발굴", en: "ASA keyword finder" },
    question: { ko: "어떤 검색어를 Exact로 옮기고 CPT를 조정할까?", en: "Which terms should move to Exact and receive a CPT change?" },
    keywords: { ko: "ASA 광고비 적게 소진돼요 검색어 키워드 Exact 승격 CPT 입찰 소진 저소진 과소진 올릴까 내릴까 증액 감액 성과 좋음 안좋음 애플서치애즈", en: "ASA ad spend too low search term keyword Exact promotion CPT bid pacing underspend overspend raise lower increase decrease Apple Search Ads" },
  },
  "5-18-trend": {
    title: { ko: "추세 분석", en: "Trend analysis" },
    question: { ko: "이 변화는 광고 때문일까, 원래 그런 추세였을까?", en: "Was this change from marketing, or the trend it was already on?" },
    keywords: { ko: "추세 계절성 시즌 이상 주차 기준선 베이스라인 자연 증감", en: "trend seasonality baseline irregular week natural movement" },
  },
  "5-18-paid-organic": {
    title: { ko: "유입 변화맵", en: "Paid vs Organic map" },
    question: { ko: "Paid가 늘 때 Organic이 줄어드는 주가 반복될까?", en: "Do weeks repeat where Paid rises while Organic falls?" },
    keywords: { ko: "오가닉 줄었어요 자연유입 감소 Paid Organic 반대 움직임 WoW 변화맵", en: "organic dropped natural traffic Paid Organic opposite movement WoW map" },
  },
  "5-18-cannibal": {
    title: { ko: "잠식 진단", en: "Cannibalization diagnosis" },
    question: { ko: "유료 광고가 원래 올 손님을 사 오고 있는 걸까?", en: "Is paid spend buying demand that would have come anyway?" },
    keywords: { ko: "카니발 잠식 브랜드 검색 오가닉 잠식 유료 광고 대체 그랜저", en: "cannibalization brand search organic displacement paid substitution Granger" },
  },
  "5-18-mmm": {
    // MMM은 마케터가 실제로 찾는 고유명사다. 이름에서 빼면 목록을 눈으로 훑을 때
    // 걸리지 않는다(§12.31의 "괄호 금지"에 대한 명시적 예외).
    title: { ko: "채널 기여도 (MMM)", en: "Channel contribution (MMM)" },
    question: { ko: "성과 중 각 채널이 만든 몫은 얼마일까?", en: "How much of the outcome did each channel contribute?" },
    keywords: { ko: "MMM 마케팅 믹스 모델 채널 기여도 분해 adstock 포화 기본 수요", en: "MMM marketing mix model channel contribution decomposition adstock saturation base demand" },
  },
  "5-18-forecast": {
    title: { ko: "미래 예측", en: "Forecast" },
    question: { ko: "다음 기간 성과는 얼마로 예상되고 얼마나 믿을 수 있을까?", en: "What is the next period's outcome, and how much can I trust it?" },
    keywords: { ko: "예측 미래 전망 회귀 예측 OOS 검증 시나리오 불확실성", en: "forecast projection regression prediction OOS validation scenario uncertainty" },
  },
  "5-20": {
    title: { ko: "핵심 가치 발굴", en: "Aha-moment finder" },
    question: { ko: "잔존을 예측하는 초기 행동은 무엇일까?", en: "Which early actions predict retention?" },
    keywords: { ko: "리텐션 만드는 행동 Aha 아하 정착 전환 초기 행동", en: "retention behavior Aha activation conversion early action" },
  },
  "9-1": {
    title: { ko: "콘텐츠 요소 분석", en: "Content element analysis" },
    question: { ko: "어떤 콘텐츠 요소가 성과를 만드는 걸까?", en: "Which content elements drive performance?" },
    keywords: { ko: "콘텐츠 요소 성과 훅 제목 길이 이모지 회귀", en: "content element performance hook title length emoji regression" },
  },
};

// 도구를 묶는 축은 사용자가 겪는 "상황"이다(product-ssot §1.1c, 2026-10-26 승인).
// 예전 11갈래는 뒤의 넷이 이름만 있고 상황이 없었으며("고객 행동·가치에서 무엇을
// 확인할까요?"), 이름표가 "01 · CHECK" 같은 영어 대문자였다. 지금은 7개 상황에
// 공개 분석이 정확히 한 번씩 속하고, 같은 상황 안에서는 광고 운영 분석을 앞에,
// 고급 분석(5-32~5-43)을 뒤에 둔다. 상황은 순서가 아니므로 "이전/다음 단계"를 만들지
// 않는다 — 이름표는 번호만 쓴다.
export const TOOL_JOURNEY = [
  {
    id: "performance",
    title: { ko: "성과가 흔들렸다, 왜?", en: "Performance moved. Why?" },
    homeQuestion: { ko: "CPA·CPI가 어디서, 왜 올랐을까?", en: "Where did CPA or CPI rise, and why?" },
    description: { ko: "채널·캠페인·사용자 구성 중 어디서 바뀌었는지 찾습니다.", en: "Find whether channels, campaigns or the audience mix moved." },
    tools: ["5-2", "5-21", "5-31", "5-18-trend", "5-29"],
  },
  {
    id: "budget",
    title: { ko: "예산을 어디에 얼마나", en: "Where the budget should go" },
    homeQuestion: { ko: "더 쓸 곳과 줄일 곳은 어디일까?", en: "Where should I scale, and where should I cut?" },
    description: { ko: "증액 여력, 재배분, 채널 기여와 다음 기간 예측을 봅니다.", en: "Check headroom, reallocation, channel contribution and next-period forecasts." },
    tools: ["5-22", "5-3", "5-18-mmm", "5-18-forecast", "5-25", "5-42"],
  },
  {
    id: "proof",
    title: { ko: "광고가 진짜 효과가 있었나", en: "Did the ads really work?" },
    homeQuestion: { ko: "실험과 홀드아웃으로 본 순수 효과는?", en: "What do tests and holdouts show?" },
    description: { ko: "관찰된 차이가 실제 효과인지 실험 설계로 확인합니다.", en: "Use test designs to check whether a difference is a real effect." },
    tools: ["5-4", "5-23", "5-24", "5-36", "5-34"],
  },
  {
    id: "overlap",
    title: { ko: "광고와 오가닉이 겹치나", en: "Do paid and organic overlap?" },
    homeQuestion: { ko: "광고가 원래 올 손님을 사 오고 있을까?", en: "Is paid buying traffic that would come anyway?" },
    description: { ko: "잠식, 함께 기록된 채널, 유입 품질을 봅니다.", en: "Check displacement, co-recorded channels and traffic quality." },
    tools: ["5-18-cannibal", "5-18-paid-organic", "5-30", "5-43"],
  },
  {
    id: "creative",
    title: { ko: "소재·스토어를 고치고 싶다", en: "Improve creatives and the store page" },
    homeQuestion: { ko: "무엇을 바꾸면 전환이 나아질까?", en: "What change would lift conversion?" },
    description: { ko: "소재 피로, 콘텐츠 요소, 검색 키워드, 스토어 전환을 봅니다.", en: "Check creative fatigue, content elements, search terms and store conversion." },
    tools: ["9-6", "9-1", "5-26", "5-27"],
  },
  {
    id: "users",
    title: { ko: "들어온 유저가 남고 돈이 되나", en: "Do new users stay and pay?" },
    homeQuestion: { ko: "어디서 이탈하고, 어떤 고객이 가치가 있을까?", en: "Where do users drop off, and which customers are valuable?" },
    description: { ko: "초기 행동, 퍼널·리텐션, 고객 수익성과 CRM 효과를 봅니다.", en: "Check early actions, funnels, retention, customer profitability and CRM lift." },
    tools: ["5-20", "5-28", "5-33", "5-32", "5-35", "5-37"],
  },
  {
    id: "commerce",
    title: { ko: "상품·가격·영업", en: "Products, pricing and sales" },
    homeQuestion: { ko: "프로모션과 가격은 이익을 남겼을까?", en: "Did promotions and pricing pay off?" },
    description: { ko: "프로모션 이익, 함께 사는 상품, 가격 선호, 영업 파이프라인을 봅니다.", en: "Check promotion profit, co-purchases, price preference and the sales pipeline." },
    tools: ["5-40", "5-41", "5-39", "5-38"],
  },
].map((stage, index) => {
  const number = String(index + 1).padStart(2, "0");
  return { ...stage, label: { ko: number, en: number } };
});

// 다음 단계 3개. 같은 CSV 그룹이면 화면이 "같은 데이터로 바로" 라고 표시하므로
// (isSameData), 응답 패널을 쓰는 다섯 분석은 서로를 먼저 가리킨다 — 한 번 매핑한
// CSV로 이어서 볼 수 있는 질문을 다음 단계로 잇는 것이 이 맵의 목적이다.
export const NEXT_TOOL_IDS = {
  ...advancedMap((tool) => tool.next),
  "5-30": ["5-18-cannibal", "5-23", "5-18-mmm"],
  "5-31": ["5-3", "5-21", "9-6"],
  "5-2": ["5-31", "5-21", "5-22"],
  "5-21": ["5-29", "5-22", "5-3"],
  "5-22": ["5-3", "5-26", "9-6"],
  "5-3": ["5-22", "5-18-mmm", "5-4"],
  "9-6": ["5-4", "9-1", "5-2"],
  "5-4": ["5-23", "5-18-cannibal", "5-34"],
  "5-23": ["5-4", "5-24", "5-2"],
  "5-24": ["5-23", "5-4", "5-2"],
  "5-25": ["5-18-mmm", "5-4", "5-23"],
  "5-26": ["5-22", "5-3", "5-27"],
  "5-27": ["5-26", "5-2", "5-23"],
  "5-28": ["5-20", "5-4", "5-23"],
  // 구성이 움직인 것을 확인했으면 성과 단가 변동(5-21)과 증분 검증(5-23)으로 넘어간다.
  "5-29": ["5-21", "5-23", "5-2"],
  "5-20": ["5-28", "9-1", "5-4"],
  "9-1": ["9-6", "5-4", "5-20"],
  // 같은 패널 CSV를 쓰는 다섯 — 추세로 기준선을 잡고, 반대 움직임을 보고,
  // 잠식을 진단하고, 기여를 나눈 뒤 예측으로 넘어간다.
  "5-18-trend": ["5-18-paid-organic", "5-18-cannibal", "5-18-mmm"],
  "5-18-paid-organic": ["5-18-cannibal", "5-18-trend", "5-23"],
  "5-18-cannibal": ["5-23", "5-30", "5-18-trend"],
  "5-18-mmm": ["5-25", "5-18-forecast", "5-3"],
  "5-18-forecast": ["5-18-mmm", "5-3", "5-2"],
};

export function localizedTool(toolId, locale = "ko") {
  const tool = CONNECTED_TOOLS[toolId];
  if (!tool) return null;
  const lang = locale === "en" ? "en" : "ko";
  return {
    ...tool,
    id: toolId,
    title: tool.title[lang],
    question: tool.question[lang],
    href: `${lang === "en" ? "/en" : ""}${idToSlug[toolId]}`,
  };
}

export function getNextTools(toolId, locale = "ko") {
  const source = CONNECTED_TOOLS[toolId];
  if (!source) return [];
  return (NEXT_TOOL_IDS[toolId] || []).map((nextId) => ({
    ...localizedTool(nextId, locale),
    isSameData: groupForRoute(toolId) === groupForRoute(nextId),
  }));
}

// 도구가 속한 상황과 이어 볼 분석. 상황은 순서가 아니라서(§1.1c) 앞뒤 단계를 만들지
// 않는다. 대신 같은 상황의 다른 분석과, 다른 상황이지만 같은 파일(같은 CSV 그룹)로
// 바로 되는 분석을 돌려준다 — 한 번 준비한 파일로 무엇을 더 볼 수 있는지가 다음 길이다.
export function getJourneyContext(toolId, locale = "ko") {
  const stage = TOOL_JOURNEY.find((item) => item.tools.includes(toolId));
  if (!stage) return null;
  const group = groupForRoute(toolId);
  const decorate = (id) => ({
    ...localizedTool(id, locale),
    isSameData: group === groupForRoute(id),
  });
  const sameFile = TOOL_JOURNEY
    .filter((item) => item !== stage)
    .flatMap((item) => item.tools)
    .filter((id) => groupForRoute(id) === group);
  return {
    stage,
    alternatives: stage.tools.filter((id) => id !== toolId).map(decorate),
    sameFile: sameFile.map(decorate),
  };
}
