import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * legacy pill 래칫.
 *
 * 배경: 선택형 pill의 정본은 `ds/PillGroup`인데, 손으로 쓴 `.ab-pillgroup` 마크업이
 * **10곳 · 4파일** 남아 있다. 전역 어댑터 `LegacyPillGroupA11y`가 런타임에
 * radiogroup·로빙 tabindex·화살표 이동을 붙여 주므로 지금 당장 조작이 깨지지는
 * 않는다(실측: 옵션은 전부 `button.ab-pill`이고 다중선택 그룹은 없어 어댑터의
 * 단일선택 가정이 성립한다. `<span class="ab-pill">` 10곳은 읽기 전용 표시 칩이라
 * 어댑터가 옳게 무시한다).
 *
 * 문제는 조작이 아니라 **증식**이다. 어댑터가 있다는 사실이 "새로 써도 된다"로
 * 읽히면 부채는 계속 늘고, 계약은 영원히 런타임 DOM 패치에만 존재하게 된다.
 * 그래서 이 검사는 이관을 강제하지 않고 **수가 늘지 않는 것만** 강제한다.
 *
 * 2026-08-19 이관 완료 후 남은 10곳은 **PillGroup을 쓰면 안 되는 자리들**이다:
 *   · MarketingResponse 6곳 — pill이 0~1개라 선택 그룹이 아니라 레이아웃 컨테이너
 *   · LtvTab 2곳 — 다중선택(`data-pillgroup="multi"`). radiogroup을 씌우면 거짓 상태를 알린다
 *   · AnomalyTab 1곳 — 한 컨테이너에 선택기 셋. 쪼개면 줄바꿈이 달라진다(레이아웃 변경)
 *   · FunnelTab 1곳 — ON/OFF 토글
 * 그래서 이 수는 더 내려갈 예정이 없다. 대신 아래 "손으로 쓴 단일선택" 검사가
 * **진짜 계약**을 지킨다 — 새 라디오 그룹을 손으로 쓰면 그게 잡힌다.
 * (`docs/product-ssot.md` §7 · D-05)
 */

const COMPONENTS = path.dirname(fileURLToPath(import.meta.url)).replace(/\/ds$/, "");

// 2026-08-19 실측 기준선. 이관할 때마다 내려간다.
const BASELINE = 10;
const BASELINE_FILES = 4;

function jsxFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return path.basename(full) === "ds" ? [] : jsxFiles(full);
    return entry.endsWith(".jsx") && !entry.includes(".test.") ? [full] : [];
  });
}

function legacyGroups() {
  const perFile = new Map();
  for (const file of jsxFiles(COMPONENTS)) {
    // `ab-pillgroup-label`(라벨 span)까지 세면 안 된다 — 처음 기준선 94는 그 오류였고,
    // 실제 컨테이너는 45곳이었다. 숫자를 적을 땐 무엇을 세는지부터 확인할 것.
    const count = (readFileSync(file, "utf-8").match(/className="ab-pillgroup(?:"|\s)/g) || []).length;
    if (count) perFile.set(path.relative(COMPONENTS, file), count);
  }
  return perFile;
}

describe("legacy pill ratchet", () => {
  it("never grows the hand-written .ab-pillgroup markup", () => {
    const perFile = legacyGroups();
    const total = [...perFile.values()].reduce((sum, count) => sum + count, 0);
    expect(
      total,
      `legacy pill이 늘었다. 새 선택형 컨트롤은 ds/PillGroup을 쓸 것(product-ssot §7). 현재 분포: ${JSON.stringify(Object.fromEntries(perFile), null, 1)}`,
    ).toBeLessThanOrEqual(BASELINE);
    expect(perFile.size, "legacy pill을 쓰는 파일이 늘었다").toBeLessThanOrEqual(BASELINE_FILES);
  });

  it("keeps the baseline honest — lower it after a migration", () => {
    const total = [...legacyGroups().values()].reduce((sum, count) => sum + count, 0);
    // 이관해 놓고 기준선을 안 내리면 래칫이 다시 헐거워진다.
    expect(BASELINE - total, `${BASELINE - total}곳을 이관했다. BASELINE을 ${total}로 내릴 것`).toBeLessThan(5);
  });

  // 개수보다 이것이 진짜 계약이다: **손으로 쓴 단일선택 라디오 그룹이 새로 생기지 않는 것.**
  // 남은 10곳은 선택 그룹이 아니거나(pill 0~1개) 다중선택이거나 복합이라 대상이 아니다.
  it("never hand-writes a new single-select radio group", () => {
    const offenders = [];
    for (const file of jsxFiles(COMPONENTS)) {
      const lines = readFileSync(file, "utf-8").split("\n");
      lines.forEach((line, index) => {
        if (!/className="ab-pillgroup(?:"|\s)/.test(line)) return;
        // 컨테이너의 닫는 </div>까지를 그룹으로 본다.
        let depth = 0;
        let end = index;
        for (let cursor = index; cursor < lines.length; cursor += 1) {
          depth += (lines[cursor].match(/<div\b/g) || []).length - (lines[cursor].match(/<\/div>/g) || []).length;
          if (depth === 0) { end = cursor; break; }
        }
        const body = lines.slice(index, end + 1).join("\n");
        if (body.includes('data-pillgroup="multi"')) return;      // 다중선택은 대상 아님
        if ((body.match(/ab-pillgroup-label/g) || []).length >= 2) return; // 복합 컨테이너
        const pills = (body.match(/`ab-pill/g) || []).length;
        if (pills < 2) return;                                     // 선택 그룹이 아님
        offenders.push(`${path.relative(COMPONENTS, file)}:${index + 1}`);
      });
    }
    expect(
      offenders,
      "손으로 쓴 단일선택 그룹이 새로 생겼다. ds/PillGroup을 쓸 것(product-ssot §7)",
    ).toEqual([]);
  });

  it("relies on an adapter that is actually mounted", () => {
    // 기준선을 유지하는 근거는 "어댑터가 계약을 붙여 준다"는 것이다. 어댑터가
    // 앱 셸에서 빠지면 잔여 10곳이 통째로 키보드 조작을 잃으므로 함께 단언한다.
    // 이름만 찾으면 import 줄에 걸려 마운트를 지워도 통과한다(실제로 그랬다).
    // JSX 사용을 찾아야 계약을 검사하는 것이 된다.
    const mounted = jsxFiles(COMPONENTS)
      .some((file) => /<LegacyPillGroupA11y[\s/>]/.test(readFileSync(file, "utf-8")));
    expect(mounted, "LegacyPillGroupA11y가 어디에도 마운트돼 있지 않다 — 잔여 10곳이 키보드 조작을 잃는다").toBe(true);
  });
});
