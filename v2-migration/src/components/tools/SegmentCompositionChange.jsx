"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Chart from "@/utils/chartGlobals";
import CsvUploader from "@/components/CsvUploader";
import ToolPageShell from "@/components/ToolPageShell";
import SegmentRoleMapper from "@/components/data-import/SegmentRoleMapper";
import ResultActionCard from "@/components/ds/ResultActionCard";
import DataTable from "@/components/ds/DataTable";
import DownloadHub from "@/components/ds/DownloadHub";
import { useAppStore } from "@/store/useDataStore";
import { CHART_THEME, chartCommonOpts } from "@/utils/chartUtils";
import { csvBody, downloadCsv } from "@/utils/download";
import { fmtNum, fmtPct } from "@/utils/format";
import { buildSegmentPanel, PANEL_STATUS } from "@/lib/segment-composition/segmentPanel";
import { segmentMappingSignature } from "@/lib/segment-composition/mappingSignature";
import {
  compareDistribution, decomposeMixRate, netNewProfile, rankDimensions,
  DIMENSION_STATUS, SEGMENT_REASON,
} from "@/utils/segmentCompositionMath";

const TOOL_ID = "5-29";
const tx = (locale, ko, en) => (locale === "en" ? en : ko);

const EMPTY_MAPPING = { roles: { time: "", entity: [], scope: [], population: "", measures: {} }, dimensions: [] };

const STATUS_TONE = {
  [DIMENSION_STATUS.READY]: "neutral",
  [DIMENSION_STATUS.CAUTION]: "neutral",
  [DIMENSION_STATUS.INSUFFICIENT_DATA]: "bad",
  [DIMENSION_STATUS.INVALID_GRAIN]: "bad",
};

const statusLabel = (status, locale) => ({
  [DIMENSION_STATUS.READY]: tx(locale, "분석 가능", "Ready"),
  [DIMENSION_STATUS.CAUTION]: tx(locale, "주의", "Caution"),
  [DIMENSION_STATUS.INSUFFICIENT_DATA]: tx(locale, "표본 부족", "Insufficient data"),
  [DIMENSION_STATUS.INVALID_GRAIN]: tx(locale, "매핑 확인 필요", "Check mapping"),
}[status] || status);

// 사유 코드 → 문장. 표본 부족과 "변화 없음"이 같아 보이지 않게 항상 이유를 쓴다.
const reasonLabel = (reason, locale) => ({
  [SEGMENT_REASON.MISSING_PERIOD]: tx(locale, "비교할 두 기간 중 한쪽에 데이터가 없습니다", "One of the two periods has no data"),
  [SEGMENT_REASON.LOW_PERIOD_POPULATION]: tx(locale, "기간 전체 인원이 너무 적습니다", "Too few people in a period"),
  [SEGMENT_REASON.LOW_MEMBER_POPULATION]: tx(locale, "일부 값의 인원이 적어 변화가 흔들릴 수 있습니다", "Some values have small counts, so shifts are unstable"),
  [SEGMENT_REASON.NO_DENOMINATOR]: tx(locale, "전체 모수를 알 수 없는 구간이 있습니다", "Total population is unknown for part of the data"),
  [SEGMENT_REASON.NOT_EXHAUSTIVE]: tx(locale, "모든 사람이 어딘가에 속하는 축이 아니라 전체 구성 거리를 계산하지 않습니다", "Not an exhaustive axis, so overall distribution distance is not computed"),
  [SEGMENT_REASON.GRAIN_CONFLICT]: tx(locale, "같은 기간·단위에 서로 다른 모수가 적혀 있습니다", "Conflicting totals within one period and unit"),
  [SEGMENT_REASON.ESTIMATED_COUNTS]: tx(locale, "비율에서 되만든 인원수라 정확한 정수가 아닙니다", "Counts were rebuilt from rounded rates"),
  [SEGMENT_REASON.MEMBER_SUM_MISMATCH]: tx(locale, "값별 인원 합이 적어 둔 전체 인원과 다릅니다", "Member counts do not match the declared total"),
  [SEGMENT_REASON.MEMBER_ENTERED]: tx(locale, "이번 기간에 새로 나타난 값이 있습니다", "A value appears only in the later period"),
  [SEGMENT_REASON.MEMBER_EXITED]: tx(locale, "이번 기간에 사라진 값이 있습니다", "A value disappeared in the later period"),
  [SEGMENT_REASON.SINGLE_ENTITY]: tx(locale, "분석 단위가 하나뿐이라 단위 간 이동이 없습니다", "Only one analysis unit, so there is no movement between units"),
  [SEGMENT_REASON.ENTITY_ENTERED]: tx(locale, "새로 시작한 분석 단위가 있어 그 변화는 상호작용 항에 잡힙니다", "A new unit appears, so its change lands in the interaction term"),
  [SEGMENT_REASON.ENTITY_EXITED]: tx(locale, "종료된 분석 단위가 있습니다", "A unit ended during the comparison"),
  [SEGMENT_REASON.POPULATION_NOT_GROWN]: tx(locale, "전체 인원이 늘지 않아 순증 구간을 계산하지 않습니다", "The population did not grow, so the net-new slice is not computed"),
  [SEGMENT_REASON.NET_INCREASE_TOO_SMALL]: tx(locale, "증가분이 너무 작아 순증 구간 구성을 신뢰할 수 없습니다", "The increase is too small to profile"),
  [SEGMENT_REASON.NET_RATE_OUT_OF_RANGE]: tx(locale, "일부 값의 순증 비율이 0~100% 밖이라 해석할 수 없습니다", "Some net-new shares fall outside 0–100% and cannot be read"),
  [SEGMENT_REASON.MIX_RATE_UNAVAILABLE]: tx(locale, "전체 모수나 분석 단위가 없어 이동·내부 변화를 나눌 수 없습니다", "Without a total population or analysis unit, movement cannot be separated"),
}[reason] || reason);

const periodsOf = (rows, timeColumn) => {
  if (!timeColumn) return [];
  const values = new Set();
  rows.forEach((row) => {
    const value = String(row?.[timeColumn] ?? "").trim();
    if (value) values.add(value);
  });
  return [...values].sort();
};

export function buildCompositionChartData(distribution, locale) {
  const members = distribution.members.filter((member) => member.preShare != null || member.postShare != null);
  return {
    labels: [tx(locale, "이전", "Before"), tx(locale, "이후", "After")],
    datasets: members.map((member, index) => ({
      label: member.label,
      data: [(member.preShare ?? 0) * 100, (member.postShare ?? 0) * 100],
      // canvas는 CSS var()를 못 읽는다 — 반드시 getter가 준 리터럴을 넘긴다(§7).
      backgroundColor: CHART_THEME.colors[index % CHART_THEME.colors.length],
      borderWidth: 0,
    })),
  };
}

function CompositionChart({ distribution, locale, isDarkMode }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const data = useMemo(() => buildCompositionChartData(distribution, locale), [distribution, locale]);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    if (chartRef.current) chartRef.current.destroy();
    const base = chartCommonOpts();
    const chart = new Chart(canvasRef.current, {
      type: "bar",
      data,
      options: {
        ...base,
        indexAxis: "y",
        scales: {
          x: { stacked: true, min: 0, max: 100, ticks: { color: CHART_THEME.text, callback: (value) => `${value}%` }, grid: { color: CHART_THEME.grid } },
          y: { stacked: true, ticks: { color: CHART_THEME.text }, grid: { display: false } },
        },
      },
    });
    chartRef.current = chart;
    // 조건부 마운트 캔버스는 부모 레이아웃 전이라 최초 폭이 0이다(§7).
    const raf = requestAnimationFrame(() => chart.resize());
    return () => { cancelAnimationFrame(raf); chart.destroy(); if (chartRef.current === chart) chartRef.current = null; };
  }, [data, isDarkMode]);

  return <div className="chart-container" style={{ height: 220 }}>
    <canvas ref={canvasRef} role="img" aria-label={tx(locale, "기간별 구성 비중", "Composition share by period")} />
  </div>;
}

export default function SegmentCompositionChange({ locale = "ko", rows: rowsOverride, headers: headersOverride, analyzed: analyzedOverride } = {}) {
  const csvData = useAppStore((state) => state.csvData);
  const isStoreAnalyzed = useAppStore((state) => state.isGroupAnalyzed(TOOL_ID));
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  // 폴백 표현식을 그대로 두면 렌더마다 새 배열이 되어 아래 무거운 useMemo가 전부
  // 다시 돈다(20만 행 패널 빌드가 매 렌더). 참조를 먼저 고정한다.
  const rows = useMemo(() => rowsOverride || csvData?.raw || [], [rowsOverride, csvData?.raw]);
  const headers = useMemo(
    () => headersOverride || csvData?.headers || (rows[0] ? Object.keys(rows[0]) : []),
    [headersOverride, csvData?.headers, rows],
  );
  const hasRows = rows.length > 0;
  const gateOpen = analyzedOverride ?? isStoreAnalyzed;

  const [mapping, setMapping] = useState(EMPTY_MAPPING);
  const [draft, setDraft] = useState({ pre: "", post: "", scopeValue: "", dimensionId: "", memberId: "" });
  const [applied, setApplied] = useState(null);

  const periods = useMemo(() => periodsOf(rows, mapping.roles.time), [rows, mapping.roles.time]);
  const signature = useMemo(
    () => segmentMappingSignature({ fileName: csvData?.fileName || "", rowCount: rows.length, ...mapping }),
    [csvData?.fileName, rows.length, mapping],
  );

  // 선언이 바뀌면 이전 결과를 그대로 두지 않는다 — 화면과 근거가 어긋나는 상태가 제일 나쁘다.
  const active = gateOpen && applied?.signature === signature ? applied : null;

  const panel = useMemo(() => {
    if (!active) return null;
    return buildSegmentPanel({ rows, roles: mapping.roles, dimensions: mapping.dimensions });
  }, [active, rows, mapping.roles, mapping.dimensions]);

  const analysis = useMemo(() => {
    if (!panel || !active) return null;
    const selector = { pre: [active.pre], post: [active.post] };
    const scopeFilter = active.scopeColumn && active.scopeValue ? { [active.scopeColumn]: active.scopeValue } : null;
    const ranked = rankDimensions({ panel, ...selector, scopeFilter });
    const selected = ranked.find((entry) => entry.dimensionId === active.dimensionId) || ranked[0] || null;
    if (!selected) return { ranked, selected: null, decomposition: null, netNew: null };
    const distribution = compareDistribution({ panel, dimensionId: selected.dimensionId, ...selector, scopeFilter });
    const topMember = active.memberId
      || [...distribution.members].sort((a, b) => Math.abs(b.shareDelta ?? 0) - Math.abs(a.shareDelta ?? 0))[0]?.memberId;
    return {
      ranked,
      selected: distribution,
      memberId: topMember,
      decomposition: topMember ? decomposeMixRate({ panel, dimensionId: selected.dimensionId, memberId: topMember, ...selector, scopeFilter }) : null,
      netNew: netNewProfile(distribution),
    };
  }, [panel, active]);

  const canRun = Boolean(mapping.roles.time && mapping.dimensions.length && draft.pre && draft.post && draft.pre !== draft.post);
  const run = () => {
    if (!canRun) return;
    setApplied({
      signature,
      pre: draft.pre,
      post: draft.post,
      scopeColumn: mapping.roles.scope?.[0] || "",
      scopeValue: draft.scopeValue,
      dimensionId: draft.dimensionId,
      memberId: draft.memberId,
    });
  };

  const scopeValues = useMemo(() => {
    const column = mapping.roles.scope?.[0];
    if (!column) return [];
    return [...new Set(rows.map((row) => String(row?.[column] ?? "").trim()).filter(Boolean))].sort();
  }, [rows, mapping.roles.scope]);

  const selected = analysis?.selected || null;
  const topMember = selected?.members
    ? [...selected.members].sort((a, b) => Math.abs(b.shareDelta ?? 0) - Math.abs(a.shareDelta ?? 0))[0]
    : null;

  const download = analysis ? <DownloadHub toolId={TOOL_ID} locale={locale} manifest={{
    toolId: TOOL_ID,
    version: "segment_composition_v1",
    pre: active.pre,
    post: active.post,
    scope: active.scopeColumn ? { [active.scopeColumn]: active.scopeValue || null } : null,
    dimensions: mapping.dimensions.map((dimension) => dimension.id),
    warnings: [...(selected?.reasons || []), ...(analysis.decomposition?.reasons || []), ...(analysis.netNew?.reasons || [])],
    source: "browser",
  }} items={[
    {
      label: tx(locale, "축 랭킹 CSV", "Axis ranking CSV"),
      analyticsType: "segment_axis_ranking",
      onSelect: () => downloadCsv(csvBody(
        ["dimension", "status", "total_variation", "pre_population", "post_population", "reasons"],
        analysis.ranked.map((entry) => [entry.label, entry.status, entry.totalVariation ?? "", entry.periods.pre.population, entry.periods.post.population, entry.reasons.join(" ")]),
      ), "segment_composition_axes"),
    },
    ...(selected ? [{
      label: tx(locale, "구성 변화 CSV", "Composition change CSV"),
      analyticsType: "segment_distribution",
      onSelect: () => downloadCsv(csvBody(
        ["member", "pre_count", "post_count", "pre_share", "post_share", "share_delta_pp", "is_new", "is_lost"],
        selected.members.map((member) => [member.label, member.preCount ?? "", member.postCount ?? "", member.preShare ?? "", member.postShare ?? "", member.shareDelta == null ? "" : member.shareDelta * 100, member.isNew, member.isLost]),
      ), "segment_composition_members"),
    }] : []),
    ...(analysis.decomposition?.available ? [{
      label: tx(locale, "이동·내부 변화 CSV", "Mix and rate CSV"),
      analyticsType: "segment_mix_rate",
      onSelect: () => downloadCsv(csvBody(
        ["entity", "kind", "pre_weight", "post_weight", "pre_member_rate", "post_member_rate", "mix", "rate", "interaction", "total"],
        analysis.decomposition.entities.map((entity) => [entity.entityKey, entity.kind, entity.wPre, entity.wPost, entity.rPre, entity.rPost, entity.mix, entity.rate, entity.interaction, entity.total]),
      ), "segment_composition_mix_rate"),
    }] : []),
  ]} /> : null;

  /* 엑셀에서 계산을 되짚을 수 있게 수식 시트를 함께 내보낸다(product-ssot §5.5.1).
   * 특히 Mix/Rate는 "합이 정말 전체 변화와 같은가"를 사용자가 직접 확인할 수 있어야
   * 신뢰가 생긴다 — 엔진 값과 수식 값의 차이 열을 나란히 둔다. */
  const workbookExport = () => {
    const members = selected?.members || [];
    const entities = analysis?.decomposition?.available ? analysis.decomposition.entities : [];
    const tables = [{
      name: "DISTRIBUTION",
      title: tx(locale, "기간별 구성 비중 계산", "Composition share by period"),
      note: tx(locale, "인원수에서 비중을 다시 계산해 엔진 값과 비교합니다.", "Recomputes shares from head counts and compares them with engine values."),
      rows: [
        ["member", "pre_count", "post_count", "pre_population", "post_population", "pre_share_engine", "post_share_engine", "pre_share_formula", "post_share_formula", "share_delta_formula"],
        ...members.map((member, index) => {
          const row = index + 2;
          return [
            member.label, member.preCount ?? "", member.postCount ?? "",
            selected.periods.pre.population, selected.periods.post.population,
            member.preShare ?? "", member.postShare ?? "",
            { formula: `=IFERROR(B${row}/D${row},"")`, numberFormat: "0.0%" },
            { formula: `=IFERROR(C${row}/E${row},"")`, numberFormat: "0.0%" },
            { formula: `=IFERROR(I${row}-H${row},"")`, numberFormat: "0.0%" },
          ];
        }),
      ],
    }];
    if (entities.length) {
      tables.push({
        name: "MIX_RATE",
        title: tx(locale, "단위 간 이동·내부 변화 분해", "Mix and rate decomposition"),
        note: tx(locale, "세 항의 합이 전체 변화와 같은지 수식으로 확인할 수 있습니다.", "Check in the sheet that the three terms add up to the total change."),
        rows: [
          ["entity", "w_pre", "w_post", "r_pre", "r_post", "mix_engine", "rate_engine", "interaction_engine", "mix_formula", "rate_formula", "interaction_formula", "total_formula"],
          ...entities.map((entity, index) => {
            const row = index + 2;
            return [
              entity.entityKey, entity.wPre, entity.wPost, entity.rPre, entity.rPost,
              entity.mix, entity.rate, entity.interaction,
              { formula: `=(C${row}-B${row})*D${row}`, numberFormat: "0.00%" },
              { formula: `=B${row}*(E${row}-D${row})`, numberFormat: "0.00%" },
              { formula: `=(C${row}-B${row})*(E${row}-D${row})`, numberFormat: "0.00%" },
              { formula: `=I${row}+J${row}+K${row}`, numberFormat: "0.00%" },
            ];
          }),
        ],
      });
    }
    return { calculationMode: "exact_after_preprocessing", calculationTables: tables };
  };

  const conclusion = () => {
    if (!selected) return tx(locale, "비교할 세그먼트 축이 없습니다.", "No segment axis to compare.");
    if (selected.totalVariation == null) {
      return tx(locale,
        `${selected.label} 축은 전체 구성 거리를 계산할 수 없어 값별 변화만 봅니다.`,
        `${selected.label} cannot be summarized as one distribution distance, so only per-value change is shown.`);
    }
    const direction = (topMember?.shareDelta ?? 0) >= 0 ? tx(locale, "늘었습니다", "grew") : tx(locale, "줄었습니다", "shrank");
    return tx(locale,
      `${selected.label} 구성이 ${fmtPct(selected.totalVariation)} 움직였고, ${topMember?.label} 비중이 ${fmtPct(Math.abs(topMember?.shareDelta ?? 0))} ${direction}.`,
      `${selected.label} composition shifted by ${fmtPct(selected.totalVariation)}; ${topMember?.label} ${direction} by ${fmtPct(Math.abs(topMember?.shareDelta ?? 0))}.`);
  };

  const points = () => {
    if (!analysis) return [];
    const list = [];
    const decomposition = analysis.decomposition;
    if (decomposition?.available) {
      const mixShare = Math.abs(decomposition.totals.mix);
      const rateShare = Math.abs(decomposition.totals.rate);
      list.push(mixShare >= rateShare
        ? tx(locale, "변화의 큰 쪽은 분석 단위 간 이동입니다. 같은 단위의 구성보다 어디에 볼륨이 실렸는지가 더 움직였습니다.", "Most of the change came from movement between units rather than change inside them.")
        : tx(locale, "변화의 큰 쪽은 단위 내부 구성 변화입니다. 볼륨 배분보다 각 단위가 데려온 사람의 구성이 달라졌습니다.", "Most of the change came from inside the units rather than from how volume was split."));
    }
    if (analysis.netNew?.available) {
      const netTop = [...analysis.netNew.members].sort((a, b) => (b.netCount ?? 0) - (a.netCount ?? 0))[0];
      if (netTop && netTop.interpretable) {
        list.push(tx(locale,
          `늘어난 ${fmtNum(analysis.netNew.increase)}명 중 ${netTop.label}가 ${fmtPct(netTop.netRate)}입니다. 두 기간을 뺀 산술 추정치이지 증분 유저의 인과 프로필이 아닙니다.`,
          `Of the ${fmtNum(analysis.netNew.increase)} added, ${netTop.label} accounts for ${fmtPct(netTop.netRate)}. This is arithmetic between two periods, not a causal profile of incremental users.`));
      }
    }
    (selected?.reasons || []).forEach((reason) => list.push(reasonLabel(reason, locale)));
    return list;
  };

  const rankColumns = [
    { key: "label", label: tx(locale, "세그먼트 축", "Segment axis"), align: "left" },
    { key: "status", label: tx(locale, "증거 상태", "Evidence"), align: "left", fmt: (value) => statusLabel(value, locale) },
    { key: "totalVariation", label: tx(locale, "구성 이동 크기", "Distribution shift"), align: "right", fmt: (value) => (value == null ? tx(locale, "계산 안 함", "Not computed") : fmtPct(value)) },
    { key: "prePopulation", label: tx(locale, "이전 인원", "Before"), align: "right", fmt: (value) => fmtNum(value) },
    { key: "postPopulation", label: tx(locale, "이후 인원", "After"), align: "right", fmt: (value) => fmtNum(value) },
  ];

  const memberColumns = [
    { key: "label", label: tx(locale, "값", "Value"), align: "left" },
    { key: "preCount", label: tx(locale, "이전 인원", "Before"), align: "right", fmt: (value) => (value == null ? "—" : fmtNum(value)) },
    { key: "postCount", label: tx(locale, "이후 인원", "After"), align: "right", fmt: (value) => (value == null ? "—" : fmtNum(value)) },
    { key: "preShare", label: tx(locale, "이전 비중", "Before %"), align: "right", fmt: (value) => (value == null ? "—" : fmtPct(value)) },
    { key: "postShare", label: tx(locale, "이후 비중", "After %"), align: "right", fmt: (value) => (value == null ? "—" : fmtPct(value)) },
    { key: "shareDelta", label: tx(locale, "변화", "Change"), align: "right", fmt: (value) => (value == null ? "—" : `${value >= 0 ? "+" : "−"}${fmtPct(Math.abs(value))}`) },
  ];

  const mixColumns = [
    { key: "entityKey", label: tx(locale, "분석 단위", "Unit"), align: "left" },
    { key: "kind", label: tx(locale, "상태", "State"), align: "left", fmt: (value) => (value === "entry" ? tx(locale, "신규", "Entered") : value === "exit" ? tx(locale, "종료", "Exited") : tx(locale, "유지", "Stable")) },
    { key: "mix", label: tx(locale, "단위 간 이동", "Mix"), align: "right", fmt: (value) => fmtPct(value) },
    { key: "rate", label: tx(locale, "단위 내부 변화", "Rate"), align: "right", fmt: (value) => fmtPct(value) },
    { key: "interaction", label: tx(locale, "상호작용", "Interaction"), align: "right", fmt: (value) => fmtPct(value) },
    { key: "total", label: tx(locale, "합", "Total"), align: "right", fmt: (value) => fmtPct(value) },
  ];

  return <ToolPageShell
    toolId={TOOL_ID}
    title={tx(locale, "구성 변화 분석", "Composition change")}
    locale={locale}
    summary={<p>{tx(locale,
      "전체 지표가 움직였을 때 어떤 사용자 구성이 바뀌었는지 보고, 그 변화가 분석 단위 간 볼륨 이동인지 단위 내부 변화인지 나눕니다. 관측된 분해이지 원인 확정이 아닙니다.",
      "See which audience composition changed when an overall metric moved, and split that change into movement between units and change inside them. This is an observed decomposition, not a cause.")}</p>}
    toc={[
      { id: "segment-composition-result", title: tx(locale, "결론", "Conclusion") },
      { id: "segment-composition-ranking", title: tx(locale, "변화한 축", "Axes") },
      { id: "segment-composition-detail", title: tx(locale, "선택 축 상세", "Detail") },
    ]}
  >
    {!hasRows && <section className="block" aria-labelledby="segment-composition-empty">
      <h2 id="segment-composition-empty" className="section-title">{tx(locale, "데이터를 준비하세요", "Prepare your data")}</h2>
      <p>{tx(locale,
        "기간과 세그먼트별 인원수가 있는 CSV를 올려 주세요. 값별 인원수(long)든 값마다 컬럼이 나뉜 형태(wide)든, 비율과 전체 모수를 함께 준 형태든 괜찮습니다. 파일은 이 브라우저에서만 처리됩니다.",
        "Upload a CSV with periods and per-segment head counts. Long, wide, or rates with a total column all work. The file is processed only in this browser.")}</p>
      <CsvUploader toolId={TOOL_ID} locale={locale} />
    </section>}

    {hasRows && <section className="block" aria-labelledby="segment-composition-mapping">
      <h2 id="segment-composition-mapping" className="section-title">{tx(locale, "데이터·역할 매핑", "Data and roles")}</h2>
      <SegmentRoleMapper
        headers={headers}
        rows={rows}
        value={mapping}
        onChange={setMapping}
        quality={panel?.quality || null}
        locale={locale}
      />
    </section>}

    {hasRows && <section className="block" aria-labelledby="segment-composition-compare">
      <h2 id="segment-composition-compare" className="section-title">{tx(locale, "비교 조건", "Comparison")}</h2>
      <div className="form-row">
        <label>{tx(locale, "이전 기간", "Earlier period")}
          <select value={draft.pre} onChange={(event) => setDraft((value) => ({ ...value, pre: event.target.value }))}>
            <option value="">{tx(locale, "선택", "Select")}</option>
            {periods.map((period) => <option key={period} value={period}>{period}</option>)}
          </select>
        </label>
        <label>{tx(locale, "이후 기간", "Later period")}
          <select value={draft.post} onChange={(event) => setDraft((value) => ({ ...value, post: event.target.value }))}>
            <option value="">{tx(locale, "선택", "Select")}</option>
            {periods.map((period) => <option key={period} value={period}>{period}</option>)}
          </select>
        </label>
        {scopeValues.length ? <label>{tx(locale, "경쟁 범위", "Scope")}
          <select value={draft.scopeValue} onChange={(event) => setDraft((value) => ({ ...value, scopeValue: event.target.value }))}>
            <option value="">{tx(locale, "전체", "All")}</option>
            {scopeValues.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label> : null}
        <button type="button" className="btn primary" disabled={!canRun} onClick={run}>{tx(locale, "분석하기", "Analyze")}</button>
      </div>
      {!gateOpen ? <p className="muted">{tx(locale, "매핑을 확인한 뒤 업로드 화면의 ‘데이터 분석하기’를 눌러 주세요.", "Confirm the mapping, then choose Analyze data on the upload panel.")}</p> : null}
      {gateOpen && !canRun ? <p className="muted">{tx(locale, "기간 컬럼·세그먼트 축·서로 다른 두 기간을 고르면 분석할 수 있습니다.", "Pick a period column, at least one axis, and two different periods.")}</p> : null}
    </section>}

    {analysis && selected ? <>
      <section className="block" id="segment-composition-result">
        <ResultActionCard
          locale={locale}
          toolId={TOOL_ID}
          tone={STATUS_TONE[selected.status] || "neutral"}
          headline={conclusion()}
          points={points()}
          stats={[
            { label: tx(locale, "이전 인원", "Before"), value: fmtNum(selected.periods.pre.population) },
            { label: tx(locale, "이후 인원", "After"), value: fmtNum(selected.periods.post.population) },
            { label: tx(locale, "증거 상태", "Evidence"), value: statusLabel(selected.status, locale) },
          ]}
          download={download}
          workbookExport={workbookExport}
        />
      </section>

      <section className="block" id="segment-composition-ranking">
        <h2 className="section-title">{tx(locale, "변화한 축", "Which axis moved")}</h2>
        <DataTable
          columns={rankColumns}
          rows={analysis.ranked.map((entry) => ({
            label: entry.label,
            status: entry.status,
            totalVariation: entry.totalVariation,
            prePopulation: entry.periods.pre.population,
            postPopulation: entry.periods.post.population,
          }))}
          rowKey={(row) => row.label}
          ariaLabel={tx(locale, "세그먼트 축 랭킹", "Segment axis ranking")}
        />
        <p className="muted">{tx(locale,
          "합성 점수를 만들지 않고 증거 상태 → 구성 이동 크기 → 작은 쪽 인원 순으로 정렬합니다.",
          "Ranked by evidence state, then shift size, then the smaller population — no composite score.")}</p>
      </section>

      <section className="block" id="segment-composition-detail">
        <h2 className="section-title">{selected.label}</h2>
        <CompositionChart distribution={selected} locale={locale} isDarkMode={isDarkMode} />
        <DataTable
          columns={memberColumns}
          rows={selected.members}
          rowKey={(row) => row.memberId}
          ariaLabel={tx(locale, "값별 구성 변화", "Composition change by value")}
        />
        {analysis.decomposition?.available ? <>
          <h3 className="section-title">{tx(locale, "이동인가, 내부 변화인가", "Movement or internal change")}</h3>
          <DataTable
            columns={mixColumns}
            rows={analysis.decomposition.entities}
            rowKey={(row) => row.entityKey}
            ariaLabel={tx(locale, "분석 단위별 이동·내부 변화 분해", "Mix and rate decomposition by unit")}
          />
          <p className="muted">{tx(locale,
            `세 항의 합이 전체 변화 ${fmtPct(analysis.decomposition.totals.delta)}와 정확히 같습니다(잔차 없음).`,
            `The three terms add up exactly to the total change of ${fmtPct(analysis.decomposition.totals.delta)} — no residual.`)}</p>
        </> : <p className="muted">{(analysis.decomposition?.reasons || []).map((reason) => reasonLabel(reason, locale)).join(" · ")}</p>}
      </section>

      <section className="block" aria-labelledby="segment-composition-limits">
        <h2 id="segment-composition-limits" className="section-title">{tx(locale, "이 결과로 말할 수 없는 것", "What this cannot say")}</h2>
        <ul>
          <li>{tx(locale, "구성이 바뀐 이유는 이 분해로 알 수 없습니다. 무엇이 얼마나 움직였는지까지입니다.", "This decomposition does not say why the composition changed — only what moved and by how much.")}</li>
          <li>{tx(locale, "순증 구간 구성은 두 기간을 뺀 추정치이며, 증분 유저를 실제로 관측한 값이 아닙니다.", "The net-new profile is arithmetic between two periods, not an observation of incremental users.")}</li>
          <li>{tx(locale, "개입 효과를 확인하려면 증분 분석이나 실험으로 넘어가야 합니다.", "To test an intervention, move on to incrementality analysis or an experiment.")}</li>
        </ul>
      </section>
    </> : null}
  </ToolPageShell>;
}
