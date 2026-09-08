/**
 * Weekly Review 유의미성 판정.
 *
 * 이 제품이 사용자에게 주는 값어치는 "더 많이 보여주기"가 아니라 **쓸데없는 걱정을 줄이기**다.
 * 그래서 단순 WoW 변화율로 경보를 울리지 않고 세 축을 함께 본다.
 *
 *   ① 크기      |Δ%| ≥ minPct        — 이하는 운영 노이즈
 *   ② 평소 변동  |z|   ≥ minZ          — 최근 주간값의 흩어짐 대비
 *   ③ 표본      volume ≥ minVolume   — 이하는 비율 지표가 튄다
 *
 * 셋 다 통과해야 "확인할 것"이고, 아니면 화면은 원인·행동 카드를 접는다.
 *
 * z는 표본 평균·표준편차로 계산한다. `ANOMALY_MATH`(5-2 이상 감지)는 일별 EMA에 요일 보정을
 * 얹은 엔진이라 여기엔 맞지 않는다 — 주간 집계에는 요일 효과가 없고(각 점이 같은 길이의 기간),
 * EMA 분산은 7점에서 안정되지 않는다. 더 중요한 이유는 **화면이 그리는 띠와 판정이 같은 값이어야
 * 한다**는 것이다. 결론 카드는 "평균 ±1σ 밖으로 나갔다"고 말하면서 판정은 다른 기준을 쓰면,
 * 사용자가 그림과 문장의 불일치를 먼저 발견한다.
 *
 * 임계값은 실데이터로 튜닝할 예정이라 config로 분리했다.
 * 결정론 — 같은 입력이면 언제나 같은 출력. 시계·난수를 쓰지 않는다.
 */

export const SIGNIFICANCE_CONFIG = Object.freeze({
  minPct: 0.05,          // 5%
  minZ: 1.5,
  minVolume: 30,         // 이번 기간 전환 건수
  lookbackWeeks: 8,      // z 계산에 쓰는 최근 주 수
  minBaselineWeeks: 3,   // 이 미만이면 평소 범위를 모른다고 말한다
});

/** 높을수록 좋은 지표인지, 낮을수록 좋은 지표인지. */
export const HIGHER_IS_BETTER = "higher_is_better";
export const LOWER_IS_BETTER = "lower_is_better";

/**
 * 숫자로 읽을 수 없으면 null. **`Number()`를 그대로 쓰면 안 된다** — `Number(null)`도
 * `Number("")`도 `Number(false)`도 0이라, 빈 값이 조용히 "0"으로 둔갑한다. 그러면 이력에
 * 0짜리 주가 섞여 평소 범위가 무너지고, 표본을 안 준 것이 "0건"이 되며, 값이 없는 지표가
 * 유효한 0으로 판정을 통과한다. 셋 다 실제로 테스트에 걸렸다.
 */
function toFiniteNumber(value) {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function finiteNumbers(values) {
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    const num = toFiniteNumber(value);
    if (num !== null) out.push(num);
  }
  return out;
}

/**
 * 최근 주간값에서 평소 변동 범위를 낸다.
 * 화면의 회색 띠(`lo`~`hi`)가 곧 이 값이다.
 *
 * `known:false`면 **"정상"이라고 말하면 안 된다** — 모른다고 말해야 한다.
 */
export function summarizeBaseline(history, config = SIGNIFICANCE_CONFIG) {
  const all = finiteNumbers(history);
  const weeks = all.slice(-config.lookbackWeeks);

  if (weeks.length < config.minBaselineWeeks) {
    return { known: false, reason: "too_few_weeks", weeks: weeks.length, mean: null, sd: null, lo: null, hi: null };
  }

  const mean = weeks.reduce((sum, v) => sum + v, 0) / weeks.length;
  const variance = weeks.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / (weeks.length - 1);
  const sd = Math.sqrt(variance);

  if (!(sd > 0)) {
    // 모든 주가 완전히 같은 값 — 실데이터에서는 거의 자리표시자다. 흩어짐이 0이면 어떤 변화든
    // z가 무한대가 되므로, 그것을 "매우 유의미"로 뒤집지 않고 모른다고 둔다.
    return { known: false, reason: "no_variation", weeks: weeks.length, mean, sd: 0, lo: mean, hi: mean };
  }

  return { known: true, reason: null, weeks: weeks.length, mean, sd, lo: mean - sd, hi: mean + sd };
}

function outcomeOf(delta, direction) {
  if (delta === 0) return "flat";
  const worse = direction === LOWER_IS_BETTER ? delta > 0 : delta < 0;
  return worse ? "worse" : "better";
}

/**
 * 이번 기간의 변화가 실제로 확인할 만한 것인지 판정한다.
 *
 * @param {number} current            이번 기간 값
 * @param {number} previous           지난 기간 값
 * @param {number[]} history          이번 기간을 **제외한** 최근 주간값(오래된 것 → 최신 순)
 * @param {number} volume             이번 기간의 표본(전환 건수)
 * @param {string} direction          LOWER_IS_BETTER | HIGHER_IS_BETTER
 * @param {number} volumeMultiplier   부분 주 소표본이면 2 (period.js가 준다)
 */
export function assessChange({
  current,
  previous,
  history = [],
  volume = null,
  direction = LOWER_IS_BETTER,
  volumeMultiplier = 1,
  config = SIGNIFICANCE_CONFIG,
} = {}) {
  const cur = toFiniteNumber(current);
  const prev = toFiniteNumber(previous);
  const baseline = summarizeBaseline(history, config);
  const volumeRequired = config.minVolume * (volumeMultiplier || 1);

  const base = {
    significant: false,
    baseline,
    baselineKnown: baseline.known,
    volumeRequired,
    delta: null,
    deltaPct: null,
    z: null,
    outcome: "unknown",
    checks: null,
  };

  if (cur === null || prev === null) {
    return { ...base, reason: "no_value" };
  }
  if (prev === 0) {
    // 0에서 출발한 변화율은 정의되지 않는다. 무한대를 화면에 띄우지 않는다.
    return { ...base, reason: "no_previous_value", delta: cur - prev, outcome: outcomeOf(cur - prev, direction) };
  }

  const delta = cur - prev;
  const deltaPct = delta / Math.abs(prev);
  const z = baseline.known ? (cur - baseline.mean) / baseline.sd : null;

  const size = { pass: Math.abs(deltaPct) >= config.minPct, value: deltaPct, threshold: config.minPct };
  const variability = baseline.known
    ? { pass: Math.abs(z) >= config.minZ, value: z, threshold: config.minZ, skipped: false }
    : { pass: false, value: null, threshold: config.minZ, skipped: true, reason: baseline.reason };
  const volumeValue = toFiniteNumber(volume);
  const volumeCheck = volumeValue !== null
    ? { pass: volumeValue >= volumeRequired, value: volumeValue, threshold: volumeRequired, skipped: false }
    : { pass: false, value: null, threshold: volumeRequired, skipped: true, reason: "no_volume" };

  const checks = { size, variability, volume: volumeCheck };
  const result = { ...base, delta, deltaPct, z, outcome: outcomeOf(delta, direction), checks };

  // 평소 변동 범위를 모를 때는 그 검사를 건너뛰고 크기·표본만 본다. 모르는 것을
  // "통과"로 세지 않으므로 판정은 `baselineKnown:false`와 함께 나가고, 화면은
  // "평소 범위를 아직 모릅니다"라고 말해야 한다.
  const gates = [size, volumeCheck];
  if (!variability.skipped) gates.splice(1, 0, variability);

  const failed = gates.find((gate) => !gate.pass);
  if (!failed) return { ...result, significant: true, reason: null };

  if (failed === size) return { ...result, reason: "change_too_small" };
  if (failed === volumeCheck) return { ...result, reason: volumeCheck.skipped ? "no_volume" : "volume_too_low" };
  return { ...result, reason: "within_normal_range" };
}
