// EN 라벨 오버레이 — IA 원본(store/useDataStore.js)은 한글 SSOT 그대로 두고,
// Header/Sidebar가 locale="en"일 때만 여기서 찾아 덮어씀(없으면 한글 폴백).
// 번역 완료된 그룹/항목만 추가 (§routeMap EN_READY_TOOL_IDS와 함께 확장).
export const GROUP_TITLE_EN = {
  "01": "Tracking Foundation",
  "02": "Campaign Execution",
  "03": "Creative & Copy",
  "04": "Analysis & Optimization",
  "05": "Operations & Performance",
  "06": "Experiment Analysis",
  "07": "Attribution & Value",
  "08": "Data Guide",
  "09": "Creative & Content Analysis",
};

export const ITEM_TITLE_EN = {
  // ── SOP 가이드(EN_READY_GUIDE_IDS와 동기) ──
  "1-1": "Developer Collaboration Guide & Technical PRD",
  "1-2": "In-App Event Taxonomy Spec",
  "1-3": "Network Postback Integration Manual",
  "1-4": "iOS Privacy Playbook (ATT & SKAN)",
  "2-1": "Google App Campaigns (UAC) Guide",
  "2-2": "Meta Advantage+ App (AAP) Optimization",
  "2-3": "Apple Search Ads (ASA) Operations Manual",
  "2-4": "App Retargeting & Re-engagement",
  "3-1": "App Store Optimization (ASO) Basics",
  "3-2": "Ad Creative Specs by Network",
  "3-3": "The 3-Second Hook Framework",
  "4-1": "Core App Marketing KPI Analysis",
  "4-2": "Cohort-Based Retention Guide",
  "4-3": "Organic vs Paid Cannibalization Analysis",
  "8-1": "CSV Data Prep & Column Mapping Guide",
  "5-2": "Operations Dashboard (Scorecard · Pacing · Charts)",
  "5-21": "Campaign Performance Variance (PVM)",
  "5-22": "Campaign Saturation Diagnosis",
  "5-3": "Budget Allocation Simulator",
  "5-26": "ASA Keyword Finder · CPT Actions",
  "5-4": "Experiment Analysis (A/B Test)",
  "5-23": "Incrementality Analysis",
  "5-24": "Brand Campaign Incrementality",
  "5-18": "Marketing Response Analysis (MMM)",
  "5-20": "Find Your Aha-Moment",
  "5-25": "VIF Multicollinearity Check",
  "5-27": "ASO Store Conversion",
  "9-1": "Content Element Analysis",
  "9-2": "Killer Content Finder",
  "9-3": "Content Traffic Variance",
  "9-6": "Creative Analysis",
  "9-7": "Content Operations Dashboard",
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

// 가이드 인덱스 카드의 그룹 설명(EN) — IA 원본 desc(한글)의 오버레이(§EN 가이드 확장).
export const GROUP_DESC_EN = {
  "01": "MMP infrastructure, event taxonomy, network postbacks, and iOS privacy — the foundation to lay before scaling spend.",
  "02": "Hands-on setup for UAC, Meta, ASA, and retargeting campaigns. The standard daily operating procedures.",
  "03": "From ASO basics to per-network creative specs and the 3-second hook framework.",
  "04": "KPI benchmarks, cohort retention, and cannibalization adjustment — the validation stage after launch.",
  "08": "How CSV upload and column mapping work across every analysis tool — the shared data-prep reference.",
};

export function trGroupDesc(id, locale, fallback) {
  return locale === "en" ? GROUP_DESC_EN[id] || fallback : fallback;
}

export function trItemTitle(id, locale, fallback) {
  return locale === "en" ? ITEM_TITLE_EN[id] || fallback : fallback;
}
