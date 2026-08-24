import { describe, expect, it } from "vitest";
import { getToolGuide } from "./toolGuide";
import { TOOL_GROUP } from "@/lib/toolGroups";

// 감사 P1-7: 9-6(소재 분석)이 요청하는 guide id "5-6"이 TOOL_GUIDE에 없어서
// CsvGuide가 null을 반환했고, 업로드 화면의 필수 컬럼 안내가 통째로 사라졌다.
// CsvGuide.smoke는 5-2·5-18만 렌더해 이 구멍을 못 봤다.
//
// CSV를 쓰는 라우트는 전부 TOOL_GROUP에 등록돼 있으므로(§4.3), 그 목록에서
// **파생**해 검사한다 — 손으로 나열하면 다음 도구에서 또 빠진다.
describe("TOOL_GUIDE 커버리지", () => {
  // CsvGuide를 쓰지 않는 라우트. 각 항목은 "왜 없어도 되는지"를 코드로 확인한 것만 넣는다 —
  // 여기 추가하는 순간 그 라우트는 이 가드의 보호를 잃는다.
  const NO_UPLOAD_GUIDE = new Set([
    "5-7", "5-15", // 5-4로 흡수된 legacy id (slugToId가 5-4로 해석)
    "5-23", // 방법별 데이터가 달라 "5-23:<method>" 서브키를 쓴다(Incrementality.jsx:249)
    "5-24", // 자체 dropzone 사용, CsvGuide 미사용(BrandCampaignIncrementality.jsx:201)
    "dochi-result", // 업로드가 아니라 이미 확인한 매핑을 결과 작업대로 이어 주는 라우트
  ]);

  const guideIds = Object.keys(TOOL_GROUP).filter((id) => !NO_UPLOAD_GUIDE.has(id));
  // 5-23은 서브키로 대신 검사한다.
  const subKeyIds = ["5-23:suppression", "5-23:on", "5-23:off"];

  it.each(guideIds)("%s 는 KO 가이드를 갖는다", (id) => {
    expect(getToolGuide(id, "ko"), `TOOL_GUIDE["${id}"] 누락`).toBeTruthy();
  });

  it.each(guideIds)("%s 는 EN 가이드를 갖는다", (id) => {
    expect(getToolGuide(id, "en"), `TOOL_GUIDE_EN["${id}"] 누락`).toBeTruthy();
  });

  it.each(subKeyIds)("%s 는 KO·EN 가이드를 갖는다", (id) => {
    expect(getToolGuide(id, "ko"), `TOOL_GUIDE["${id}"] 누락`).toBeTruthy();
    expect(getToolGuide(id, "en"), `TOOL_GUIDE_EN["${id}"] 누락`).toBeTruthy();
  });

  // 소재(5-6)와 콘텐츠(9-6)는 같은 엔진의 도메인 리라벨이라 필드 계약은 같지만
  // 화면 문구는 달라야 한다(§12.23 — 라벨팩 분리). 같은 객체면 리라벨이 안 된 것이다.
  it("5-6(소재)과 9-6(콘텐츠) 가이드 문구가 서로 다르다", () => {
    expect(getToolGuide("5-6", "ko").grain).not.toBe(getToolGuide("9-6", "ko").grain);
    expect(getToolGuide("5-6", "en").grain).not.toBe(getToolGuide("9-6", "en").grain);
  });
});
