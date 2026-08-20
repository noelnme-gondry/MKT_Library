import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import Papa from "papaparse";
import { mergeEvents as mergeStoreEvents } from "@/utils/storeEvents";
import { SECTION_LABEL_EN } from "@/lib/enNavCopy";
import { TOOL_GROUP, groupForRoute, buildGroupMap } from "@/lib/toolGroups";
import { validateFinding } from "@/lib/assist/findingSchema";
import {
  normalizeDecisionReviewRows,
  sanitizeDecisionReviewRecord,
  sanitizeDecisionReviewRecords,
} from "@/lib/decisionReview";
import { STANDARD_FIELDS } from "@/utils/csvConstants";

export { TOOL_GROUP, groupForRoute };

const EMPTY_SLICE = () => ({ raw: [], headers: [], mapping: {}, fileName: "" });
const APP_PERSIST_VERSION = 3;
let decisionFallbackSequence = 0;
const EMPTY_DASHBOARD_FILTER = () => ({
  dateStart: null,
  dateEnd: null,
  compareEnabled: false,
  comparisonStart: null,
  comparisonEnd: null,
  comparisonPreset: "previous",
  platforms: new Set(),
  countries: new Set(),
  channels: new Set(),
  sources: new Set(),
});

function nextStableId(prefix, items = []) {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedPrefix}(\\d+)$`);
  const max = items.reduce((highest, item) => {
    const match = String(item?.id || "").match(pattern);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `${prefix}${max + 1}`;
}

function nextDecisionRecordId(items = []) {
  const existingIds = new Set(items.map((item) => String(item?.id || "")));
  if (typeof globalThis.crypto?.randomUUID === "function") {
    const id = `decision_${globalThis.crypto.randomUUID()}`;
    if (!existingIds.has(id)) return id;
  }
  let id;
  do {
    decisionFallbackSequence += 1;
    id = `decision_${Date.now()}_${decisionFallbackSequence}`;
  } while (existingIds.has(id));
  return id;
}

function isSameImportedDecision(existing, incoming) {
  if (!existing || !incoming) return false;
  if (existing.createdAt && incoming.createdAt) return existing.createdAt === incoming.createdAt;
  return existing.toolId === incoming.toolId && existing.action === incoming.action;
}

function canUseDecisionStorage() {
  if (typeof window === "undefined") return true;
  try {
    const key = "__mkt_decision_storage_probe__";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

// ── Analyze-gate signature (index.html toolAnalyzeSig 이식, §12.5) ───────────
// SINGLE source of the "mapping I confirmed by pressing 분석하기" signature.
// Covers ONLY the column mapping (+ fileName + row count) — NOT exploratory
// toggles (target/platform/metric/grain) so users can freely switch AFTER
// analysis. Changing the mapping changes the sig → the stored analyzed sig no
// longer matches → the tool auto-hides results until 분석하기 is pressed again
// (faithful to isToolAnalyzed's sig-equality reset-on-mapping-change).
// Group-scoped by design: the efficiency family (5-2/5-21/5-22/5-3) shares one
// csv slice, so ONE confirmed mapping analyzes the whole group. Because every
// family tool derives this sig from the SAME active slice, the sig is identical
// across the family — one flag, no per-component dupes.
export const computeAnalyzeSig = (csvData) => {
  const m = (csvData && csvData.mapping) || {};
  const sig = Object.entries(m)
    .filter(([, v]) => v && v !== "__ignore__")
    .map(([h, v]) => `${v}:${h}`)
    .sort()
    .join("|");
  const fileName = (csvData && csvData.fileName) || "";
  const rowCount = ((csvData && csvData.raw) || []).length;
  return `${fileName}|${rowCount}|${sig}`;
};

export const IA = [
  {
    id: "01",
    title: "트래킹 기반 구축",
    desc: "MMP 인프라, 이벤트 택소노미, 매체 포스트백, iOS 프라이버시 대응까지. 본격 운영 전 반드시 갖춰야 할 토대.",
    items: [
      { id: "1-1", title: "개발자 협업 가이드 및 테크니컬 PRD" },
      { id: "1-2", title: "인앱 이벤트 택소노미 설계서" },
      { id: "1-3", title: "매체별 포스트백 연동 매뉴얼" },
      { id: "1-4", title: "iOS 프라이버시 대응 (ATT & SKAN)" },
    ],
  },
  {
    id: "02",
    title: "캠페인 실행",
    desc: "UAC·Meta·ASA·리타겟팅 캠페인 실전 셋업. 운영 일과의 표준 절차.",
    items: [
      { id: "2-1", title: "Google App Campaigns (UAC) 가이드" },
      { id: "2-2", title: "Meta Advantage+ App (AAP) 최적화" },
      { id: "2-3", title: "Apple Search Ads (ASA) 운영 매뉴얼" },
      { id: "2-4", title: "앱 리타겟팅 및 Re-engagement" },
    ],
  },
  {
    id: "03",
    title: "소재·카피",
    desc: "ASO 베이직부터 매체별 소재 규격, 3초 훅 설계까지.",
    items: [
      { id: "3-1", title: "앱 스토어 최적화 (ASO) 베이직" },
      { id: "3-2", title: "매체별 앱 설치 유도 소재 규격" },
      { id: "3-3", title: "초기 3초 훅(Hook) 설계 프레임워크" },
    ],
  },
  {
    id: "04",
    title: "분석·최적화",
    desc: "KPI 벤치마크, 코호트·리텐션, 카니발리제이션 보정까지. 데이터로 검증하는 단계.",
    items: [
      { id: "4-1", title: "앱 마케팅 핵심 지표(KPI) 분석" },
      { id: "4-2", title: "코호트 기반 리텐션 가이드" },
      { id: "4-3", title: "오가닉 vs 페이드 카니발리제이션 분석" },
    ],
  },
  {
    id: "08",
    title: "데이터 가이드",
    desc: "CSV 준비부터 컬럼 매핑까지 — 모든 분석 도구가 공통으로 쓰는 업로드 구조 참고 문서.",
    items: [
      { id: "8-1", title: "CSV 데이터 준비 & 컬럼 매핑 가이드" },
    ],
  },
  // 항목의 `seoTitle*`·`seoDescription*`은 이름과 달리 **SERP 메타가 아니다**.
  // 페이지 title/description의 SSOT는 `lib/routeSeo.js`이고, generateMetadata가
  // routeSeo를 먼저 읽으므로 여기 문구는 렌더된 <title>에 절대 도달하지 않는다
  // (routeSeo가 색인 가능한 전 라우트를 덮는 것을 routeSeo.test.js가 강제한다).
  // 실제 용도는 ⌘K 검색 텍스트(`GlobalModals.jsx`) — 질문형·키워드형 문구라
  // 명령 팔레트 매칭에 도움이 된다. 새 SERP 문구는 routeSeo에 쓸 것.
  {
    id: "05",
    title: "운영 & 성과 분석",
    desc: "실제 운영한 캠페인 데이터를 업로드해 대시보드로 시각화하고, 성과 변동·포화도·예산 배분까지 한 CSV로 이어서 분석.",
    items: [
      {
        id: "5-2",
        title: "주간 성과 점검",
        titleEn: "Weekly check",
        seoTitleEn: "Free Ops Dashboard: Scorecard, Pacing, Anomalies, Cohorts",
        seoDescriptionEn:
          "Upload your campaign CSV to see scorecards, budget pacing, anomaly detection, LTV, cohorts, and funnels in one dashboard — free, client-side only.",
      },
      {
        id: "5-21",
        title: "성과 변동 원인",
        titleEn: "Change drivers",
        seoTitleEn: "Why Did Performance Change? Free PVM Decomposition Tool",
        seoDescriptionEn:
          "Decompose a performance shift into volume, efficiency, and mix effects with zero residual (Bennet decomposition). Free, upload a CSV to run it instantly.",
      },
      {
        id: "5-22",
        title: "증액 여력 진단",
        titleEn: "Headroom check",
        seoTitleEn: "Is This Campaign Saturated? Free Marginal Efficiency Diagnosis",
        seoDescriptionEn:
          "Compares marginal vs. average CPA/ROAS to tell you whether a channel or campaign is saturated or still has room to scale. Free, CSV-based.",
      },
      {
        id: "5-3",
        title: "예산 재배분",
        seoTitle: "목표 CPI·CPA·ROAS에 맞는 예산은? 무료 배분 시뮬레이터",
        seoDescription:
          "총 예산 또는 목표 CPI·CPA·ROAS를 슬라이드하면 채널별 관측 최대 지출을 넘지 않도록 권장 총예산과 자동 배분안을 계산합니다. CSV 업로드만으로 바로 확인하세요.",
        titleEn: "Budget Allocation Simulator",
        seoTitleEn: "What Budget Meets Your CPI, CPA, or ROAS Goal? Free Simulator",
        seoDescriptionEn:
          "Slide a total budget or target CPI, CPA, or ROAS to calculate a recommended total budget and automatic channel allocation without exceeding observed maximum spend. Free — just upload a CSV.",
      },
      {
        id: "5-26",
        title: "ASA 키워드",
        titleEn: "ASA keywords",
        seoTitle: "ASA 키워드 발굴기: Exact 승격·CPT 입찰 조정",
        seoDescription: "Apple Search Ads 검색어에서 Exact 승격 후보와 예산 대비 소진률·목표 CPA 기반 CPT 증감 조치를 찾습니다.",
        seoTitleEn: "ASA Keyword Finder: Exact Promotion & CPT Bids",
        seoDescriptionEn: "Find Exact-promotion candidates and CPT bid actions from Apple Search Ads search-term pacing and target CPA.",
      },
    ],
  },
  {
    id: "06",
    title: "실험 설계 분석",
    desc: "A/B·홀드아웃 실험 설계와 판독, 증분(광고가 실제 만든 몫) 측정.",
    items: [
      {
        id: "5-4",
        title: "A/B 테스트",
        titleEn: "A/B testing",
        seoTitleEn: "Is A vs B Really Different? Free A/B Test Significance Calculator",
        seoDescriptionEn:
          "Design your sample size and judge whether your A/B test result is statistically significant. Free, no signup — paste your numbers or upload a CSV.",
      },
      {
        id: "5-23",
        title: "광고 순증분",
        titleEn: "Incremental lift",
        seoTitleEn: "How Much Did Your Ads Really Cause? Free Incrementality Testing",
        seoDescriptionEn:
          "Measure true incremental lift with holdout tests, on/off comparisons, or DiD pre/post analysis — not just correlation. Free, CSV-based.",
      },
      {
        id: "5-24",
        title: "브랜드 증분",
        titleEn: "Brand lift",
        seoTitleEn: "Did Brand Marketing Create Lift? Free ITS Analysis",
        seoDescriptionEn:
          "Estimate whether a brand campaign added search, direct traffic, or signups with interrupted time series, then route to a stronger holdout design when available.",
      },
    ],
  },
  {
    id: "07",
    title: "기여도·가치 분석",
    desc: "MMM·회귀 기반 마케팅 반응 분석과 핵심 가치(Aha-moment) 발굴.",
    items: [
      // 5-18은 다섯 분석이 공유하는 CSV·매핑 준비 화면이다(목록에는 없고 검색·
      // /start 추천의 착지점으로만 남는다). 분석 다섯은 각각 독립 도구다.
      {
        id: "5-18",
        title: "패널 데이터 준비",
        seoTitle: "마케팅 반응 분석: 한 CSV로 추세·잠식·기여·예측",
        seoDescription:
          "주간 패널 CSV 하나를 매핑해 추세·잠식·MMM 기여·회귀 예측 다섯 분석으로 넘깁니다. 브라우저 안에서만 처리하는 무료 도구.",
        titleEn: "Panel data setup",
        seoTitleEn: "Marketing Response: One CSV for Trend, Cannibalization, MMM, Forecast",
        seoDescriptionEn:
          "Map one weekly panel CSV once and hand it to five analyses — trend, cannibalization, MMM contribution, and forecast. Free, processed only in your browser.",
      },
      {
        id: "5-18-trend",
        title: "추세 분석",
        seoTitle: "마케팅 추세 분석: 계절성·이상 주차 분리",
        seoDescription:
          "광고 효과를 판단하기 전에 자연 추세와 계절성, 이상 주차를 분리해 비교 기준선을 만듭니다.",
        titleEn: "Trend",
        seoTitleEn: "Marketing Trend Analysis: Separate Seasonality and Outlier Weeks",
        seoDescriptionEn:
          "Separate natural trend, seasonality, and irregular weeks to build the baseline other analyses compare against.",
      },
      {
        id: "5-18-paid-organic",
        title: "유입 변화맵",
        seoTitle: "Paid·Organic 변화맵: 주간 반대 움직임 점검",
        seoDescription:
          "Organic과 Paid 성과의 WoW 움직임을 한 궤적으로 보고, 정밀 잠식 진단이 필요한 패턴을 찾습니다.",
        titleEn: "Paid vs Organic",
        seoTitleEn: "Paid · Organic Movement Map: Spot Opposite Weekly Moves",
        seoDescriptionEn:
          "Plot weekly Organic and Paid movement on one path and find the patterns that deserve a deeper cannibalization check.",
      },
      {
        id: "5-18-cannibal",
        title: "잠식 진단",
        seoTitle: "광고 카니발라이제이션 진단: 유료가 오가닉을 먹는지",
        seoDescription:
          "유료 성과가 늘 때 오가닉·브랜드 성과가 줄었는지 네 가지 신호로 점검하고 홀드아웃 후보를 좁힙니다.",
        titleEn: "Cannibalization",
        seoTitleEn: "Ad Cannibalization Diagnosis: Is Paid Replacing Organic?",
        seoDescriptionEn:
          "Check four signals that paid outcomes may be replacing organic or branded demand, then shortlist channels for a holdout.",
      },
      {
        id: "5-18-mmm",
        title: "채널 기여도 (MMM)",
        seoTitle: "MMM 기여 분해: 광고비, 어디서 벌고 어디서 잃는지",
        seoDescription:
          "마케팅 믹스 모델(MMM)로 채널·기본 수요·이벤트의 성과 기여를 분해합니다. CSV 업로드로 바로 실행하는 무료 MMM 도구.",
        titleEn: "Channel contribution (MMM)",
        seoTitleEn: "MMM Contribution: See Where Your Ad Spend Wins",
        seoDescriptionEn:
          "Use marketing mix modeling to decompose channel, base-demand, and event contribution. Free — upload a CSV and run it instantly.",
      },
      {
        id: "5-18-forecast",
        title: "미래 예측",
        seoTitle: "마케팅 회귀 예측: 봉인 OOS 검증과 불확실성",
        seoDescription:
          "예측 전용 회귀와 봉인 OOS 검증으로 다음 기간의 성과와 불확실성 구간을 확인합니다.",
        titleEn: "Forecast",
        seoTitleEn: "Marketing Regression Forecast with Sealed OOS Validation",
        seoDescriptionEn:
          "Run forecast-only regression with sealed out-of-sample validation to assess the next period and its uncertainty.",
      },
      {
        id: "5-20",
        title: "Aha 모먼트",
        titleEn: "Aha moment",
        seoTitleEn: "What Makes Users Stick? Free Aha-Moment Finder",
        seoDescriptionEn:
          "Find which early actions, done how many times within how many days, predict retention (F1/lift grid search). Free, upload an event-level CSV.",
      },
      {
        id: "5-27",
        title: "스토어 전환",
        titleEn: "Store conversion",
        seoTitle: "ASO 스토어 전환 분석: 소스별 전환 분해",
        seoDescription: "스토어 콘솔 CSV로 노출→제품페이지→설치 퍼널을 세우고, 전환율 변화가 트래픽 구성 탓인지 소스별 효율 탓인지 나눠 봅니다.",
        seoTitleEn: "ASO Store Conversion Analysis",
        seoDescriptionEn: "Build the store funnel from a console CSV and split conversion change into traffic mix and per-source efficiency.",
      },
      {
        id: "5-25",
        title: "채널 중복 점검",
        titleEn: "Channel overlap",
        seoTitle: "VIF 다중공선성 진단: MMM 전 채널 지출 점검",
        seoDescription: "채널별 지출이 같이 움직여 MMM 기여도 분리가 어려운지 VIF와 상관관계로 점검합니다.",
        seoTitleEn: "VIF Multicollinearity Check Before MMM",
        seoDescriptionEn: "Use VIF and channel-spend correlation to check whether MMM can separate channel contribution.",
      },
    ],
  },
  // ── Content Analytics — 퍼포먼스 엔진(regMath·ahaMath)을 콘텐츠 도메인으로
  // 리라벨. 내부 id(9-x)는 불변(§4.1), 표시번호는 SECTIONS 위치로 계산. 파일럿 2종. ──
  {
    id: "09",
    title: "소재·콘텐츠 분석",
    desc: "소재(크리에이티브) 성과·피로도 진단과, 콘텐츠 성과 CSV로 어떤 제작 요소가 성과를 끌어올리는지 진단.",
    // 소재 분석(9-6, 구 5-6 통합)이 이 섹션의 대표 도구 — 퍼포먼스 소재 분석과 콘텐츠
    // 도메인 도구(요소 분석기 등)를 같은 섹션에 둔다. 9-2/9-3/9-7은 아직 미완성이라
    // hidden(라우팅·findMeta는 살아있어 직접 링크는 안 깨짐 — "삭제"가 아니라 "숨김").
    items: [
      {
        id: "9-6",
        title: "소재 피로도",
        titleEn: "Creative fatigue",
        seoTitleEn: "Which Creative Should You Replace? Free Fatigue Analysis",
        seoDescriptionEn:
          "Analyze creative performance, fatigue over time, and which attributes (hook, format, message) actually drive results. Free, upload a creative-level CSV.",
      },
      {
        id: "9-1",
        title: "콘텐츠 요소",
        titleEn: "Content elements",
        seoTitleEn: "Which Content Elements Drive Results? Free Regression Analyzer",
        seoDescriptionEn: "Estimate how hooks, formats, lengths, and message angles relate to content performance with regression controls and clear evidence limits. Free, browser-only CSV analysis.",
      },
      { id: "9-2", title: "킬러 콘텐츠", hidden: true },
      { id: "9-3", title: "콘텐츠 변동", titleEn: "Content shifts", hidden: true },
      { id: "9-7", title: "콘텐츠 대시보드", titleEn: "Content dashboard", hidden: true },
    ],
  },
];

// ── 사이드바·브레드크럼 표시 번호 SSOT (§12.6: 내부 route id는 절대 불변,
// 표시 번호만 이 SECTIONS 기준으로 계산) ────────────────────────────────
// 가이드(구 SOP, 01~04)와 분석(구 05~07)을 병렬 두 섹션으로 분리 — 예전
// PHASES(p1 셋업/p2 운영/p3 운영후분석/p4 운영)가 01~04를 불균등하게 묶고
// p4.groups에 존재하지 않는 "10" 그룹을 참조하던 죽은 참조·왜곡 모두 제거.
export const SECTIONS = [
  { id: "guide", label: "가이드", groups: ["01", "02", "03", "04"] },
  // 콘텐츠(09)를 분석 섹션으로 흡수 — 별도 "콘텐츠 분석" 카테고리 제거(사이드바·
  // 브레드크럼 자동 반영). slug(/content/*)는 SEO·북마크 보존 위해 그대로 둠.
  { id: "analysis", label: "분석", groups: ["08", "05", "06", "07", "09"] },
];

export function findGroupSection(groupId) {
  return SECTIONS.find((s) => s.groups.includes(groupId)) || null;
}

// 표시 번호를 붙일 항목인지. 가이드(SOP 01~04)는 번호가 실제 문서 체계라 유지하고,
// 분석 섹션은 붙이지 않는다 — 사이드바가 IA 그룹이 아니라 TOOL_JOURNEY 스테이지를
// 그리기 때문에 그룹 기준 번호("03 선택" 아래 2-3·5-1)가 화면 계층과 어긋났다.
// 도구 번호는 라우트 id도 아니어서 사용자에게 주는 정보가 없다.
export function isNumberedDocItem(itemId) {
  const meta = findMeta(itemId);
  if (!meta) return false;
  return findGroupSection(meta.group.id)?.id === "guide";
}

export function findMeta(itemId) {
  for (const g of IA) {
    const it = g.items.find((x) => x.id === itemId);
    if (it) return { ...it, group: g };
  }
  return null;
}

// "가이드 1" / "분석 2" — 섹션 내 그룹 순번(1-based). locale="en"이면 section.label을
// SECTION_LABEL_EN(enNavCopy.js)으로 오버레이(Header breadcrumb EN 대응 — 없으면 KR 폴백).
export function displayGroupNumber(groupId, locale = "ko") {
  const section = findGroupSection(groupId);
  if (!section) return groupId;
  const label = locale === "en" ? SECTION_LABEL_EN[section.id] || section.label : section.label;
  return `${label} ${section.groups.indexOf(groupId) + 1}`;
}

// "가이드 1-1" / "분석 2-3" — 섹션 내 그룹 순번-그룹 내 항목 순번.
export function displayItemNumber(itemId, locale = "ko") {
  const meta = findMeta(itemId);
  if (!meta) return itemId;
  const section = findGroupSection(meta.group.id);
  if (!section) return itemId;
  const label = locale === "en" ? SECTION_LABEL_EN[section.id] || section.label : section.label;
  const groupNum = section.groups.indexOf(meta.group.id) + 1;
  const itemNum = meta.group.items.findIndex((it) => it.id === itemId) + 1;
  return `${label} ${groupNum}-${itemNum}`;
}

// 사이드바용 짧은 번호(라벨 없음) — 섹션 헤더가 이미 라벨을 보여주므로 그룹/항목
// 칩에서는 숫자만("1"/"1-1"). 브레드크럼은 위 라벨-포함 버전을 그대로 사용.
export function displayGroupNumberShort(groupId) {
  const section = findGroupSection(groupId);
  if (!section) return groupId;
  return String(section.groups.indexOf(groupId) + 1);
}

export function displayItemNumberShort(itemId) {
  const meta = findMeta(itemId);
  if (!meta) return itemId;
  const section = findGroupSection(meta.group.id);
  if (!section) return itemId;
  const groupNum = section.groups.indexOf(meta.group.id) + 1;
  const itemNum = meta.group.items.findIndex((it) => it.id === itemId) + 1;
  return `${groupNum}-${itemNum}`;
}

// persist 저장 대상 = "설정만"(§2.2). 원본 CSV(csvGroups·csvData)·필터 Set·차트상태는
// 제외. export하여 불변식(원본 데이터 미저장)을 골든으로 잠금(useDataStore.test.js).
// 이벤트 마커는 사용자가 직접 입력한 날짜 + 짧은 라벨("브랜드 캠페인 시작")이다.
// 원본 CSV 행이 아니므로 §2.2(원본 미저장)에 걸리지 않지만, 무한정 쌓이지 않도록
// 개수·길이를 제한해 저장한다. 저장하지 않으면 새로고침마다 사라져 "왜 이랬는지"를
// 기록하는 유일한 장치가 매번 증발한다(기능은 이미 완성돼 있는데 배선만 빠져 있었다).
const MAX_PERSISTED_EVENT_MARKERS = 200;
export const sanitizeEventMarkers = (markers) => {
  if (!Array.isArray(markers)) return [];
  return markers
    .filter((marker) => marker && typeof marker === "object")
    .slice(0, MAX_PERSISTED_EVENT_MARKERS)
    .map((marker) => ({
      id: String(marker.id ?? "").slice(0, 40),
      date: String(marker.date ?? "").slice(0, 40),
      label: String(marker.label ?? "").slice(0, 120),
    }))
    .filter((marker) => marker.date || marker.label);
};

export const persistPartialize = (state) => {
  const persisted = {
    viewConfig: state.viewConfig,
    customMetrics: state.customMetrics,
    customCharts: state.customCharts,
    // 분석가 모드는 표시 설정만 저장한다. 원본 CSV·매핑·필터는 포함하지 않는다.
    analystMode: state.analystMode === true,
    decisionPersistenceEnabled: state.decisionPersistenceEnabled === true,
    eventMarkers: sanitizeEventMarkers(state.eventMarkers),
  };
  if (state.decisionPersistenceEnabled === true) {
    persisted.decisionRecords = sanitizeDecisionReviewRecords(state.decisionRecords);
  }
  return persisted;
};

// 서버(SSR)·테스트(node) 환경에는 localStorage가 없음 — no-op 폴백으로 persist가
// setItem에서 throw하지 않게(브라우저에선 실제 localStorage 사용). 클라이언트 전용 저장.
const noopStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

// persist 스키마 버전 마이그레이션 훅. v2부터 opt-in 결정 요약을 지원하며, v1
// payload에 우연히 같은 키가 있어도 동의로 간주하지 않고 제거한다.
export function persistMigrate(persistedState, version) {
  const state = persistedState && typeof persistedState === "object" ? { ...persistedState } : {};
  // v3 전 payload에는 분석가 모드가 없었다. 기존 마케터 UX를 보존하기 위해 off가 기본이다.
  state.analystMode = version >= 3 && state.analystMode === true;
  // v3 adds only analystMode. v2's explicitly opted-in decision summaries remain valid.
  if (version < 2 || state.decisionPersistenceEnabled !== true) {
    delete state.decisionRecords;
    return { ...state, decisionPersistenceEnabled: false };
  }
  return { ...state, decisionPersistenceEnabled: true, decisionRecords: sanitizeDecisionReviewRecords(state.decisionRecords) };
}

export const useAppStore = create(persist((set, get) => ({
  // 데모 안내 모달 — 세션당 1회만(휘발, persist 대상 아님). 첫 도구 진입 시 데모
  // 데이터임을 알리고 우상단 CSV 변경 버튼을 안내.
  demoNoticeSeen: false,
  setDemoNoticeSeen: () => set({ demoNoticeSeen: true }),

  // "내 데이터로 분석 시작"(게이트) 선택 시 true → 전 도구 데모 자동로드 억제(빈
  // 업로드 화면 유지). 휘발(세션 한정) — 새로고침 시 리셋(첫인상 데모 복원). "데모
  // 보기"류 명시 로드는 false로 되돌림.
  demoDisabled: false,
  setDemoDisabled: (v) => set({ demoDisabled: !!v }),

  // Navigation State
  currentRouteId: "home",
  // On route change, swap the csvData mirror to the newly-active group's slice
  // so the rendered tool sees ITS group's data (efficiency family shares one
  // slice; aha/creative/experiment/response are isolated). The existing page.js
  // effect already calls this on every navigation (incl. browser back/forward),
  // so the mirror swap is automatic with no page.js structural change.
  setCurrentRouteId: (id) => set((state) => {
    // 주간 검토·가이드처럼 CSV를 소비하지 않는 경로가 효율 CSV로 강제 전환되면,
    // 다른 도구에서 저장한 결정의 비교 기준이 바뀐다. 마지막 실제 도구 그룹을 유지한다.
    const routeGroup = TOOL_GROUP[id];
    const activeDataGroup = routeGroup || state.activeDataGroup || "efficiency";
    return {
    currentRouteId: id,
    activeDataGroup,
    // 슬라이스가 없는 그룹으로 이동해도 미러는 항상 객체여야 한다. undefined가 되면
    // csvData.headers 같은 직접 접근이 렌더 throw로 도구를 통째로 죽인다(5-24 사고).
    csvData: state.csvGroups[activeDataGroup] || EMPTY_SLICE(),
    // 같은 CSV grain은 같은 필터를 이어 쓰고, 다른 grain으로 이동하면 그 그룹의
    // 필터로 교체한다. 다른 데이터에 이전 채널/국가 필터가 남는 cross-grain 사고 방지.
    dashboardFilter: state.dashboardFilterGroups[activeDataGroup] || EMPTY_DASHBOARD_FILTER(),
  };
  }),

  // Theme State — 라이트모드 기본값 (매 새로고침 리셋 방지)
  isDarkMode: false,
  toggleTheme: () => set((state) => ({ isDarkMode: !state.isDarkMode })),

  // 분석가 모드 — 진단·재현 레이어의 전역 표시 설정. CSV나 매핑과 달리 민감 데이터가
  // 아닌 UI 환경설정이므로 persist allowlist에만 포함한다.
  analystMode: false,
  setAnalystMode: (on) => set({ analystMode: !!on }),

  // Command Palette State (CMDK)
  isCmdkOpen: false,
  setCmdkOpen: (isOpen) => set({ isCmdkOpen: isOpen }),

  // 모바일 도구 안내 배너(§12.13 피드백 넛지와 동일 스타일) — 세션 한정 dismiss.
  // persist 대상 아님(partialize 미포함) → 새로고침 시 리셋, 매 세션 다시 노출.
  mobileNudgeDismissed: false,
  dismissMobileNudge: () => set({ mobileNudgeDismissed: true }),

  // DM 상담 유도 사이드 팝업(도구 내부, 라이브 데모 후 스크롤 시 우하단) — 세션 한정
  // dismiss. mobileNudgeDismissed와 동일: persist 미포함 → 새로고침 시 리셋, 매 세션 재노출.
  dmNudgeDismissed: false,
  dismissDmNudge: () => set({ dmNudgeDismissed: true }),

  // 기존 호출부 호환용 분석 실행 래퍼. 전면 광고 게이트는 제거했고 즉시 실행한다.
  requestAd: (cb) => { if (cb) cb(); },

  // 5-18 허브에서 확정한 컬럼 역할은 같은 브라우저 세션의 하위 분석 화면에서만
  // 이어 쓴다. CSV 원본과 함께 persist하지 않으므로 새로고침 뒤에는 재업로드가
  // 필요하며, 민감 원자료가 localStorage에 남지 않는다.
  responseMappingSession: { raw: null, colMap: null, weekStart: "monday" },
  setResponseMappingSession: (session) => set({ responseMappingSession: session }),

  // 결정·검토 루프는 모든 도구가 공유하는 세션 상태다. 사용자가 아래 opt-in을 켠
  // 경우에만 persistPartialize가 allowlist 요약을 localStorage에 포함한다. 원본 CSV,
  // 매핑, inputSignature, 차트 데이터는 레코드 스키마에 들어갈 수 없다. 단, 사용자가
  // 선택한 비교 범위(차원 필터)만 결정 검증을 위해 축약해 저장할 수 있다.
  decisionPersistenceEnabled: false,
  decisionPersistencePromptSeen: false,
  decisionSessionRecordIds: new Set(),
  decisionRecords: [],
  markDecisionPersistencePromptSeen: () => set({ decisionPersistencePromptSeen: true }),
  setDecisionPersistenceEnabled: (enabled) => {
    const shouldEnable = enabled === true;
    if (shouldEnable && !canUseDecisionStorage()) return false;
    set({ decisionPersistenceEnabled: shouldEnable });
    return true;
  },
  addDecisionRecord: (draft) => set((state) => {
    const now = new Date().toISOString();
    const normalized = sanitizeDecisionReviewRecord(draft, draft?.toolId);
    if (!normalized) return {};
    const isUniqueId = normalized.id && !state.decisionRecords.some((record) => record.id === normalized.id);
    const id = isUniqueId ? normalized.id : nextDecisionRecordId(state.decisionRecords);
    const decisionSessionRecordIds = new Set(state.decisionSessionRecordIds);
    decisionSessionRecordIds.add(id);
    return {
      decisionSessionRecordIds,
      decisionRecords: [{
        ...normalized,
        id,
        createdAt: normalized.createdAt || now,
        updatedAt: now,
      }, ...state.decisionRecords],
    };
  }),
  importDecisionRecords: (rows, fallbackToolId = "") => set((state) => {
    const now = new Date().toISOString();
    const normalizedRows = normalizeDecisionReviewRows(rows, fallbackToolId);
    if (!normalizedRows.length) return {};
    const nextRecords = [...state.decisionRecords];
    normalizedRows.forEach((record) => {
      const existingIndex = record.id ? nextRecords.findIndex((item) => item.id === record.id) : -1;
      if (existingIndex >= 0 && isSameImportedDecision(nextRecords[existingIndex], record)) {
        const existing = nextRecords[existingIndex];
        nextRecords[existingIndex] = { ...record, id: existing.id, createdAt: existing.createdAt || record.createdAt || now, updatedAt: now };
        return;
      }
      const id = record.id && existingIndex < 0 ? record.id : nextDecisionRecordId(nextRecords);
      nextRecords.unshift({ ...record, id, createdAt: record.createdAt || now, updatedAt: now });
    });
    return { decisionRecords: nextRecords };
  }),
  updateDecisionRecord: (id, patch) => set((state) => ({
    decisionRecords: state.decisionRecords.map((record) => {
      if (record.id !== id) return record;
      const normalized = sanitizeDecisionReviewRecord({ ...record, ...patch, id: record.id, createdAt: record.createdAt });
      return normalized ? { ...normalized, updatedAt: new Date().toISOString() } : record;
    }),
  })),
  removeDecisionRecord: (id) => set((state) => ({
    decisionRecords: state.decisionRecords.filter((record) => record.id !== id),
    decisionSessionRecordIds: new Set([...state.decisionSessionRecordIds].filter((recordId) => recordId !== id)),
  })),
  clearDecisionRecords: () => set({ decisionRecords: [], decisionSessionRecordIds: new Set() }),

  // ── 스토어 운영 이벤트(액션 로그) — 5-27 ─────────────────────────────────
  // 세션 메모리 전용이다(§7 localStorage 영속 금지). 오래 들고 갈 방법은 CSV
  // 다운로드이고, 그 CSV를 다시 올리면 그대로 복구된다.
  // 여기 담기는 건 사용자가 직접 적은 이벤트뿐 — CSV에서 뽑은 이벤트는
  // 원본에 이미 있으므로 저장하지 않는다(중복 소유 금지).
  storeEventsManual: [],
  setStoreEventsManual: (events) => set({ storeEventsManual: mergeStoreEvents(events) }),
  addStoreEvents: (events) => set((state) => ({ storeEventsManual: mergeStoreEvents(state.storeEventsManual, events) })),
  removeStoreEvent: (date, label) => set((state) => ({
    storeEventsManual: state.storeEventsManual.filter((event) => !(event.date === date && event.label === label)),
  })),
  clearStoreEvents: () => set({ storeEventsManual: [] }),

  // 구조화된 분석 연결 상태. 모두 세션 메모리 전용이며 persistPartialize에 포함하지
  // 않는다. 원본 행 대신 집계 결과·설정만 보관한다.
  analysisHandoff: null,
  setAnalysisHandoff: (handoff) => set({ analysisHandoff: handoff }),
  clearAnalysisHandoff: () => set({ analysisHandoff: null }),
  findingsByGroup: {},
  publishFinding: (finding) => set((state) => {
    if (!validateFinding(finding)) return {};
    const group = finding.dataGroup;
    const current = state.findingsByGroup[group] || [];
    return {
      findingsByGroup: {
        ...state.findingsByGroup,
        [group]: [...current.filter((item) => item.id !== finding.id && item.toolId !== finding.toolId), finding],
      },
    };
  }),
  clearFindingsForGroup: (group) => set((state) => ({
    findingsByGroup: { ...state.findingsByGroup, [group]: [] },
  })),
  reportDraft: { schemaVersion: 1, title: "", period: null, blocks: [], notes: [] },
  setReportMeta: (patch) => set((state) => ({ reportDraft: { ...state.reportDraft, ...patch } })),
  addReportBlock: (block) => set((state) => ({
    reportDraft: {
      ...state.reportDraft,
      blocks: [...state.reportDraft.blocks.filter((item) => item.id !== block.id), block],
    },
  })),
  removeReportBlock: (id) => set((state) => ({
    reportDraft: { ...state.reportDraft, blocks: state.reportDraft.blocks.filter((item) => item.id !== id) },
  })),
  moveReportBlock: (id, direction) => set((state) => {
    const blocks = [...state.reportDraft.blocks];
    const from = blocks.findIndex((item) => item.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= blocks.length) return {};
    [blocks[from], blocks[to]] = [blocks[to], blocks[from]];
    return { reportDraft: { ...state.reportDraft, blocks } };
  }),
  setReportNote: (text) => set((state) => ({
    reportDraft: {
      ...state.reportDraft,
      notes: text ? [{ id: "weekly-note", text: String(text) }] : [],
    },
  })),
  pendingProjectConfig: null,
  setPendingProjectConfig: (project) => set({ pendingProjectConfig: project }),
  applyProjectConfig: (project, compatibleGroups = []) => set((state) => {
    const allowed = new Set(compatibleGroups);
    const csvGroups = { ...state.csvGroups };
    const dashboardFilterGroups = { ...state.dashboardFilterGroups };
    Object.entries(project.groups || {}).forEach(([group, config]) => {
      if (!allowed.has(group) || !csvGroups[group]) return;
      const headers = new Set(csvGroups[group].headers || []);
      const safeMapping = Object.fromEntries(Object.entries(config.mapping || {}).filter(([header, field]) =>
        headers.has(header) && (field === "__ignore__" || Boolean(STANDARD_FIELDS[field]))
      ));
      csvGroups[group] = { ...csvGroups[group], mapping: safeMapping };
      const filters = config.filters || {};
      dashboardFilterGroups[group] = {
        dateStart: filters.dateStart || null,
        dateEnd: filters.dateEnd || null,
        compareEnabled: Boolean(filters.compareEnabled),
        comparisonStart: filters.comparisonStart || null,
        comparisonEnd: filters.comparisonEnd || null,
        comparisonPreset: filters.comparisonPreset === "previousYear" || filters.comparisonPreset === "custom" ? filters.comparisonPreset : "previous",
        platforms: new Set(filters.platforms || []),
        countries: new Set(filters.countries || []),
        channels: new Set(filters.channels || []),
        sources: new Set(filters.sources || []),
      };
    });
    const activeGroup = groupForRoute(state.currentRouteId);
    return {
      viewConfig: project.viewConfig || {},
      customMetrics: project.customMetrics || {},
      customCharts: project.customCharts || {},
      csvGroups,
      dashboardFilterGroups,
      csvData: csvGroups[activeGroup] || EMPTY_SLICE(),
      dashboardFilter: dashboardFilterGroups[activeGroup] || EMPTY_DASHBOARD_FILTER(),
      analyzedByGroup: { ...state.analyzedByGroup, ...Object.fromEntries([...allowed].map((group) => [group, null])) },
      pendingProjectConfig: compatibleGroups.length === Object.keys(project.groups || {}).length ? null : project,
    };
  }),

  // CSV Data State — group-scoped slices + an active-group mirror.
  // Consumers keep reading `s.csvData` unchanged; scoping happens by storing
  // per-group and swapping the mirror on route change (see setCurrentRouteId).
  csvGroups: buildGroupMap(EMPTY_SLICE),
  // Mirror of the ACTIVE group's slice. Initial currentRouteId is "home" →
  // "efficiency", so the initial mirror is the (empty) efficiency slice.
  csvData: {
    raw: [],
    headers: [],
    mapping: {},
    fileName: "",
  },
  activeDataGroup: "efficiency",
  // Writes the ACTIVE group's slice AND updates the mirror to the SAME object
  // reference, so consumer selectors (s => s.csvData) fire on identity change.
  // A changed signature keeps the last confirmed signature so the UI can say
  // "stale" rather than silently falling back to the pre-analysis state.
  setCsvData: (data) => set((state) => {
    const g = groupForRoute(state.currentRouteId);
    // Any non-empty write (real upload or explicit demo load) clears the
    // manual-clear flag below — it only needs to suppress auto-demo-reload
    // while the group is genuinely empty.
    const hasRows = !!(data && data.raw && data.raw.length > 0);
    const csvClearedByGroup = hasRows
      ? { ...state.csvClearedByGroup, [g]: false }
      : state.csvClearedByGroup;
    const responseMappingSession = g === "response" && state.responseMappingSession.raw !== data.raw
      ? { raw: null, colMap: null, weekStart: "monday" }
      : state.responseMappingSession;
    return {
      csvGroups: { ...state.csvGroups, [g]: data },
      csvData: data,
      analyzedByGroup: state.analyzedByGroup,
      csvClearedByGroup,
      responseMappingSession,
      findingsByGroup: { ...state.findingsByGroup, [g]: [] },
      analysisHandoff: state.analysisHandoff?.dataGroup === g ? null : state.analysisHandoff,
    };
  }),
  // 결과 허브에서 "같은 데이터로 상세 분석"을 고르면 대상 그룹에만 재매핑된 사본을
  // 넣는다. 원본은 브라우저 메모리에만 있고, 대상 도구를 바로 열 수 있게 gate도 확인한다.
  handoffCsvToRoute: (routeId, data, { markAnalyzed = true } = {}) => set((state) => {
    const g = groupForRoute(routeId);
    const sig = computeAnalyzeSig(data);
    return {
      csvGroups: { ...state.csvGroups, [g]: data },
      analyzedByGroup: { ...state.analyzedByGroup, [g]: markAnalyzed ? sig : null },
      csvClearedByGroup: { ...state.csvClearedByGroup, [g]: false },
    };
  }),
  // Non-persisted, session-scoped: which groups the user explicitly emptied
  // (Header's "Change CSV" / CsvUploader's own reset), so CsvUploader's
  // mount-once demo-autoload effect doesn't silently refill it. Needed because
  // tools render CsvUploader in 3 different JSX branches keyed on
  // hasData/analyzed state — clearing data flips branches, which REMOUNTS
  // CsvUploader (fresh component instance) and its "if empty, load demo"
  // mount effect re-fires before the user can see the empty dropzone or drop
  // their own file, making "Change CSV" look like it does nothing (§bugfix).
  csvClearedByGroup: {},
  // Clears the ACTIVE group's slice + marks it manually-cleared (see above).
  // Header.jsx and CsvUploader.jsx's own reset button both call this instead
  // of setCsvData(EMPTY_SLICE()) directly.
  clearCsvGroup: () => set((state) => {
    const g = groupForRoute(state.currentRouteId);
    return {
      csvGroups: { ...state.csvGroups, [g]: EMPTY_SLICE() },
      csvData: EMPTY_SLICE(),
      analyzedByGroup: { ...state.analyzedByGroup, [g]: null },
      csvClearedByGroup: { ...state.csvClearedByGroup, [g]: true },
      findingsByGroup: { ...state.findingsByGroup, [g]: [] },
      analysisHandoff: state.analysisHandoff?.dataGroup === g ? null : state.analysisHandoff,
    };
  }),

  // "내 데이터로 시작"(StartGate) 진입 — 데모 자동로드 억제 + 이미 로드된 데모
  // 슬라이스(fileName "demo_")만 비운다(실제 업로드는 보존). csvData 미러도 활성
  // 그룹 기준으로 갱신. 세션 한정(demoDisabled 휘발).
  startMyData: () => set((state) => {
    const groups = { ...state.csvGroups };
    const analyzed = { ...state.analyzedByGroup };
    for (const k of Object.keys(groups)) {
      const slice = groups[k];
      if (slice && slice.fileName && slice.fileName.startsWith("demo")) {
        groups[k] = EMPTY_SLICE();
        analyzed[k] = null;
      }
    }
    return {
      demoDisabled: true,
      csvGroups: groups,
      analyzedByGroup: analyzed,
      csvData: groups[groupForRoute(state.currentRouteId)] || EMPTY_SLICE(),
    };
  }),

  // ── Analyze gate (single source, §12.5 / #4/#5) ────────────────────────────
  // analyzedByGroup[group] holds the mapping sig that was CONFIRMED by pressing
  // 분석하기. A tool is "analyzed" iff that stored sig equals the current slice's
  // sig — so editing the mapping (new sig) auto-hides results until re-confirmed.
  // Keyed by TOOL_GROUP so the whole efficiency family shares ONE flag: Dashboard
  // (5-2) and every 5-x tool read the SAME gate via isGroupAnalyzed(routeId),
  // eliminating the per-component analyzedSig dupes (5-22 etc.).
  analyzedByGroup: buildGroupMap(() => null),
  // Confirm analysis for the route's group. Stores the CURRENT active-slice sig.
  // Call from CsvUploader's "분석하기/데이터 분석하기" (and "↻ 다시 분석") button.
  setGroupAnalyzed: (routeId) => set((state) => {
    const g = groupForRoute(routeId);
    return { analyzedByGroup: { ...state.analyzedByGroup, [g]: computeAnalyzeSig(state.csvData) } };
  }),
  // Read the gate: true iff the group's confirmed sig matches the active slice.
  // Consumers: `useAppStore((s) => s.isGroupAnalyzed("5-2"))` — recomputes on any
  // csvData/analyzedByGroup change (both live in the store the selector reads).
  isGroupAnalyzed: (routeId) => {
    const state = get();
    const g = groupForRoute(routeId);
    const stored = state.analyzedByGroup[g];
    if (!stored) return false;
    return stored === computeAnalyzeSig(state.csvData);
  },
  isGroupStale: (routeId) => {
    const state = get();
    const stored = state.analyzedByGroup[groupForRoute(routeId)];
    return Boolean(stored && stored !== computeAnalyzeSig(state.csvData));
  },

  // CSV 업로드 및 파싱 (PapaParse). Currently unused (CsvUploader has its own
  // parse path) — kept group-scoped so a future caller can't reintroduce a flat
  // write that desyncs csvGroups from the mirror.
  handleAnalyze: (file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => String(h).trim(),
      complete: (results) => {
        const data = {
          raw: results.data,
          headers: results.meta.fields || [],
          mapping: {}, // TODO: Auto mapping logic if needed
          fileName: file.name,
        };
        set((state) => {
          const g = groupForRoute(state.currentRouteId);
          return { csvGroups: { ...state.csvGroups, [g]: data }, csvData: data };
        });
      },
      error: (err) => {
        alert("CSV 파싱 오류: " + err.message);
      },
    });
  },

  // Ops Dashboard State
  dashboardTab: "viz", // viz, scorecard, pacing, anomaly, ltv, cohort, funnel, segment
  setDashboardTab: (tab) => set({ dashboardTab: tab }),

  // WoW 비교 기간(일) — 결론 카드·스코어카드가 공유(토글 연동). 휘발(세션 UI).
  dashWindowDays: 7, // 7 | 14 | 28
  setDashWindowDays: (d) => set({ dashWindowDays: d }),

  dashboardFilterGroups: buildGroupMap(EMPTY_DASHBOARD_FILTER),
  dashboardFilter: EMPTY_DASHBOARD_FILTER(),
  setDashboardFilter: (filterUpdate) => set((state) => {
    const group = groupForRoute(state.currentRouteId);
    const next = { ...state.dashboardFilter, ...filterUpdate };
    return {
      dashboardFilter: next,
      dashboardFilterGroups: { ...state.dashboardFilterGroups, [group]: next },
    };
  }),

  // Selected Cohort (0, 7, 14, 30...)
  selectedCohort: 7,
  setSelectedCohort: (c) => set({ selectedCohort: c }),

  // 전역 분모 기준(설치/가입) — 운영 대시보드 §12.18 MON_DENOM_STATE 이식.
  // CPI/CPA·CVR·ARPU·리텐션·LTV·퍼널이 이 토글 하나로 함께 전환. 미매핑 시
  // effectiveDenomBasis(csvData, denomBasis)가 installs→actions 자동 폴백.
  denomBasis: "installs", // "installs" | "actions"
  setDenomBasis: (basis) => set({ denomBasis: basis }),

  // LTV 표시 옵션 — 표시 통화(₩/$) 토글(§12.18). 값 변환이 아니라 표시 단위만.
  displayCurrency: "KRW", // "KRW" | "USD"
  setDisplayCurrency: (cur) => set({ displayCurrency: cur }),

  // 코호트 성숙(closure) 필터(#7) — 아직 관측 윈도우가 안 닫힌 미성숙 코호트를
  // 리텐션/LTV 곡선에서 제외할지. index.html 코호트 closure 필터 이식.
  // true = 성숙 코호트만(윈도우 마감), false = 전부 포함. CohortTab/LtvTab이 읽음.
  matureCohortOnly: false,
  setMatureCohortOnly: (v) => set({ matureCohortOnly: !!v }),

  // Event Markers for Dashboard Charts
  eventMarkers: [],
  addEventMarker: (marker) => set((state) => ({
    eventMarkers: [...state.eventMarkers, { ...marker, id: nextStableId("m", state.eventMarkers) }]
  })),
  removeEventMarker: (id) => set((state) => ({
    eventMarkers: state.eventMarkers.filter((m) => m.id !== id)
  })),

  // ── 지표 뷰 설정(Phase B, custom-metrics-data-config-spec.md) ──────────────
  // 유저가 지표를 끄거나 순서를 바꾼 설정. scope별(도구:표면, 예 "5-2:scorecard")
  // 로 { hidden:[], order:[] }. 렌더는 applyMetricView(metricView.js)로 후보에 적용.
  // ★ persist(localStorage) 대상 = viewConfig만(partialize). 원본 CSV는 절대 저장 X(§2.2).
  viewConfig: {},
  setViewConfig: (scopeId, patch) => set((state) => ({
    viewConfig: {
      ...state.viewConfig,
      [scopeId]: { hidden: [], order: [], ...(state.viewConfig[scopeId] || {}), ...patch },
    },
  })),
  resetViewConfig: (scopeId) => set((state) => {
    const next = { ...state.viewConfig };
    delete next[scopeId];
    return { viewConfig: next };
  }),

  // ── 커스텀 지표(Phase C) — 유저가 실제 컬럼으로 "조립"한 지표 정의 ────────────
  // scope별 정의 배열 { [scopeId]: [{ id, name, op, a, b, unit }] }. 정의(config)라
  // persist 대상(원본 데이터 아님, §2.2). compute는 customMetric.js가 순수 생성(eval X).
  customMetrics: {},
  addCustomMetric: (scopeId, def) => set((state) => {
    const list = state.customMetrics[scopeId] || [];
    const id = nextStableId("cm_", list);
    return { customMetrics: { ...state.customMetrics, [scopeId]: [...list, { ...def, id }] } };
  }),
  removeCustomMetric: (scopeId, id) => set((state) => {
    const list = (state.customMetrics[scopeId] || []).filter((m) => m.id !== id);
    return { customMetrics: { ...state.customMetrics, [scopeId]: list } };
  }),
  // 기존 커스텀 지표 수정(id 유지, 정의 교체) — 빌더 "수정" 흐름.
  updateCustomMetric: (scopeId, id, patch) => set((state) => {
    const list = (state.customMetrics[scopeId] || []).map((m) => (m.id === id ? { ...m, ...patch, id } : m));
    return { customMetrics: { ...state.customMetrics, [scopeId]: list } };
  }),

  // ── 커스텀 차트(Phase C) — 유저가 "모양+행(차원)+값(지표)"로 만든 차트 정의 ──────
  // scope별 { [scopeId]: [{ id, name, type, dim, metric }] }. 정의(config)라 persist.
  customCharts: {},
  addCustomChart: (scopeId, def) => set((state) => {
    const list = state.customCharts[scopeId] || [];
    const id = nextStableId("ch_", list);
    return { customCharts: { ...state.customCharts, [scopeId]: [...list, { ...def, id }] } };
  }),
  removeCustomChart: (scopeId, id) => set((state) => {
    const list = (state.customCharts[scopeId] || []).filter((c) => c.id !== id);
    return { customCharts: { ...state.customCharts, [scopeId]: list } };
  }),
}), {
  // localStorage에 "설정만" 저장(§2.2 민감데이터 서버·로컬 잔존 최소화). 원본 CSV·필터
  // Set·차트상태는 partialize에서 제외 → 새로고침 시 데이터는 재업로드, 설정은 유지.
  name: "mkt_view_config",
  version: APP_PERSIST_VERSION,
  storage: createJSONStorage(() => (typeof window !== "undefined" ? window.localStorage : noopStorage)),
  partialize: persistPartialize,
  migrate: persistMigrate,
}));
