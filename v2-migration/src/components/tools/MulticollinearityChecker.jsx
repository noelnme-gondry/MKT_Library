"use client";

import React, { useMemo } from "react";
import CsvUploader from "@/components/CsvUploader";
import ToolPageShell from "@/components/ToolPageShell";
import DataTable from "@/components/ds/DataTable";
import ResultActionCard from "@/components/ds/ResultActionCard";
import DownloadHub from "@/components/ds/DownloadHub";
import { downloadCsv } from "@/utils/download";
import { useAppStore } from "@/store/useDataStore";
import { buildVifSpendPanel } from "@/lib/analysis-router/vifReadiness";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { computeVif, correlationMatrix, DIAG_THRESHOLDS } from "@/utils/modelDiagnostics";

function analyze(rows) {
  const panel = buildVifSpendPanel(rows.map((row) => ({
    date: row.date,
    entity: row.channel || row.campaign_name,
    cost: row.cost ?? row.spend,
  })));
  const channels = panel.entities;
  const matrix = panel.matrix;
  if (channels.length < 2 || matrix.length < channels.length + 3) return { channels, matrix, vif: null, correlation: null, pairs: [] };
  const vif = computeVif(matrix);
  // r만 보여주던 시절엔 채널 5개 = 쌍 10개라 우연히 강한 상관이 하나쯤 늘 나왔고,
  // 그걸 "함께 움직인다"고 읽을 근거가 화면에 없었다. Holm 보정 p와 pointwise 95%
  // 구간을 함께 낸다(엔진: modelDiagnostics.correlationMatrix, 골든 검증됨).
  const correlation = correlationMatrix(channels.map((name, index) => ({ name, values: matrix.map((row) => row[index]) })));
  return { channels, matrix, vif, correlation, pairs: correlation.pairs };
}

export default function MulticollinearityChecker({ locale = "ko" } = {}) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  const csvData = useAppStore((state) => state.csvData);
  const analyzed = useAppStore((state) => state.isGroupAnalyzed("5-25"));
  const result = useMemo(() => analyzed ? analyze(getMappedRows(csvData)) : null, [analyzed, csvData]);
  const verdict = result?.vif?.verdict;
  const isDemo = String(csvData?.fileName || "").startsWith("demo_");
  const copy = verdict === "ok" ? tr("현재 지출 패턴에서는 심한 중복 움직임이 보이지 않습니다. 그래도 연관은 인과가 아니므로 MMM 결과는 실험·홀드아웃과 함께 해석하세요.", "The spend pattern has no severe overlap signal. Correlation is still not causation; interpret MMM with experiments or holdouts.") : verdict === "warn" || verdict === "severe" ? tr("채널별 기여도를 숫자로 나누기 전에, 같이 움직인 채널을 분리해 변동시킨 기간을 확보하세요. 이 상태의 MMM 계수는 배분 근거로 쓰기 어렵습니다.", "Before dividing contribution by channel, create periods where the paired channels move independently. MMM coefficients in this state are weak evidence for allocation.") : verdict === "not_applicable" ? tr("채널은 있지만 시간에 따라 지출이 변한 채널이 2개 미만이라 VIF를 계산할 수 없습니다. 최소 2개 채널의 지출이 서로 다르게 움직인 기간을 추가하세요.", "Channels are present, but fewer than two vary over time, so VIF is not computable. Add periods where at least two channels move independently.") : tr("채널 수와 공통 기간이 부족합니다. 최소 2개 채널, 채널 수보다 3개 이상 많은 날짜가 필요합니다.", "There are not enough channels or common periods. Use at least two channels and at least three more dates than channels.");
  // computeVif는 계산 불가 시 vif: []를 반환하면서 variableIndices는 비우지 않는다
  // (골든 계약: modelDiagnostics.test.js). 위치 zip만 하면 vif[i]가 undefined가 되고,
  // 표시층에서 이를 비유한(∞)으로 렌더해 "계산 불가"를 "완전 공선(최악)"으로 뒤집었다.
  // → 값이 실제로 존재하는 행만 남긴다. 남은 Infinity는 진짜 완전 공선이다(§8 날조 금지).
  const vifRows = result?.vif
    ? result.vif.variableIndices
      .map((index, vifIndex) => ({ channel: result.channels[index], vif: result.vif.vif[vifIndex] }))
      .filter((row) => typeof row.vif === "number" && !Number.isNaN(row.vif))
    : [];
  const maxVif = result?.vif?.maxVif;
  const formattedMaxVif = Number.isFinite(maxVif) ? maxVif.toFixed(2) : verdict === "severe" ? "∞" : tr("계산 불가", "Not computable");
  const robustnessLabel = (value) => value === "consistent"
    ? tr("두 방법 일치", "Methods agree")
    : value === "direction_conflict"
      ? tr("방향 불일치", "Direction differs")
      : value === "magnitude_conflict"
        ? tr("크기 차이", "Magnitude differs")
        : value === "significance_conflict"
          ? tr("판정 불일치", "Significance differs")
          : tr("계산 불가", "Not computable");
  const robustnessWarnings = (result?.pairs || []).filter((pair) => pair.robustness && pair.robustness !== "consistent" && pair.robustness !== "not_identified");
  const canSaveDecision = result?.vif && verdict !== "not_applicable" && verdict !== "unknown";
  const decisionPrefill = canSaveDecision && !isDemo ? {
    conclusion: tr(`최대 VIF ${formattedMaxVif} · ${verdict === "ok" ? "심한 중복 신호 없음" : "채널 분리 변동 필요"}`, `Maximum VIF ${formattedMaxVif} · ${verdict === "ok" ? "no severe overlap signal" : "independent channel variation needed"}`),
    action: verdict === "ok" ? tr("MMM을 진행하되 중요한 예산 결정은 별도 실험으로 확인한다", "Proceed with MMM, then verify important budget decisions with an experiment") : tr("함께 움직인 채널의 예산 변동을 분리한 뒤 VIF를 다시 점검한다", "Create independent spend variation for overlapping channels, then rerun VIF"),
    metric: tr("최대 VIF", "Maximum VIF"),
    baseline: formattedMaxVif,
    targetDirection: "lower",
    reviewQuestion: tr("새 기간의 채널 지출은 기여도를 분리해 읽을 만큼 독립적으로 움직였는가?", "Did channel spend move independently enough in the new period to separate contribution?"),
  } : null;
  const resultHeadline = verdict === "ok" ? tr("MMM 진행 가능 · 해석은 신중하게", "MMM can proceed · interpret cautiously") : verdict === "warn" ? tr("주의 · 채널 분리 변동 권장", "Warning · create independent variation") : verdict === "severe" ? tr("중단 · 현재 데이터로 기여도 분리 금지", "Stop · do not separate contribution") : verdict === "not_applicable" ? tr("계산 불가 · 변동 채널 2개 필요", "Not computable · two varying channels required") : tr("데이터 추가 필요", "Need more data");
  const downloadVifCsv = () => {
    const cell = (value) => {
      const text = String(value ?? "");
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const lines = [["channel", "vif"], ...vifRows.map((row) => [row.channel, Number.isFinite(row.vif) ? row.vif : "Infinity"])]
      .map((line) => line.map(cell).join(","));
    downloadCsv(`\uFEFF${lines.join("\r\n")}`, "vif-multicollinearity");
  };
  // 상관은 화면에서 판정까지 하므로 내보내기도 판정 근거를 통째로 담는다 —
  // r만 있는 CSV는 받아봐야 "우연인지"를 다시 판단할 수 없다(§12.27).
  const downloadCorrelationCsv = () => {
    const cell = (value) => {
      const text = value == null ? "" : String(value);
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const header = ["channel_a", "channel_b", "pearson_r", "spearman_r", "ci_low_95_pointwise", "ci_high_95_pointwise", "pearson_raw_p", "pearson_holm_p", "spearman_raw_p_approx", "spearman_holm_p_approx", "robustness", "moves_together"];
    const lines = [header, ...(result?.pairs || []).map((row) => [
      row.left,
      row.right,
      Number.isFinite(row.r) ? row.r : "",
      Number.isFinite(row.spearmanR) ? row.spearmanR : "",
      Number.isFinite(row.ciLow) ? row.ciLow : "",
      Number.isFinite(row.ciHigh) ? row.ciHigh : "",
      Number.isFinite(row.rawP) ? row.rawP : "",
      Number.isFinite(row.holmP) ? row.holmP : "",
      Number.isFinite(row.spearmanRawP) ? row.spearmanRawP : "",
      Number.isFinite(row.spearmanHolmP) ? row.spearmanHolmP : "",
      row.robustness || "not_identified",
      Number.isFinite(row.r) ? (row.isSignificant ? "yes" : "no") : "not_computable",
    ])].map((line) => line.map(cell).join(","));
    downloadCsv(`\uFEFF${lines.join("\r\n")}\r\n`, "channel-correlation-holm");
  };
  return <ToolPageShell toolId="5-25" locale={locale} titleLevel={0} title={tr("VIF 다중공선성 점검", "VIF Multicollinearity Check")} summary={<p>{tr("MMM을 돌리기 전에 채널별 지출이 서로 너무 같이 움직였는지 확인합니다. 숫자는 진단 신호이며, 공선성을 해결한 인과 추정은 아닙니다.", "Check whether channel spend moved too tightly together before running MMM. This is a diagnostic signal, not a causal fix.")}</p>}>
    <section className="block diagnostic-tool__rules" id="vif-setup"><h2 className="section-title">{tr("VIF 해석", "Reading VIF")}</h2><p>{tr(`VIF ${DIAG_THRESHOLDS.vifWarn} 미만은 관찰상 양호, ${DIAG_THRESHOLDS.vifWarn} 이상은 주의, ${DIAG_THRESHOLDS.vifSevere} 이상 또는 계산 불가는 심각으로 표시합니다. 비용·채널·날짜만 있으면 됩니다.`, `Below ${DIAG_THRESHOLDS.vifWarn} is observationally OK; ${DIAG_THRESHOLDS.vifWarn}+ is a warning; ${DIAG_THRESHOLDS.vifSevere}+ or an uncomputable value is severe. You only need date, channel, and spend.`)}</p></section>
    <CsvUploader toolId="5-25" locale={locale} />
    {analyzed && <>
      <div id="vif-result"><ResultActionCard
        tone={verdict === "ok" ? "good" : verdict === "warn" ? "neutral" : "bad"}
        title={tr("판정", "Verdict")}
        headline={resultHeadline}
        points={[{ text: copy }]}
        stats={[{ label: tr("최대 VIF", "Maximum VIF"), value: formattedMaxVif }, { label: tr("변동 채널", "Varying channels"), value: String(vifRows.length) }, { label: tr("공통 기간", "Common periods"), value: String(result?.matrix?.length || 0) }]}
        toolId="5-25"
        analysisType="multicollinearity"
        analysisKey={`${verdict || "unknown"}:${formattedMaxVif}`}
        resultState={canSaveDecision ? "ready" : "blocked"}
        locale={locale}
        decisionPrefill={decisionPrefill}
        workbookExport={() => ({
          calculationMode: "hybrid_engine_output",
          calculationTables: [{
            name: "COLLINEARITY_DIAGNOSTICS",
            title: tr("VIF·채널쌍 상관 진단", "VIF and channel-pair correlation diagnostics"),
            note: tr("회귀·Holm 보정은 엔진 출력이고 절댓값·임계치 초과 여부는 수식", "Regression and Holm adjustment are engine outputs; absolute values and threshold flags are formulas"),
            rows: [
              ["kind", "channel_a", "channel_b", "engine_value", "adjusted_p_engine", "absolute_value", "warn_threshold", "threshold_exceeded"],
              ...vifRows.map((row, index) => {
                const excelRow = index + 2;
                return ["VIF", row.channel, "", Number.isFinite(row.vif) ? row.vif : "", "", { formula: `=ABS(D${excelRow})` }, DIAG_THRESHOLDS.vifWarn, { formula: `=IF(F${excelRow}>=G${excelRow},1,0)` }];
              }),
              ...(result?.pairs || []).map((row, index) => {
                const excelRow = vifRows.length + index + 2;
                return ["CORRELATION", row.left, row.right, Number.isFinite(row.r) ? row.r : "", Number.isFinite(row.holmP) ? row.holmP : "", { formula: `=ABS(D${excelRow})` }, 0.8, { formula: `=IF(F${excelRow}>=G${excelRow},1,0)` }];
              }),
            ],
          }],
          method: {
            name: "VIF + Pearson/Spearman + Holm",
            version: "collinearity-v1",
            limitations: [tr("VIF와 상관은 식별 진단이며 공선성을 해결한 인과 추정이 아닙니다.", "VIF and correlation are identification diagnostics, not causal estimates with collinearity resolved.")],
          },
        })}
        download={<DownloadHub toolId="5-25" locale={locale} label={tr("결과 받기", "Download results")} items={[
          { icon: "⬇", analyticsType: "csv", label: tr("VIF 결과 (CSV)", "VIF results (CSV)"), desc: tr("채널별 VIF 원자료", "Channel-level VIF values"), onSelect: downloadVifCsv },
          { icon: "⬇", analyticsType: "csv", label: tr("채널쌍 상관 (CSV)", "Channel-pair correlation (CSV)"), desc: tr("채널쌍별 상관과 판정 근거 숫자", "Correlation and the numbers behind each verdict"), onSelect: downloadCorrelationCsv },
        ]} />}
      /></div>
      <section className="block"><h2 className="section-title">{tr("채널별 VIF", "VIF by channel")}</h2><DataTable columns={[{ key: "channel", label: tr("채널", "Channel") }, { key: "vif", label: "VIF", align: "right", fmt: (value) => Number.isFinite(value) ? value.toFixed(2) : value === Infinity ? "∞" : tr("계산 불가", "Not computable") }]} rows={vifRows} rowKey={(row) => row.channel} emptyText={tr("계산 가능한 VIF가 없습니다.", "No computable VIF values.")} /></section>
      <section className="block">
        <h2 className="section-title">{tr("가장 함께 움직인 채널쌍", "Most correlated channel pairs")}</h2>
        {/* 판정 칩이 이미 다중비교 보정을 반영한다. 보정 p와 구간을 열로 펴면 6열이 되고
            사용자가 숫자 넷을 대조해야 하는데, 그 대조는 우리가 이미 했다(§12.14·§12.17). */}
        <DataTable
          columns={[
            { key: "left", label: tr("채널 A", "Channel A") },
            { key: "right", label: tr("채널 B", "Channel B") },
            { key: "r", label: tr("함께 움직인 정도", "How closely they moved"), align: "right", fmt: (value) => Number.isFinite(value) ? value.toFixed(2) : tr("계산 불가", "Not computable") },
            { key: "spearmanR", label: tr("순위 기준", "Rank-based"), align: "right", fmt: (value) => Number.isFinite(value) ? value.toFixed(2) : tr("계산 불가", "Not computable") },
            { key: "robustness", label: tr("강건성", "Robustness"), fmt: (value) => robustnessLabel(value) },
            { key: "isSignificant", label: tr("판정", "Verdict"), fmt: (value, row) => !Number.isFinite(row.r) ? tr("계산 불가", "Not computable") : value ? tr("함께 움직임", "Moves together") : tr("근거 부족", "Not established") },
          ]}
          rows={result?.pairs || []}
          rowKey={(row) => `${row.left}-${row.right}`}
          emptyText={tr("비교할 쌍이 없습니다.", "No pairs to compare.")}
        />
        {robustnessWarnings.length > 0 && <p className="required-banner" style={{ marginTop: "12px" }}>{tr(
          `Pearson과 순위 기반 상관이 일치하지 않는 채널쌍 ${robustnessWarnings.length}건이 있습니다. 일부 극단값·비선형 단조 관계의 영향일 수 있으므로, Pearson만으로 MMM의 채널 분리를 판단하지 마세요.`,
          `${robustnessWarnings.length} channel pair(s) differ between Pearson and rank-based correlation. Outliers or nonlinear monotonic movement may be involved, so do not use Pearson alone to decide MMM channel separation.`,
        )}</p>}
        {(result?.pairs || []).length > 0 && (
          <details className="stat-method">
            <summary>{tr("판정 근거 숫자 보기", "Show the numbers behind the verdict")}</summary>
            <div>
              <p style={{ margin: "0 0 8px" }}>{tr(
                `채널쌍이 ${result?.correlation?.comparisons ?? 0}개라 우연히 강하게 움직인 쌍이 섞일 수 있습니다. 그 몫을 덜어낸 값(Holm 보정 p)으로 판정했습니다. 95% 구간은 각 쌍을 따로 본 구간입니다. Pearson이 주 판정이고, 순위 기준 p는 동률을 보정한 t 근사로 강건성만 점검합니다.`,
                `With ${result?.correlation?.comparisons ?? 0} pairs, some will move together by chance. The verdict uses p-values adjusted for that (Holm). The 95% intervals are per-pair, not multiplicity-adjusted. Pearson is the primary test; rank-based p-values are tie-corrected t approximations used as a robustness check.`,
              )}</p>
              <DataTable
                columns={[
                  { key: "left", label: tr("채널 A", "Channel A") },
                  { key: "right", label: tr("채널 B", "Channel B") },
                  { key: "ciLow", label: tr("95% 구간", "95% interval"), align: "right", fmt: (_, row) => Number.isFinite(row.ciLow) && Number.isFinite(row.ciHigh) ? `${row.ciLow.toFixed(2)} ~ ${row.ciHigh.toFixed(2)}` : "—" },
                  { key: "holmP", label: tr("보정 p", "Adjusted p"), align: "right", fmt: (value) => Number.isFinite(value) ? (value < 0.001 ? "<0.001" : value.toFixed(3)) : "—" },
                  { key: "spearmanHolmP", label: tr("순위 보정 p", "Rank adjusted p"), align: "right", fmt: (value) => Number.isFinite(value) ? (value < 0.001 ? "<0.001" : value.toFixed(3)) : "—" },
                ]}
                rows={result?.pairs || []}
                rowKey={(row) => `${row.left}-${row.right}-detail`}
                emptyText=""
              />
            </div>
          </details>
        )}
      </section>
    </>}
  </ToolPageShell>;
}
