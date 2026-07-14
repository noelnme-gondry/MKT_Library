// EN 라벨 오버레이 — IA 원본(store/useDataStore.js)은 한글 SSOT 그대로 두고,
// Header/Sidebar가 locale="en"일 때만 여기서 찾아 덮어씀(없으면 한글 폴백).
// 번역 완료된 그룹/항목만 추가 (§routeMap EN_READY_TOOL_IDS와 함께 확장).
export const GROUP_TITLE_EN = {
  "05": "Operations & Performance",
  "06": "Creative & Experiments",
  "07": "Attribution & Value",
};

export const ITEM_TITLE_EN = {
  "5-2": "Operations Dashboard (Scorecard · Pacing · Charts)",
  "5-21": "Campaign Performance Variance (PVM)",
  "5-22": "Campaign Saturation Diagnosis",
  "5-3": "Budget Allocation Simulator",
  "5-6": "Creative Analysis",
  "5-4": "Experiment Analysis (A/B Test)",
  "5-23": "Incrementality Analysis",
  "5-18": "Marketing Response Analysis (MMM)",
  "5-20": "Find Your Aha-Moment",
};

// 사이드바 최상단 섹션(SECTIONS) 라벨 — 전부 UI 껍데기라 3개뿐, 항상 번역.
export const SECTION_LABEL_EN = {
  guide: "Guide",
  analysis: "Analysis",
  content: "Content Analytics",
};

export function trSectionLabel(id, locale, fallback) {
  return locale === "en" ? SECTION_LABEL_EN[id] || fallback : fallback;
}

export function trGroupTitle(id, locale, fallback) {
  return locale === "en" ? GROUP_TITLE_EN[id] || fallback : fallback;
}

export function trItemTitle(id, locale, fallback) {
  return locale === "en" ? ITEM_TITLE_EN[id] || fallback : fallback;
}
