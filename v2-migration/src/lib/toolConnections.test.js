import { describe, expect, it } from "vitest";

import {
  CONNECTED_TOOLS,
  NEXT_TOOL_IDS,
  TOOL_JOURNEY,
  getJourneyContext,
  getNextTools,
  localizedTool,
} from "@/lib/toolConnections";
import { EN_READY_TOOL_IDS, ROUTES, idToSlug, isRoutePublished } from "@/lib/routeMap";
import { TOOL_GROUP, groupForRoute } from "@/lib/toolGroups";
import { isNumberedDocItem } from "@/store/useDataStore";
import { advancedMap } from "@/lib/advanced-marketing/registry";

describe("connected tool workflow", () => {
  it("covers every published tool exactly once in the landing journey", () => {
    const toolIds = Object.keys(CONNECTED_TOOLS);
    const journeyIds = TOOL_JOURNEY.flatMap((stage) => stage.tools);
    const publishedToolIds = ROUTES
      .filter((route) => /^(5|9)-/.test(route.id) && !route.legacy && isRoutePublished(route))
      .map((route) => route.id);
    // 개수를 손으로 적으면 도구가 늘 때마다 이 줄만 고치게 되고, 정작 "여정에
    // 중복 없이 한 번씩 들어갔는가"는 검사되지 않는다(§7). 발행 도구에서 파생한다.
    expect(new Set(journeyIds).size).toBe(publishedToolIds.length);
    expect(journeyIds.length).toBe(new Set(journeyIds).size);
    expect([...journeyIds].sort()).toEqual([...toolIds].sort());
    expect([...toolIds].sort()).toEqual([...publishedToolIds].sort());
    expect([...toolIds].sort()).toEqual([...EN_READY_TOOL_IDS].sort());
  });

  // 여정 도구에는 표시 번호를 붙이지 않는다. 사이드바 분석 섹션이 IA 그룹이 아니라
  // 스테이지를 그리므로 그룹 기준 번호가 화면 계층과 어긋났고("03 선택" 아래 2-3·5-1),
  // 가이드(01~04)의 문서 번호와도 값이 겹쳤다. 번호 체계는 가이드 전용으로 한정한다.
  it("keeps display numbers out of the analysis journey", () => {
    for (const toolId of TOOL_JOURNEY.flatMap((stage) => stage.tools)) {
      expect(isNumberedDocItem(toolId)).toBe(false);
    }
    expect(isNumberedDocItem("8-1")).toBe(false);
  });

  it("keeps guide documents numbered", () => {
    expect(isNumberedDocItem("1-1")).toBe(true);
    expect(isNumberedDocItem("4-3")).toBe(true);
  });

  it("keeps every next-step reference valid and limited to three choices", () => {
    for (const [sourceId, nextIds] of Object.entries(NEXT_TOOL_IDS)) {
      expect(CONNECTED_TOOLS[sourceId]).toBeTruthy();
      expect(nextIds).toHaveLength(3);
      expect(new Set(nextIds).size).toBe(3);
      nextIds.forEach((nextId) => expect(CONNECTED_TOOLS[nextId]).toBeTruthy());
    }
  });

  it("builds matching KR and EN routes", () => {
    expect(localizedTool("5-21", "ko").href).toBe("/tools/campaign-variance");
    expect(localizedTool("5-21", "en").href).toBe("/en/tools/campaign-variance");
    expect(localizedTool("5-21", "en").title).toBe("Campaign performance variance");
    for (const toolId of Object.keys(CONNECTED_TOOLS)) {
      expect(localizedTool(toolId, "ko").href).toBe(idToSlug[toolId]);
      expect(localizedTool(toolId, "en").href).toBe(`/en${idToSlug[toolId]}`);
    }
  });

  it("derives same-CSV labels from the real store group registry", () => {
    for (const toolId of Object.keys(CONNECTED_TOOLS)) {
      expect(TOOL_GROUP[toolId]).toBeTruthy();
      for (const nextTool of getNextTools(toolId, "ko")) {
        expect(nextTool.isSameData).toBe(groupForRoute(toolId) === groupForRoute(nextTool.id));
      }
    }
    const dashboardNext = getNextTools("5-2", "ko");
    expect(dashboardNext.every((tool) => tool.isSameData)).toBe(true);
    const saturationNext = getNextTools("5-22", "ko");
    expect(saturationNext.find((tool) => tool.id === "5-3").isSameData).toBe(true);
    expect(saturationNext.find((tool) => tool.id === "9-6").isSameData).toBe(false);
  });

  it("has no self-links or dead ends and reaches every tool from every start", () => {
    const toolIds = Object.keys(CONNECTED_TOOLS);
    for (const startId of toolIds) {
      const seen = new Set([startId]);
      const queue = [startId];
      expect(NEXT_TOOL_IDS[startId]).not.toContain(startId);
      while (queue.length > 0) {
        const currentId = queue.shift();
        for (const nextId of NEXT_TOOL_IDS[currentId]) {
          if (!seen.has(nextId)) {
            seen.add(nextId);
            queue.push(nextId);
          }
        }
      }
      expect([...seen].sort()).toEqual([...toolIds].sort());
    }
  });

  // 상황 분류(product-ssot §1.1c, 2026-10-26 승인). 상황은 순서가 아니므로 앞뒤 단계가
  // 아니라 같은 상황·같은 파일로 잇는다.
  it("groups tools by situation and links the same situation and the same file", () => {
    const variance = getJourneyContext("5-21", "ko");
    expect(variance.stage.id).toBe("performance");
    expect(variance.alternatives.map((tool) => tool.id)).not.toContain("5-21");
    expect(variance.alternatives.every((tool) => variance.stage.tools.includes(tool.id))).toBe(true);
    // 효율 CSV 하나로 되는 예산 분석은 다른 상황이지만 같은 파일로 이어진다.
    expect(variance.sameFile.map((tool) => tool.id)).toEqual(expect.arrayContaining(["5-22", "5-3"]));
    for (const toolId of TOOL_JOURNEY.flatMap((stage) => stage.tools)) {
      const context = getJourneyContext(toolId, "en");
      expect(context, toolId).toBeTruthy();
      expect(context).not.toHaveProperty("previous");
      expect(context).not.toHaveProperty("next");
      for (const tool of context.sameFile) {
        expect(context.stage.tools).not.toContain(tool.id);
        expect(groupForRoute(tool.id)).toBe(groupForRoute(toolId));
        expect(tool.href.startsWith("/en/")).toBe(true);
      }
    }
  });

  it("names every situation in plain Korean and English without stage codes", () => {
    expect(TOOL_JOURNEY.length).toBeGreaterThanOrEqual(5);
    TOOL_JOURNEY.forEach((stage, index) => {
      // 이름표는 번호만. 예전 "01 · CHECK"처럼 영어 대문자 이름표를 붙이지 않는다.
      expect(stage.label).toEqual({ ko: String(index + 1).padStart(2, "0"), en: String(index + 1).padStart(2, "0") });
      for (const key of ["title", "homeQuestion", "description"]) {
        expect(/[가-힣]/.test(stage[key].ko), `${stage.id}.${key}`).toBe(true);
        expect(/[가-힣]/.test(stage[key].en), `${stage.id}.${key}`).toBe(false);
      }
      // 한 상황에 하나뿐이면 축이 아니고, 너무 많으면 다시 잡동사니가 된다(§12.31).
      expect(stage.tools.length, stage.id).toBeGreaterThanOrEqual(2);
      expect(stage.tools.length, stage.id).toBeLessThanOrEqual(6);
    });
    const descriptions = TOOL_JOURNEY.map((stage) => stage.description.ko);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it("keeps advanced analyses after ad-operations analyses within a situation", () => {
    // 고급 분석(5-32~5-43)은 숨기지 않되 같은 상황에서 뒤에 둔다(§1.1c 결정 3).
    const isAdvanced = (id) => Object.prototype.hasOwnProperty.call(advancedMap(() => true), id);
    let advancedCount = 0;
    for (const stage of TOOL_JOURNEY) {
      const firstAdvanced = stage.tools.findIndex(isAdvanced);
      if (firstAdvanced < 0) continue;
      advancedCount += stage.tools.filter(isAdvanced).length;
      expect(stage.tools.slice(firstAdvanced).every(isAdvanced), stage.id).toBe(true);
    }
    expect(advancedCount).toBeGreaterThan(0);
  });

});
