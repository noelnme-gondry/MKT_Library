// 결과 화면의 "자세히 보기"(ds/ResultReport ResultDetails)는 기본 닫힘이다.
// 근거 구역(탭·보조 차트·원자료 표)을 다루는 e2e는 사람이 하듯 버튼을 눌러 연다.
export async function openResultDetails(page) {
  const toggles = page.locator('[data-result-details-toggle][aria-expanded="false"]:visible');
  let opened = 0;
  while (await toggles.count() > 0 && opened < 10) {
    await toggles.first().click();
    opened += 1;
  }
  return opened;
}
