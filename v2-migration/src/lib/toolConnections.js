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
  "5-26": {
    title: { ko: "ASA 키워드 발굴", en: "ASA keyword finder" },
    question: { ko: "어떤 검색어를 Exact로 옮기고 CPT를 조정할까?", en: "Which terms should move to Exact and receive a CPT change?" },
    keywords: { ko: "ASA 광고비 적게 소진돼요 검색어 키워드 Exact 승격 CPT 입찰 소진 저소진 과소진 올릴까 내릴까 증액 감액 성과 좋음 안좋음 애플서치애즈", en: "ASA ad spend too low search term keyword Exact promotion CPT bid pacing underspend overspend raise lower increase decrease Apple Search Ads" },
  },
  "5-18": {
    title: { ko: "마케팅 반응 분석", en: "Marketing response analysis" },
    question: { ko: "지금 필요한 것은 추세·잠식·기여·예측 중 무엇일까?", en: "Do I need trend, cannibalization, contribution, or forecast next?" },
    keywords: { ko: "MMM 마케팅 믹스 기여도 카니발 잠식 추세 예측 회귀", en: "MMM marketing mix contribution cannibalization trend forecast regression" },
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
    id: "budget",
    label: { ko: "02 · BUDGET", en: "02 · BUDGET" },
    title: { ko: "예산 조정", en: "Budget moves" },
    description: { ko: "더 써도 되는지, 어디로 옮길지 정합니다.", en: "Decide what can scale and where budget should move." },
    tools: ["5-22", "5-3"],
  },
  {
    id: "creative",
    label: { ko: "03 · CREATIVE", en: "03 · CREATIVE" },
    title: { ko: "먹히는 요소 찾기", en: "What resonates" },
    description: { ko: "소재·콘텐츠·초기 행동 중 무엇이 성과를 만드는지 찾습니다.", en: "Find which creative, content, or early action drives the outcome." },
    tools: ["9-6", "9-1", "5-20"],
  },
  {
    id: "store",
    label: { ko: "04 · STORE", en: "04 · STORE" },
    title: { ko: "앱 유입 개선", en: "App store traffic" },
    description: { ko: "검색 키워드와 스토어 페이지에서 새는 곳을 봅니다.", en: "Check search keywords and the store page for leaks." },
    tools: ["5-26", "5-27"],
  },
  {
    id: "prove",
    label: { ko: "05 · PROOF", en: "05 · PROOF" },
    title: { ko: "효과 검증", en: "Proof" },
    description: { ko: "관찰된 차이가 실제 효과인지 확인합니다.", en: "Test whether the observed difference is a real effect." },
    tools: ["5-4", "5-23", "5-24"],
  },
  {
    id: "contribution",
    label: { ko: "06 · MIX", en: "06 · MIX" },
    title: { ko: "채널 기여도", en: "Channel contribution" },
    description: { ko: "장기 배분의 근거를 채널 단위로 만듭니다.", en: "Build the channel-level basis for long-run allocation." },
    tools: ["5-25", "5-18"],
  },
];

export const NEXT_TOOL_IDS = {
  "5-2": ["5-21", "5-22", "5-3"],
  "5-21": ["5-22", "5-3", "5-4"],
  "5-22": ["5-3", "5-26", "9-6"],
  "5-3": ["5-22", "5-18", "5-4"],
  "9-6": ["5-4", "9-1", "5-2"],
  "5-4": ["5-23", "5-18", "5-2"],
  "5-23": ["5-4", "5-24", "5-2"],
  "5-24": ["5-23", "5-4", "5-2"],
  "5-18": ["5-3", "5-25", "5-20"],
  "5-25": ["5-18", "5-4", "5-23"],
  "5-26": ["5-22", "5-3", "5-27"],
  "5-27": ["5-26", "5-2", "5-23"],
  "5-20": ["5-18", "5-4", "5-2"],
  "9-1": ["9-6", "5-4", "5-20"],
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
