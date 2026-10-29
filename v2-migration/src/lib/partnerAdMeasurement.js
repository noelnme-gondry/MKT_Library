// GaPageviews의 pathname 전환과 같은 페이지 진입 경계. 사용자 식별자·저장소 없음.
// 현재 진입만 보관하므로 A→B→A는 새 Set이고, StrictMode/중복 슬롯은 같은 Set이다.
let currentPage = null;

export function beginPartnerAdPage(pathname) {
  if (!currentPage || currentPage.pathname !== pathname) currentPage = { pathname, slots: new Set() };
  return currentPage;
}

export function isCurrentPartnerAdPage(page) {
  return page === currentPage;
}
