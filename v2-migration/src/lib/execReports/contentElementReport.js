// 9-1 콘텐츠 요소 — 임원 보고형 결론·수치·표(docs/product-ssot.md §5.5).
// 엔진(REG_STATS.ols + HC3 + BH) 출력만 묶는다. 계수는 성과의 원 단위다:
// 0/1 요소는 "있을 때 vs 없을 때", 숫자 요소는 "1 늘 때"의 성과 차이(다른 요소를 고정한 관측 연관).
// 정직성(§8): 관측 속성 회귀라 "연관"을 결론에 남기고, 보정 후 유의하지 않으면 보류형으로 말한다.

const tr = (locale, ko, en) => (locale === "en" ? en : ko);

/** 성과 원 단위 크기: 100 이상은 정수 + 천단위, 1 이상은 소수 1자리, 그 밑은 유효 3자리. */
export function fmtEffectSize(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 100) return Math.round(abs).toLocaleString("en-US");
  if (abs >= 1) return abs.toFixed(1);
  if (abs === 0) return "0";
  return Number(abs.toPrecision(3)).toString();
}

/** 부호 있는 크기. 표시 자리에서 0이면 부호를 붙이지 않는다. */
export function fmtSignedEffect(value) {
  const text = fmtEffectSize(value);
  if (text === "—" || Number(text.replace(/,/g, "")) === 0) return text;
  return `${value > 0 ? "+" : "−"}${text}`;
}

export function effectInterval(row) {
  return `${fmtSignedEffect(row.ciLo)} ~ ${fmtSignedEffect(row.ciHi)}`;
}

export function elementVerdict(row) {
  if (!row.sig) return "uncertain";
  return row.coef >= 0 ? "positive" : "negative";
}

export function nextExperimentText(row, locale) {
  if (!row.sig) return "—";
  return row.binary ? tr(locale, `${row.name} 유무 A/B`, `${row.name} on/off A/B`) : tr(locale, `${row.name} 수준 A/B`, `${row.name} level A/B`);
}

export function contentElementReport(fit, { locale = "ko" } = {}) {
  const rows = fit?.rows || [];
  const outcome = fit?.outcome || tr(locale, "성과", "outcome");
  const sigRows = rows.filter((row) => row.sig);
  const top = sigRows[0] || null; // 엔진 순서(|t| 큰 순)에서 첫 유의 요소 — 도구의 topSig와 같다.
  const closest = rows[0] || null;
  const subject = (row) => (row.binary
    ? tr(locale, `${row.name} 있는 콘텐츠의 ${outcome}`, `Content with ${row.name}: ${outcome}`)
    : tr(locale, `${row.name} 1 늘 때 ${outcome}`, `Each +1 ${row.name}: ${outcome}`));
  const direction = (row) => (row.coef >= 0 ? tr(locale, "높게", "higher") : tr(locale, "낮게", "lower"));

  let lines;
  let tone = "neutral";
  if (top) {
    tone = "good";
    lines = [
      { kind: "main", chunks: [subject(top), tr(locale, `평균 ${fmtEffectSize(top.coef)} ${direction(top)} 관측`, `${fmtEffectSize(top.coef)} ${direction(top)} on average`), `(95% ${effectInterval(top)})`] },
      { kind: "effect", chunks: [tr(locale, "→ 이 요소 하나만 바꾼 A/B로 확인 (연관)", "→ Confirm with an A/B that changes only this element (association)")] },
    ];
  } else {
    lines = [
      { kind: "main", chunks: [tr(locale, "판단 보류 —", "Withheld —"), tr(locale, `다중비교 보정 후 확정할 요소 없음 (${rows.length}개 검토)`, `no element holds up after multiple-comparison adjustment (${rows.length} checked)`)] },
      ...(closest ? [{ kind: "effect", chunks: [tr(locale, `가장 가까운 후보 ${closest.name}:`, `Closest candidate ${closest.name}:`), `${fmtSignedEffect(closest.coef)} (95% ${effectInterval(closest)})`] }] : []),
    ];
  }
  const text = lines.map((line) => line.chunks.join(" ")).join(" · ");

  const lead = top || closest;
  const stats = [
    { id: "significant", label: tr(locale, "유의 연관 요소", "Significant elements"), value: `${sigRows.length} / ${rows.length}`, detail: tr(locale, "다중비교 보정(BH) 후", "After BH adjustment") },
    { id: "size", label: top ? tr(locale, "최대 연관 크기", "Largest association") : tr(locale, "가장 가까운 후보", "Closest candidate"), value: lead ? fmtSignedEffect(lead.coef) : "—", detail: lead ? `${lead.name} · ${lead.binary ? tr(locale, "있음 vs 없음", "with vs without") : tr(locale, "1 증가당", "per +1")}${top ? "" : tr(locale, " · 보정 후 불확실", " · uncertain after adjustment")}` : undefined },
    { id: "rows", label: tr(locale, "분석 콘텐츠", "Contents analyzed"), value: tr(locale, `${(fit?.n || 0).toLocaleString()}편`, (fit?.n || 0).toLocaleString()), detail: fit?.excludedRows ? tr(locale, `입력 ${(fit.inputRows || 0).toLocaleString()}행 중 결측 ${fit.excludedRows.toLocaleString()}행 제외`, `${fit.excludedRows.toLocaleString()} of ${(fit.inputRows || 0).toLocaleString()} rows excluded for blanks`) : tr(locale, "제외 없음", "None excluded") },
  ];

  const issues = [
    fit?.sparse?.length ? { kind: tr(locale, "희소 요소", "Sparse elements"), target: fit.sparse.join(", "), text: tr(locale, "있음/없음 중 한쪽이 5편 미만 — 추정에서 제외", "Fewer than 5 contents in one state — excluded from estimation") } : null,
    fit?.dropped?.length ? { kind: tr(locale, "변화 없음", "No variation"), target: fit.dropped.join(", "), text: tr(locale, "모든 콘텐츠가 같은 값 — 추정 불가", "Same value for every content — not estimable") } : null,
    fit?.excludedRows ? { kind: tr(locale, "결측", "Missing values"), target: tr(locale, `${fit.excludedRows.toLocaleString()}행`, `${fit.excludedRows.toLocaleString()} rows`), text: tr(locale, "성과·요소 빈칸 — 빈칸을 ‘없음’으로 가정하지 않고 제외", "Blank outcome or element — excluded, not assumed absent") } : null,
  ].filter(Boolean);

  // 보정 후 유의한 요소가 없으면 결론이 아니라 보류다 — 보고서에 결론처럼 수집되지 않게 한다(ResultActionCard canCollectReport).
  return { tone, lines, text, stats, issues, top, resultState: top ? "ready" : "inconclusive" };
}
