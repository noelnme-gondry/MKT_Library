"use client";

import React, { useMemo } from "react";
import CsvUploader from "@/components/CsvUploader";
import ToolPageShell from "@/components/ToolPageShell";
import DataTable from "@/components/ds/DataTable";
import { useAppStore } from "@/store/useDataStore";
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
  const byDate = new Map();
  rows.forEach((row) => {
    const date = String(row.date || "").trim();
    const channel = String(row.channel || row.campaign_name || "").trim();
    const cost = Number(String(row.cost ?? row.spend ?? "").replaceAll(",", ""));
    if (!date || !channel || !Number.isFinite(cost)) return;
    const point = byDate.get(date) || {};
    point[channel] = (point[channel] || 0) + cost;
    byDate.set(date, point);
  });
  const channels = [...new Set([...byDate.values()].flatMap((point) => Object.keys(point)))].sort();
  const matrix = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, point]) => channels.map((channel) => point[channel] || 0));
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
  const copy = verdict === "ok" ? tr("현재 지출 패턴에서는 심한 중복 움직임이 보이지 않습니다. 그래도 연관은 인과가 아니므로 MMM 결과는 실험·홀드아웃과 함께 해석하세요.", "The spend pattern has no severe overlap signal. Correlation is still not causation; interpret MMM with experiments or holdouts.") : verdict === "warn" || verdict === "severe" ? tr("채널별 기여도를 숫자로 나누기 전에, 같이 움직인 채널을 분리해 변동시킨 기간을 확보하세요. 이 상태의 MMM 계수는 배분 근거로 쓰기 어렵습니다.", "Before dividing contribution by channel, create periods where the paired channels move independently. MMM coefficients in this state are weak evidence for allocation.") : tr("채널 수와 공통 기간이 부족합니다. 최소 2개 채널, 채널 수보다 3개 이상 많은 날짜가 필요합니다.", "There are not enough channels or common periods. Use at least two channels and at least three more dates than channels.");
  const vifRows = result?.vif ? result.vif.variableIndices.map((index, vifIndex) => ({ channel: result.channels[index], vif: result.vif.vif[vifIndex] })) : [];
  return <ToolPageShell toolId="5-25" locale={locale} titleLevel={0} title={tr("VIF 다중공선성 점검", "VIF Multicollinearity Check")} summary={<p>{tr("MMM을 돌리기 전에 채널별 지출이 서로 너무 같이 움직였는지 확인합니다. 숫자는 진단 신호이며, 공선성을 해결한 인과 추정은 아닙니다.", "Check whether channel spend moved too tightly together before running MMM. This is a diagnostic signal, not a causal fix.")}</p>}>
    <section className="block diagnostic-tool__rules"><h2 className="section-title">{tr("VIF 해석", "Reading VIF")}</h2><p>{tr(`VIF ${DIAG_THRESHOLDS.vifWarn} 미만은 관찰상 양호, ${DIAG_THRESHOLDS.vifWarn} 이상은 주의, ${DIAG_THRESHOLDS.vifSevere} 이상 또는 계산 불가는 심각으로 표시합니다. 비용·채널·날짜만 있으면 됩니다.`, `Below ${DIAG_THRESHOLDS.vifWarn} is observationally OK; ${DIAG_THRESHOLDS.vifWarn}+ is a warning; ${DIAG_THRESHOLDS.vifSevere}+ or an uncomputable value is severe. You only need date, channel, and spend.`)}</p></section>
    <CsvUploader toolId="5-25" locale={locale} />
    {analyzed && <><section className={`block diagnostic-tool__verdict diagnostic-tool__verdict--${verdict || "unknown"}`}><h2 className="section-title">{tr("판정", "Verdict")}</h2><strong>{verdict === "ok" ? tr("MMM 진행 가능 · 해석은 신중하게", "MMM can proceed · interpret cautiously") : verdict === "warn" ? tr("주의 · 채널 분리 변동 권장", "Warning · create independent variation") : verdict === "severe" ? tr("중단 · 현재 데이터로 기여도 분리 금지", "Stop · do not separate contribution") : tr("데이터 추가 필요", "Need more data")}</strong><p>{copy}</p></section><section className="block"><h2 className="section-title">{tr("채널별 VIF", "VIF by channel")}</h2><DataTable columns={[{ key: "channel", label: tr("채널", "Channel") }, { key: "vif", label: "VIF", align: "right", fmt: (value) => Number.isFinite(value) ? value.toFixed(2) : "∞" }]} rows={vifRows} rowKey={(row) => row.channel} emptyText={tr("계산 가능한 VIF가 없습니다.", "No computable VIF values.")} /></section><section className="block"><h2 className="section-title">{tr("가장 함께 움직인 채널쌍", "Most correlated channel pairs")}</h2><DataTable columns={[{ key: "left", label: tr("채널 A", "Channel A") }, { key: "right", label: tr("채널 B", "Channel B") }, { key: "correlation", label: tr("상관", "Correlation"), align: "right", fmt: (value) => Number.isFinite(value) ? value.toFixed(2) : "—" }]} rows={result?.pairs || []} rowKey={(row) => `${row.left}-${row.right}`} emptyText={tr("비교할 쌍이 없습니다.", "No pairs to compare.")} /></section></>}
  </ToolPageShell>;
}
