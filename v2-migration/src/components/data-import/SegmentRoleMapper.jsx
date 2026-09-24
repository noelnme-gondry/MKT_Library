"use client";

import React, { useMemo, useState } from "react";
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
    rolesTitle: "1. 파일의 열 확인",
    rolesHint: "열 이름은 상관없습니다. 질문마다 맞는 열을 고르세요. 위쪽 '추천'은 값을 보고 고른 후보입니다.",
    time: "날짜나 주차는 어느 열인가요?",
    entity: "캠페인·채널처럼 예산이 옮겨 다니는 단위가 있나요? (선택)",
    scope: "OS·국가처럼 따로 나눠 비교할 범위가 있나요? (선택)",
    population: "전체 인원은 어느 열인가요? (없으면 각 행의 인원을 더합니다)",
    spend: "비용은 어느 열인가요? (선택)",
    none: "없음",
    recommended: "추천",
    others: "기타 (파일 순서)",
    moreColumns: "다른 열도 보기",
    axesTitle: "2. 무엇으로 나눠 볼까요?",
    candidates: "나눠 볼 수 있는 열",
    review: "나눠 볼 수는 있지만 확인이 필요한 열",
    wideGroups: "여러 열이 한 기준의 값으로 보여요",
    addAxis: "이 열로 나눠 보기",
    addGroup: "이 열들을 한 기준으로 보기",
    remove: "빼기",
    declared: "지금 나눠 보는 기준",
    exclusive: "한 사람은 값 하나에만 속합니다",
    exhaustive: "빠진 사람 없이 모두 포함됩니다",
    denominator: "이 기준의 전체 인원은 어느 열인가요?",
    members: "각 값의 인원은 어느 열인가요?",
    shape: { long_count: "행마다 값 하나", wide_count: "값마다 열 하나", rate: "값마다 비율 열" },
    allAssigned: "나눠 볼 만한 열은 모두 위 기준에 넣었습니다.",
    blockedTitle: "아직 분석할 수 없습니다",
    qualityTitle: "데이터 점검",
    notes: (count) => ` · 참고 ${count}건`,
    sampled: (rows) => `앞 ${rows.toLocaleString()}행만 훑어 후보를 제안했습니다. 전체 검사는 분석 실행 시 이뤄집니다.`,
    noCandidates: "값을 보고 나눠 볼 만한 열을 찾지 못했습니다. 연령대·성별처럼 값 종류가 적은 열이 있는지 확인해 주세요.",
    ready: "점검 통과",
    caution: "주의할 점이 있습니다",
    blocked: "분석을 막는 문제가 있습니다",
  },
  en: {
    rolesTitle: "1. Check your columns",
    rolesHint: "Column names do not matter. Pick the column that answers each question. 'Suggested' comes from the values.",
    time: "Which column holds the date or week?",
    entity: "Is there a unit budget moves between, like campaign or channel? (optional)",
    scope: "Is there a scope to compare separately, like OS or country? (optional)",
    population: "Which column holds the total people? (If none, each row's people are added up)",
    spend: "Which column holds spend? (optional)",
    none: "None",
    recommended: "Suggested",
    others: "Other (file order)",
    moreColumns: "Show other columns",
    axesTitle: "2. What should we split by?",
    candidates: "Columns you can split by",
    review: "Columns you can split by after a check",
    wideGroups: "Several columns look like values of one split",
    addAxis: "Split by this column",
    addGroup: "Treat these columns as one split",
    remove: "Remove",
    declared: "Splits in use",
    exclusive: "Each person belongs to one value",
    exhaustive: "Everyone is included",
    denominator: "Which column holds this split's total people?",
    members: "Which column holds the people per value?",
    shape: { long_count: "one value per row", wide_count: "one column per value", rate: "one rate column per value" },
    allAssigned: "Every column worth splitting by is already in use above.",
    blockedTitle: "Not ready to analyze yet",
    qualityTitle: "Data check",
    notes: (count) => ` · ${count} note${count === 1 ? "" : "s"}`,
    sampled: (rows) => `Suggestions come from the first ${rows.toLocaleString()} rows. The full check runs when you analyze.`,
    noCandidates: "No column looks worth splitting by. Check for a column with few distinct values, like age band or gender.",
    ready: "Checks passed",
    caution: "Some cautions",
    blocked: "Blocking problems",
  },
};

// 진단 코드 → 사람이 읽는 문장. 계약(코드)은 엔진이 갖고 문구는 여기 한 곳에만 둔다.
const ISSUE_COPY = {
  ko: {
    [SEGMENT_ISSUE.MISSING_TIME_ROLE]: "날짜나 주차 열을 아직 고르지 않았습니다.",
    [SEGMENT_ISSUE.MISSING_DIMENSION]: "무엇으로 나눠 볼지 아직 고르지 않았습니다.",
    [SEGMENT_ISSUE.MISSING_MEMBER_COLUMN]: "이 기준의 값이 든 열을 아직 고르지 않았습니다.",
    [SEGMENT_ISSUE.MISSING_COUNT_COLUMN]: "각 값의 인원이 든 열을 아직 고르지 않았습니다.",
    [SEGMENT_ISSUE.RATE_WITHOUT_DENOMINATOR]: "비율만으로는 인원을 알 수 없습니다. 전체 인원 열을 골라 주세요.",
    [SEGMENT_ISSUE.RATE_OUT_OF_RANGE]: "0~1 범위를 벗어난 비율이 있습니다. 퍼센트 표기인지 확인해 주세요.",
    [SEGMENT_ISSUE.RATE_SUM_OFF]: "값별 비율의 합이 100%에서 벗어납니다.",
    [SEGMENT_ISSUE.DUPLICATE_RATE_CELL]: "같은 기간·단위에 비율 행이 여러 개입니다. 비율은 더할 수 없습니다.",
    [SEGMENT_ISSUE.NON_NUMERIC_COUNT]: "숫자로 읽을 수 없는 인원수가 있습니다.",
    [SEGMENT_ISSUE.NEGATIVE_COUNT]: "음수 인원수가 있습니다.",
    [SEGMENT_ISSUE.MISSING_COUNT_VALUE]: "인원수가 빈 행이 있습니다.",
    [SEGMENT_ISSUE.MISSING_TIME_VALUE]: "기간을 읽을 수 없는 행이 있습니다.",
    [SEGMENT_ISSUE.MISSING_CATEGORY_VALUE]: "나눠 볼 기준의 값이 빈 행이 있습니다.",
    [SEGMENT_ISSUE.NON_POSITIVE_DENOMINATOR]: "0 이하인 분모가 있습니다.",
    [SEGMENT_ISSUE.DENOMINATOR_CONFLICT]: "같은 날짜·단위에 전체 인원이 서로 다르게 적혀 있습니다.",
    [SEGMENT_ISSUE.DENOMINATOR_UNAVAILABLE]: "전체 인원을 알 수 없어 비중을 계산하지 못한 구간이 있습니다.",
    [SEGMENT_ISSUE.COUNT_EXCEEDS_DENOMINATOR]: "한 값의 인원이 전체 인원보다 큽니다.",
    [SEGMENT_ISSUE.MEMBER_SUM_MISMATCH]: "값별 인원의 합이 전체 인원과 다릅니다.",
    [SEGMENT_ISSUE.AGGREGATED_DUPLICATE_ROWS]: "여러 행이 한 칸으로 합쳐졌습니다. 매핑하지 않은 차원이 있습니다.",
    [SEGMENT_ISSUE.MEASURE_REPEATED_ACROSS_MEMBERS]: "비용이 값별 행마다 반복돼 있어 한 번만 셉니다.",
    [SEGMENT_ISSUE.MEASURE_GRAIN_AMBIGUOUS]: "값마다 비용이 달라 더하는 방법을 알 수 없습니다. 비용 지표는 잠깁니다.",
    [SEGMENT_ISSUE.ESTIMATED_COUNT_FROM_RATE]: "비율에서 되만든 인원수라 정확한 정수가 아닙니다.",
    [SEGMENT_ISSUE.NO_USABLE_ROWS]: "쓸 수 있는 행이 없습니다.",
  },
  en: {
    [SEGMENT_ISSUE.MISSING_TIME_ROLE]: "No date or week column chosen yet.",
    [SEGMENT_ISSUE.MISSING_DIMENSION]: "Nothing chosen to split by yet.",
    [SEGMENT_ISSUE.MISSING_MEMBER_COLUMN]: "No column holding this split's values yet.",
    [SEGMENT_ISSUE.MISSING_COUNT_COLUMN]: "No column holding people per value yet.",
    [SEGMENT_ISSUE.RATE_WITHOUT_DENOMINATOR]: "Rates alone cannot give people counts. Choose the total people column.",
    [SEGMENT_ISSUE.RATE_OUT_OF_RANGE]: "Some rates fall outside 0–1. Check whether they are percentages.",
    [SEGMENT_ISSUE.RATE_SUM_OFF]: "Rates per value do not add up to 100%.",
    [SEGMENT_ISSUE.DUPLICATE_RATE_CELL]: "Several rate rows share one period and unit. Rates cannot be summed.",
    [SEGMENT_ISSUE.NON_NUMERIC_COUNT]: "Some head counts are not numbers.",
    [SEGMENT_ISSUE.NEGATIVE_COUNT]: "Some head counts are negative.",
    [SEGMENT_ISSUE.MISSING_COUNT_VALUE]: "Some rows have an empty head count.",
    [SEGMENT_ISSUE.MISSING_TIME_VALUE]: "Some rows have an unreadable period.",
    [SEGMENT_ISSUE.MISSING_CATEGORY_VALUE]: "Some rows have an empty split value.",
    [SEGMENT_ISSUE.NON_POSITIVE_DENOMINATOR]: "Some denominators are zero or negative.",
    [SEGMENT_ISSUE.DENOMINATOR_CONFLICT]: "One date and unit has conflicting totals.",
    [SEGMENT_ISSUE.DENOMINATOR_UNAVAILABLE]: "Shares could not be computed where total people is unknown.",
    [SEGMENT_ISSUE.COUNT_EXCEEDS_DENOMINATOR]: "One value has more people than the total.",
    [SEGMENT_ISSUE.MEMBER_SUM_MISMATCH]: "People per value do not add up to the total.",
    [SEGMENT_ISSUE.AGGREGATED_DUPLICATE_ROWS]: "Several rows folded into one cell — some dimension is unmapped.",
    [SEGMENT_ISSUE.MEASURE_REPEATED_ACROSS_MEMBERS]: "Spend repeats on every value row, so it is counted once.",
    [SEGMENT_ISSUE.MEASURE_GRAIN_AMBIGUOUS]: "Spend differs per value, so we cannot add it up. Spend metrics stay locked.",
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

const DATE_LIKE = /^\d{4}[-/.]\d{1,2}([-/.]\d{1,2})?|^\d{4}-?W\d{1,2}$/i;
const NUMBER_LIKE = /^-?[\d,]+(\.\d+)?%?$/;
export function classifyColumns(headers, rows, sample = 200) {
  const kinds = {};
  const head = rows.slice(0, sample);
  for (const header of headers) {
    const values = head.map((row) => String(row?.[header] ?? "").trim()).filter(Boolean);
    if (!values.length) { kinds[header] = "empty"; continue; }
    const share = (test) => values.filter((value) => test.test(value)).length / values.length;
    if (share(DATE_LIKE) >= 0.8) kinds[header] = "date";
    else if (share(NUMBER_LIKE) >= 0.8) kinds[header] = "number";
    else {
      const distinct = new Set(values).size;
      kinds[header] = distinct >= 2 && distinct <= 30 ? "category" : "text";
    }
  }
  return kinds;
}

const emptyRoles = { time: "", entity: [], scope: [], population: "", measures: {} };

export default function SegmentRoleMapper({
  headers = [], rows = [], value, onChange, quality = null, locale = "ko",
}) {
  const t = copy[locale] || copy.ko;
  const issueCopy = ISSUE_COPY[locale] || ISSUE_COPY.ko;
  const candidateCopy = CANDIDATE_COPY[locale] || CANDIDATE_COPY.ko;
  const roles = { ...emptyRoles, ...(value?.roles || {}) };
  const dimensions = value?.dimensions || [];

  // 열마다 앞부분 값을 보고 날짜·숫자·범주 중 무엇인지 가른다(추천 묶음용, 판정은 이름이 아니라 값).
  const columnKinds = useMemo(() => classifyColumns(headers, rows), [headers, rows]);

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

  // 선택 목록은 "추천"(값으로 판단한 후보)과 "기타"(파일 순서) 두 묶음. 파일의 열 전부를
  // 순서대로 늘어놓으면 날짜를 고를 때도 캠페인이, 인원을 고를 때도 날짜가 섞인다.
  const columnOptions = (selectedValue, onSelect, label, kind) => {
    const recommended = headers.filter((header) => columnKinds[header] === kind);
    const others = headers.filter((header) => columnKinds[header] !== kind);
    return (
      <select value={selectedValue || ""} aria-label={label} onChange={(event) => onSelect(event.target.value)}>
        <option value="">{t.none}</option>
        {recommended.length ? <optgroup label={t.recommended}>{recommended.map((header) => <option key={header} value={header}>{header}</option>)}</optgroup> : null}
        <optgroup label={recommended.length ? t.others : t.recommended}>{others.map((header) => <option key={header} value={header}>{header}</option>)}</optgroup>
      </select>
    );
  };

  const [showAllChecks, setShowAllChecks] = useState({});
  const checkboxList = (key, label) => {
    const picked = roles[key] || [];
    const shown = showAllChecks[key] ? headers : headers.filter((header) => columnKinds[header] === "category" || picked.includes(header));
    return (
      <fieldset className="segment-role-fieldset">
        <legend>{label}</legend>
        {shown.map((header) => (
          <label key={header} className="segment-role-check">
            <input
              type="checkbox"
              checked={picked.includes(header)}
              onChange={() => toggleInList(key, header)}
            />
            <span>{header}</span>
          </label>
        ))}
        {!showAllChecks[key] && shown.length < headers.length ? <button type="button" className="btn ghost" onClick={() => setShowAllChecks((value) => ({ ...value, [key]: true }))}>{t.moreColumns}</button> : null}
      </fieldset>
    );
  };

  return (
    <div className="segment-role-mapper">
      <section className="csv-mapping-block" aria-labelledby="segment-roles-title">
        <h3 id="segment-roles-title" className="csv-mapping-title">{t.rolesTitle}</h3>
        <p className="muted">{t.rolesHint}</p>
        <div className="segment-role-grid">
          <label className="segment-role-row"><span>{t.time}</span>{columnOptions(roles.time, (next) => setRole("time", next), t.time, "date")}</label>
          <label className="segment-role-row"><span>{t.population}</span>{columnOptions(roles.population, (next) => setRole("population", next), t.population, "number")}</label>
          <label className="segment-role-row"><span>{t.spend}</span>{columnOptions(roles.measures?.spend, (next) => setRole("measures", { ...roles.measures, spend: next }), t.spend, "number")}</label>
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
        ) : <p className="muted">{dimensions.length ? t.allAssigned : t.noCandidates}</p>}

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
              <span className="muted"> — {t.shape[dimension.sourceShape] || dimension.sourceShape}</span>
              {dimension.sourceShape === SEGMENT_SHAPE.LONG_COUNT ? (
                <label className="segment-role-row">
                  <span>{t.members}</span>
                  {columnOptions(dimension.countColumn, (next) => patchDimension(index, { countColumn: next }), `${dimension.label} ${t.members}`, "number")}
                </label>
              ) : (
                <span className="muted"> · {(dimension.members || []).map((member) => member.sourceColumn).join(", ")}</span>
              )}
              <label className="segment-role-row">
                <span>{t.denominator}</span>
                {columnOptions(dimension.denominatorColumn, (next) => patchDimension(index, { denominatorColumn: next }), `${dimension.label} ${t.denominator}`, "number")}
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
          <p>{quality.status === PANEL_STATUS.BLOCKED ? t.blocked : quality.status === PANEL_STATUS.CAUTION ? t.caution : `${t.ready}${quality.issues?.length ? t.notes(quality.issues.length) : ""}`}</p>
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
