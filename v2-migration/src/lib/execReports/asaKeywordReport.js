// 5-26 ASA 키워드 — 임원 보고형 결론·수치·표(docs/product-ssot.md §5.5).
// 엔진(asaKeywordMath·asaRecommendationQuality)의 출력만 묶는다. 새 계산은 합계·개수뿐이다.
// 도구 화면과 결과 작업대가 같은 함수를 써서 결론이 갈리지 않게 한다(§7 메타 4).
import { fmtCurrencyCompact } from "@/utils/format";

const tr = (locale, ko, en) => (locale === "en" ? en : ko);

export const ASA_ACTION_CODES = Object.freeze(["raise", "lower"]);

/** 조치가 있는 행인가: CPT 증감 또는 Exact 승격. 보류·유지·입력 필요는 조치가 아니다. */
export function isAsaActionRow(row) {
  return ASA_ACTION_CODES.includes(row?.action?.code) || row?.isExactCandidate === true;
}

/** 조치 행을 먼저(소진액 큰 순), 나머지는 엔진 순서(소진액 큰 순) 그대로. */
export function sortAsaRows(rows = []) {
  const indexed = rows.map((row, index) => ({ row, index }));
  return indexed.sort((left, right) => {
    const a = isAsaActionRow(left.row) ? 0 : 1;
    const b = isAsaActionRow(right.row) ? 0 : 1;
    return a - b || left.index - right.index;
  }).map(({ row }) => row);
}

/** 보류 사유 중 가장 많은 것(보류형 결론의 이유). */
function dominantHoldReason(rows) {
  const counts = new Map();
  rows.forEach((row) => counts.set(row.qualityStatus, (counts.get(row.qualityStatus) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

export function asaHoldReasonText(status, locale) {
  return {
    maturity_unknown: tr(locale, "전환 성숙도 미확인", "Conversion maturity unknown"),
    immature: tr(locale, "아직 전환이 들어오는 날 포함", "Includes days still receiving conversions"),
    low_taps: tr(locale, "탭 8건 미만", "Fewer than 8 taps"),
    low_installs: tr(locale, "설치 3건 미만", "Fewer than 3 installs"),
  }[status] || tr(locale, "근거 부족", "Insufficient evidence");
}

/** 사유 열: 조치가 무엇을 근거로 했는지 짧은 명사구. 엔진 규칙(소진률·목표 달성)을 그대로 말한다. */
export function asaReasonText(row, locale) {
  const pace = Number.isFinite(row.pace) ? `${Math.round(row.pace * 100)}%` : null;
  const parts = [];
  if (row.action?.code === "raise") parts.push(tr(locale, `목표 달성 · 예산 소진 ${pace}`, `Meets target · ${pace} paced`));
  else if (row.action?.code === "lower") parts.push(tr(locale, `목표 미달 · 예산 소진 ${pace}`, `Misses target · ${pace} paced`));
  if (row.isExactCandidate) {
    const match = row.matchType === "discovery" ? "Search Match" : "Broad";
    parts.push(tr(locale, `${match}에서 설치 ${row.installs}건`, `${row.installs} installs from ${match}`));
  }
  return parts.join(" · ") || "—";
}

/**
 * 결론·수치·표·확인할 점. recommendations는 qualifyAsaRecommendations를 거친 행(작업대는 거치지 않은 행).
 * 결론 숫자는 전부 행 개수와 소진액 합계다 — 조치 뒤의 예상 CPA·소진 변화는 엔진이 계산하지 않으므로 말하지 않는다(§8).
 */
export function asaKeywordReport(recommendations = [], { locale = "ko", currency = "KRW" } = {}) {
  const money = (value) => fmtCurrencyCompact(value, { currency, locale });
  const total = recommendations.length;
  const reviewable = recommendations.filter((row) => row.qualityStatus == null || row.qualityStatus === "reviewable");
  const held = recommendations.filter((row) => row.qualityStatus != null && row.qualityStatus !== "reviewable");
  const raises = recommendations.filter((row) => row.action?.code === "raise");
  const lowers = recommendations.filter((row) => row.action?.code === "lower");
  const exact = recommendations.filter((row) => row.isExactCandidate);
  const negatives = recommendations.filter((row) => row.isNegativeCandidate);
  const needsTarget = reviewable.filter((row) => row.action?.code === "target_needed");
  const needsBudget = reviewable.filter((row) => row.action?.code === "budget_needed");
  const actionRows = sortAsaRows(recommendations).filter(isAsaActionRow);
  const totalSpend = recommendations.reduce((sum, row) => sum + (Number(row.cost) || 0), 0);
  const actionSpend = actionRows.reduce((sum, row) => sum + (Number(row.cost) || 0), 0);
  const cptCount = raises.length + lowers.length;
  const spendShare = totalSpend > 0 ? actionSpend / totalSpend : null;

  let lines;
  let tone = "neutral";
  let resultState = "ready";
  if (!total) {
    resultState = "insufficient";
    lines = [{ kind: "main", chunks: [tr(locale, "판단 보류 —", "Withheld —"), tr(locale, "검색어가 있는 행 없음", "no rows with a search term")] }];
  } else if (!reviewable.length) {
    resultState = "insufficient";
    lines = [{ kind: "main", chunks: [tr(locale, "판단 보류 —", "Withheld —"), asaHoldReasonText(dominantHoldReason(held), locale), tr(locale, `· 검색어 ${total}개 조치 보류`, `· ${total} search terms held`)] }];
  } else if (!actionRows.length && needsTarget.length + needsBudget.length === reviewable.length) {
    resultState = "insufficient";
    lines = [{ kind: "main", chunks: [tr(locale, "판단 보류 —", "Withheld —"), needsTarget.length >= needsBudget.length
      ? tr(locale, "목표 CPA·CPT 없음", "no target CPA or CPT")
      : tr(locale, "캠페인 예산 없음", "no campaign budget"), tr(locale, `· 검색어 ${reviewable.length}개 입찰 판단 불가`, `· ${reviewable.length} terms cannot be judged`)] }];
  } else if (!actionRows.length) {
    lines = [{ kind: "main", chunks: [tr(locale, `판정한 검색어 ${reviewable.length}개`, `${reviewable.length} judged search terms`), tr(locale, "모두 유지", "all hold")] },
      { kind: "effect", chunks: [tr(locale, "CPT 조정·Exact 승격 대상 없음", "No CPT change or Exact promotion")] }];
  } else {
    tone = "good";
    const main = cptCount
      ? [tr(locale, `검색어 ${cptCount}개 CPT 조정`, `Adjust CPT on ${cptCount} search terms`), tr(locale, `(증액 ${raises.length} · 감액 ${lowers.length})`, `(raise ${raises.length} · lower ${lowers.length})`)]
      : [tr(locale, `Exact 승격 후보 ${exact.length}개`, `${exact.length} Exact-promotion candidates`)];
    const effect = [
      ...(cptCount && exact.length ? [tr(locale, `Exact 승격 ${exact.length}개 ·`, `Exact promotion ${exact.length} ·`)] : []),
      ...(!cptCount ? [tr(locale, "CPT 조정 대상 없음 ·", "No CPT change ·")] : []),
      tr(locale, `조치 대상 소진액 ${money(actionSpend)}`, `spend on these terms ${money(actionSpend)}`),
    ];
    lines = [{ kind: "main", chunks: main }, { kind: "effect", chunks: effect }];
  }
  const text = lines.map((line) => line.chunks.join(" ")).join(" · ");

  const stats = !total ? [] : !reviewable.length || resultState === "insufficient"
    ? [
      { id: "held", label: tr(locale, "보류", "Held"), value: tr(locale, `${held.length + needsTarget.length + needsBudget.length}건`, String(held.length + needsTarget.length + needsBudget.length)), detail: held.length ? asaHoldReasonText(dominantHoldReason(held), locale) : tr(locale, "목표·예산 입력 필요", "Targets or budget needed") },
      { id: "terms", label: tr(locale, "검색어", "Search terms"), value: tr(locale, `${total}개`, String(total)), detail: tr(locale, "검색어·캠페인·광고그룹·매치 단위", "Term × campaign × ad group × match") },
      { id: "spend", label: tr(locale, "전체 소진액", "Total spend"), value: money(totalSpend), detail: tr(locale, "업로드한 기간 합계", "Sum over the uploaded period") },
    ]
    : [
      { id: "action-spend", label: tr(locale, "조치 대상 소진액", "Spend on action terms"), value: money(actionSpend), detail: spendShare == null ? undefined : tr(locale, `전체 ${money(totalSpend)}의 ${Math.round(spendShare * 100)}%`, `${Math.round(spendShare * 100)}% of ${money(totalSpend)}`) },
      { id: "actions", label: tr(locale, "즉시 조치", "Act now"), value: tr(locale, `${actionRows.length}건`, String(actionRows.length)), detail: tr(locale, `CPT ${cptCount} · 승격 ${exact.length}`, `CPT ${cptCount} · Exact ${exact.length}`) },
      { id: "held", label: tr(locale, "보류", "Held"), value: tr(locale, `${held.length + needsTarget.length + needsBudget.length}건`, String(held.length + needsTarget.length + needsBudget.length)), detail: held.length ? asaHoldReasonText(dominantHoldReason(held), locale) : (needsTarget.length + needsBudget.length ? tr(locale, "목표·예산 입력 필요", "Targets or budget needed") : tr(locale, "근거 부족 없음", "None for evidence")) },
    ];

  const negativeSpend = negatives.reduce((sum, row) => sum + (Number(row.cost) || 0), 0);
  const issues = [
    negatives.length ? { kind: tr(locale, "제외 후보", "Negative candidates"), target: tr(locale, `검색어 ${negatives.length}개`, `${negatives.length} terms`), text: tr(locale, `설치 0건이거나 CPA가 목표의 1.5배 초과 · 소진 ${money(negativeSpend)} — 제외 키워드 등록 검토`, `No installs or CPA above 1.5× target · ${money(negativeSpend)} spent — review as negatives`) } : null,
    reviewable.length && held.length ? { kind: tr(locale, "근거 부족", "Thin evidence"), target: tr(locale, `검색어 ${held.length}개`, `${held.length} terms`), text: tr(locale, `${asaHoldReasonText(dominantHoldReason(held), locale)} — 조치 보류`, `${asaHoldReasonText(dominantHoldReason(held), locale)} — actions held`) } : null,
    reviewable.length && (needsTarget.length || needsBudget.length) && actionRows.length ? { kind: tr(locale, "입력 필요", "Input needed"), target: tr(locale, `검색어 ${needsTarget.length + needsBudget.length}개`, `${needsTarget.length + needsBudget.length} terms`), text: tr(locale, "목표 CPA·CPT 또는 캠페인 예산이 없어 CPT 방향 미판정", "No target CPA/CPT or campaign budget, so no CPT direction") } : null,
  ].filter(Boolean);

  return { tone, lines, text, stats, issues, resultState, actionRows, counts: { total, reviewable: reviewable.length, held: held.length, raises: raises.length, lowers: lowers.length, exact: exact.length, negatives: negatives.length }, totals: { totalSpend, actionSpend, spendShare } };
}
