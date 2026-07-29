import { idToSlug } from "@/lib/routeMap";
import { groupForRoute } from "@/lib/toolGroups";

export const CONNECTED_TOOLS = {
  "5-2": {
    title: { ko: "운영 대시보드", en: "Operations dashboard" },
    question: { ko: "이번 주 전체 성과는 어디서 흔들렸을까?", en: "Where did overall performance move this week?" },
  },
  "5-21": {
    title: { ko: "캠페인 성과 변동 탐지", en: "Campaign performance variance" },
    question: { ko: "변화를 물량·효율·믹스로 나누면 원인은 뭘까?", en: "Was the change driven by volume, efficiency, or mix?" },
  },
  "5-22": {
    title: { ko: "캠페인 포화도 탐지", en: "Campaign saturation" },
    question: { ko: "효율을 해치지 않고 더 늘릴 수 있을까?", en: "Can we scale further without hurting efficiency?" },
  },
  "5-3": {
    title: { ko: "예산 배분", en: "Budget allocation" },
    question: { ko: "줄인 예산을 어디로 옮기는 게 좋을까?", en: "Where should the pulled-back budget move next?" },
  },
  "9-6": {
    title: { ko: "소재 분석", en: "Creative analysis" },
    question: { ko: "무엇을 교체하고 다음에 어떤 소재를 만들까?", en: "What should we replace and create next?" },
  },
  "5-4": {
    title: { ko: "실험 분석", en: "Experiment analysis" },
    question: { ko: "관찰된 차이를 실제 효과라고 볼 수 있을까?", en: "Is the observed difference a real effect?" },
  },
  "5-23": {
    title: { ko: "증분 분석", en: "Incrementality analysis" },
    question: { ko: "광고가 실제로 추가로 만든 성과는 얼마일까?", en: "How much outcome did marketing truly add?" },
  },
  "5-18": {
    title: { ko: "마케팅 반응 분석", en: "Marketing response analysis" },
    question: { ko: "지금 필요한 것은 추세·잠식·기여·예측 중 무엇일까?", en: "Do I need trend, cannibalization, contribution, or forecast next?" },
  },
  "5-20": {
    title: { ko: "핵심 가치 발굴", en: "Aha-moment finder" },
    question: { ko: "잔존을 예측하는 초기 행동은 무엇일까?", en: "Which early actions predict retention?" },
  },
  "9-1": {
    title: { ko: "콘텐츠 요소 분석", en: "Content element analysis" },
    question: { ko: "어떤 콘텐츠 요소가 성과를 만드는 걸까?", en: "Which content elements drive performance?" },
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
    tools: ["5-22", "5-3", "9-6"],
  },
  {
    id: "prove",
    label: { ko: "04 · PROVE", en: "04 · PROVE" },
    title: { ko: "효과 검증", en: "Prove" },
    description: { ko: "관찰된 차이가 실제 효과인지 확인합니다.", en: "Test whether the observed difference is a real effect." },
    tools: ["5-4", "5-23"],
  },
  {
    id: "learn",
    label: { ko: "05 · LEARN", en: "05 · LEARN" },
    title: { ko: "학습 축적", en: "Learn" },
    description: { ko: "채널·고객·콘텐츠의 장기 학습으로 연결합니다.", en: "Turn results into channel, customer, and content learning." },
    tools: ["5-18", "5-20", "9-1"],
  },
];

export const NEXT_TOOL_IDS = {
  "5-2": ["5-21", "5-22", "5-3"],
  "5-21": ["5-22", "5-3", "5-4"],
  "5-22": ["5-3", "9-6", "5-4"],
  "5-3": ["5-22", "5-18", "5-4"],
  "9-6": ["5-4", "9-1", "5-2"],
  "5-4": ["5-23", "5-18", "5-2"],
  "5-23": ["5-4", "5-18", "5-2"],
  "5-18": ["5-3", "5-23", "5-20"],
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
