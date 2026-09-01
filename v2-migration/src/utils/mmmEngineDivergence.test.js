import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

/*
 * MMM 엔진은 두 벌이다(ARCHITECTURE.md §3):
 *   mmmMath.js       기본·예측 경로
 *   mmmMathPr416.js  mmmMode="classic"·"prism"이 쓰는 PR #416 시점 모델의 동결 스냅샷
 *
 * 두 파일은 module-level 심볼 대부분을 같은 이름·같은 본문으로 들고 있다. 그래서
 * `_nonRedundantCols`의 버그를 mmmMath에서만 고치면 classic/prism 모드는 조용히
 * 옛 코드를 계속 쓴다 — 화면도 테스트도 아무 말을 하지 않는다.
 *
 * 통합은 답이 아니다. 실측하면 핵심 알고리즘 17개(mmmBayesianRun 707 vs 432줄 등)가
 * **의도적으로** 갈려 있고, 그 재현성이 classic 모드의 존재 이유다. 비공개 헬퍼까지
 * 포함해 안전하게 공유 가능한 부분은 225줄/6,718줄뿐이라 이득이 위험을 못 넘는다.
 *
 * 그래서 통합 대신 **분기를 감지**한다. 지금 같은 두 심볼의 목록을 고정해 두고, 한쪽만
 * 바뀌면 그 이름을 짚어 실패시킨다. 의도적으로 갈라야 하면 아래 상수에서 빼면 되고,
 * 그 순간 "왜 갈랐는지"가 diff에 남는다.
 */

const A = readFileSync(new URL("./mmmMath.js", import.meta.url), "utf8");
const B = readFileSync(new URL("./mmmMathPr416.js", import.meta.url), "utf8");

// classic이 일부러 다르게 들고 있는 것들. 여기 있는 이름은 두 파일이 달라야 정상이다.
const INTENTIONALLY_FORKED = Object.freeze(new Set([
  "MMM_METH_CONFIG", "MMM_CANNIB_RULES", "stlWeekly", "adfCT",
  "mmmBayesianRun", "mmmBayesianForecast", "mmmBayesianHealth", "mmmBayesianWeeklyDecomp",
  "mmmBayesianSeasonalitySelection", "mmmBayesianMediaPenaltySelection",
  "mmmBayesianCorrelatedGroupRefit", "mmmBuildFeatures", "mmmCannibalization",
  "mmmChannelCoverage", "mmmForecastRollingSelection", "mmmTrendExistence", "mmmValidate",
  // 위 mmmBayesian* 계열이 쓰는 비공개 헬퍼들. 동결된 classic 사후추정 경로의 일부라
  // 함께 갈려 있다 — 이것들이 같아지면 classic 수치가 바뀐다.
  "_mmmBayesTransformCandidates", "_mmmBayesChannelParams", "_mmmNonNegativeMediaFit",
  "_mmmBayesianLinear", "_mmmBayesFitColumns", "_mmmBusinessContributionPriors",
  "_mmmBayesTransformUncertainty", "_mmmBayesBaselineSelection", "_mmmBayesSlicePanel",
  "_mmmBayesSeasonalityCandidateFit", "_mmmBayesJointTransformCheck",
  "_mmmBuildChannelContributions", "_mmmSliceWindowPanel",
]));

function declarations(source) {
  const found = new Map();
  // 모듈 최상위 선언만 본다. 두 파일은 index.html에서 뽑혀 나와 전체가 들여쓰기돼
  // 있으므로 들여쓰기로는 최상위를 못 가른다 — `export`이거나 `function` 선언문인
  // 것만 받는다(지역 변수는 전부 `const`라 이 규칙으로 걸러진다).
  const pattern = /^[ \t]*(?:(export)\s+(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)\s*=)|(?:async\s+)?function\s+(\w+))/gm;
  for (const match of source.matchAll(pattern)) {
    const name = match[2] || match[3] || match[4];
    const isFunction = Boolean(match[2] || match[4]);
    if (found.has(name)) continue;
    let index = match.index + match[0].length;
    if (isFunction) {
      while (index < source.length && source[index] !== "(") index += 1;
      let parens = 0;
      while (index < source.length) {
        if (source[index] === "(") parens += 1;
        else if (source[index] === ")") { parens -= 1; if (parens === 0) { index += 1; break; } }
        index += 1;
      }
    }
    let depth = 0; let started = false; let end = null;
    while (index < source.length) {
      const char = source[index];
      if (char === "{" || char === "(" || char === "[") { depth += 1; started = true; }
      else if (char === "}" || char === ")" || char === "]") {
        depth -= 1;
        if (started && depth === 0) { end = index + 1; break; }
      }
      index += 1;
    }
    const body = source.slice(match.index, end ?? match.index + match[0].length);
    const normalized = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "").replace(/\s+/g, " ").trim();
    found.set(name, crypto.createHash("sha1").update(normalized).digest("hex"));
  }
  return found;
}

const left = declarations(A);
const right = declarations(B);
const shared = [...right.keys()].filter((name) => left.has(name));
const trackable = shared.filter((name) => !INTENTIONALLY_FORKED.has(name));

describe("MMM 두 엔진의 분기 감지", () => {
  it("스캐너가 두 파일 모두에서 심볼을 찾는다", () => {
    // 파서가 깨지면 공유 목록이 비어 검사가 조용히 통과한다 — 규모부터 단언한다.
    expect(left.size).toBeGreaterThan(150);
    expect(right.size).toBeGreaterThan(100);
    expect(shared.length).toBeGreaterThan(90);
  });

  it("의도적 포크 목록은 실제로 두 파일에 다 있고 실제로 다르다", () => {
    const missing = [...INTENTIONALLY_FORKED].filter((name) => !left.has(name) || !right.has(name));
    expect(missing, "포크 목록에 있는데 한쪽 파일에 없는 심볼 — 목록이 낡았다").toEqual([]);
    const notActuallyForked = [...INTENTIONALLY_FORKED].filter((name) => left.get(name) === right.get(name));
    expect(notActuallyForked, "같아졌는데 포크로 선언돼 있다 — 목록에서 뺄 것").toEqual([]);
  });

  it("공유 심볼이 한쪽에서만 바뀌지 않았다", () => {
    const drifted = trackable.filter((name) => left.get(name) !== right.get(name));
    expect(
      drifted,
      `두 MMM 엔진에서 이름은 같은데 본문이 갈렸다. mmmMath.js만 고치고 mmmMathPr416.js를 안 고치면\n`
      + `classic·prism 모드는 옛 코드를 계속 쓴다. 양쪽에 같이 반영하거나, 의도적으로 가른 것이면\n`
      + `INTENTIONALLY_FORKED에 사유와 함께 추가할 것:\n  ${drifted.join("\n  ")}`,
    ).toEqual([]);
  });
});
