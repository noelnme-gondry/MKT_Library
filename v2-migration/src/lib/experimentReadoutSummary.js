// 5-4 A/B 판독의 보고서 층(결론 줄 · 핵심 수치 · 실험군 표 · 확인할 점).
// 엔진(STATS)이 낸 값만 묶는다 — 새 통계는 만들지 않는다(§8).
// 판정은 "검정 p < 0.05"와 "95% 구간이 0을 벗어남"이 같은 말을 할 때만 내린다.
// 둘이 엇갈리면(경계) 판단 보류 — 입증 책임은 효과가 있다는 쪽에 있다(§8.6).
import { STATS } from "@/utils/abTestMath";

const MINUS = "−";

/** 비율(0~1) 차이 → "+0.70" (%p 단위 숫자, 기호 포함). */
export function ppNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "—";
  const scaled = value * 100;
  if (Math.abs(scaled) < 0.5 * 10 ** -digits) return (0).toFixed(digits);
  return `${scaled > 0 ? "+" : MINUS}${Math.abs(scaled).toFixed(digits)}`;
}

export const pp = (value, digits = 2) => (Number.isFinite(value) ? `${ppNumber(value, digits)}%p` : "—");
const pct = (value, digits = 2) => (Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : "—");
const signedPct = (value, digits = 1) => {
  if (!Number.isFinite(value)) return "—";
  const scaled = value * 100;
  if (Math.abs(scaled) < 0.5 * 10 ** -digits) return `${(0).toFixed(digits)}%`;
  return `${scaled > 0 ? "+" : MINUS}${Math.abs(scaled).toFixed(digits)}%`;
};
export const ppInterval = (low, high) => `95% ${ppNumber(low)} ~ ${ppNumber(high)}%p`;

function armVerdict(arm, srmMismatch) {
  if (arm.isControl) return "control";
  if (srmMismatch) return "hold";
  const significant = Number.isFinite(arm.pValue) && arm.pValue < 0.05;
  if (significant && arm.ciLow95 > 0) return "adopt";
  if (significant && arm.ciHigh95 < 0) return "stop";
  return "hold";
}

/**
 * readoutData: AbTestHoldout의 CSV 집계({cNum,cDen,tNum,tDen,cRate,tRate,sig,mass}).
 * srm: experimentQuality.sampleRatioMismatch 결과. plannedShare: 계획 Control 비율(%) 문자열/숫자.
 */
export function summarizeAbReadout({ readoutData, srm, plannedShare, locale = "ko" }) {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  if (!readoutData?.sig) return null;
  const srmMismatch = srm?.status === "mismatch";
  const isMulti = Boolean(readoutData.mass?.control && readoutData.mass.rows.filter((row) => !row.isControl).length > 1);

  let arms;
  if (readoutData.mass?.control && readoutData.mass.rows.length >= 2) {
    const controlRate = readoutData.mass.control.n > 0 ? readoutData.mass.control.x / readoutData.mass.control.n : 0;
    arms = readoutData.mass.rows.map((row) => ({
      name: row.name, n: row.n, x: row.x, rate: row.rate, isControl: row.isControl,
      diff: row.isControl ? null : row.rate - controlRate,
      liftRel: row.isControl ? null : row.liftRel,
      ciLow95: row.isControl ? null : row.ciLow95,
      ciHigh95: row.isControl ? null : row.ciHigh95,
      pValue: row.isControl ? null : row.pValue,
      z: row.isControl ? null : row.z,
      testMethod: row.testMethod, approxUnreliable: row.approxUnreliable,
    }));
  } else {
    // arm_id가 없는 두 집단: z 근사를 못 믿는 구간이면 판정을 정확검정으로 옮긴다(수동 판독·arm별 표와 같은 규칙).
    const { cDen, cNum, tDen, tNum, sig } = readoutData;
    const preferExact = STATS.shouldPreferExactTest(cDen, cNum, tDen, tNum);
    const exact = preferExact ? STATS.fisherExact2x2(cDen, cNum, tDen, tNum) : null;
    arms = [
      { name: "Control", n: cDen, x: cNum, rate: sig.pA, isControl: true },
      {
        name: "Test", n: tDen, x: tNum, rate: sig.pB, isControl: false,
        diff: sig.liftAbs, liftRel: sig.liftRel, ciLow95: sig.ciLow95, ciHigh95: sig.ciHigh95,
        pValue: exact ? exact.pValue : sig.pValue, z: sig.z,
        testMethod: exact ? "fisher" : "normal", approxUnreliable: preferExact && !exact,
      },
    ];
  }
  arms = arms.map((arm) => ({ ...arm, verdict: armVerdict(arm, srmMismatch) }));
  const control = arms.find((arm) => arm.isControl);
  const variants = arms.filter((arm) => !arm.isControl);
  if (!control || !variants.length) return null;
  const byDiff = [...variants].sort((a, b) => (b.diff ?? -Infinity) - (a.diff ?? -Infinity));
  const adopters = byDiff.filter((arm) => arm.verdict === "adopt");
  const lead = adopters[0] || (variants.length === 1 ? variants[0] : byDiff[0]);
  const srmOk = srm?.status === "no_alarm";

  // 보류(두 집단)일 때만: 관측 차이가 실제라면 그룹당 몇 명이 더 필요한가 — 설계 탭과 같은 엔진(검정력 80%·α 0.05).
  let neededMore = null;
  if (!srmMismatch && !isMulti && lead.verdict === "hold" && Number.isFinite(lead.liftRel) && lead.liftRel !== 0 && control.rate > 0 && control.rate < 1) {
    const required = STATS.sampleSizePerArm({ baseline: control.rate, mdeRelative: Math.abs(lead.liftRel) }).n;
    const more = Number.isFinite(required) ? required - Math.min(control.n, lead.n) : NaN;
    if (Number.isFinite(more) && more > 0) neededMore = more >= 1000 ? Math.ceil(more / 100) * 100 : Math.ceil(more);
  }

  const effectChunks = [
    tr(`전환율 ${pp(lead.diff)}`, `Conversion ${pp(lead.diff)}`),
    `(${ppInterval(lead.ciLow95, lead.ciHigh95)})`,
    ...(Number.isFinite(lead.liftRel) ? [tr(`· 상대 ${signedPct(lead.liftRel)}`, `· relative ${signedPct(lead.liftRel)}`)] : []),
    ...(isMulti ? [tr("· Holm 보정 판정", "· Holm-adjusted verdict")] : []),
  ];

  let lines;
  let tone = "neutral";
  if (srmMismatch) {
    const total = control.n + variants.reduce((sum, arm) => sum + arm.n, 0);
    const observedA = total > 0 ? Math.round((control.n / total) * 100) : null;
    const plannedA = Math.round(Number(String(plannedShare ?? "").replace(/,/g, "")));
    lines = [
      { kind: "main", chunks: [tr(`판단 보류 — 배정 ${observedA}:${100 - observedA}`, `Hold — allocation ${observedA}:${100 - observedA}`), Number.isFinite(plannedA) ? tr(`(계획 ${plannedA}:${100 - plannedA}, SRM p<0.001)`, `(planned ${plannedA}:${100 - plannedA}, SRM p<0.001)`) : "(SRM p<0.001)"] },
      { kind: "effect", chunks: [tr("배정 로직을 확인하기 전에는 효과를 판단하지 않습니다", "Treatment effects are not judged until assignment is checked")] },
    ];
  } else if (lead.verdict === "adopt") {
    tone = "good";
    lines = [
      { kind: "main", chunks: srmOk ? [tr(`${lead.name} 채택 권고`, `Adopt ${lead.name}`)] : [tr(`${lead.name} 개선 후보`, `${lead.name} improvement candidate`), tr("— 배정 비율 확인 후 채택", "— confirm allocation before adopting")] },
      { kind: "effect", chunks: effectChunks },
    ];
  } else if (lead.verdict === "stop" && !isMulti) {
    tone = "bad";
    lines = [
      { kind: "main", chunks: srmOk ? [tr(`${lead.name} 중단 권고`, `Stop ${lead.name}`)] : [tr(`${lead.name} 악화 후보`, `${lead.name} decline candidate`), tr("— 배정 비율 확인 후 중단", "— confirm allocation before stopping")] },
      { kind: "effect", chunks: effectChunks },
    ];
  } else if (isMulti) {
    lines = [
      { kind: "main", chunks: [tr(`판단 보류 — 변형 ${variants.length}개 중 유의한 개선 없음`, `Hold — no significant improvement among ${variants.length} variants`), tr("(Holm 보정)", "(Holm-adjusted)")] },
      { kind: "effect", chunks: [tr(`최대 차이 ${lead.name} ${pp(lead.diff)}`, `Largest difference ${lead.name} ${pp(lead.diff)}`), `(${ppInterval(lead.ciLow95, lead.ciHigh95)})`] },
    ];
  } else {
    const significantP = Number.isFinite(lead.pValue) && lead.pValue < 0.05;
    lines = [
      { kind: "main", chunks: [tr(`판단 보류 — 차이 ${pp(lead.diff)}`, `Hold — difference ${pp(lead.diff)}`), `(${ppInterval(lead.ciLow95, lead.ciHigh95)})`] },
      { kind: "effect", chunks: [neededMore
        ? tr(`관측 차이 기준 그룹당 약 ${neededMore.toLocaleString("ko-KR")}명 더 필요`, `About ${neededMore.toLocaleString("en-US")} more per arm needed for the observed difference`)
        : significantP
          ? tr("검정과 95% 구간이 경계에서 엇갈림 — 효과를 단정하지 않음", "The test and the 95% interval disagree at the boundary — no effect claimed")
          : tr("구간이 0 포함 — 효과 없음이 아니라 판단 보류", "The interval includes 0 — inconclusive, not proof of no effect")] },
    ];
  }

  const total = arms.reduce((sum, arm) => sum + arm.n, 0);
  const srmLabel = {
    no_alarm: tr("통과", "Passed"), mismatch: tr("이상", "Mismatch"), unconfirmed: tr("미확인", "Not checked"),
    invalid: tr("입력 확인", "Check inputs"), insufficient: tr("표본 부족", "Too few"),
  }[srm?.status] || tr("미확인", "Not checked");
  const stats = [
    { label: tr(`차이 (${lead.name} − 대조)`, `Difference (${lead.name} − control)`), value: pp(lead.diff), detail: ppInterval(lead.ciLow95, lead.ciHigh95) },
    {
      label: tr("상대 리프트", "Relative lift"),
      value: Number.isFinite(lead.liftRel) ? signedPct(lead.liftRel) : "—",
      detail: Number.isFinite(lead.liftRel) ? `${pct(control.rate)} → ${pct(lead.rate)}` : tr("대조군 전환 0 — 상대값 정의 불가", "Control has no conversions — relative lift undefined"),
    },
    {
      label: tr("배정 비율 (SRM)", "Allocation (SRM)"),
      value: srmLabel,
      detail: isMulti
        ? tr(`실험군 ${arms.length}개 · 총 ${total.toLocaleString("ko-KR")}명`, `${arms.length} arms · ${total.toLocaleString("en-US")} total`)
        : tr(`대조 ${control.n.toLocaleString("ko-KR")} · ${lead.name} ${lead.n.toLocaleString("ko-KR")}`, `Control ${control.n.toLocaleString("en-US")} · ${lead.name} ${lead.n.toLocaleString("en-US")}`),
    },
  ];

  const issues = [];
  if (!isMulti && srm?.status === "unconfirmed") issues.push({ kind: tr("배정 확인", "Allocation"), target: tr("계획 배정 비율", "Planned split"), text: tr("계획 비율을 입력하면 SRM을 점검합니다 — 조건 바꾸기", "Enter the planned split to run the SRM check — Change settings") });
  if (isMulti) issues.push({ kind: tr("다중 비교", "Multiple tests"), target: tr(`변형 ${variants.length}개`, `${variants.length} variants`), text: tr("판정은 Holm 보정 p, 95% 구간은 비교별(보정 전) 구간입니다", "Verdicts use Holm-adjusted p; 95% intervals are per comparison (unadjusted)") });
  for (const arm of variants) {
    if (arm.testMethod === "fisher") issues.push({ kind: tr("정확검정", "Exact test"), target: arm.name, text: tr("전환이 적어 Fisher 정확검정으로 판정했습니다", "Few conversions — the verdict uses Fisher's exact test") });
    else if (arm.approxUnreliable) issues.push({ kind: tr("근사 주의", "Approximation"), target: arm.name, text: tr("전환이 적지만 정수가 아니라 정확검정을 쓸 수 없습니다 — p가 낙관적일 수 있음", "Few conversions but non-integer counts rule out the exact test — p may be optimistic") });
  }

  return { arms, control, variants, lead, isMulti, lines, tone, stats, issues, neededMore, srmOk };
}
