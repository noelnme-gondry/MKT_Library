// 5-23 증분 효과의 보고서 층(결론 줄 · 핵심 수치 3개 · 확인할 점). 엔진(INCR_MATH·INCR_PREPOST) 값만 묶는다.
// 2026-10-23 사용자 결정 #3: 설계가 선언되지 않아도 추정치와 95% 구간은 보여 주고 "탐색용"을 붙인다.
// 권고·채택 단어는 선언된 설계 + 0을 벗어난 구간 + (홀드아웃) 사전 균형 확인일 때만 쓴다(§8.6·§8.9).
import { fmtNum, fmtCurrencyCompact } from "@/utils/format";

const MINUS = "−";

/** 부호 붙은 건수·값: +1,240 / −12.5. 표시 자리수에서 0이면 부호 없음. */
export function signedValue(value, digits = 0) {
  if (!Number.isFinite(value)) return "—";
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return fmtNum(0, digits);
  return `${rounded > 0 ? "+" : MINUS}${fmtNum(Math.abs(rounded), digits)}`;
}

export const intervalText = (low, high, digits = 0) => (Number.isFinite(low) && Number.isFinite(high)
  ? `95% ${signedValue(low, digits)} ~ ${signedValue(high, digits)}`
  : null);

const crossesZero = (low, high) => !(Number.isFinite(low) && Number.isFinite(high)) || (low <= 0 && high >= 0);

const ASSIGNMENT_LABEL = {
  randomized: ["무작위 배정", "random assignment"],
  comparison: ["비슷한 그룹 비교", "matched comparison"],
  observational: ["같은 대상 전후", "same-audience before/after"],
};

/** 조건 줄에 넣을 설계 선언 한 마디. */
export function designDeclarationText(design, locale = "ko") {
  const en = locale === "en";
  const assignment = ASSIGNMENT_LABEL[design?.values?.assignment];
  if (design?.ready) return en ? `Design declared: ${assignment?.[1] || "conditions met"}` : `설계 선언: ${assignment?.[0] || "조건 충족"}`;
  if (!assignment) return en ? "Design declared: not yet" : "설계 선언: 아직 모름";
  return en ? `Design declared: ${assignment[1]} (conditions not met)` : `설계 선언: ${assignment[0]} (판정 조건 미충족)`;
}

function designIssue(design, locale, randomizedOnly) {
  const en = locale === "en";
  if (design?.ready) return null;
  const declared = Boolean(design?.values?.assignment);
  return {
    kind: en ? "Design" : "설계 선언",
    target: randomizedOnly ? (en ? "Assignment" : "배정 방식") : (en ? "Comparison" : "비교 조건"),
    text: declared
      ? (en ? "Declared conditions do not meet the verdict rule — see Change settings" : "선언한 조건이 판정 기준에 맞지 않습니다 — 조건 바꾸기에서 확인")
      : randomizedOnly
        ? (en ? "Random assignment not confirmed — declare it in Change settings to get a verdict" : "무작위 여부 미확인 — 조건 바꾸기에서 선언하면 판정합니다")
        : (en ? "Comparison conditions not confirmed — declare them in Change settings to get a verdict" : "비교 조건 미확인 — 조건 바꾸기에서 선언하면 판정합니다"),
  };
}

/**
 * 통제군(홀드아웃). r: INCR_MATH.compute 출력. win: {balanced, preExp, preHold, preDiff}.
 * 증분 전환의 95% 구간 = 전환율 차이 구간 × 노출 분모 — incrementalConv가 정의상 nTest × liftAbs이므로 같은 구간의 단위 환산이다.
 */
export function suppressionReport({ r, win, design, locale = "ko", currency = "KRW" }) {
  const en = locale === "en";
  const tr = (ko, eng) => (en ? eng : ko);
  const inc = r.incrementalConv;
  const low = Number.isFinite(r.ciLow95) ? r.ciLow95 * r.nTest : null;
  const high = Number.isFinite(r.ciHigh95) ? r.ciHigh95 * r.nTest : null;
  const interval = intervalText(low, high);
  const conclusive = Boolean(r.conclusive) && !crossesZero(low, high);
  const positive = inc > 0;
  const ready = Boolean(design?.ready);
  const balanced = win?.balanced;
  const unit = tr("건", "");
  const incChunk = tr(`증분 전환 ${signedValue(inc)}건`, `Incremental conversions ${signedValue(inc)}`);
  const intervalChunk = interval ? `(${interval}${unit})` : null;
  const iroasChunk = Number.isFinite(r.iroas) ? `· iROAS ${r.iroas.toFixed(2)}×` : null;
  const exploratory = tr("탐색용 — 무작위 배정이 확인되면 판정합니다", "Exploratory — a verdict needs confirmed random assignment");

  let lines;
  let tone = "neutral";
  if (!conclusive) {
    lines = [
      { kind: "main", chunks: [interval ? tr("판단 보류 — 구간이 0 포함", "Hold — the interval includes 0") : tr("판단 보류 — 구간 추정 불가", "Hold — interval not estimable"), incChunk, intervalChunk] },
      { kind: "effect", chunks: [ready
        ? tr("효과 없음이 아니라 표본 부족 — 계획한 기간·표본에서 다시 판독", "Not proof of no effect — reread at the planned window and sample")
        : exploratory] },
    ];
  } else if (!ready) {
    lines = [
      { kind: "main", chunks: [incChunk, intervalChunk, iroasChunk] },
      { kind: "effect", chunks: [exploratory] },
    ];
  } else if (balanced === false) {
    lines = [
      { kind: "main", chunks: [tr(`판단 보류 — 홀드아웃 전부터 두 그룹 차이 ${signedValue(win.preDiff, 2)}%p`, `Hold — groups already differed by ${signedValue(win.preDiff, 2)}pp before the holdout`)] },
      { kind: "effect", chunks: [incChunk, intervalChunk, tr("— 확대 근거로 쓰지 않음", "— not a basis for scaling")] },
    ];
  } else if (balanced == null) {
    lines = [
      { kind: "main", chunks: [incChunk, intervalChunk, iroasChunk] },
      { kind: "effect", chunks: [tr("탐색용 — 홀드아웃 전 기간이 없어 그룹 균형을 확인할 수 없습니다", "Exploratory — no pre-holdout period to check group balance")] },
    ];
  } else if (positive) {
    const recovers = !Number.isFinite(r.iroas) || r.iroas >= 1;
    tone = recovers ? "good" : "neutral";
    lines = [
      { kind: "main", chunks: [recovers ? tr("광고 유지 권고:", "Keep the ads:") : tr("증분 확인, 광고비 미회수:", "Incremental but spend not recovered:"), incChunk, intervalChunk, iroasChunk] },
      { kind: "effect", chunks: [tr("선언한 무작위 홀드아웃 기준 — 같은 설계로 재검증 후 확대", "Based on the declared random holdout — revalidate with the same design before scaling")] },
    ];
  } else {
    tone = "bad";
    lines = [
      { kind: "main", chunks: [tr("광고 효과 미확인:", "No ad lift found:"), incChunk, intervalChunk] },
      { kind: "effect", chunks: [tr("노출 그룹 전환율이 홀드아웃보다 낮음 — 소재·타깃 재검토", "Exposed converted below holdout — review creative and targeting")] },
    ];
  }

  const secondStat = Number.isFinite(r.iroas)
    ? { label: "iROAS", value: `${r.iroas.toFixed(2)}×`, detail: Number.isFinite(r.cpia) ? tr(`증분 전환당 비용 ${fmtCurrencyCompact(r.cpia, { currency, locale })}`, `Cost per incremental conversion ${fmtCurrencyCompact(r.cpia, { currency, locale })}`) : tr("증분 매출 ÷ 광고비", "Incremental revenue ÷ spend") }
    : Number.isFinite(r.cpia)
      ? { label: tr("증분 전환당 비용", "Cost per incremental conv."), value: fmtCurrencyCompact(r.cpia, { currency, locale }), detail: tr("광고비 ÷ 증분 전환", "Spend ÷ incremental conversions") }
      : { label: tr("상대 리프트", "Relative lift"), value: Number.isFinite(r.liftRel) ? signedValue(r.liftRel * 100, 1) + "%" : "—", detail: `${(r.cRate * 100).toFixed(2)}% → ${(r.tRate * 100).toFixed(2)}%` };
  const stats = [
    { label: tr("증분 전환", "Incremental conversions"), value: tr(`${signedValue(inc)}건`, signedValue(inc)), detail: interval || tr("구간 추정 불가", "Interval not estimable") },
    secondStat,
    {
      label: tr("설계 등급", "Design grade"),
      value: ready ? tr("무작위 (선언)", "Randomized (declared)") : design?.values?.assignment ? tr("조건 미충족", "Conditions not met") : tr("미확인", "Not confirmed"),
      detail: balanced == null
        ? tr("홀드아웃 전 기간 없음", "No pre-holdout period")
        : tr(`사전 차이 ${signedValue(win.preDiff, 2)}%p · ${balanced ? "균형" : "불균형 의심"}`, `Pre-period gap ${signedValue(win.preDiff, 2)}pp · ${balanced ? "balanced" : "imbalance suspected"}`),
    },
  ];

  const issues = [designIssue(design, locale, true)];
  if (balanced === false) issues.push({ kind: tr("그룹 균형", "Balance"), target: tr("홀드아웃 전", "Before holdout"), text: tr(`노출 ${win.preExp.toFixed(2)}% vs 홀드아웃 ${win.preHold.toFixed(2)}% — 증분이 왜곡됐을 수 있습니다`, `Exposed ${win.preExp.toFixed(2)}% vs holdout ${win.preHold.toFixed(2)}% — the increment may be distorted`) });
  else if (balanced == null) issues.push({ kind: tr("그룹 균형", "Balance"), target: tr("홀드아웃 전", "Before holdout"), text: tr("홀드아웃 전 기간이 없어 균형을 확인할 수 없습니다", "No pre-holdout period, so balance cannot be checked") });
  if (Number.isFinite(r.iroas)) issues.push({ kind: "iROAS", target: tr("증분 매출", "Incremental revenue"), text: tr("마진·다른 비용을 반영하지 않습니다 — 이익 여부가 아닙니다", "Excludes margins and other costs — not profitability") });

  return { lines, tone, stats, issues: issues.filter(Boolean), interval: { low, high }, conclusive, ready };
}

/**
 * 전후·DiD. effect: 일평균 순효과(DiD) 또는 처리군 변화, low/high: 같은 엔진의 95% 구간.
 */
export function prepostReport({ effect, low, high, total, preN, postN, isDiD, lost, metric, design, hasSignificance, locale = "ko" }) {
  const en = locale === "en";
  const tr = (ko, eng) => (en ? eng : ko);
  const hold = crossesZero(low, high);
  const ready = Boolean(design?.ready);
  const interval = intervalText(low, high, 1);
  const prefix = lost ? tr("광고 종료 뒤", "After stopping ads,") : tr("광고 시작 뒤", "After starting ads,");
  const valueChunks = [
    tr(`${metric} 일평균 ${signedValue(effect, 1)}`, `daily ${metric} ${signedValue(effect, 1)}`),
    interval ? `(${interval})` : null,
    isDiD ? tr("· 대조군 보정", "· control-adjusted") : null,
  ];
  const totalChunk = Number.isFinite(total) ? tr(`· 기간 합계 ${signedValue(total)}`, `· period total ${signedValue(total)}`) : null;
  const exploratory = tr("탐색용 — 비교 조건이 확인되면 판정합니다", "Exploratory — a verdict needs confirmed comparison conditions");
  const caveat = isDiD
    ? tr("대조군 변화를 뺀 관측 차이 — 인과 확정 아님", "Observed difference net of the control — not causal proof")
    : tr("대조군 없는 전후 비교 — 계절·추세와 구분 불가", "Before/after without a control — mixed with seasonality and trend");

  let lines;
  let tone = "neutral";
  if (hold) {
    lines = [
      { kind: "main", chunks: [interval ? tr("판단 보류 — 구간이 0 포함", "Hold — the interval includes 0") : tr("판단 보류 — 구간 추정 불가", "Hold — interval not estimable"), prefix, ...valueChunks] },
      { kind: "effect", chunks: [ready ? tr("효과 없음이 아니라 판단 보류 — 계획한 기간까지 유지 후 재판정", "Not proof of no effect — keep to the planned window, then reassess") : exploratory] },
    ];
  } else if (!ready) {
    lines = [
      { kind: "main", chunks: [prefix, ...valueChunks] },
      { kind: "effect", chunks: [exploratory] },
    ];
  } else if (!lost && effect > 0) {
    tone = "good";
    lines = [
      { kind: "main", chunks: [tr("광고 시작과 연관된 증가:", "Increase associated with the launch:"), ...valueChunks, totalChunk] },
      { kind: "effect", chunks: [caveat] },
    ];
  } else if (lost && effect < 0) {
    tone = "good";
    lines = [
      { kind: "main", chunks: [tr("광고 종료와 연관된 손실:", "Loss associated with the shutdown:"), ...valueChunks, totalChunk] },
      { kind: "effect", chunks: [caveat] },
    ];
  } else {
    lines = [
      { kind: "main", chunks: [lost ? tr("광고 종료 뒤 오히려 증가:", "Higher after stopping ads:") : tr("광고 시작 뒤 감소:", "Lower after starting ads:"), ...valueChunks] },
      { kind: "effect", chunks: [lost ? tr("종료로 인한 손실은 확인되지 않음", "No shutdown loss found") : tr("시작으로 인한 증가는 확인되지 않음", "No launch-driven increase found")] },
    ];
  }

  const stats = [
    { label: isDiD ? tr("순효과 (DiD, 일평균)", "Net effect (DiD, daily)") : tr("일평균 변화", "Daily change"), value: signedValue(effect, 1), detail: interval || (hasSignificance ? null : tr("구간 추정 불가", "Interval not estimable")) },
    { label: tr("기간 합계", "Period total"), value: signedValue(total), detail: tr(`전 ${preN}일 · 후 ${postN}일`, `${preN} pre · ${postN} post days`) },
    { label: tr("설계 등급", "Design grade"), value: isDiD ? tr("DiD (대조군 보정)", "DiD (control-adjusted)") : tr("단순 전후", "Simple before/after"), detail: designDeclarationText(design, locale) },
  ];
  const issues = [designIssue(design, locale, false)];
  if (!isDiD) issues.push({ kind: tr("대조군 없음", "No control"), target: tr("전후 비교", "Before/after"), text: tr("계절성·추세·프로모션과 섞일 수 있습니다 — 대조군을 넣어 DiD로 보정", "May mix with seasonality, trend and promotions — add a control for DiD") });
  if (!hasSignificance) issues.push({ kind: tr("유의성", "Significance"), target: metric, text: tr("공통 날짜와 변동이 부족해 추정할 수 없습니다", "Too few common dates or too little variation to estimate") });
  return { lines, tone, stats, issues: issues.filter(Boolean), hold, ready };
}
