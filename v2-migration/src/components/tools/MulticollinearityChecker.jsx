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
import { computeVif, DIAG_THRESHOLDS } from "@/utils/modelDiagnostics";

function pearson(a, b) {
  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;
  const top = a.reduce((sum, value, index) => sum + (value - meanA) * (b[index] - meanB), 0);
  const bottom = Math.sqrt(a.reduce((sum, value) => sum + (value - meanA) ** 2, 0) * b.reduce((sum, value) => sum + (value - meanB) ** 2, 0));
  return bottom > 0 ? top / bottom : null;
}

function analyze(rows) {
  const panel = buildVifSpendPanel(rows.map((row) => ({
    date: row.date,
    entity: row.channel || row.campaign_name,
    cost: row.cost ?? row.spend,
  })));
  const channels = panel.entities;
  const matrix = panel.matrix;
  if (channels.length < 2 || matrix.length < channels.length + 3) return { channels, matrix, vif: null, pairs: [] };
  const vif = computeVif(matrix);
  const pairs = [];
  for (let i = 0; i < channels.length; i += 1) for (let j = i + 1; j < channels.length; j += 1) pairs.push({ left: channels[i], right: channels[j], correlation: pearson(matrix.map((row) => row[i]), matrix.map((row) => row[j])) });
  return { channels, matrix, vif, pairs: pairs.sort((a, b) => Math.abs(b.correlation || 0) - Math.abs(a.correlation || 0)) };
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
        download={<DownloadHub toolId="5-25" locale={locale} label={tr("결과 받기", "Download results")} items={[{ icon: "⬇", analyticsType: "csv", label: tr("VIF 결과 (CSV)", "VIF results (CSV)"), desc: tr("채널별 VIF 원자료", "Channel-level VIF values"), onSelect: downloadVifCsv }]} />}
      /></div>
      <section className="block"><h2 className="section-title">{tr("채널별 VIF", "VIF by channel")}</h2><DataTable columns={[{ key: "channel", label: tr("채널", "Channel") }, { key: "vif", label: "VIF", align: "right", fmt: (value) => Number.isFinite(value) ? value.toFixed(2) : value === Infinity ? "∞" : tr("계산 불가", "Not computable") }]} rows={vifRows} rowKey={(row) => row.channel} emptyText={tr("계산 가능한 VIF가 없습니다.", "No computable VIF values.")} /></section>
      <section className="block"><h2 className="section-title">{tr("가장 함께 움직인 채널쌍", "Most correlated channel pairs")}</h2><DataTable columns={[{ key: "left", label: tr("채널 A", "Channel A") }, { key: "right", label: tr("채널 B", "Channel B") }, { key: "correlation", label: tr("상관", "Correlation"), align: "right", fmt: (value) => Number.isFinite(value) ? value.toFixed(2) : "—" }]} rows={result?.pairs || []} rowKey={(row) => `${row.left}-${row.right}`} emptyText={tr("비교할 쌍이 없습니다.", "No pairs to compare.")} /></section>
    </>}
  </ToolPageShell>;
}
