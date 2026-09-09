/* ============================================================
 * workspaceNav — 공통 작업 목적지의 이름·설명 단일 출처.
 *
 * 같은 라벨이 사이드바(홈 변형·일반 변형), 헤더 브레드크럼, ⌘K, 푸터에
 * 각각 적혀 있었다. 한 곳만 고치면 나머지가 어긋난다(§7 — 목록을 두 곳에
 * 나열하지 말고 파생시켜라).
 *
 * 이름 규칙: **어디로 가는지**를 말한다. 예전 라벨은 `NOW`·`DATA`·`DIAG`·
 * `WEEK` 같은 암호를 부제로 달고 있었는데, 줄여 쓴 코드는 읽는 사람에게
 * 아무것도 주지 않는다. 그 자리를 실제 설명으로 바꿨다.
 * ============================================================ */

export const WORKSPACE_NAV = [
  {
    id: "home",
    group: "home",
    href: "/",
    icon: "◎",
    ko: { name: "홈", desc: "지금 볼 것과 다음 행동" },
    en: { name: "Home", desc: "What to check now" },
  },
  {
    id: "start",
    group: "work",
    href: "/start",
    icon: "⇧",
    ko: { name: "CSV로 시작", desc: "파일 올리고 가능한 분석 찾기" },
    en: { name: "Analyze my CSV", desc: "Upload and see what's possible" },
  },
  {
    id: "results", group: "work", href: "/dochi-result", icon: "▦",
    ko: { name: "내 분석 결과", desc: "같은 CSV에서 확인한 통합 결과" },
    en: { name: "My analysis results", desc: "Connected results from the same CSV" },
  },
  {
    id: "overview", group: "work", href: "/dashboard", icon: "▥",
    ko: { name: "성과 오버뷰", desc: "기간과 채널별 운영 성과 확인" },
    en: { name: "Performance overview", desc: "Review performance by period and channel" },
  },
  {
    id: "blog", group: "learn", href: "/blog", icon: "▤",
    ko: { name: "블로그", desc: "마케팅 질문을 이해하는 실무 글" },
    en: { name: "Blog", desc: "Practical answers to marketing questions" },
  },
  {
    id: "guide", group: "learn", href: "/guide", icon: "☑",
    ko: { name: "실무 가이드 · SOP", desc: "설정부터 분석까지 운영 기준" },
    en: { name: "Guides & SOPs", desc: "Operating standards from setup to analysis" },
  },
  {
    id: "storage", group: "manage", href: "/storage", icon: "▣",
    ko: { name: "저장된 데이터", desc: "이 기기의 CSV 복원과 저장 관리" },
    en: { name: "Saved data", desc: "Restore and manage CSVs on this device" },
  },
  {
    id: "review",
    group: "work",
    href: "/weekly-review",
    icon: "◷",
    // 이 주소는 이제 주간 리뷰 제품이다(명세 §1). 지난 결정 이력은 그 안 접기로 들어갔다.
    ko: { name: "주간 리뷰", desc: "비교 → 결정 기록 → 다음 결과 검토" },
    en: { name: "Weekly Review", desc: "Compare → decide → review the next results" },
  },
  {
    id: "projects",
    group: "manage",
    href: "/projects",
    icon: "▣",
    ko: { name: "프로젝트 보관함", desc: "고객·앱별 리뷰와 지난 결정" },
    en: { name: "Projects", desc: "Reviews and decisions by client or app" },
  },
  {
    id: "subscription",
    group: "manage",
    href: "/subscription",
    icon: "▤",
    ko: { name: "구독 · 요금제", desc: "무료 분석과 Pro 보고서 이용 안내" },
    en: { name: "Plans & subscription", desc: "Free analysis and Pro reporting" },
  },
  {
    id: "diagnose",
    group: "learn",
    href: "/diagnose",
    icon: "◇",
    ko: { name: "질문에서 시작", desc: "파일 없이 3문항으로" },
    en: { name: "Start with a question", desc: "Three questions, no file" },
  },
];

const byId = Object.fromEntries(WORKSPACE_NAV.map((entry) => [entry.id, entry]));

/** 목적지 하나의 로케일 사본. 없는 id는 null(빈 라벨을 만들지 않는다). */
export function workspaceNavItem(id, locale = "ko") {
  const entry = byId[id];
  if (!entry) return null;
  const copy = entry[locale] || entry.ko;
  return { id: entry.id, href: entry.href, icon: entry.icon, group: entry.group, ...copy };
}

export function workspaceNavItems(locale = "ko") {
  return WORKSPACE_NAV.map((entry) => workspaceNavItem(entry.id, locale));
}

export const WORKSPACE_NAV_GROUPS = [
  { id: "home", ko: "라이브러리", en: "Library" },
  { id: "learn", ko: "배우고 찾아보기", en: "Learn & explore" },
  { id: "work", ko: "데이터로 적용하기", en: "Analyze & review" },
  { id: "manage", ko: "내 워크스페이스", en: "My workspace" },
];
