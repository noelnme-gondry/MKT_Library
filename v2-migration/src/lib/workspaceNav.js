/* ============================================================
 * workspaceNav — 상단 작업 목적지 네 개의 이름·설명 단일 출처.
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
    href: "/",
    icon: "◎",
    ko: { name: "홈", desc: "지금 볼 것과 다음 행동" },
    en: { name: "Home", desc: "What to check now" },
  },
  {
    id: "start",
    href: "/start",
    icon: "⇧",
    ko: { name: "내 CSV 분석", desc: "파일 올리고 가능한 분석 찾기" },
    en: { name: "Analyze my CSV", desc: "Upload and see what's possible" },
  },
  {
    id: "diagnose",
    href: "/diagnose",
    icon: "◇",
    ko: { name: "원인 찾기", desc: "파일 없이 3문항으로" },
    en: { name: "Find the cause", desc: "Three questions, no file" },
  },
  {
    id: "review",
    href: "/weekly-review",
    icon: "◷",
    ko: { name: "지난 결정", desc: "결과가 어땠는지 확인" },
    en: { name: "Past decisions", desc: "Check how they turned out" },
  },
];

const byId = Object.fromEntries(WORKSPACE_NAV.map((entry) => [entry.id, entry]));

/** 목적지 하나의 로케일 사본. 없는 id는 null(빈 라벨을 만들지 않는다). */
export function workspaceNavItem(id, locale = "ko") {
  const entry = byId[id];
  if (!entry) return null;
  const copy = entry[locale] || entry.ko;
  return { id: entry.id, href: entry.href, icon: entry.icon, ...copy };
}

export function workspaceNavItems(locale = "ko") {
  return WORKSPACE_NAV.map((entry) => workspaceNavItem(entry.id, locale));
}
