"use client";

import React, { useMemo } from "react";
import { profileSegmentCandidates, CANDIDATE_STATUS, CANDIDATE_REASON } from "@/lib/segment-composition/profileSegmentCandidates";
import { SEGMENT_SHAPE, SEGMENT_ISSUE, PANEL_STATUS } from "@/lib/segment-composition/segmentPanel";

/* 구성 변화 분석(5-29) 역할 매퍼.
 *
 * 전역 `SemanticMappingTable`에 사용자별 동적 세그먼트를 억지로 넣지 않는다(설계 §9.4).
 * 성별·연령·플랜·지역은 사람마다 다른 축이라 전역 표준키 목록으로 고정할 수 없다 —
 * 컬럼의 "이름"이 아니라 사용자가 선언한 "역할"로 분석한다.
 *
 * 성능 계약(§4.4): 역할 편집 중에는 전체 행을 순회하지 않는다. 프로파일러는 앞부분만
 * 훑고, 분모·멤버 합 정합 같은 무거운 검사는 분석 게이트를 지난 뒤 부모가 만든 패널의
 * `quality`를 받아서 보여 주기만 한다.
 */

const copy = {
  ko: {
    rolesTitle: "1. 컬럼 역할 확인",
    rolesHint: "컬럼 이름이 무엇이든 상관없습니다. 이 파일에서 각 역할을 맡을 컬럼만 골라 주세요.",
    time: "기간 (날짜·주차)",
    entity: "분석 단위 (캠페인·채널)",
    scope: "경쟁 범위 (OS·국가)",
    population: "전체 모수",
    spend: "비용",
    none: "선택 안 함",
    axesTitle: "2. 세그먼트 축 선언",
    candidates: "축 후보",
    review: "확인이 필요한 컬럼",
    wideGroups: "멤버 컬럼 묶음 제안",
    addAxis: "축으로 추가",
    addGroup: "묶음으로 추가",
    remove: "제거",
    declared: "선언한 축",
    exclusive: "한 사람이 하나의 값만 가짐 (배타)",
    exhaustive: "모든 사람이 어딘가에 속함 (포괄)",
    denominator: "분모 컬럼",
    members: "멤버",
    blockedTitle: "아직 분석할 수 없습니다",
    qualityTitle: "데이터 점검 결과",
    sampled: (rows) => `앞 ${rows.toLocaleString()}행만 훑어 후보를 제안했습니다. 전체 검사는 분석 실행 시 이뤄집니다.`,
    noCandidates: "축으로 쓸 수 있는 컬럼을 찾지 못했습니다. 아래 목록에서 직접 지정해 주세요.",
    ready: "점검 통과",
    caution: "주의할 점이 있습니다",
    blocked: "분석을 막는 문제가 있습니다",
  },
  en: {
    rolesTitle: "1. Confirm column roles",
    rolesHint: "Column names do not matter. Pick which column plays each role in this file.",
    time: "Period (date or week)",
    entity: "Analysis unit (campaign, channel)",
    scope: "Competition scope (OS, country)",
    population: "Total population",
    spend: "Spend",
    none: "Not selected",
    axesTitle: "2. Declare segment axes",
    candidates: "Axis candidates",
    review: "Columns needing review",
    wideGroups: "Suggested member column groups",
    addAxis: "Add as axis",
    addGroup: "Add as group",
    remove: "Remove",
    declared: "Declared axes",
    exclusive: "Each person has exactly one value (exclusive)",
    exhaustive: "Everyone falls into some value (exhaustive)",
    denominator: "Denominator column",
    members: "Members",
    blockedTitle: "Not ready to analyze yet",
    qualityTitle: "Data check",
    sampled: (rows) => `Suggestions come from the first ${rows.toLocaleString()} rows. The full check runs when you analyze.`,
    noCandidates: "No column looks like a segment axis. Pick one manually below.",
    ready: "Checks passed",
    caution: "Some cautions",
    blocked: "Blocking problems",
  },
};

// 진단 코드 → 사람이 읽는 문장. 계약(코드)은 엔진이 갖고 문구는 여기 한 곳에만 둔다.
const ISSUE_COPY = {
  ko: {
    [SEGMENT_ISSUE.MISSING_TIME_ROLE]: "기간 컬럼을 아직 고르지 않았습니다.",
    [SEGMENT_ISSUE.MISSING_DIMENSION]: "분석할 세그먼트 축이 없습니다.",
    [SEGMENT_ISSUE.MISSING_MEMBER_COLUMN]: "축을 만들 컬럼(또는 멤버 컬럼)이 지정되지 않았습니다.",
    [SEGMENT_ISSUE.MISSING_COUNT_COLUMN]: "인원수 컬럼이 지정되지 않았습니다.",
    [SEGMENT_ISSUE.RATE_WITHOUT_DENOMINATOR]: "비율만으로는 가중할 수 없습니다. 전체 모수 컬럼이 필요합니다.",
    [SEGMENT_ISSUE.RATE_OUT_OF_RANGE]: "0~1 범위를 벗어난 비율이 있습니다. 퍼센트 표기인지 확인해 주세요.",
    [SEGMENT_ISSUE.RATE_SUM_OFF]: "멤버 비율의 합이 100%에서 벗어납니다.",
    [SEGMENT_ISSUE.DUPLICATE_RATE_CELL]: "같은 기간·단위에 비율 행이 여러 개입니다. 비율은 더할 수 없습니다.",
    [SEGMENT_ISSUE.NON_NUMERIC_COUNT]: "숫자로 읽을 수 없는 인원수가 있습니다.",
    [SEGMENT_ISSUE.NEGATIVE_COUNT]: "음수 인원수가 있습니다.",
    [SEGMENT_ISSUE.MISSING_COUNT_VALUE]: "인원수가 빈 행이 있습니다.",
    [SEGMENT_ISSUE.MISSING_TIME_VALUE]: "기간을 읽을 수 없는 행이 있습니다.",
    [SEGMENT_ISSUE.MISSING_CATEGORY_VALUE]: "세그먼트 값이 빈 행이 있습니다.",
    [SEGMENT_ISSUE.NON_POSITIVE_DENOMINATOR]: "0 이하인 분모가 있습니다.",
    [SEGMENT_ISSUE.DENOMINATOR_CONFLICT]: "같은 기간·단위에 서로 다른 모수가 적혀 있습니다.",
    [SEGMENT_ISSUE.DENOMINATOR_UNAVAILABLE]: "전체 모수를 알 수 없어 비중을 계산하지 못한 구간이 있습니다.",
    [SEGMENT_ISSUE.COUNT_EXCEEDS_DENOMINATOR]: "멤버 인원수가 전체 모수보다 큽니다.",
    [SEGMENT_ISSUE.MEMBER_SUM_MISMATCH]: "멤버 인원수의 합이 적어 둔 전체 모수와 다릅니다.",
    [SEGMENT_ISSUE.AGGREGATED_DUPLICATE_ROWS]: "여러 행이 한 칸으로 합쳐졌습니다. 매핑하지 않은 차원이 있습니다.",
    [SEGMENT_ISSUE.MEASURE_REPEATED_ACROSS_MEMBERS]: "비용이 멤버 행마다 반복돼 있어 한 번만 셉니다.",
    [SEGMENT_ISSUE.MEASURE_GRAIN_AMBIGUOUS]: "멤버마다 비용이 달라 합산 규칙을 알 수 없습니다. 이 지표는 잠깁니다.",
    [SEGMENT_ISSUE.ESTIMATED_COUNT_FROM_RATE]: "비율에서 되만든 인원수라 정확한 정수가 아닙니다.",
    [SEGMENT_ISSUE.NO_USABLE_ROWS]: "쓸 수 있는 행이 없습니다.",
  },
  en: {
    [SEGMENT_ISSUE.MISSING_TIME_ROLE]: "No period column selected yet.",
    [SEGMENT_ISSUE.MISSING_DIMENSION]: "No segment axis to analyze.",
    [SEGMENT_ISSUE.MISSING_MEMBER_COLUMN]: "No column (or member columns) declared for this axis.",
    [SEGMENT_ISSUE.MISSING_COUNT_COLUMN]: "No head-count column declared.",
    [SEGMENT_ISSUE.RATE_WITHOUT_DENOMINATOR]: "Rates cannot be weighted without a total population column.",
    [SEGMENT_ISSUE.RATE_OUT_OF_RANGE]: "Some rates fall outside 0–1. Check whether they are percentages.",
    [SEGMENT_ISSUE.RATE_SUM_OFF]: "Member rates do not add up to 100%.",
    [SEGMENT_ISSUE.DUPLICATE_RATE_CELL]: "Several rate rows share one period and unit. Rates cannot be summed.",
    [SEGMENT_ISSUE.NON_NUMERIC_COUNT]: "Some head counts are not numbers.",
    [SEGMENT_ISSUE.NEGATIVE_COUNT]: "Some head counts are negative.",
    [SEGMENT_ISSUE.MISSING_COUNT_VALUE]: "Some rows have an empty head count.",
    [SEGMENT_ISSUE.MISSING_TIME_VALUE]: "Some rows have an unreadable period.",
    [SEGMENT_ISSUE.MISSING_CATEGORY_VALUE]: "Some rows have an empty segment value.",
    [SEGMENT_ISSUE.NON_POSITIVE_DENOMINATOR]: "Some denominators are zero or negative.",
    [SEGMENT_ISSUE.DENOMINATOR_CONFLICT]: "One period and unit carries conflicting totals.",
    [SEGMENT_ISSUE.DENOMINATOR_UNAVAILABLE]: "Shares could not be computed where the total population is unknown.",
    [SEGMENT_ISSUE.COUNT_EXCEEDS_DENOMINATOR]: "A member count exceeds the total population.",
    [SEGMENT_ISSUE.MEMBER_SUM_MISMATCH]: "Member counts do not add up to the declared total.",
    [SEGMENT_ISSUE.AGGREGATED_DUPLICATE_ROWS]: "Several rows folded into one cell — some dimension is unmapped.",
    [SEGMENT_ISSUE.MEASURE_REPEATED_ACROSS_MEMBERS]: "Spend repeats on every member row, so it is counted once.",
    [SEGMENT_ISSUE.MEASURE_GRAIN_AMBIGUOUS]: "Spend differs per member, so the summing rule is unknown. This metric stays locked.",
    [SEGMENT_ISSUE.ESTIMATED_COUNT_FROM_RATE]: "Counts were rebuilt from rounded rates, so they are not exact integers.",
    [SEGMENT_ISSUE.NO_USABLE_ROWS]: "No usable rows.",
  },
};

const CANDIDATE_COPY = {
  ko: {
    [CANDIDATE_REASON.CONTINUOUS_NUMERIC]: "연속형 숫자 — 구간을 나눠야 합니다",
    [CANDIDATE_REASON.BINARY_FLAG_AMBIGUOUS]: "0/1 — 성과 플래그인지 세그먼트인지 확인 필요",
    [CANDIDATE_REASON.MULTI_VALUE_TAGS]: "여러 값이 든 태그 — 비배타 축일 수 있습니다",
    [CANDIDATE_REASON.HIGH_MISSING]: "결측이 많습니다",
    [CANDIDATE_REASON.MISSING_IN_PERIOD]: "한쪽 기간에만 나타납니다",
  },
  en: {
    [CANDIDATE_REASON.CONTINUOUS_NUMERIC]: "Continuous number — needs binning",
    [CANDIDATE_REASON.BINARY_FLAG_AMBIGUOUS]: "0/1 — confirm whether this is a flag or a segment",
    [CANDIDATE_REASON.MULTI_VALUE_TAGS]: "Multi-value tags — the axis may be non-exclusive",
    [CANDIDATE_REASON.HIGH_MISSING]: "Many missing values",
    [CANDIDATE_REASON.MISSING_IN_PERIOD]: "Observed in only one period",
  },
};

const emptyRoles = { time: "", entity: [], scope: [], population: "", measures: {} };

export default function SegmentRoleMapper({
  headers = [], rows = [], value, onChange, quality = null, locale = "ko",
}) {
  const t = copy[locale] || copy.ko;
  const issueCopy = ISSUE_COPY[locale] || ISSUE_COPY.ko;
  const candidateCopy = CANDIDATE_COPY[locale] || CANDIDATE_COPY.ko;
  const roles = { ...emptyRoles, ...(value?.roles || {}) };
  const dimensions = value?.dimensions || [];

  const profile = useMemo(
    () => profileSegmentCandidates({ headers, rows, options: { timeColumn: roles.time } }),
    [headers, rows, roles.time],
  );

  /* 이미 다른 역할을 맡은 컬럼은 축 후보에서 뺀다. 캠페인은 그 자체로 저카디널리티
   * 문자열이라 후보 규칙을 통과하지만, 분석 단위로 선언한 컬럼을 다시 세그먼트 축으로
   * 쓰면 "캠페인 안에서 캠페인 구성이 변했다"는 동어반복이 된다. */
  const assigned = new Set([
    roles.time, roles.population,
    ...(roles.entity || []), ...(roles.scope || []),
    ...Object.values(roles.measures || {}),
    ...dimensions.map((dimension) => dimension.categoryColumn),
  ].filter(Boolean));
  const unassigned = (columns) => columns.filter((column) => !assigned.has(column.header));
  const candidates = unassigned(profile.candidates);
  const review = unassigned(profile.review);

  const update = (next) => onChange?.({ roles, dimensions, ...next });
  const setRole = (key, next) => update({ roles: { ...roles, [key]: next } });
  const toggleInList = (key, header) => {
    const current = roles[key] || [];
    setRole(key, current.includes(header) ? current.filter((item) => item !== header) : [...current, header]);
  };

  const addLongAxis = (header) => update({
    dimensions: [...dimensions, {
      id: header,
      label: header,
      sourceShape: SEGMENT_SHAPE.LONG_COUNT,
      isExclusive: true,
      isExhaustive: true,
      categoryColumn: header,
      countColumn: "",
      members: [],
    }],
  });

  const addWideAxis = (group) => update({
    dimensions: [...dimensions, {
      id: group.id,
      label: group.id,
      sourceShape: SEGMENT_SHAPE.WIDE_COUNT,
      isExclusive: true,
      isExhaustive: true,
      denominatorColumn: group.denominatorCandidate || "",
      members: group.members.map((member) => ({ id: member.sourceColumn, label: member.label, sourceColumn: member.sourceColumn })),
    }],
  });

  const patchDimension = (index, patch) => update({
    dimensions: dimensions.map((dimension, position) => (position === index ? { ...dimension, ...patch } : dimension)),
  });

  const removeDimension = (index) => update({ dimensions: dimensions.filter((_, position) => position !== index) });

  // 구조적 차단 사유만 여기서 판정한다 — 행을 순회해야 아는 문제는 분석 게이트 뒤.
  const blockers = [];
  if (!roles.time) blockers.push(issueCopy[SEGMENT_ISSUE.MISSING_TIME_ROLE]);
  if (!dimensions.length) blockers.push(issueCopy[SEGMENT_ISSUE.MISSING_DIMENSION]);
  dimensions.forEach((dimension) => {
    if (dimension.sourceShape === SEGMENT_SHAPE.LONG_COUNT && !dimension.countColumn) {
      blockers.push(`${dimension.label}: ${issueCopy[SEGMENT_ISSUE.MISSING_COUNT_COLUMN]}`);
    }
    if (dimension.sourceShape !== SEGMENT_SHAPE.LONG_COUNT && !(dimension.members || []).length) {
      blockers.push(`${dimension.label}: ${issueCopy[SEGMENT_ISSUE.MISSING_MEMBER_COLUMN]}`);
    }
    if (dimension.sourceShape === SEGMENT_SHAPE.RATE && !dimension.denominatorColumn && !roles.population) {
      blockers.push(`${dimension.label}: ${issueCopy[SEGMENT_ISSUE.RATE_WITHOUT_DENOMINATOR]}`);
    }
  });

  const columnOptions = (selectedValue, onSelect, label) => (
    <select value={selectedValue || ""} aria-label={label} onChange={(event) => onSelect(event.target.value)}>
      <option value="">{t.none}</option>
      {headers.map((header) => <option key={header} value={header}>{header}</option>)}
    </select>
  );

  const checkboxList = (key, label) => (
    <fieldset className="segment-role-fieldset">
      <legend>{label}</legend>
      {headers.map((header) => (
        <label key={header} className="segment-role-check">
          <input
            type="checkbox"
            checked={(roles[key] || []).includes(header)}
            onChange={() => toggleInList(key, header)}
          />
          <span>{header}</span>
        </label>
      ))}
    </fieldset>
  );

  return (
    <div className="segment-role-mapper">
      <section className="csv-mapping-block" aria-labelledby="segment-roles-title">
        <h3 id="segment-roles-title" className="csv-mapping-title">{t.rolesTitle}</h3>
        <p className="muted">{t.rolesHint}</p>
        <div className="segment-role-grid">
          <label className="segment-role-row"><span>{t.time}</span>{columnOptions(roles.time, (next) => setRole("time", next), t.time)}</label>
          <label className="segment-role-row"><span>{t.population}</span>{columnOptions(roles.population, (next) => setRole("population", next), t.population)}</label>
          <label className="segment-role-row"><span>{t.spend}</span>{columnOptions(roles.measures?.spend, (next) => setRole("measures", { ...roles.measures, spend: next }), t.spend)}</label>
        </div>
        {checkboxList("entity", t.entity)}
        {checkboxList("scope", t.scope)}
      </section>

      <section className="csv-mapping-block" aria-labelledby="segment-axes-title">
        <h3 id="segment-axes-title" className="csv-mapping-title">{t.axesTitle}</h3>
        {profile.isSampled ? <p className="muted">{t.sampled(profile.scannedRows)}</p> : null}

        <h4>{t.candidates}</h4>
        {candidates.length ? (
          <ul className="segment-candidate-list">
            {candidates.map((column) => (
              <li key={column.header}>
                <span className="segment-candidate-name">{column.header}</span>
                <span className="muted"> · {column.cardinality} · {column.sampleValues.slice(0, 3).join(", ")}</span>
                <button type="button" onClick={() => addLongAxis(column.header)}>{t.addAxis}</button>
              </li>
            ))}
          </ul>
        ) : <p className="muted">{t.noCandidates}</p>}

        {review.length ? (
          <>
            <h4>{t.review}</h4>
            <ul className="segment-candidate-list">
              {review.map((column) => (
                <li key={column.header}>
                  <span className="segment-candidate-name">{column.header}</span>
                  <span className="muted"> · {column.reasons.map((reason) => candidateCopy[reason] || reason).join(" · ")}</span>
                  <button type="button" onClick={() => addLongAxis(column.header)}>{t.addAxis}</button>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {profile.wideGroups.length ? (
          <>
            <h4>{t.wideGroups}</h4>
            <ul className="segment-candidate-list">
              {profile.wideGroups.map((group) => (
                <li key={group.key}>
                  <span className="segment-candidate-name">{group.id}</span>
                  <span className="muted"> · {group.members.map((member) => member.sourceColumn).join(", ")}</span>
                  <button type="button" onClick={() => addWideAxis(group)}>{t.addGroup}</button>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <h4>{t.declared}</h4>
        <ul className="segment-declared-list">
          {dimensions.map((dimension, index) => (
            <li key={dimension.id} className="segment-declared-item">
              <strong>{dimension.label}</strong>
              <span className="muted"> · {dimension.sourceShape}</span>
              {dimension.sourceShape === SEGMENT_SHAPE.LONG_COUNT ? (
                <label className="segment-role-row">
                  <span>{t.members}</span>
                  {columnOptions(dimension.countColumn, (next) => patchDimension(index, { countColumn: next }), `${dimension.label} ${t.members}`)}
                </label>
              ) : (
                <span className="muted"> · {(dimension.members || []).map((member) => member.sourceColumn).join(", ")}</span>
              )}
              <label className="segment-role-row">
                <span>{t.denominator}</span>
                {columnOptions(dimension.denominatorColumn, (next) => patchDimension(index, { denominatorColumn: next }), `${dimension.label} ${t.denominator}`)}
              </label>
              <label className="segment-role-check">
                <input type="checkbox" checked={dimension.isExclusive !== false} onChange={(event) => patchDimension(index, { isExclusive: event.target.checked })} />
                <span>{t.exclusive}</span>
              </label>
              <label className="segment-role-check">
                <input type="checkbox" checked={dimension.isExhaustive === true} onChange={(event) => patchDimension(index, { isExhaustive: event.target.checked })} />
                <span>{t.exhaustive}</span>
              </label>
              <button type="button" onClick={() => removeDimension(index)}>{t.remove}</button>
            </li>
          ))}
        </ul>
      </section>

      {blockers.length ? (
        <section className="csv-mapping-block" aria-labelledby="segment-blocked-title">
          <h3 id="segment-blocked-title" className="csv-mapping-title">{t.blockedTitle}</h3>
          <ul>{blockers.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        </section>
      ) : null}

      {quality ? (
        <section className="csv-mapping-block" aria-labelledby="segment-quality-title">
          <h3 id="segment-quality-title" className="csv-mapping-title">{t.qualityTitle}</h3>
          <p>{quality.status === PANEL_STATUS.BLOCKED ? t.blocked : quality.status === PANEL_STATUS.CAUTION ? t.caution : t.ready}</p>
          <ul>
            {(quality.issues || []).map((issue) => (
              <li key={`${issue.code}-${issue.dimensionId || ""}`} data-issue-level={issue.level}>
                {issueCopy[issue.code] || issue.code}
                {issue.rowNumbers?.length ? <span className="muted"> · {issue.rowNumbers.join(", ")}행</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export { CANDIDATE_STATUS };
