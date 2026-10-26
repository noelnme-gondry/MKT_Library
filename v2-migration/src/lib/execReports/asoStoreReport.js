// 5-27 ASO 스토어 전환 — 임원 보고형 결론·수치·표(docs/product-ssot.md §5.5).
//
// 엔진(asoStoreMath → PVM_MATH)은 "설치 1건당 조회 수"(C = 1/전환율)의 변화를 구성(mix)·효율(rate)로
// 무잔차 분해한다. 화면은 전환율로 말해야 하므로 같은 분해를 전환율 %p로 옮긴다:
//   전환율 변화 = 1/C₂ − 1/C₁ = −(C₂ − C₁)/(C₁·C₂) = Σ −(mixᵢ + rateᵢ)/(C₁·C₂)
// 모든 항에 같은 상수 −1/(C₁·C₂)를 곱하는 선형 변환이라 합(= 전체 %p 변화)과 구성:효율 비율은
// 엔진 분해 그대로다. 새 분해를 만들지 않는다 — 단위만 바꾼다(엔진 수학 불변).
import { fmtPct, fmtNum } from "@/utils/format";

const tr = (locale, ko, en) => (locale === "en" ? en : ko);

/** 비율 차이(0~1) → "−2.40%p". 표시 자리에서 0이면 부호를 붙이지 않는다(§12.3 "−0.0%p" 금지). */
export function fmtPp(value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "—";
  const text = Math.abs(value * 100).toFixed(digits);
  if (Number(text) === 0) return `${(0).toFixed(digits)}%p`;
  return `${value > 0 ? "+" : "−"}${text}%p`;
}

/** 소스별 구성·효율 기여를 전환율(비율) 단위로. 합은 전체 전환율 변화와 같다. */
export function storeContributions(decomposed) {
  if (!decomposed || !(decomposed.CPA1 > 0) || !(decomposed.CPA2 > 0)) return null;
  const scale = -1 / (decomposed.CPA1 * decomposed.CPA2);
  const rows = (decomposed.entities || []).map((entity) => ({
    source: entity.key,
    shareBefore: entity.s1,
    shareAfter: entity.s2,
    cvrBefore: entity.cost1 > 0 ? entity.result1 / entity.cost1 : null,
    cvrAfter: entity.cost2 > 0 ? entity.result2 / entity.cost2 : null,
    mix: (entity.mix || 0) * scale,
    rate: (entity.rate || 0) * scale,
    mixViewsPerInstall: entity.mix,
    rateViewsPerInstall: entity.rate,
  }));
  const mix = rows.reduce((sum, row) => sum + row.mix, 0);
  const rate = rows.reduce((sum, row) => sum + row.rate, 0);
  return {
    rows: rows.sort((a, b) => (Math.abs(b.mix) + Math.abs(b.rate)) - (Math.abs(a.mix) + Math.abs(a.rate)) || String(a.source).localeCompare(String(b.source))),
    mix,
    rate,
    total: mix + rate,
  };
}

/**
 * result: AsoStoreConversion의 analyze() 결과({ overall, split, periods, decomposed, verdict }).
 * 판정(verdict.verdict)은 엔진 classifyStoreShift 그대로 쓰고, 문장의 방향·몫만 기여 값에서 파생한다.
 */
export function asoStoreReport(result, { locale = "ko" } = {}) {
  const pct = (value) => (value == null ? "—" : fmtPct(value, 2));
  const decomposed = result?.decomposed || null;
  const verdict = result?.verdict?.verdict || "unknown";
  const contributions = storeContributions(decomposed);
  if (!decomposed || !contributions) {
    const reason = !result?.split
      ? tr(locale, "서로 다른 날짜 4일 미만", "fewer than four distinct dates")
      : tr(locale, "앞·뒤 기간 중 한쪽에 설치 없음", "no installs in one of the two periods");
    const lines = [{ kind: "main", chunks: [tr(locale, "판단 보류 —", "Withheld —"), reason] }];
    return {
      tone: "neutral", lines, text: lines[0].chunks.join(" "), resultState: "blocked", contributions: null,
      stats: [{ id: "overall", label: tr(locale, "전체 조회→설치", "Overall view-to-install"), value: pct(result?.overall?.viewToInstall), detail: tr(locale, "분해 전 전체 기간", "Whole period, not decomposed") }],
      issues: [],
    };
  }

  const before = decomposed.funnelBefore.viewToInstall;
  const after = decomposed.funnelAfter.viewToInstall;
  const total = after - before;
  const { mix, rate } = contributions;
  const sameSign = (value) => value === 0 || Math.sign(value) === Math.sign(total);
  const direction = total < 0 ? tr(locale, "하락분", "the drop") : tr(locale, "상승분", "the rise");
  const mixShare = result.verdict?.mixShare;
  const topMix = [...contributions.rows].sort((a, b) => Math.abs(b.mix) - Math.abs(a.mix))[0];
  const arrow = topMix && topMix.shareAfter > topMix.shareBefore ? "↑" : "↓";
  const parts = tr(locale, `구성 ${fmtPp(mix)} · 효율 ${fmtPp(rate)}`, `mix ${fmtPp(mix)} · efficiency ${fmtPp(rate)}`);

  let effect;
  if (verdict === "flat" || total === 0) {
    effect = [tr(locale, "구성·효율 변화의 합 0", "Mix and efficiency sum to zero"), `(${parts})`];
  } else if (verdict === "mix" && sameSign(mix) && sameSign(rate)) {
    effect = [
      tr(locale, `${direction}의 ${Math.round(mixShare * 100)}%는 유입 구성 변화`, `${Math.round(mixShare * 100)}% of ${direction} came from traffic mix`),
      tr(locale, `(${topMix.source} 설치 비중 ${arrow})`, `(${topMix.source} install share ${arrow})`),
      tr(locale, "— 페이지 원인은 판단 보류", "— page cause not established"),
    ];
  } else if (verdict === "efficiency" && sameSign(mix) && sameSign(rate)) {
    effect = [
      tr(locale, `${direction}의 ${Math.round((1 - mixShare) * 100)}%는 소스 안 전환율 변화`, `${Math.round((1 - mixShare) * 100)}% of ${direction} came from within-source conversion`),
      tr(locale, "— 페이지·유입 의도·측정 변경 확인", "— check the page, traffic intent, and measurement"),
    ];
  } else if (verdict === "mix") {
    // 두 항의 방향이 반대면 "하락분의 X%"는 성립하지 않는다 — 각 항의 크기와 방향을 그대로 말한다.
    effect = [
      tr(locale, `유입 구성 변화 ${fmtPp(mix)}가 주도`, `Traffic mix ${fmtPp(mix)} drove it`),
      tr(locale, `(소스 안 전환율 ${fmtPp(rate)}이 일부 상쇄)`, `(within-source rate ${fmtPp(rate)} partly offset)`),
      tr(locale, "— 페이지 원인은 판단 보류", "— page cause not established"),
    ];
  } else if (verdict === "efficiency") {
    effect = [
      tr(locale, `소스 안 전환율 변화 ${fmtPp(rate)}가 주도`, `Within-source rate ${fmtPp(rate)} drove it`),
      tr(locale, `(유입 구성 ${fmtPp(mix)}이 일부 상쇄)`, `(traffic mix ${fmtPp(mix)} partly offset)`),
    ];
  } else {
    effect = [tr(locale, "구성과 효율이 함께 움직임", "Mix and efficiency moved together"), `(${parts})`];
  }
  const lines = [
    { kind: "main", chunks: [tr(locale, "설치 전환율", "View-to-install rate"), `${pct(before)} → ${pct(after)}`, `(${fmtPp(total)})`] },
    { kind: "effect", chunks: effect },
  ];
  const text = `${lines[0].chunks.join(" ")} · ${effect.join(" ")}`;

  const installDiff = decomposed.funnelAfter.installs - decomposed.funnelBefore.installs;
  const viewsChange = decomposed.funnelBefore.views > 0 ? (decomposed.funnelAfter.views - decomposed.funnelBefore.views) / decomposed.funnelBefore.views : null;
  const signedCount = (value) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${fmtNum(Math.abs(value))}`;
  const driverLabel = verdict === "mix" ? tr(locale, "유입 구성", "Traffic mix")
    : verdict === "efficiency" ? tr(locale, "소스 안 전환율", "Within-source rate")
      : verdict === "mixed" ? tr(locale, "구성 + 효율", "Mix + efficiency") : tr(locale, "변화 없음", "No change");
  const stats = [
    { id: "conversion", label: tr(locale, "설치 전환율", "View-to-install"), value: `${pct(before)} → ${pct(after)}`, detail: fmtPp(total) },
    { id: "installs", label: tr(locale, "설치 변화", "Install change"), value: tr(locale, `${signedCount(installDiff)}건`, signedCount(installDiff)), detail: viewsChange == null ? undefined : tr(locale, `조회는 ${viewsChange > 0 ? "+" : viewsChange < 0 ? "−" : ""}${Math.abs(viewsChange * 100).toFixed(1)}%`, `Views ${viewsChange > 0 ? "+" : viewsChange < 0 ? "−" : ""}${Math.abs(viewsChange * 100).toFixed(1)}%`) },
    { id: "driver", label: tr(locale, "주된 요인", "Main driver"), value: driverLabel, detail: parts },
  ];

  const balance = result.periods?.balance;
  const issues = [
    balance && !balance.balanced ? { kind: tr(locale, "기간 길이", "Period length"), target: tr(locale, "앞·뒤 기간", "Both periods"), text: tr(locale, `데이터가 있는 날이 앞 ${balance.beforeDays}일 · 뒤 ${balance.afterDays}일 — 설치 합계 비교에 주의`, `${balance.beforeDays} vs ${balance.afterDays} days with data — compare install totals with care`) } : null,
    result.eventCount > 0 ? { kind: tr(locale, "이벤트", "Events"), target: tr(locale, `기록 ${result.eventCount}건`, `${result.eventCount} logged`), text: tr(locale, "관측 기간 안 스토어·광고 변경 — 분해만으로 원인 분리 불가", "Store or media changes in the window — the decomposition alone cannot separate causes") } : null,
  ].filter(Boolean);

  return { tone: total < 0 ? "bad" : total > 0 ? "good" : "neutral", lines, text, stats, issues, resultState: "ready", contributions };
}
