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

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/store/useDataStore";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { DECISION_OUTCOME } from "@/lib/weekly-review/decisionScore";
import { DEFAULT_PROJECT, KPI_OPTIONS, kpiFor, runReview } from "@/lib/weekly-review/reviewPipeline";
import { listStoredSnapshots, saveStoredSnapshot } from "@/lib/weekly-review/snapshotStore";
import { OUTCOME_LABEL, buildReportDraft, describeAction, renderReportText } from "@/lib/weekly-review/reportDraft";
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
    settings: "기준·기간 설정",
    kpiLabel: "핵심 지표",
    basisLabel: "전환 기준",
    basisActions: "가입·구매 등(actions)",
    basisInstalls: "설치(installs)",
    periodLabel: "비교 기간",
    periodAuto: "자동 (최신 날짜의 요일까지)",
    periodCustom: "직접 지정",
    curStart: "이번 시작", curEnd: "이번 끝",
    prevStart: "지난 시작", prevEnd: "지난 끝",
    lengthWarn: "기간 길이가 다릅니다. 변화율이 기간 차이 때문일 수 있습니다.",
    historyNote: (n) => `저장된 주간 기록 ${n}주 — 평소 변동 범위를 이 기록으로 판정합니다.`,
    historyNone: "저장된 주간 기록이 없어 평소 변동 범위는 아직 모릅니다. 이번 리뷰가 첫 기록으로 남습니다.",
    goalLabel: "목표", guardLabel: "가드레일", amountLabel: "크기",
    guardHint: "가드레일을 비우면 다음 주에 자동으로 판정할 수 없습니다.",
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
    settings: "Metric & period",
    kpiLabel: "Headline metric",
    basisLabel: "Conversion basis",
    basisActions: "Actions (signup, purchase…)",
    basisInstalls: "Installs",
    periodLabel: "Comparison period",
    periodAuto: "Automatic (through the latest weekday)",
    periodCustom: "Set manually",
    curStart: "This from", curEnd: "This to",
    prevStart: "Last from", prevEnd: "Last to",
    lengthWarn: "The two periods differ in length. The change may reflect that difference.",
    historyNote: (n) => `${n} weeks of saved history — the usual range is judged from these.`,
    historyNone: "No saved weekly history yet, so the usual range is unknown. This review becomes the first record.",
    goalLabel: "Goal", guardLabel: "Guardrail", amountLabel: "Size",
    guardHint: "Leave the guardrail empty and next week's review cannot score this decision.",
  },
};

// 셀렉터가 매 렌더 새 배열을 만들면 아래 useMemo가 매번 다시 돈다.
const EMPTY_RECORDS = [];

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
  const decisionRecords = useAppStore((state) => state.decisionRecords ?? EMPTY_RECORDS);
  const addDecisionRecord = useAppStore((state) => state.addDecisionRecord);
  const persistenceEnabled = useAppStore((state) => state.decisionPersistenceEnabled);

  const [kpiMetric, setKpiMetric] = useState(DEFAULT_PROJECT.kpi.metric);
  const [basis, setBasis] = useState(DEFAULT_PROJECT.kpi.basis);
  const [customPeriod, setCustomPeriod] = useState(null);
  const [storedSnapshots, setStoredSnapshots] = useState([]);
  const [decision, setDecision] = useState({
    actionKind: "hold", actionTarget: "", actionAmount: "",
    goalMetric: "conversions", goalDirection: "up",
    guardrailMetric: "cpa", guardrailOp: "lte", guardrailValue: "",
  });
  const [savedId, setSavedId] = useState(null);

  const rows = useMemo(() => getMappedRows(csvData), [csvData]);
  const project = useMemo(() => ({ kpi: kpiFor(kpiMetric, basis), target: null }), [kpiMetric, basis]);

  // 저장된 주간 기록을 읽어야 평소 변동 범위를 판정할 수 있다(§2.3).
  // 못 읽으면 빈 목록으로 떨어지고 리뷰는 크기·표본 두 축으로 계속 동작한다.
  useEffect(() => {
    let alive = true;
    listStoredSnapshots().then((list) => { if (alive) setStoredSnapshots(list); });
    return () => { alive = false; };
  }, []);

  const review = useMemo(
    () => runReview({ rows, storedSnapshots, decisionRecords, project, customPeriod }),
    [rows, storedSnapshots, decisionRecords, project, customPeriod],
  );

  // 이번 기간 집계를 보관한다 — 다음 주의 "평소 범위"가 여기서 나온다.
  // 기기 저장을 끈 사용자에게는 쓰지 않는다.
  useEffect(() => {
    if (!review.ok || persistenceEnabled !== true) return;
    saveStoredSnapshot(review.current);
  }, [review, persistenceEnabled]);

  const saveDecision = useCallback((recommendedLabel) => {
    const record = {
      toolId: "weekly-review",
      locale,
      action: [decision.actionTarget || recommendedLabel, decision.actionKind, decision.actionAmount]
        .filter(Boolean).join(" "),
      actionKind: decision.actionKind,
      actionTarget: decision.actionTarget || recommendedLabel || "",
      actionAmount: decision.actionAmount || "",
      goalMetric: decision.goalMetric,
      goalDirection: decision.goalDirection,
      guardrailMetric: decision.guardrailValue ? decision.guardrailMetric : "",
      guardrailOp: decision.guardrailValue ? decision.guardrailOp : "",
      guardrailValue: decision.guardrailValue,
      createdAt: new Date().toISOString(),
    };
    addDecisionRecord(record);
    setSavedId(record.createdAt);
  }, [decision, addDecisionRecord, locale]);

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
        <ReviewSettings
          t={t} locale={locale}
          kpiMetric={kpiMetric} setKpiMetric={setKpiMetric}
          basis={basis} setBasis={setBasis}
          customPeriod={customPeriod} setCustomPeriod={setCustomPeriod}
          periods={review.periods || null}
          historyWeeks={0}
        />
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
    project: { name: null, kpi: project.kpi },
    period: periods.current,
    previousPeriod: periods.previous,
    routing,
    drivers: variance?.ok ? variance.drivers.filter((d) => !d.isRemainder).map((d) => ({ label: d.label, share: d.share })) : [],
    split: variance?.ok && variance.split.shares
      ? { efficiency: variance.split.shares.efficiency, mix: variance.split.shares.mix }
      : null,
    lastDecision,
    thisDecision: savedId ? decision : null,
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

      <ReviewSettings
        t={t} locale={locale}
        kpiMetric={kpiMetric} setKpiMetric={setKpiMetric}
        basis={basis} setBasis={setBasis}
        customPeriod={customPeriod} setCustomPeriod={setCustomPeriod}
        periods={periods}
        historyWeeks={review.history?.[kpiMetric]?.length ?? 0}
      />

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
            <label className="wr-field">
              <span>{t.amountLabel}</span>
              <input
                value={decision.actionAmount}
                placeholder="-10%"
                onChange={(event) => setDecision((prev) => ({ ...prev, actionAmount: event.target.value }))}
              />
            </label>
            <label className="wr-field">
              <span>{t.goalLabel}</span>
              <select
                value={decision.goalMetric}
                onChange={(event) => setDecision((prev) => ({ ...prev, goalMetric: event.target.value }))}
              >
                <option value="conversions">{locale === "en" ? "Conversions" : "전환"}</option>
                <option value="cpa">CPA</option>
                <option value="spend">{locale === "en" ? "Spend" : "비용"}</option>
              </select>
              <select
                value={decision.goalDirection}
                onChange={(event) => setDecision((prev) => ({ ...prev, goalDirection: event.target.value }))}
              >
                <option value="up">{locale === "en" ? "Increase" : "증가"}</option>
                <option value="down">{locale === "en" ? "Decrease" : "감소"}</option>
                <option value="hold">{locale === "en" ? "Hold" : "유지"}</option>
              </select>
            </label>
            <label className="wr-field">
              <span>{t.guardLabel}</span>
              <select
                value={decision.guardrailMetric}
                onChange={(event) => setDecision((prev) => ({ ...prev, guardrailMetric: event.target.value }))}
              >
                <option value="cpa">CPA</option>
                <option value="roas">ROAS</option>
                <option value="conversions">{locale === "en" ? "Conversions" : "전환"}</option>
              </select>
              <select
                value={decision.guardrailOp}
                onChange={(event) => setDecision((prev) => ({ ...prev, guardrailOp: event.target.value }))}
              >
                <option value="lte">≤</option>
                <option value="gte">≥</option>
              </select>
              <input
                className="wr-field__num"
                value={decision.guardrailValue}
                placeholder="8.00"
                inputMode="decimal"
                onChange={(event) => setDecision((prev) => ({ ...prev, guardrailValue: event.target.value }))}
              />
            </label>
            {/* 가드레일을 강제하지 않는다 — 강제하면 아무 값이나 넣어 판정이 거짓이 된다. */}
            {!decision.guardrailValue && <p className="wr-note">{t.guardHint}</p>}
            <button type="button" className="btn primary" onClick={() => saveDecision(recommended?.label || "")}>{t.save}</button>
            {savedId && <p className="wr-note" role="status">{t.saved}</p>}
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

/**
 * 기준·기간 설정. 자동 판정은 **제안**이고 사용자가 언제든 바꿀 수 있어야 한다 — 자동 비교가
 * 틀렸는데 고칠 방법이 없으면 리뷰 전체를 못 믿는다(§2.2b).
 * 접어 두는 이유는 P2다: 매주 바꾸는 값이 아니다.
 */
function ReviewSettings({
  t, locale, kpiMetric, setKpiMetric, basis, setBasis,
  customPeriod, setCustomPeriod, periods, historyWeeks,
}) {
  const manual = Boolean(customPeriod);
  const setField = (key, value) => setCustomPeriod((prev) => ({ ...(prev || {}), [key]: value }));

  return (
    <details className="wr-settings">
      <summary>{t.settings}</summary>
      <div className="wr-settings__body">
        <label className="wr-field">
          <span>{t.kpiLabel}</span>
          <select value={kpiMetric} onChange={(event) => setKpiMetric(event.target.value)}>
            {KPI_OPTIONS.map((option) => (
              <option key={option.metric} value={option.metric}>{locale === "en" ? option.en : option.ko}</option>
            ))}
          </select>
        </label>

        <label className="wr-field">
          <span>{t.basisLabel}</span>
          <select value={basis} onChange={(event) => setBasis(event.target.value)}>
            <option value="actions">{t.basisActions}</option>
            <option value="installs">{t.basisInstalls}</option>
          </select>
        </label>

        <label className="wr-field">
          <span>{t.periodLabel}</span>
          <select
            value={manual ? "custom" : "auto"}
            onChange={(event) => setCustomPeriod(
              event.target.value !== "custom"
                ? null
                : periods
                  ? { currentStart: periods.current.start, currentEnd: periods.current.end }
                  : {},
            )}
          >
            <option value="auto">{t.periodAuto}</option>
            <option value="custom">{t.periodCustom}</option>
          </select>
        </label>

        {manual && (
          <div className="wr-settings__dates">
            {[["currentStart", t.curStart], ["currentEnd", t.curEnd],
              ["previousStart", t.prevStart], ["previousEnd", t.prevEnd]].map(([key, label]) => (
              <label className="wr-field" key={key}>
                <span>{label}</span>
                <input
                  type="date"
                  value={customPeriod?.[key] || ""}
                  onChange={(event) => setField(key, event.target.value)}
                />
              </label>
            ))}
          </div>
        )}

        {periods?.warnings?.includes("length_mismatch") && (
          <p className="wr-notice">{t.lengthWarn}</p>
        )}

        <p className="wr-note">
          {historyWeeks > 0 ? t.historyNote(historyWeeks) : t.historyNone}
        </p>
      </div>
    </details>
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

