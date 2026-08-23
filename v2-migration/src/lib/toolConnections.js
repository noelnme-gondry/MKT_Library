import { idToSlug } from "@/lib/routeMap";
import { groupForRoute } from "@/lib/toolGroups";

export const CONNECTED_TOOLS = {
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

// 도구를 묶는 축은 "무엇을 판단하려는 상황인가"다. 예전 5갈래는 상태 확인이
// 1개짜리였고 학습 축적에 MMM·Aha·VIF·ASO·콘텐츠 다섯이 성격 없이 모여 있었다
// ("여러 상황을 하나에 밀어넣은" 상태). 지금은 한 갈래가 한 상황만 말하고
// 크기도 2~3개로 고르다 — 갈래 이름만 읽어도 어디를 볼지 정해진다.
export const TOOL_JOURNEY = [
  {
    id: "monitor",
    label: { ko: "01 · CHECK", en: "01 · CHECK" },
    title: { ko: "이번 주 점검", en: "This week" },
    description: { ko: "어디가 흔들렸고 왜 그런지 봅니다.", en: "See what moved and why." },
    tools: ["5-2", "5-21"],
  },
  {
    id: "baseline",
    label: { ko: "02 · BASELINE", en: "02 · BASELINE" },
    title: { ko: "추세·잠식 점검", en: "Trend and displacement" },
    description: { ko: "원래 추세인지, 광고가 오가닉을 먹은 건지 가릅니다.", en: "Tell the underlying trend apart from paid displacing organic." },
    tools: ["5-18-trend", "5-18-paid-organic", "5-18-cannibal"],
  },
  {
    id: "budget",
    label: { ko: "03 · BUDGET", en: "03 · BUDGET" },
    title: { ko: "예산 조정", en: "Budget moves" },
    description: { ko: "더 써도 되는지, 어디로 옮길지 정합니다.", en: "Decide what can scale and where budget should move." },
    tools: ["5-22", "5-3"],
  },
  {
    id: "creative",
    label: { ko: "04 · CREATIVE", en: "04 · CREATIVE" },
    title: { ko: "먹히는 요소 찾기", en: "What resonates" },
    description: { ko: "소재·콘텐츠·초기 행동 중 무엇이 성과를 만드는지 찾습니다.", en: "Find which creative, content, or early action drives the outcome." },
    tools: ["9-6", "9-1", "5-20"],
  },
  {
    id: "store",
    label: { ko: "05 · STORE", en: "05 · STORE" },
    title: { ko: "앱 유입 개선", en: "App store traffic" },
    description: { ko: "검색 키워드와 스토어 페이지에서 새는 곳을 봅니다.", en: "Check search keywords and the store page for leaks." },
    tools: ["5-26", "5-27"],
  },
  {
    id: "prove",
    label: { ko: "06 · PROOF", en: "06 · PROOF" },
    title: { ko: "효과 검증", en: "Proof" },
    description: { ko: "관찰된 차이가 실제 효과인지 확인합니다.", en: "Test whether the observed difference is a real effect." },
    tools: ["5-4", "5-23", "5-24", "5-28"],
  },
  {
    id: "contribution",
    label: { ko: "07 · MIX", en: "07 · MIX" },
    title: { ko: "채널 기여도", en: "Channel contribution" },
    description: { ko: "장기 배분의 근거를 채널 단위로 만듭니다.", en: "Build the channel-level basis for long-run allocation." },
    tools: ["5-25", "5-18-mmm", "5-18-forecast"],
  },
];

// 다음 단계 3개. 같은 CSV 그룹이면 화면이 "같은 데이터로 바로" 라고 표시하므로
// (isSameData), 응답 패널을 쓰는 다섯 분석은 서로를 먼저 가리킨다 — 한 번 매핑한
// CSV로 이어서 볼 수 있는 질문을 다음 단계로 잇는 것이 이 맵의 목적이다.
export const NEXT_TOOL_IDS = {
  "5-2": ["5-21", "5-22", "5-3"],
  "5-21": ["5-22", "5-3", "5-4"],
  "5-22": ["5-3", "5-26", "9-6"],
  "5-3": ["5-22", "5-18-mmm", "5-4"],
  "9-6": ["5-4", "9-1", "5-2"],
  "5-4": ["5-23", "5-18-cannibal", "5-2"],
  "5-23": ["5-4", "5-24", "5-2"],
  "5-24": ["5-23", "5-4", "5-2"],
  "5-25": ["5-18-mmm", "5-4", "5-23"],
  "5-26": ["5-22", "5-3", "5-27"],
  "5-27": ["5-26", "5-2", "5-23"],
  "5-28": ["5-20", "5-4", "5-23"],
  "5-20": ["5-28", "9-1", "5-4"],
  "9-1": ["9-6", "5-4", "5-20"],
  // 같은 패널 CSV를 쓰는 다섯 — 추세로 기준선을 잡고, 반대 움직임을 보고,
  // 잠식을 진단하고, 기여를 나눈 뒤 예측으로 넘어간다.
  "5-18-trend": ["5-18-paid-organic", "5-18-cannibal", "5-18-mmm"],
  "5-18-paid-organic": ["5-18-cannibal", "5-18-trend", "5-23"],
  "5-18-cannibal": ["5-23", "5-18-mmm", "5-18-trend"],
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

export function getJourneyContext(toolId, locale = "ko") {
  const stageIndex = TOOL_JOURNEY.findIndex((stage) => stage.tools.includes(toolId));
  if (stageIndex < 0) return null;
  const stage = TOOL_JOURNEY[stageIndex];
  const previousStage = TOOL_JOURNEY[(stageIndex - 1 + TOOL_JOURNEY.length) % TOOL_JOURNEY.length];
  const nextStage = TOOL_JOURNEY[(stageIndex + 1) % TOOL_JOURNEY.length];
  const decorate = (id) => ({
    ...localizedTool(id, locale),
    isSameData: groupForRoute(toolId) === groupForRoute(id),
  });
  return {
    stage,
    previousStage,
    nextStage,
    previous: previousStage.tools.map(decorate),
    alternatives: stage.tools.filter((id) => id !== toolId).map(decorate),
    next: nextStage.tools.map(decorate),
    isCycleRestart: stageIndex === TOOL_JOURNEY.length - 1,
  };
}
