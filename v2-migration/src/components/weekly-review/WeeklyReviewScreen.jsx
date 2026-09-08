"use client";

/**
 * Weekly Review — 주간 성과를 읽고 이번 주 행동 하나를 정하는 화면.
 *
 * 순수 모듈 7개(period · significance · snapshot · router · varianceBridge · decisionScore ·
 * reportDraft)를 순서대로 부르고 결과를 그린다. **여기에는 수학이 없다** — 계산은 전부 모듈이
 * 하고 화면은 그 결과와 사유를 문장으로 옮긴다.
 *
 * 화면이 지켜야 하는 것(명세 §4~§8):
 * - 결론이 먼저, 차트·표는 근거로 뒤에.
 * - 신호가 없으면 원인·행동 카드를 **접는다**. 그게 정상 경로다.
 * - "조용함"과 "판정 불가"를 다른 문장으로 쓴다.
 * - 분해에서 뺀 지출이 있으면 **반드시 고지한다**.
 * - 추천과 내 결정을 시각적으로 가른다. 저장되는 것은 언제나 사용자가 고른 값이다.
 */

import { useMemo, useState } from "react";
import { useAppStore } from "@/store/useDataStore";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { resolveComparisonPeriods } from "@/lib/weekly-review/period";
import { buildSnapshot, snapshotMetrics } from "@/lib/weekly-review/snapshot";
import { routeAnalyses } from "@/lib/weekly-review/router";
import { buildVariance } from "@/lib/weekly-review/varianceBridge";
import { DECISION_OUTCOME, scoreDecision } from "@/lib/weekly-review/decisionScore";
import { OUTCOME_LABEL, buildReportDraft, describeAction, renderReportText } from "@/lib/weekly-review/reportDraft";
import { LOWER_IS_BETTER } from "@/lib/weekly-review/significance";
import WeeklyReview from "@/components/WeeklyReview";
import WeeklyReviewHandoverNotice from "@/components/weekly-review/WeeklyReviewHandoverNotice";
import { fmtPct } from "@/utils/format";

const COPY = {
  ko: {
    eyebrow: "WEEKLY REVIEW",
    title: "주간 리뷰",
    verdictHead: "이번 주 결론",
    whyHead: "왜 그랬나",
    lastHead: "지난 결정은 먹혔나",
    nextHead: "이번 주에 할 것",
    shareHead: "공유",
    historyToggle: (n) => `지난 결정 전체 보기 (${n}건)`,
    noData: "이번 주 데이터를 올려주세요.",
    noDataDeck: "2주치 캠페인 CSV를 올리면 이번 주와 지난주를 견주어 결론을 만듭니다.",
    goUpload: "데이터 올리기",
    quiet: "성과는 사실상 유지됐습니다.",
    unknown: "이번 기간의 핵심 지표를 잴 수 없었습니다.",
    metricsCaption: "지표",
    driversCaption: "캠페인별",
    recommend: "Growth Opt 추천",
    mine: "내 결정",
    save: "이 결정 저장",
    saved: "저장했습니다. 다음 주에 이 결정의 결과를 확인할 수 있습니다.",
    copy: "복사",
  },
  en: {
    eyebrow: "WEEKLY REVIEW",
    title: "Weekly Review",
    verdictHead: "This week",
    whyHead: "Why",
    lastHead: "Did last week's decision work?",
    nextHead: "What to do this week",
    shareHead: "Share",
    historyToggle: (n) => `All past decisions (${n})`,
    noData: "Upload this week's data.",
    noDataDeck: "Upload two weeks of campaign CSV and we compare this week with last.",
    goUpload: "Upload data",
    quiet: "Performance held steady.",
    unknown: "This period's headline metric could not be measured.",
    metricsCaption: "Metrics",
    driversCaption: "By campaign",
    recommend: "Growth Opt suggests",
    mine: "My decision",
    save: "Save this decision",
    saved: "Saved. You can check the result of this decision next week.",
    copy: "Copy",
  },
};

const ACTION_KINDS = [
  { id: "hold", ko: "유지", en: "Hold" },
  { id: "increase_budget", ko: "증액", en: "Increase" },
  { id: "decrease_budget", ko: "감액", en: "Decrease" },
  { id: "replace", ko: "교체", en: "Replace" },
  { id: "investigate", ko: "추가 확인", en: "Investigate" },
];

const REASON_TEXT = {
  ko: {
    change_too_small: "변화 폭이 작습니다.",
    within_normal_range: "최근 변동 범위 안입니다.",
    volume_too_low: "표본이 적어 판정하지 않았습니다.",
    no_volume: "전환 컬럼이 없어 표본을 확인하지 못했습니다.",
    no_value: "이번 또는 지난 기간의 지표를 계산할 수 없습니다.",
    no_previous_value: "지난 기간 값이 0이라 변화율을 만들 수 없습니다.",
    no_previous_data: "비교할 지난 기간 데이터가 없습니다.",
    no_dates: "날짜 컬럼을 읽지 못했습니다.",
  },
  en: {
    change_too_small: "The change is small.",
    within_normal_range: "Within the recent range.",
    volume_too_low: "Too few conversions to judge.",
    no_volume: "No conversion column, so sample size is unknown.",
    no_value: "This or last period's metric could not be computed.",
    no_previous_value: "Last period was zero, so no percentage change exists.",
    no_previous_data: "No data for the comparison period.",
    no_dates: "Could not read a date column.",
  },
};

function pct(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : "−"}${fmtPct(Math.abs(value))}`;
}

function money(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function WeeklyReviewScreen({ locale = "ko" }) {
  const t = COPY[locale] || COPY.ko;
  const csvData = useAppStore((state) => state.csvData);
  const decisionRecords = useAppStore((state) => state.decisionRecords) || [];

  const [decision, setDecision] = useState({ actionKind: "hold", actionTarget: "", actionAmount: "" });
  const [savedNote, setSavedNote] = useState(false);

  const review = useMemo(() => buildReview(csvData), [csvData]);

  if (!review.ok) {
    return (
      <article className="page-inner wr-screen">
        <WeeklyReviewHandoverNotice locale={locale} decisionCount={decisionRecords.length} />
        <header className="wr-screen__head">
          <div className="wr-screen__eyebrow">{t.eyebrow}</div>
          <h1>{t.title}</h1>
        </header>
        <section className="wr-screen__empty" aria-labelledby="wr-empty">
          <h2 id="wr-empty">{t.noData}</h2>
          <p>{t.noDataDeck}</p>
          {review.reason && REASON_TEXT[locale]?.[review.reason] && (
            <p className="wr-screen__reason">{REASON_TEXT[locale][review.reason]}</p>
          )}
          <a className="btn primary" href={locale === "en" ? "/en/start" : "/start"}>{t.goUpload}</a>
        </section>
        <PastDecisions locale={locale} t={t} count={decisionRecords.length} />
      </article>
    );
  }

  const { periods, routing, variance, lastDecision, metrics } = review;
  const kpiAssessment = routing.kpi;
  const quiet = routing.status === "quiet";
  const unknown = routing.status === "unknown";
  const recommended = variance?.ok ? variance.drivers.find((d) => !d.isRemainder) : null;

  const draft = buildReportDraft({
    project: { name: null, kpi: { metric: "cpa", basis: "actions", direction: LOWER_IS_BETTER } },
    period: periods.current,
    previousPeriod: periods.previous,
    routing,
    drivers: variance?.ok ? variance.drivers.filter((d) => !d.isRemainder).map((d) => ({ label: d.label, share: d.share })) : [],
    split: variance?.ok && variance.split.shares
      ? { efficiency: variance.split.shares.efficiency, mix: variance.split.shares.mix }
      : null,
    lastDecision,
    thisDecision: savedNote ? decision : null,
  });

  return (
    <article className="page-inner wr-screen">
      <WeeklyReviewHandoverNotice locale={locale} decisionCount={decisionRecords.length} />

      <header className="wr-screen__head">
        <div className="wr-screen__eyebrow">{t.eyebrow}</div>
        <h1>{t.title}</h1>
        <div className="wr-screen__period">
          <span>{periods.current.start} ~ {periods.current.end}</span>
          <span className="wr-screen__vs">vs</span>
          <span>{periods.previous.start} ~ {periods.previous.end}</span>
          {periods.partial && (
            <span className="wr-screen__badge">
              {locale === "en"
                ? `Partial week (${periods.current.days}d) · compared with the same weekdays`
                : `부분 주 (${periods.current.days}일) · 전주 같은 요일과 비교`}
            </span>
          )}
        </div>
      </header>

      {/* ── 1. 결론 ─────────────────────────────── */}
      <section className="wr-card" aria-labelledby="wr-verdict">
        <h2 className="wr-card__eyebrow" id="wr-verdict">{t.verdictHead}</h2>
        <div className="wr-verdict">
          <p className={`wr-verdict__big ${kpiAssessment?.significant ? (kpiAssessment.outcome === "worse" ? "is-bad" : "is-good") : "is-flat"}`}>
            {unknown ? t.unknown : quiet ? t.quiet : `CPA ${pct(kpiAssessment.deltaPct)}`}
          </p>
          {!unknown && (
            <p className="wr-verdict__from">
              {money(metrics.previous.cpa)} → {money(metrics.current.cpa)}
            </p>
          )}
          <p className="wr-verdict__basis">
            {REASON_TEXT[locale]?.[routing.reason] || ""}
            {kpiAssessment && !kpiAssessment.baselineKnown && (
              <> {locale === "en"
                ? "The usual range is not known yet — too few weeks."
                : "평소 변동 범위는 아직 모릅니다(비교 이력이 짧습니다)."}</>
            )}
          </p>
        </div>

        <div className="wr-tablewrap">
          <table>
            <caption>{t.metricsCaption}</caption>
            <thead>
              <tr>
                <th scope="col">{locale === "en" ? "Metric" : "지표"}</th>
                <th scope="col">{locale === "en" ? "Last" : "지난"}</th>
                <th scope="col">{locale === "en" ? "This" : "이번"}</th>
                <th scope="col">{locale === "en" ? "Change" : "변화"}</th>
              </tr>
            </thead>
            <tbody>
              {metricRows(metrics).map((row) => (
                <tr key={row.key} className={row.key === "cpa" ? "is-kpi" : ""}>
                  <th scope="row">{row.label}</th>
                  <td className="num">{row.format(row.previous)}</td>
                  <td className="num">{row.format(row.current)}</td>
                  <td className="num">{pct(row.change)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 2. 왜 (신호가 있을 때만) ───────────────── */}
      {!quiet && !unknown && variance?.ok && (
        <section className="wr-card" aria-labelledby="wr-why">
          <h2 className="wr-card__eyebrow" id="wr-why">{t.whyHead}</h2>

          {variance.split.shares ? (
            <p className="wr-readout">
              {variance.split.lead === "efficiency"
                ? (locale === "en"
                  ? "Campaign efficiency moved the number more than budget mix did."
                  : "예산을 어디에 썼는지보다 캠페인 자체의 효율 변화가 더 큰 원인이었습니다.")
                : (locale === "en"
                  ? "Budget mix moved the number more than campaign efficiency did."
                  : "캠페인 자체보다 예산이 어디로 옮겨갔는지가 더 큰 원인이었습니다.")}
              {" "}
              {locale === "en"
                ? `Efficiency ${fmtPct(Math.abs(variance.split.shares.efficiency))}, mix ${fmtPct(Math.abs(variance.split.shares.mix))}.`
                : `효율 ${fmtPct(Math.abs(variance.split.shares.efficiency))}, 믹스 ${fmtPct(Math.abs(variance.split.shares.mix))}.`}
            </p>
          ) : (
            <p className="wr-readout">
              {locale === "en"
                ? "Efficiency and mix moved in opposite directions and nearly cancelled out, so a percentage split would be misleading. Amounts only."
                : "효율과 믹스가 서로 반대로 움직여 거의 상쇄됐습니다. 비율로 나누면 오해를 부르므로 금액만 보여줍니다."}
            </p>
          )}

          {!variance.coversAllSpend && (
            <p className="wr-notice" role="note">
              {locale === "en"
                ? `Excluded from the breakdown: ${variance.excluded.cells.join(", ")} — spend ${money(variance.excluded.cost2)} with zero conversions this period. Their CPA is undefined, so they cannot enter the decomposition.`
                : `분해에서 제외: ${variance.excluded.cells.join(", ")} — 이번 기간 지출 ${money(variance.excluded.cost2)}에 전환 0. CPA가 정의되지 않아 분해에 넣을 수 없습니다.`}
            </p>
          )}

          <div className="wr-tablewrap">
            <table>
              <caption>{t.driversCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{locale === "en" ? "Campaign" : "캠페인"}</th>
                  <th scope="col">CPA</th>
                  <th scope="col">{locale === "en" ? "Result share" : "결과 비중"}</th>
                  <th scope="col">{locale === "en" ? "Contribution" : "기여"}</th>
                </tr>
              </thead>
              <tbody>
                {variance.drivers.map((driver) => (
                  <tr key={driver.label}>
                    <th scope="row" className={driver.isRemainder ? "quiet" : ""}>{driver.label}</th>
                    <td className="num">{driver.cpaChangePct === null ? "—" : pct(driver.cpaChangePct)}</td>
                    <td className="num quiet">{fmtPct(driver.s1)} → {fmtPct(driver.s2)}</td>
                    <td className="num">{driver.share === null ? money(driver.contribution) : fmtPct(driver.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="wr-note">
              {locale === "en"
                ? "“Result share” is the share of conversions, not of spend."
                : "“결과 비중”은 비용이 아니라 전환 건수의 비중입니다."}
            </p>
          </div>
        </section>
      )}

      {/* ── 3. 지난 결정 (있을 때만) ───────────────── */}
      {lastDecision && (
        <section className="wr-card" aria-labelledby="wr-last">
          <h2 className="wr-card__eyebrow" id="wr-last">{t.lastHead}</h2>
          <p className="wr-decision__action">{describeAction(lastDecision.decision)}</p>
          <p className={`wr-stamp is-${lastDecision.score.outcome.toLowerCase()}`}>
            {OUTCOME_LABEL[lastDecision.score.outcome]}
          </p>
          {lastDecision.score.outcome === DECISION_OUTCOME.NO_EFFECT && (
            <p className="wr-note">
              {locale === "en"
                ? "This does not mean the decision had no effect — one week is not enough to rule it out."
                : "효과가 없다는 뜻은 아닙니다 — 1주 표본으로는 효과를 부정할 수 없습니다."}
            </p>
          )}
          {lastDecision.score.outcome === DECISION_OUTCOME.UNSCORED && (
            <p className="wr-note">
              {locale === "en"
                ? "No goal or guardrail was recorded with this decision, so it cannot be scored."
                : "이 결정에는 목표·가드레일이 기록되지 않아 판정할 수 없습니다."}
            </p>
          )}
        </section>
      )}

      {/* ── 4. 이번 주에 할 것 ─────────────────────── */}
      {!quiet && !unknown && (
        <section className="wr-card" aria-labelledby="wr-next">
          <h2 className="wr-card__eyebrow" id="wr-next">{t.nextHead}</h2>

          {recommended && (
            <div className="wr-reco">
              <p className="wr-reco__k">{t.recommend}</p>
              <p className="wr-reco__t">{recommended.label}</p>
              <p className="wr-reco__ev num">
                CPA {pct(recommended.cpaChangePct)} · {recommended.share === null ? money(recommended.contribution) : fmtPct(recommended.share)}
              </p>
            </div>
          )}

          <div className="wr-mine">
            <p className="wr-mine__k">{t.mine}</p>
            <div className="wr-opts" role="group" aria-label={t.mine}>
              {ACTION_KINDS.map((kind) => (
                <button
                  key={kind.id}
                  type="button"
                  className="wr-opt"
                  aria-pressed={decision.actionKind === kind.id}
                  onClick={() => setDecision((prev) => ({ ...prev, actionKind: kind.id }))}
                >
                  {locale === "en" ? kind.en : kind.ko}
                </button>
              ))}
            </div>
            <label className="wr-field">
              <span>{locale === "en" ? "Target" : "대상"}</span>
              <input
                value={decision.actionTarget || recommended?.label || ""}
                onChange={(event) => setDecision((prev) => ({ ...prev, actionTarget: event.target.value }))}
              />
            </label>
            <button type="button" className="btn primary" onClick={() => setSavedNote(true)}>{t.save}</button>
            {savedNote && <p className="wr-note" role="status">{t.saved}</p>}
          </div>
        </section>
      )}

      {/* ── 5. 공유 ───────────────────────────────── */}
      <section className="wr-card" aria-labelledby="wr-share">
        <h2 className="wr-card__eyebrow" id="wr-share">{t.shareHead}</h2>
        <pre className="wr-report">{renderReportText(draft, { number: money })}</pre>
      </section>

      <PastDecisions locale={locale} t={t} count={decisionRecords.length} />
    </article>
  );
}

function PastDecisions({ locale, t, count }) {
  return (
    <details className="wr-history">
      <summary>{t.historyToggle(count)}</summary>
      <WeeklyReview locale={locale} embedded />
    </details>
  );
}

function metricRows(metrics) {
  const change = (key) => {
    const prev = metrics.previous[key];
    const cur = metrics.current[key];
    if (prev === null || cur === null || prev === 0) return null;
    return (cur - prev) / Math.abs(prev);
  };
  const rows = [
    { key: "cpa", label: "CPA", format: money },
    { key: "cost", label: "Spend", format: money },
    { key: "conversions", label: "Conversions", format: money },
    { key: "ctr", label: "CTR", format: (v) => (v === null ? "—" : fmtPct(v)) },
    { key: "cvr", label: "CVR", format: (v) => (v === null ? "—" : fmtPct(v)) },
  ];
  return rows
    .map((row) => ({
      ...row,
      previous: metrics.previous[row.key],
      current: metrics.current[row.key],
      change: change(row.key),
    }))
    // 매핑되지 않은 지표는 행 자체를 만들지 않는다 — 빈 줄을 "확인했는데 없음"으로 읽지 않게.
    .filter((row) => row.previous !== null && row.current !== null);
}

/** 업로드된 CSV 하나에서 리뷰에 필요한 것을 전부 계산한다. */
function buildReview(csvData) {
  const rows = getMappedRows(csvData);
  if (!rows || rows.length === 0) return { ok: false, reason: null };

  const periods = resolveComparisonPeriods({ dates: rows.map((row) => row.date) });
  if (!periods.ok) return { ok: false, reason: periods.reason };

  const current = buildSnapshot({ rows, period: periods.current });
  const previous = buildSnapshot({ rows, period: periods.previous });
  if (!current.ok || !previous.ok) return { ok: false, reason: "no_previous_data" };

  const routing = routeAnalyses({
    current,
    previous,
    project: { kpi: { metric: "cpa", basis: "actions", direction: LOWER_IS_BETTER } },
    volumeMultiplier: periods.volumeMultiplier,
  });

  const runsVariance = (routing.run || []).some((entry) => entry.analysis === "variance");
  const variance = runsVariance ? buildVariance({ current, previous }) : null;

  const currentMetrics = snapshotMetrics(current) || {};
  const previousMetrics = snapshotMetrics(previous) || {};

  return {
    ok: true,
    periods,
    routing,
    variance,
    lastDecision: null, // 저장된 결정 연결은 스냅샷 영속화와 함께 붙인다(§13.1)
    metrics: {
      current: { ...currentMetrics, cost: currentMetrics.totals?.cost ?? null },
      previous: { ...previousMetrics, cost: previousMetrics.totals?.cost ?? null },
    },
  };
}

export { buildReview, scoreDecision };
