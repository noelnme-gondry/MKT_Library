import { describe, expect, it } from "vitest";
import { WORKSPACE_NAV, workspaceNavItem, workspaceNavItems } from "@/lib/workspaceNav";

describe("workspaceNav", () => {
  it.each(["ko", "en"])("%s 모든 항목이 이름과 설명을 갖는다", (locale) => {
    for (const item of workspaceNavItems(locale)) {
      expect(item.name.trim(), item.id).not.toBe("");
      expect(item.desc.trim(), item.id).not.toBe("");
    }
  });

  it("부제 자리에 암호를 두지 않는다", () => {
    // 예전 부제는 NOW·DATA·DIAG·WEEK였다. 줄여 쓴 코드는 정보가 아니다.
    for (const item of workspaceNavItems("ko")) {
      expect(/^[A-Z]{3,6}$/.test(item.desc), `${item.id} 설명이 암호형`).toBe(false);
      expect(item.desc.length, `${item.id} 설명이 너무 짧음`).toBeGreaterThan(6);
    }
  });

  it("EN에 한글이 새지 않는다", () => {
    for (const item of workspaceNavItems("en")) {
      expect(`${item.name} ${item.desc}`, item.id).not.toMatch(/[가-힣]/);
    }
  });

  it("경로가 실제 라우트 형태다", () => {
    for (const item of WORKSPACE_NAV) expect(item.href).toMatch(/^\/[a-z-]*$/);
  });

  it("없는 id는 null — 빈 라벨을 만들지 않는다", () => {
    expect(workspaceNavItem("없음")).toBeNull();
  });
});
