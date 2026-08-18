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

export const TOOL_JOURNEY = [
  {
    id: "monitor",
    label: { ko: "01 · MONITOR", en: "01 · MONITOR" },
    title: { ko: "상태 확인", en: "Monitor" },
    description: { ko: "이번 주 이상 신호와 우선순위를 찾습니다.", en: "Find this week’s anomalies and priorities." },
    tools: ["5-2"],
  },
  {
    id: "explain",
    label: { ko: "02 · EXPLAIN", en: "02 · EXPLAIN" },
    title: { ko: "원인 설명", en: "Explain" },
    description: { ko: "성과 변화가 어디에서 왔는지 분해합니다.", en: "Break down where the performance change came from." },
    tools: ["5-21"],
  },
  {
    id: "choose",
    label: { ko: "03 · CHOOSE", en: "03 · CHOOSE" },
    title: { ko: "다음 조치 선택", en: "Choose" },
    description: { ko: "증액·감액·소재 교체의 우선순위를 정합니다.", en: "Prioritize budget moves and creative replacements." },
    tools: ["5-22", "5-3", "5-26", "9-6"],
  },
  {
    id: "prove",
    label: { ko: "04 · PROVE", en: "04 · PROVE" },
    title: { ko: "효과 검증", en: "Prove" },
    description: { ko: "관찰된 차이가 실제 효과인지 확인합니다.", en: "Test whether the observed difference is a real effect." },
    tools: ["5-4", "5-23", "5-24"],
  },
  {
    id: "learn",
    label: { ko: "05 · LEARN", en: "05 · LEARN" },
    title: { ko: "학습 축적", en: "Learn" },
    description: { ko: "채널·고객·콘텐츠의 장기 학습으로 연결합니다.", en: "Turn results into channel, customer, and content learning." },
    tools: ["5-18", "5-20", "5-25", "5-27", "9-1"],
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
