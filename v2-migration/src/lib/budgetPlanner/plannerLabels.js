// 플래너 상태·판정·제약의 화면 이름(KO/EN). 화면·내보내기가 같은 이름을 쓰도록 한 곳에 둔다.
// 이름은 검출한 조건을 그대로 말한다 — 원인 판정은 "후보"이므로 단정하지 않는다(spec §6.4).

const L = (ko, en) => Object.freeze({ ko, en });

export const NODE_STATE_LABELS = Object.freeze({
  IN_RANGE: L("과거 범위 안", "Within history"),
  UNVERIFIED: L("범위 확인 불가(이력 부족)", "Unverified (short history)"),
  EXTRAPOLATING: L("써 본 적 없는 지출 수준", "Spend outside history"),
  DRIFT_WORSE: L("같은 지출에서 단가 악화", "Worse at the same spend"),
  DRIFT_BETTER: L("같은 지출에서 단가 개선", "Better at the same spend"),
  LEARNING_TRANSITION: L("신규 소재 학습 중", "New creative learning"),
  INSUFFICIENT: L("곡선 없음(데이터 부족)", "No curve (too little data)"),
});

export const VERDICT_LABELS = Object.freeze({
  BUDGET_CURVE: L("예산 변화(곡선 위 이동)", "Budget change (along the curve)"),
  MARKET: L("시장 공통 변화", "Market-wide shift"),
  CREATIVE: L("소재 변화", "Creative change"),
  FUNNEL_POST_CLICK: L("클릭 이후 전환 변화", "Post-click conversion change"),
  AUCTION_COST: L("노출 단가 상승(경매·입찰 경쟁 가능성)", "Higher impression cost (likely auction pressure)"),
  NEW_CREATIVE_LEARNING: L("신규 소재 학습", "New creative learning"),
  MIXED: L("원인 여럿", "Several causes"),
  INCONCLUSIVE: L("판정 보류", "Inconclusive"),
});

export const VERDICT_REASON_LABELS = Object.freeze({
  within_noise: L("변화가 평소 흔들림 안", "Change is within normal noise"),
  budget_and_creative_changed_together: L("예산과 소재가 같은 주에 함께 바뀜", "Budget and creatives changed in the same week"),
  no_dominant_cause: L("두드러진 원인 없음", "No dominant cause"),
  no_results_in_window: L("비교 기간에 결과 없음", "No results in a comparison week"),
  not_measured: L("측정 불가", "Not measured"),
});

export const BINDING_LABELS = Object.freeze({
  max_daily_increase: L("하루 증액 한도", "Daily increase limit"),
  max_daily_decrease: L("하루 감액 한도", "Daily decrease limit"),
  extrapolation: L("관측 최대 지출", "Observed spend ceiling"),
  curve_peak: L("곡선 꼭짓점", "Curve peak"),
  learning_freeze: L("신규 소재 학습 보호", "New creative learning protection"),
  learning_minimum: L("매체 학습 최소 결과", "Platform learning minimum"),
  creative_fatigue: L("소재 피로로 증액 제한", "Increase limited by creative fatigue"),
  low_confidence: L("적합 신뢰도 낮아 현재 유지", "Held (low fit confidence)"),
  locked: L("고정", "Locked"),
  held: L("현재 유지", "Held"),
  no_curve: L("곡선 없어 현재 유지", "Held (no curve)"),
  "state:EXTRAPOLATING": L("관측 밖 지출이라 증액 금지", "No increase (spend outside history)"),
  "state:INSUFFICIENT": L("데이터 부족으로 현재 유지", "Held (too little data)"),
  "state:LEARNING_TRANSITION": L("신규 소재 학습 보호", "New creative learning protection"),
});

export const CREATIVE_STATE_LABELS = Object.freeze({
  LEARNING: L("학습 중", "Learning"),
  RAMPING: L("노출 확대 중", "Ramping up"),
  STALLED: L("노출 정체(판정 불가)", "Stalled (not judged)"),
  WINNER: L("기존보다 좋음", "Better than incumbents"),
  PAR: L("기존과 비슷", "On par with incumbents"),
  LOSER: L("기존보다 나쁨", "Worse than incumbents"),
  NO_BASELINE: L("비교 대상 없음", "No incumbent to compare"),
  ENDED_UNJUDGED: L("판정 전 종료", "Ended before judgment"),
  UNKNOWN_AGE: L("기존 소재(시작일 미상)", "Existing (start unknown)"),
});

// 소재 표의 정렬 우선순위: 행동이 필요한 것부터.
export const CREATIVE_STATE_ORDER = Object.freeze(["LOSER", "LEARNING", "RAMPING", "STALLED", "WINNER", "PAR", "NO_BASELINE", "ENDED_UNJUDGED", "UNKNOWN_AGE"]);

export const PVM_COLUMN_LABELS = Object.freeze({
  betweenMix: L("대상 간 비중 이동", "Shift between targets"),
  withinMix: L("대상 안 소재 비중", "Creative mix within target"),
  entry: L("신규 진입", "New entries"),
  exit: L("제외", "Removed"),
  budget: L("예산 곡선", "Budget curve"),
  market: L("시장", "Market"),
  creative: L("그 밖(소재·퍼널·노출 단가)", "Other (creative, funnel, CPM)"),
});

/** 배분 제약 이름. 상태 규칙 제약(state:XXX)은 config가 어느 상태에나 걸 수 있으므로 상태 이름에서 만든다. */
export function bindingLabel(code, locale = "ko") {
  if (code == null) return null;
  if (BINDING_LABELS[code]) return locale === "en" ? BINDING_LABELS[code].en : BINDING_LABELS[code].ko;
  if (String(code).startsWith("state:")) {
    const state = plannerLabel(NODE_STATE_LABELS, code.slice(6), locale);
    return locale === "en" ? `State rule: ${state}` : `상태 규칙: ${state}`;
  }
  return String(code);
}

/** 사전에 없는 코드는 코드 그대로 보인다(조용히 지우지 않는다). */
export function plannerLabel(table, code, locale = "ko") {
  if (code == null) return null;
  const entry = table[code];
  if (!entry) return String(code);
  return locale === "en" ? entry.en : entry.ko;
}
