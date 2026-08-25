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
import { autoDeclare, defaultPeriods } from "@/lib/segment-composition/autoDeclare";
import { segmentMappingSignature } from "@/lib/segment-composition/mappingSignature";
import {
  compareDistribution, decomposeMixRate, netNewProfile, rankDimensions,
  DIMENSION_STATUS, SEGMENT_REASON,
} from "@/utils/segmentCompositionMath";
import {
  spendShiftFingerprint, costVolumeQuadrants, scanPeriodShifts, repeatabilityByMagnitude,
  COST_VOLUME_QUADRANT, OPS_REASON,
} from "@/utils/segmentOpsMath";
import {
  evaluateCausalEligibility, eventStudy, placeboTest, mediationAvailability,
  CAUSAL_REASON, CAUSAL_STATUS,
} from "@/utils/segmentCausalMath";

const TOOL_ID = "5-29";
const tx = (locale, ko, en) => (locale === "en" ? en : ko);

const EMPTY_MAPPING = { roles: { time: "", entity: [], scope: [], population: "", measures: {} }, dimensions: [] };

const CHECK_LABEL = {
  ko: {
    cutoff_declared: "개입 시점을 선언했다",
    cutoff_in_range: "개입 시점이 관측 기간 안에 있다",
    enough_pre: "개입 전 기간이 충분하다",
    enough_post: "개입 후 기간이 충분하다",
    has_treated: "처리 범위 단위가 충분하다",
    has_control: "대조 범위가 있다",
    enough_clusters: "견고 표준오차를 쓸 만큼 단위가 있다",
    outcome_varies: "결과변수가 움직인다",
  },
  en: {
    cutoff_declared: "An intervention date is declared",
    cutoff_in_range: "The date falls inside the observed range",
    enough_pre: "Enough periods before the intervention",
    enough_post: "Enough periods after the intervention",
    has_treated: "Enough treated units",
    has_control: "A control scope exists",
    enough_clusters: "Enough units for robust standard errors",
    outcome_varies: "The outcome actually varies",
  },
};

const checkLabel = (id, locale) => (CHECK_LABEL[locale] || CHECK_LABEL.ko)[id] || id;

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
  [OPS_REASON.NO_SPEND]: tx(locale, "비용 컬럼이 없거나 0이라 비용 흐름과 함께 볼 수 없습니다", "No usable spend column, so spend flow cannot be compared"),
  [OPS_REASON.LOW_ENTITY_POPULATION]: tx(locale, "일부 단위의 모수가 작아 단가가 크게 흔들립니다", "Some units have small populations, so unit cost is unstable"),
  [OPS_REASON.NOT_ENOUGH_PERIODS]: tx(locale, "기간이 적어 반복 여부를 말할 수 없습니다", "Too few periods to say whether this repeats"),
  [OPS_REASON.MULTIPLE_COMPARISONS]: tx(locale, "여러 기간을 전부 훑어 가장 큰 변동을 고른 결과입니다. 우연히 커 보일 수 있습니다", "This picks the largest move after scanning every period pair, so some of it can be chance"),
  [OPS_REASON.DIRECTION_MIXED]: tx(locale, "방향이 갈립니다 — 한쪽으로 몰아 읽지 마세요", "Directions disagree — do not read it as one trend"),
  [CAUSAL_REASON.NO_CUTOFF]: tx(locale, "개입 시점을 아직 고르지 않았습니다", "No intervention date picked yet"),
  [CAUSAL_REASON.CUTOFF_OUT_OF_RANGE]: tx(locale, "개입 시점이 관측 기간 밖입니다", "The intervention date is outside the observed range"),
  [CAUSAL_REASON.NOT_ENOUGH_PRE]: tx(locale, "개입 전 기간이 모자랍니다", "Not enough periods before the intervention"),
  [CAUSAL_REASON.NOT_ENOUGH_POST]: tx(locale, "개입 후 기간이 모자랍니다", "Not enough periods after the intervention"),
  [CAUSAL_REASON.NO_TREATED]: tx(locale, "처리 범위로 선언한 단위가 부족합니다", "Too few units declared as treated"),
  [CAUSAL_REASON.NO_CONTROL]: tx(locale, "대조 범위가 없습니다. 대조군 없이 전후 차이를 개입 효과라고 부를 수 없습니다", "No control scope. Without a control group a before-after difference is not an intervention effect"),
  [CAUSAL_REASON.TOO_FEW_CLUSTERS]: tx(locale, "단위가 너무 적어 견고 표준오차를 믿을 수 없습니다", "Too few units for the robust standard errors to be trustworthy"),
  [CAUSAL_REASON.FEW_CLUSTERS]: tx(locale, "단위가 적어 구간을 넓게 읽어야 합니다", "Few units — read the intervals as wider than they look"),
  [CAUSAL_REASON.UNBALANCED_PANEL]: tx(locale, "일부 단위·기간 칸이 비어 있습니다", "Some unit-period cells are missing"),
  [CAUSAL_REASON.NO_OUTCOME_VARIANCE]: tx(locale, "결과변수가 전혀 움직이지 않습니다", "The outcome does not vary at all"),
  [CAUSAL_REASON.NOT_ESTIMABLE]: tx(locale, "자유도가 모자라 추정할 수 없습니다", "Not estimable — not enough degrees of freedom"),
  [CAUSAL_REASON.PRE_TREND_VIOLATED]: tx(locale, "개입 전부터 두 군의 격차가 이미 벌어지고 있었습니다. 평행 추세 가정이 깨져 이 결과를 효과로 읽을 수 없습니다", "The gap was already widening before the intervention. Parallel trends fails, so this cannot be read as an effect"),
  [CAUSAL_REASON.PLACEBO_FAILED]: tx(locale, "가짜 개입 시점에서도 효과가 나왔습니다. 설계가 개입이 아닌 다른 것을 잡고 있습니다", "A fake intervention date also produced an effect, so the design is capturing something other than the intervention"),
  [CAUSAL_REASON.MEDIATION_NOT_IDENTIFIED]: tx(locale, "매개 경로는 임의의 세그먼트 CSV로 식별할 수 없어 제공하지 않습니다", "Mediation paths cannot be identified from arbitrary segment CSVs, so they are not offered"),
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

  /* 기본값은 "다 잡아서 다 돌린다"이다. 마케터가 세그먼트를 보러 와서 매핑을 먼저
   * 공부해야 하는 화면은 쓸 수 없다 — 자동으로 선언하고, 틀린 것만 고치게 한다.
   * 사용자가 매퍼를 한 번이라도 건드리면 그때부터 자동 선언은 멈춘다. */
  const auto = useMemo(() => autoDeclare({ headers, rows }), [headers, rows]);
  const [manualMapping, setManualMapping] = useState(null);
  // 참조를 고정하지 않으면 렌더마다 새 객체가 되어 아래 무거운 패널 빌드가 매번 다시 돈다.
  const mapping = useMemo(
    () => manualMapping || { roles: { ...EMPTY_MAPPING.roles, ...auto.roles }, dimensions: auto.dimensions },
    [manualMapping, auto],
  );
  const setMapping = (next) => setManualMapping(next);
  const [draft, setDraft] = useState({ pre: "", post: "", scopeValue: "", dimensionId: "", memberId: "" });
  // 인과 확인은 탐색 토글이 아니라 **설계 선언**이다. 매핑 서명과 분리해 두되,
  // 선언이 비어 있으면 섹션 자체가 열리지 않는다.
  const [design, setDesign] = useState({ cutoff: "", treated: "", control: "" });

  const periods = useMemo(() => periodsOf(rows, mapping.roles.time), [rows, mapping.roles.time]);
  const signature = useMemo(
    () => segmentMappingSignature({ fileName: csvData?.fileName || "", rowCount: rows.length, ...mapping }),
    [csvData?.fileName, rows.length, mapping],
  );

  // 선언이 바뀌면 이전 결과를 그대로 두지 않는다 — 화면과 근거가 어긋나는 상태가 제일 나쁘다.
  const autoCountColumn = auto.notes.find((note) => note.role === "count")?.column || "";
  const autoPeriods = useMemo(() => defaultPeriods(rows, mapping.roles.time), [rows, mapping.roles.time]);
  const pre = draft.pre || autoPeriods.pre;
  const post = draft.post || autoPeriods.post;
  const scopeColumn = mapping.roles.scope?.[0] || "";

  /* 분석 실행 버튼을 따로 두지 않는다. 업로드부의 "데이터 분석하기"가 이미 명시적
   * 행동이고(§12.5 게이트), 그 뒤에 버튼을 하나 더 두면 같은 확인을 두 번 받는다. */
  const ready = Boolean(gateOpen && mapping.roles.time && mapping.dimensions.length && pre && post && pre !== post);
  const active = useMemo(
    () => (ready
      ? { signature, pre, post, scopeColumn, scopeValue: draft.scopeValue, dimensionId: draft.dimensionId, memberId: draft.memberId }
      : null),
    [ready, signature, pre, post, scopeColumn, draft.scopeValue, draft.dimensionId, draft.memberId],
  );

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
    const opsArgs = { panel, dimensionId: selected.dimensionId, memberId: topMember, ...selector, scopeFilter };
    const scan = topMember ? scanPeriodShifts({ panel, dimensionId: selected.dimensionId, memberId: topMember, scopeFilter }) : null;
    return {
      ranked,
      selected: distribution,
      memberId: topMember,
      decomposition: topMember ? decomposeMixRate(opsArgs) : null,
      netNew: netNewProfile(distribution),
      // 운영 지문은 "무엇이 움직였나" 다음 질문이라 같은 분석 게이트 뒤에서 함께 만든다.
      spendShift: topMember ? spendShiftFingerprint(opsArgs) : null,
      quadrants: topMember ? costVolumeQuadrants(opsArgs) : null,
      scan,
      repeatability: scan ? repeatabilityByMagnitude(scan) : null,
    };
  }, [panel, active]);

  const causal = useMemo(() => {
    if (!panel || !analysis?.selected || !analysis.memberId) return null;
    const scopeColumn = mapping.roles.scope?.[0] || "";
    if (!scopeColumn || !design.treated || !design.control || design.treated === design.control) return null;
    const shared = {
      panel,
      dimensionId: analysis.selected.dimensionId,
      memberId: analysis.memberId,
      scopeColumn,
      treatedValues: [design.treated],
      controlValues: [design.control],
      cutoff: design.cutoff,
    };
    const eligibility = evaluateCausalEligibility(shared);
    const study = eventStudy({ ...shared, eligibility });
    return { eligibility, study, placebo: placeboTest({ eligibility }), mediation: mediationAvailability() };
  }, [panel, analysis, mapping.roles.scope, design]);

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
    // 축을 하나만 보여 주면 "다른 건 안 봤나"가 남는다. 함께 확인한 축을 먼저 말한다.
    const others = analysis.ranked.filter((entry) => entry.dimensionId !== selected?.dimensionId);
    if (others.length) {
      const summary = others
        .map((entry) => `${entry.label} ${entry.totalVariation == null ? tx(locale, "계산 안 함", "not computed") : fmtPct(entry.totalVariation)}`)
        .join(" · ");
      list.push(tx(locale,
        `축 ${analysis.ranked.length}개를 함께 확인했습니다 — ${summary}.`,
        `${analysis.ranked.length} axes were checked together — ${summary}.`));
    }
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

  const spendColumns = [
    { key: "entityKey", label: tx(locale, "분석 단위", "Unit"), align: "left" },
    { key: "spendShareDelta", label: tx(locale, "비용 비중 변화", "Spend share change"), align: "right", fmt: (value) => `${value >= 0 ? "+" : "−"}${fmtPct(Math.abs(value))}` },
    { key: "memberShareDelta", label: tx(locale, "구성 비중 변화", "Composition share change"), align: "right", fmt: (value) => `${value >= 0 ? "+" : "−"}${fmtPct(Math.abs(value))}` },
    { key: "sameDirection", label: tx(locale, "같은 방향인가", "Same direction"), align: "left", fmt: (value) => (value == null ? "—" : value ? tx(locale, "예", "Yes") : tx(locale, "아니오", "No")) },
    { key: "elasticity", label: tx(locale, "비용 1% 대비 인원 변화", "Count change per 1% spend"), align: "right", fmt: (value) => (value == null ? "—" : value.toFixed(2)) },
  ];

  const quadrantLabel = (value) => ({
    [COST_VOLUME_QUADRANT.SCALE_EFFICIENT]: tx(locale, "볼륨↑ 단가↓", "Volume up, cost down"),
    [COST_VOLUME_QUADRANT.SCALE_COSTLY]: tx(locale, "볼륨↑ 단가↑", "Volume up, cost up"),
    [COST_VOLUME_QUADRANT.SHRINK_EFFICIENT]: tx(locale, "볼륨↓ 단가↓", "Volume down, cost down"),
    [COST_VOLUME_QUADRANT.SHRINK_COSTLY]: tx(locale, "볼륨↓ 단가↑", "Volume down, cost up"),
  }[value] || value);

  const quadrantColumns = [
    { key: "entityKey", label: tx(locale, "분석 단위", "Unit"), align: "left" },
    { key: "quadrant", label: tx(locale, "사분면", "Quadrant"), align: "left", fmt: quadrantLabel },
    { key: "volumePre", label: tx(locale, "이전 인원", "Before"), align: "right", fmt: (value) => fmtNum(value) },
    { key: "volumePost", label: tx(locale, "이후 인원", "After"), align: "right", fmt: (value) => fmtNum(value) },
    { key: "costPerMemberPre", label: tx(locale, "이전 1명당 비용", "Cost per head before"), align: "right", fmt: (value) => fmtNum(Math.round(value)) },
    { key: "costPerMemberPost", label: tx(locale, "이후 1명당 비용", "Cost per head after"), align: "right", fmt: (value) => fmtNum(Math.round(value)) },
  ];

  const scanColumns = [
    { key: "to", label: tx(locale, "기간", "Period"), align: "left", fmt: (value, row) => `${row.from} → ${value}` },
    { key: "shareBefore", label: tx(locale, "이전 비중", "Before"), align: "right", fmt: (value) => fmtPct(value) },
    { key: "shareAfter", label: tx(locale, "이후 비중", "After"), align: "right", fmt: (value) => fmtPct(value) },
    { key: "delta", label: tx(locale, "변화", "Change"), align: "right", fmt: (value) => `${value >= 0 ? "+" : "−"}${fmtPct(Math.abs(value))}` },
    { key: "isLarge", label: tx(locale, "큰 변동", "Large"), align: "left", fmt: (value) => (value ? "●" : "") },
  ];

  const eventColumns = [
    { key: "relative", label: tx(locale, "개입 기준 상대 기간", "Periods from intervention"), align: "right", fmt: (value) => (value >= 0 ? `+${value}` : String(value)) },
    { key: "estimate", label: tx(locale, "처리군 추가 변화", "Extra change in treated"), align: "right", fmt: (value) => `${value >= 0 ? "+" : "−"}${fmtPct(Math.abs(value))}` },
    { key: "ciLow", label: tx(locale, "95% 구간", "95% interval"), align: "right", fmt: (value, row) => `${fmtPct(value)} ~ ${fmtPct(row.ciHigh)}` },
    { key: "pValue", label: "p", align: "right", fmt: (value) => (value == null ? "—" : value < 0.001 ? "<0.001" : value.toFixed(3)) },
  ];

  const repeatSentence = () => {
    const large = analysis?.repeatability?.strata?.find((stratum) => stratum.label === "large");
    if (!large) return null;
    if (!large.count) return tx(locale, "임계를 넘는 큰 변동은 없었습니다. 구성은 완만하게 움직였습니다.", "No shift crossed the large-move threshold; composition moved gradually.");
    if (large.isRepeated) {
      return tx(locale,
        `큰 변동이 ${large.count}번, 모두 같은 방향으로 반복됐습니다. 한 번의 사건보다는 지속되는 흐름에 가깝습니다.`,
        `${large.count} large moves, all in the same direction. This looks more like a sustained trend than a one-off event.`);
    }
    return tx(locale,
      `큰 변동이 ${large.count}번 있었지만 방향이 갈립니다. 한 번의 사건으로 읽지 마세요.`,
      `${large.count} large moves with disagreeing directions. Do not read this as one event.`);
  };

  return <ToolPageShell
    toolId={TOOL_ID}
    title={tx(locale, "구성 변화 분석", "Composition change")}
    locale={locale}
    toc={[
      { id: "segment-composition-result", title: tx(locale, "결론", "Conclusion") },
      { id: "segment-composition-ranking", title: tx(locale, "변화한 축", "Axes") },
      { id: "segment-composition-detail", title: tx(locale, "선택 축 상세", "Detail") },
      { id: "segment-composition-ops", title: tx(locale, "운영 지문", "Fingerprints") },
      { id: "segment-composition-causal", title: tx(locale, "인과 확인", "Causal check") },
    ]}
  >
    {/* 빈 상태 문구는 CsvUploader/CsvGuide가 소유한다. 도구가 같은 말을 다시 쓰면
        업로드 화면에 같은 문장이 세 번 나온다(제품 SSOT §5.3 "설명 카드와 입력이 같은 내용 반복"). */}
    {!hasRows && <section className="block"><CsvUploader toolId={TOOL_ID} locale={locale} /></section>}

    {hasRows && <section className="block" aria-labelledby="segment-composition-mapping">
      <h2 id="segment-composition-mapping" className="section-title">{tx(locale, "이렇게 읽었습니다", "How this file was read")}</h2>
      {manualMapping ? (
        <p className="muted">{tx(locale, "직접 지정한 매핑을 씁니다.", "Using the mapping you set.")}</p>
      ) : auto.ok ? (
        <p>{tx(locale,
          `기간은 ${auto.roles.time}, 인원수는 ${autoCountColumn}, 세그먼트 축은 ${auto.dimensions.map((dimension) => dimension.label).join(" · ")}으로 읽었습니다. 축은 전부 함께 분석해 많이 움직인 순서로 보여 줍니다.`,
          `Period ${auto.roles.time}, head count ${autoCountColumn}, and segment axes ${auto.dimensions.map((dimension) => dimension.label).join(" · ")}. Every axis is analyzed together and ranked by how much it moved.`)}</p>
      ) : (
        <p className="callout">{tx(locale,
          "이 파일에서는 자동으로 읽지 못했습니다. 아래에서 기간 컬럼과 세그먼트 축을 지정해 주세요.",
          "This file could not be read automatically. Set the period column and a segment axis below.")}</p>
      )}
      {auto.review.length && !manualMapping ? <p className="muted">{tx(locale,
        `확인이 필요해 자동으로 넣지 않은 컬럼: ${auto.review.map((item) => item.header).join(", ")}`,
        `Left out pending your check: ${auto.review.map((item) => item.header).join(", ")}`)}</p> : null}
      <details className="segment-mapping-edit">
        <summary>{tx(locale, "다르게 읽혔다면 여기서 고치기", "Read it wrong? Fix it here")}</summary>
        <SegmentRoleMapper
          headers={headers}
          rows={rows}
          value={mapping}
          onChange={setMapping}
          quality={panel?.quality || null}
          locale={locale}
        />
      </details>
    </section>}

    {hasRows && <section className="block" aria-labelledby="segment-composition-compare">
      <h2 id="segment-composition-compare" className="section-title">{tx(locale, "비교 조건", "Comparison")}</h2>
      <div className="form-row">
        <label>{tx(locale, "이전 기간", "Earlier period")}
          <select value={pre} onChange={(event) => setDraft((value) => ({ ...value, pre: event.target.value }))}>
            <option value="">{tx(locale, "선택", "Select")}</option>
            {periods.map((period) => <option key={period} value={period}>{period}</option>)}
          </select>
        </label>
        <label>{tx(locale, "이후 기간", "Later period")}
          <select value={post} onChange={(event) => setDraft((value) => ({ ...value, post: event.target.value }))}>
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
      </div>
      {!gateOpen ? <p className="muted">{tx(locale, "업로드 화면의 ‘데이터 분석하기’를 누르면 결과가 나옵니다.", "Choose Analyze data on the upload panel to see results.")}</p> : null}
      {gateOpen && !ready ? <p className="muted">{tx(locale, "서로 다른 두 기간이 있어야 비교할 수 있습니다.", "Two different periods are needed to compare.")}</p> : null}
    </section>}

    {analysis && selected ? <>
      <section className="block" id="segment-composition-result">
        <ResultActionCard
          locale={locale}
          toolId={TOOL_ID}
          tone={STATUS_TONE[selected.status] || "neutral"}
          headline={conclusion()}
          /* ResultActionCard의 계약은 `{text}` 객체다. 문자열을 넘기면 렌더는
             통과하지만 `<li>`가 빈 줄로 나가고 상세 문서에는 "—"만 찍힌다 —
             화면에 아무것도 안 보여서 눈으로는 못 잡는 종류의 어긋남이다. */
          points={points().map((text) => ({ text }))}
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

      <section className="block" id="segment-composition-ops">
        <h2 className="section-title">{tx(locale, "운영 지문", "Operational fingerprints")}</h2>
        <p className="muted">{tx(locale,
          "여기부터는 원인이 아니라 가설을 좁히는 관측 신호입니다. 같은 모양이 소재·타게팅·계절성으로도 생기므로, 어느 것도 개입의 직접 증거로 쓰지 마세요.",
          "From here these are observed signals that narrow hypotheses, not causes. The same pattern can come from creative, targeting, or seasonality, so none of it is direct evidence of an intervention.")}</p>

        <h3 className="section-title">{tx(locale, "비용은 어디로 옮겨 갔나", "Where did spend move")}</h3>
        {analysis.spendShift?.available ? <>
          <DataTable
            columns={spendColumns}
            rows={analysis.spendShift.entities}
            rowKey={(row) => row.entityKey}
            ariaLabel={tx(locale, "단위별 비용 이동과 구성 이동", "Spend and composition movement by unit")}
          />
          <p className="muted">{tx(locale,
            "‘비용 1% 대비 인원 변화’는 두 기간의 로그 변화비일 뿐 반응 곡선이 아닙니다. 부호가 뒤집힌 단위를 찾는 용도로만 보세요.",
            "The per-1%-spend column is a two-point log ratio, not a response curve. Use it only to spot units whose sign flipped.")}</p>
        </> : <p className="muted">{(analysis.spendShift?.reasons || []).map((reason) => reasonLabel(reason, locale)).join(" · ")}</p>}

        <h3 className="section-title">{tx(locale, "볼륨과 1명당 비용", "Volume and cost per head")}</h3>
        {analysis.quadrants?.available ? <>
          <DataTable
            columns={quadrantColumns}
            rows={analysis.quadrants.rows}
            rowKey={(row) => row.entityKey}
            ariaLabel={tx(locale, "단위별 볼륨·단가 사분면", "Volume and unit-cost quadrant by unit")}
          />
          <p className="muted">{tx(locale,
            "볼륨이 늘면서 1명당 비용이 내려간 단위는 경쟁이 느슨해졌을 수도, 단순히 소재나 타게팅이 맞아떨어진 것일 수도 있습니다. 이 표만으로는 가릴 수 없습니다.",
            "A unit with more volume at a lower cost per head may face easier competition, or may simply have found a creative or targeting fit. This table cannot separate the two.")}</p>
          {analysis.quadrants.reasons.length ? <p className="muted">{analysis.quadrants.reasons.map((reason) => reasonLabel(reason, locale)).join(" · ")}</p> : null}
        </> : <p className="muted">{(analysis.quadrants?.reasons || []).map((reason) => reasonLabel(reason, locale)).join(" · ")}</p>}

        <h3 className="section-title">{tx(locale, "언제 움직였나", "When did it move")}</h3>
        {analysis.scan?.available ? <>
          <DataTable
            columns={scanColumns}
            rows={analysis.scan.steps}
            rowKey={(row) => `${row.from}-${row.to}`}
            ariaLabel={tx(locale, "기간 쌍별 구성 변화", "Composition change by period pair")}
          />
          {repeatSentence() ? <p>{repeatSentence()}</p> : null}
          <p className="muted">{[...new Set([...(analysis.scan.reasons || []), ...(analysis.repeatability?.reasons || [])])].map((reason) => reasonLabel(reason, locale)).join(" · ")}</p>
        </> : <p className="muted">{(analysis.scan?.reasons || []).map((reason) => reasonLabel(reason, locale)).join(" · ")}</p>}
      </section>

      <section className="block" id="segment-composition-causal">
        <h2 className="section-title">{tx(locale, "인과 확인", "Causal check")}</h2>
        <p className="muted">{tx(locale,
          "개입 시점과 대조 범위를 선언했을 때만 열립니다. 대조군 없이 전후 차이를 개입 효과라고 부를 수 없기 때문입니다 — 같은 시점의 계절성·시장 변화와 구분할 방법이 없습니다.",
          "This opens only when you declare an intervention date and a control scope. Without a control group a before-after difference is not an intervention effect — nothing separates it from seasonality or market change at the same time.")}</p>

        {!mapping.roles.scope?.length ? (
          <p className="muted">{tx(locale,
            "먼저 위에서 OS·국가 같은 컬럼을 경쟁 범위로 지정해 주세요. 처리군과 대조군은 그 값에서 고릅니다.",
            "First declare a column such as OS or country as the competition scope. Treated and control groups are picked from its values.")}</p>
        ) : (
          <div className="form-row">
            <label>{tx(locale, "개입 시점", "Intervention date")}
              <select value={design.cutoff} onChange={(event) => setDesign((value) => ({ ...value, cutoff: event.target.value }))}>
                <option value="">{tx(locale, "선택", "Select")}</option>
                {periods.map((period) => <option key={period} value={period}>{period}</option>)}
              </select>
            </label>
            <label>{tx(locale, "처리 범위", "Treated scope")}
              <select value={design.treated} onChange={(event) => setDesign((value) => ({ ...value, treated: event.target.value }))}>
                <option value="">{tx(locale, "선택", "Select")}</option>
                {scopeValues.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>{tx(locale, "대조 범위", "Control scope")}
              <select value={design.control} onChange={(event) => setDesign((value) => ({ ...value, control: event.target.value }))}>
                <option value="">{tx(locale, "선택", "Select")}</option>
                {scopeValues.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>
        )}

        {causal ? <>
          <h3 className="section-title">{tx(locale, "자격 심사", "Eligibility")}</h3>
          <ul className="segment-causal-checks">
            {causal.eligibility.checks.map((check) => (
              <li key={check.id} data-ok={check.ok ? "true" : "false"}>
                {check.ok ? "✓" : "✗"} {checkLabel(check.id, locale)}
                {check.reason ? <span className="muted"> — {reasonLabel(check.reason, locale)}</span> : null}
              </li>
            ))}
          </ul>

          {causal.study.available && causal.study.status !== CAUSAL_STATUS.BLOCKED ? <>
            <h3 className="section-title">{tx(locale, "개입 전후 궤적", "Trajectory around the intervention")}</h3>
            <DataTable
              columns={eventColumns}
              rows={causal.study.coefficients}
              rowKey={(row) => String(row.relative)}
              ariaLabel={tx(locale, "상대 기간별 처리 효과", "Treatment effect by relative period")}
            />
            <p className="muted">{tx(locale,
              `상대 기간 −1을 기준으로 잡고, 단위 ${causal.study.clusters}개를 군집으로 견고 표준오차를 계산했습니다. 개입 전 계수가 0 근처에 머물러야 이 결과를 효과로 읽을 수 있습니다.`,
              `Period −1 is the reference, and standard errors are clustered by ${causal.study.clusters} units. The pre-intervention coefficients must stay near zero for this to be read as an effect.`)}</p>
            {causal.placebo?.available ? (
              <p>{causal.placebo.passed
                ? tx(locale, `위약 검정 통과: 가짜 개입 시점(${causal.placebo.fakeCutoff})에서는 효과가 나오지 않았습니다.`, `Placebo passed: a fake intervention date (${causal.placebo.fakeCutoff}) produced no effect.`)
                : reasonLabel(CAUSAL_REASON.PLACEBO_FAILED, locale)}</p>
            ) : <p className="muted">{tx(locale, "위약 검정: ", "Placebo test: ")}{(causal.placebo?.reasons || []).map((reason) => reasonLabel(reason, locale)).join(" · ")}</p>}
          </> : (
            <p className="callout">{[...new Set([...(causal.eligibility.reasons || []), ...(causal.study.reasons || [])])]
              .map((reason) => reasonLabel(reason, locale)).join(" · ")}</p>
          )}

          <p className="muted">{reasonLabel(CAUSAL_REASON.MEDIATION_NOT_IDENTIFIED, locale)}</p>
        </> : null}
      </section>

      <section className="block" aria-labelledby="segment-composition-limits">
        <h2 id="segment-composition-limits" className="section-title">{tx(locale, "이 결과로 말할 수 없는 것", "What this cannot say")}</h2>
        <ul>
          <li>{tx(locale, "구성이 바뀐 이유는 이 분해로 알 수 없습니다. 무엇이 얼마나 움직였는지까지입니다.", "This decomposition does not say why the composition changed — only what moved and by how much.")}</li>
          <li>{tx(locale, "순증 구간 구성은 두 기간을 뺀 추정치이며, 증분 유저를 실제로 관측한 값이 아닙니다.", "The net-new profile is arithmetic between two periods, not an observation of incremental users.")}</li>
          <li>{tx(locale, "운영 지문(비용 이동·사분면·기간 스캔)은 가설을 좁힐 뿐, 어느 것도 개입의 직접 증거가 아닙니다.", "The operational fingerprints narrow hypotheses; none of them is direct evidence of an intervention.")}</li>
          <li>{tx(locale, "개입 효과를 확인하려면 증분 분석이나 실험으로 넘어가야 합니다.", "To test an intervention, move on to incrementality analysis or an experiment.")}</li>
        </ul>
      </section>
    </> : null}
  </ToolPageShell>;
}
