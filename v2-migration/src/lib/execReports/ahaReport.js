// 5-20 핵심 가치(Aha) — 임원 보고형 결론·수치·표(docs/product-ssot.md §5.5).
// 엔진(ahaMath gridSearch → holdout P·R·F1·support, lift = P ÷ 평균) 출력만 묶는다.
// 정직성(§8): 행동과 정착의 관계는 관측 연관이다 — 결론에 "연관"을 남기고 원인 확인은 실험으로 돌린다.
// "미충족 정착률"은 엔진이 정밀도(P)를 잰 같은 검증 표본에서 조건을 못 채운 사람의 정착 비율을 센다(새 추정 없음).

const tr = (locale, ko, en) => (locale === "en" ? en : ko);

export const AHA_STRONG_LIFT = 1.5;

/** 엔진 지표 → 3버킷(도구 화면의 ahaBucketOf와 같은 규칙). */
export function ahaBucket(result, minSupport) {
  if (result.holdout.support < minSupport) return "weak";
  const overfit = result.train.F1 - result.holdout.F1 > 0.2;
  const strongLift = result.lift != null && result.lift >= AHA_STRONG_LIFT;
  if (strongLift && result.holdout.F1 >= 0.3 && !overfit) return "strong";
  return "maybe";
}

/** 엔진이 P를 잰 검증 표본의 인덱스: 학습/검증을 나눴으면 학습의 여집합, 아니면 전체. */
export function ahaEvaluationIndex(cache) {
  const n = cache?.n || 0;
  const train = cache?.trainIdx || [];
  if (!n) return [];
  if (train.length >= n) return train;
  const inTrain = new Uint8Array(n);
  train.forEach((index) => { inTrain[index] = 1; });
  const out = [];
  for (let index = 0; index < n; index += 1) if (!inTrain[index]) out.push(index);
  return out;
}

/** 조건 충족/미충족의 정착 비율(검증 표본). 값 열을 못 찾으면 null. */
export function ahaSplitRates(cache, result, evalIdx = ahaEvaluationIndex(cache)) {
  const column = (result.windowCols || []).find((entry) => entry.header === result.bestHeader)
    || (result.windowCols || []).find((entry) => entry.window === result.bestWindow);
  if (!column || !cache?.targets || !evalIdx.length) return null;
  let met = 0, metPos = 0, rest = 0, restPos = 0;
  for (const index of evalIdx) {
    const isMet = (column.valuesAll[index] || 0) >= result.bestK;
    const positive = cache.targets[index] ? 1 : 0;
    if (isMet) { met += 1; metPos += positive; } else { rest += 1; restPos += positive; }
  }
  return { met, metRate: met > 0 ? metPos / met : null, rest, restRate: rest > 0 ? restPos / rest : null };
}

const pct = (value, digits = 0) => (value == null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(digits)}%`);
const times = (value, locale) => (value == null || !Number.isFinite(value) ? "—" : tr(locale, `${value.toFixed(1)}배`, `${value.toFixed(1)}x`));

export function ahaWindowLabel(result, locale) {
  return result.bestWindow === Infinity ? tr(locale, "전체 기간", "the whole period") : tr(locale, `${result.bestWindow}일`, `${result.bestWindow} days`);
}

/**
 * opts.domain: "performance"(정착·유저) | "content"(전환·독자). opts.holdoutOn: 검증 분할 여부. opts.windowConfirmed: 평가 시작일 선언 여부.
 */
export function ahaReport({ cache, sortedResults = [], topAction, minSupport, holdoutOn = true, windowConfirmed = true, domain = "performance", locale = "ko" }) {
  const content = domain === "content";
  const rateNoun = content ? tr(locale, "전환율", "conversion rate") : tr(locale, "정착률", "target rate");
  const who = content ? tr(locale, "독자", "readers") : tr(locale, "유저", "users");
  const evalIdx = ahaEvaluationIndex(cache);
  const rows = sortedResults.map((result) => ({ result, bucket: ahaBucket(result, minSupport), rates: ahaSplitRates(cache, result, evalIdx) }));
  const top = topAction ? rows.find((row) => row.result.action === topAction.action) : null;
  const baseRate = cache?.baseRate;
  const exploratory = windowConfirmed ? [] : [tr(locale, "(평가 시작일 미선언 — 탐색용)", "(outcome window undeclared — exploratory)")];

  let lines;
  let tone = "neutral";
  if (!top) {
    lines = [{ kind: "main", chunks: [tr(locale, "판단 보류 —", "Withheld —"), tr(locale, `표본 ${minSupport}명 이상 충족한 행동 후보 없음`, `no action candidate reached ${minSupport} ${who}`)] }];
  } else {
    const r = top.result;
    const condition = tr(locale, `${ahaWindowLabel(r, locale)} 내 ${r.action} ${r.bestK}회+`, `${r.action} ${r.bestK}+ times within ${ahaWindowLabel(r, locale)}`);
    if (top.bucket === "strong") {
      tone = "good";
      lines = [
        { kind: "main", chunks: locale === "en"
          ? [`${content ? "Readers" : "Users"} doing ${r.action} ${r.bestK}+ times within ${ahaWindowLabel(r, locale)}`, `${content ? "convert" : "reach the target"} at ${pct(r.holdout.P)}`]
          : [`${content ? "" : "가입 "}${condition}`, `${who}의 ${rateNoun} ${pct(r.holdout.P)}`] },
        { kind: "effect", chunks: [tr(locale, `평균 ${pct(baseRate)}의 ${times(r.lift, locale)}`, `${times(r.lift, locale)} the ${pct(baseRate)} average`), tr(locale, "— 연관이며 원인 확인은 실험으로", "— an association; confirm cause with an experiment"), ...exploratory] },
      ];
    } else {
      lines = [
        { kind: "main", chunks: [tr(locale, "판단 보류 —", "Withheld —"), tr(locale, `평균 대비 ${AHA_STRONG_LIFT}배·검증 기준을 넘는 행동 없음`, `no action clears ${AHA_STRONG_LIFT}x the average and validation`)] },
        { kind: "effect", chunks: [tr(locale, `1위 후보 ${r.action}:`, `Top candidate ${r.action}:`), tr(locale, `${rateNoun} ${pct(r.holdout.P)} vs 평균 ${pct(baseRate)}`, `${rateNoun} ${pct(r.holdout.P)} vs ${pct(baseRate)} average`), `(${times(r.lift, locale)} · F1 ${r.holdout.F1.toFixed(2)})`, ...exploratory] },
      ];
    }
  }
  const text = lines.map((line) => line.chunks.join(" ")).join(" · ");

  const stats = top ? [
    { id: "rate", label: tr(locale, `${rateNoun} 충족 vs 평균`, `${rateNoun}: met vs average`), value: `${pct(top.result.holdout.P)} vs ${pct(baseRate)}`, detail: times(top.result.lift, locale) },
    { id: "reach", label: tr(locale, "조건 충족", "Met the condition"), value: tr(locale, `${(top.result.allSupport || 0).toLocaleString()}명`, `${(top.result.allSupport || 0).toLocaleString()}`), detail: tr(locale, `전체 ${(cache?.n || 0).toLocaleString()}명의 ${pct(top.result.allPct, 1)}`, `${pct(top.result.allPct, 1)} of ${(cache?.n || 0).toLocaleString()} ${who}`) },
    { id: "f1", label: tr(locale, "검증 정확도", "Validation accuracy"), value: `F1 ${top.result.holdout.F1.toFixed(2)}`, detail: holdoutOn ? tr(locale, "검증 표본 기준", "On the holdout sample") : tr(locale, "학습 표본 기준(분리 꺼짐)", "On training data (split off)") },
  ] : [
    { id: "all", label: tr(locale, `전체 ${who}`, `All ${who}`), value: (cache?.n || 0).toLocaleString() },
    { id: "base", label: tr(locale, `평균 ${rateNoun}`, `Average ${rateNoun}`), value: pct(baseRate, 1) },
    { id: "candidates", label: tr(locale, "판정 가능한 후보", "Judgeable candidates"), value: `0 / ${sortedResults.length}`, detail: tr(locale, `표본 ${minSupport}명 미만`, `Fewer than ${minSupport} ${who}`) },
  ];

  // 대상별 표: 표본을 채운 후보만, 배수 큰 순(시안: "배수 큰 순"). 표본 부족은 확인할 점과 자세히 보기로.
  const tableRows = rows
    .filter((row) => row.bucket !== "weak")
    .sort((a, b) => (b.result.lift ?? -Infinity) - (a.result.lift ?? -Infinity) || a.result.action.localeCompare(b.result.action));
  const overfit = rows.filter((row) => row.bucket !== "weak" && row.result.train.F1 - row.result.holdout.F1 > 0.2);
  const weak = rows.filter((row) => row.bucket === "weak");
  const issues = [
    ...overfit.slice(0, 2).map((row) => ({ kind: tr(locale, "과적합", "Overfit"), target: row.result.action, text: tr(locale, `학습 대비 검증 정확도 −${(row.result.train.F1 - row.result.holdout.F1).toFixed(2)} — 우연일 수 있음`, `Validation accuracy −${(row.result.train.F1 - row.result.holdout.F1).toFixed(2)} vs training — may be chance`) })),
    !windowConfirmed ? { kind: tr(locale, "평가창", "Outcome window"), target: tr(locale, "전체", "All"), text: tr(locale, "전환 평가 시작일 미선언 — 탐색 연관만, 개입 결정 보류", "Outcome start day undeclared — exploratory association only; intervention decisions held") } : null,
    !holdoutOn ? { kind: tr(locale, "검증 분리", "Validation split"), target: tr(locale, "전체", "All"), text: tr(locale, "학습·검증 분리 꺼짐 — 정확도가 낙관적일 수 있음", "Train/holdout split off — accuracy may be optimistic") } : null,
    weak.length ? { kind: tr(locale, "표본 부족", "Small sample"), target: tr(locale, `행동 ${weak.length}개`, `${weak.length} actions`), text: tr(locale, `검증 표본 ${minSupport}명 미만 — 판정에서 제외`, `Fewer than ${minSupport} in the holdout — not judged`) } : null,
  ].filter(Boolean);

  return { tone, lines, text, stats, issues, tableRows, resultState: top ? "ready" : "insufficient" };
}

/** 다음 단계 열: 버킷과 과적합에서 파생한 짧은 명사구. */
export function ahaNextStep(row, locale) {
  if (row.result.train.F1 - row.result.holdout.F1 > 0.2) return tr(locale, "과적합 의심 — 표본 확인", "Possible overfit — check sample");
  if (row.bucket === "strong") return tr(locale, "A/B 후보", "A/B candidate");
  return tr(locale, "약한 신호", "Weak signal");
}
