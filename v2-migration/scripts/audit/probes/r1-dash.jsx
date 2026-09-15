// R1 임시 탐침 2 — 5-2 전체 화면(Dashboard) × 퇴화 입력. 결측 고지가 뜨는가.
import { describe, it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import { FIXTURES } from "../../../scripts/audit/degenerate-fixtures.mjs";
import Dashboard from "@/components/Dashboard";

const MAPPING = { date: "date", channel: "channel", cost: "cost", installs: "installs", actions: "actions", revenue: "revenue_d7" };

function seed(fx) {
  const raw = fx.rows.map((r) => Object.fromEntries(fx.headers.map((h, i) => [h, r[i]])));
  // 통화 선언이 없으면 executionPreflight가 분석을 막는다(실측). 사용자가 실제로
  // 도달하는 상태를 재현하려면 선언까지 마쳐야 한다.
  const slice = { raw, headers: fx.headers, mapping: MAPPING, fileName: "probe.csv", currency: "KRW" };
  useAppStore.setState({ currentRouteId: "5-2", dashboardTab: globalThis.__TAB || "scorecard",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice }, csvData: slice });
  useAppStore.getState().setGroupAnalyzed("5-2");
  expect(useAppStore.getState().isGroupAnalyzed("5-2")).toBe(true); // 셋업이 실제로 게이트를 열었는지 단언(§7)
}

describe("R1 · Dashboard 전체 × 퇴화 입력", () => {
  for (const [key, tab] of [["sparse","viz"],["sparse","scorecard"],["constant","viz"],["allZero","viz"],["single","viz"]]) {
    it(`${key} @ ${tab}`, () => {
      cleanup();
      globalThis.__TAB = tab;
      seed(FIXTURES[key]);
      render(<Dashboard />);
      const t = (document.body.textContent || "").replace(/\s+/g, " ");
      const blocked = t.includes("분석을 시작할 수 없습니다");
      console.log(`   차단: ${blocked}`);
      const marks = ["결측", "누락", "빈 값", "데이터 점검", "품질", "일부", "제외"].filter((m) => t.includes(m));
      console.log(`\n== ${key} (len ${t.length}) 품질 표식: ${marks.length ? marks.join(", ") : "없음"}`);
      console.log(`   [${key} @ ${tab}] 결론카드: ${t.includes("결론 — 최근 성과")} · 품질표식: ${marks.length ? marks.join(",") : "없음"}`);
      // 접힌 <details> 안의 글자도 textContent에는 잡힌다(§7) → 실제 가시성을 따로 본다.
      const nodes = [...document.querySelectorAll("*")].filter((el) => /입력 결측·비정상 셀/.test(el.textContent || "") && !el.querySelector("*"));
      for (const el of nodes.slice(0, 1)) {
        const chain = [];
        for (let cur = el; cur && cur !== document.body; cur = cur.parentElement) {
          chain.push(cur.tagName + (cur.tagName === "DETAILS" ? (cur.open ? "[open]" : "[CLOSED]") : ""));
        }
        console.log(`      가시성 경로: ${chain.join(" < ")}`);
      }
      const bad = [/Infinity/, /∞/, /NaN/, /undefined/].filter((re) => re.test(t));
      if (bad.length) console.log(`   BAD: ${bad.join(" ")}`);
    });
  }
});
