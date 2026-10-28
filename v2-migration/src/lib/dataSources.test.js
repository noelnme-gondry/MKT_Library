import { describe, expect, it } from "vitest";

import { DATA_SOURCE_FAMILIES, DATA_SOURCE_FAMILY_IDS, DATA_SOURCE_GROUP_IDS, dataSourceForGroup, dataSourceForTool } from "@/lib/dataSources";
import { analysisDataDetail } from "@/lib/analysisDataGuide";
import { publishedToolIds } from "@/lib/routeMap";
import { TOOL_GROUP } from "@/lib/toolGroups";
import { toolIndexEntry } from "@/lib/toolIndex";

const HANGUL = /[가-힣]/;
const PUBLISHED = publishedToolIds();
const PUBLISHED_GROUPS = [...new Set(PUBLISHED.map((id) => TOOL_GROUP[id]))];

// "필요한 데이터는 어디서 받는 파일인지로 먼저 말한다"(product-ssot §1.1c).
// 목록을 손으로 적지 않고 공개 도구의 데이터 그룹에서 파생해 검사한다(AGENTS §7 메타 1).
describe("data source registry", () => {
  it("names a file for every published tool's data group", () => {
    // 규모 단언 — 빈 목록을 돌며 통과하는 가드를 막는다.
    expect(PUBLISHED.length).toBeGreaterThan(20);
    expect(PUBLISHED_GROUPS.length).toBeGreaterThan(10);
    for (const id of PUBLISHED) {
      expect(TOOL_GROUP[id], id).toBeTruthy();
      for (const locale of ["ko", "en"]) {
        const source = dataSourceForTool(id, locale);
        expect(source, `${id} ${locale}`).not.toBeNull();
        expect(source.file.length, id).toBeGreaterThan(3);
        expect(source.family.length, id).toBeGreaterThan(3);
      }
    }
  });

  it("keeps no entry that no published tool reads", () => {
    // 읽는 화면이 없는 항목은 낡은 규칙처럼 남는다(§15). 그룹이 사라지면 항목도 지운다.
    expect([...DATA_SOURCE_GROUP_IDS].sort()).toEqual([...PUBLISHED_GROUPS].sort());
    const usedFamilies = new Set(DATA_SOURCE_GROUP_IDS.map((group) => dataSourceForGroup(group).familyId));
    expect([...usedFamilies].sort()).toEqual([...DATA_SOURCE_FAMILY_IDS].sort());
  });

  it("writes Korean and English separately", () => {
    for (const group of DATA_SOURCE_GROUP_IDS) {
      const ko = dataSourceForGroup(group, "ko");
      const en = dataSourceForGroup(group, "en");
      for (const key of ["file", "family", "where", "prep"]) {
        if (!ko[key] && !en[key]) continue;
        // 한쪽만 있는 문장은 반쪽 번역이다(AGENTS §2.11).
        expect(Boolean(ko[key]), `${group}.${key}`).toBe(Boolean(en[key]));
        // 출처 예시(where)는 매체 고유명사뿐일 수 있다(App Store Connect…) — 한글을 요구하지 않는다.
        if (key !== "where") expect(HANGUL.test(ko[key]), `${group}.${key} ko`).toBe(true);
        expect(HANGUL.test(en[key]), `${group}.${key} en`).toBe(false);
      }
    }
    for (const id of DATA_SOURCE_FAMILY_IDS) {
      expect(HANGUL.test(DATA_SOURCE_FAMILIES[id].name.en)).toBe(false);
      expect(HANGUL.test(DATA_SOURCE_FAMILIES[id].where.en)).toBe(false);
    }
  });

  it("returns nothing for an unregistered tool instead of guessing a file", () => {
    // groupForRoute는 모르는 id를 효율 그룹으로 보낸다 — 파일 표기는 그 폴백을 쓰지 않는다.
    expect(dataSourceForTool("no-such-tool")).toBeNull();
    expect(dataSourceForGroup("no-such-group")).toBeNull();
  });

  it("wires the file into the tool index and the data guide", () => {
    // 신호를 만들었으면 읽는 곳을 같이 배선한다(§7 메타 3).
    expect(toolIndexEntry("5-21", "ko").source.file).toBe(dataSourceForTool("5-21", "ko").file);
    expect(toolIndexEntry("5-21", "en").source.file).toBe(dataSourceForTool("5-21", "en").file);
    // 같은 파일 = 같은 그룹. 효율 CSV를 쓰는 도구는 같은 파일 이름을 받는다.
    expect(dataSourceForTool("5-22", "ko").file).toBe(dataSourceForTool("5-21", "ko").file);
    // 업로더 가이드에 출처 문장이 없는 도구는 레지스트리의 준비 안내를 쓴다.
    // 그 경로를 실제로 밟는 도구가 있는지도 센다 — 0이면 이 단언은 아무것도 검사하지 않는다.
    let viaRegistry = 0;
    for (const id of PUBLISHED) {
      const detail = analysisDataDetail(id, "ko");
      if (!detail || detail.guide.source) continue;
      viaRegistry += 1;
      expect(detail.source, id).toBe(dataSourceForTool(id, "ko").prep);
    }
    expect(viaRegistry).toBeGreaterThan(0);
  });
});
