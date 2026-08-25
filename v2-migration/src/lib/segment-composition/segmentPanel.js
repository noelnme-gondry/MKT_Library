/* ============================================================
 * segmentPanel — SegmentPanelV1 정규화 계약 (5-29 구성 변화 분석)
 *
 * 계산 엔진은 사용자의 원본 헤더를 절대 읽지 않는다. 세 가지 CSV shape
 * (long count · wide count · rate+분모)을 이 파일이 한 계약으로 정규화하고,
 * 엔진은 그 결과만 소비한다. 그래야 "성별 컬럼이 gender인지 Gender인지
 * 성별인지"가 수학에 새어 들어가지 않는다.
 *
 * 이 파일이 하지 않는 일:
 *  - 컬럼 의미 추측(어떤 컬럼이 세그먼트인지는 사용자가 선언한다)
 *  - PRE/POST 비교·TVD·Mix/Rate 분해(순수 엔진의 몫)
 *  - 화면 문구 생성(issue는 code+params만 남기고 KO/EN 카피는 렌더층이 갖는다)
 * ============================================================ */

export const SEGMENT_PANEL_SCHEMA_VERSION = 1;

export const SEGMENT_SHAPE = {
  LONG_COUNT: "long_count",
  WIDE_COUNT: "wide_count",
  RATE: "rate",
};

// 진단 코드. 문구가 아니라 코드를 남긴다 — KO/EN 카피는 렌더층 SSOT가 소유한다.
export const SEGMENT_ISSUE = {
  MISSING_TIME_ROLE: "MISSING_TIME_ROLE",
  MISSING_DIMENSION: "MISSING_DIMENSION",
  MISSING_COUNT_COLUMN: "MISSING_COUNT_COLUMN",
  MISSING_MEMBER_COLUMN: "MISSING_MEMBER_COLUMN",
  MISSING_TIME_VALUE: "MISSING_TIME_VALUE",
  MISSING_CATEGORY_VALUE: "MISSING_CATEGORY_VALUE",
  MISSING_COUNT_VALUE: "MISSING_COUNT_VALUE",
  NON_NUMERIC_COUNT: "NON_NUMERIC_COUNT",
  NEGATIVE_COUNT: "NEGATIVE_COUNT",
  RATE_WITHOUT_DENOMINATOR: "RATE_WITHOUT_DENOMINATOR",
  RATE_OUT_OF_RANGE: "RATE_OUT_OF_RANGE",
  RATE_SUM_OFF: "RATE_SUM_OFF",
  DUPLICATE_RATE_CELL: "DUPLICATE_RATE_CELL",
  NON_POSITIVE_DENOMINATOR: "NON_POSITIVE_DENOMINATOR",
  DENOMINATOR_CONFLICT: "DENOMINATOR_CONFLICT",
  DENOMINATOR_UNAVAILABLE: "DENOMINATOR_UNAVAILABLE",
  COUNT_EXCEEDS_DENOMINATOR: "COUNT_EXCEEDS_DENOMINATOR",
  MEMBER_SUM_MISMATCH: "MEMBER_SUM_MISMATCH",
  AGGREGATED_DUPLICATE_ROWS: "AGGREGATED_DUPLICATE_ROWS",
  MEASURE_REPEATED_ACROSS_MEMBERS: "MEASURE_REPEATED_ACROSS_MEMBERS",
  MEASURE_GRAIN_AMBIGUOUS: "MEASURE_GRAIN_AMBIGUOUS",
  ESTIMATED_COUNT_FROM_RATE: "ESTIMATED_COUNT_FROM_RATE",
  NO_USABLE_ROWS: "NO_USABLE_ROWS",
};

export const ISSUE_LEVEL = { BLOCK: "block", WARN: "warn", INFO: "info" };
export const PANEL_STATUS = { READY: "READY", CAUTION: "CAUTION", BLOCKED: "BLOCKED" };

// 반올림된 비율 입력에서 허용하는 오차. 합이 정확히 1이 아니어도 계약 위반이 아니다.
export const PANEL_TOLERANCE = {
  rateSum: 0.02,        // Σ멤버 비율이 1에서 벗어나도 되는 폭
  memberSum: 0.005,     // Σ멤버 인원수 vs 선언 분모의 상대 오차
  countOverflow: 0.005, // 복원 인원수가 분모를 넘을 때 반올림으로 설명 가능한 폭
};

const clean = (value) => String(value ?? "").trim();

// CSV 숫자는 모두 문자열이고 천단위 콤마가 들어온다(§7). 빈 값은 0이 아니라 null —
// "값이 없다"와 "0명이다"를 여기서 뭉개면 하류에서 되살릴 수 없다.
const parseNumber = (value) => {
  const source = clean(value);
  if (!source) return null;
  const parsed = Number(source.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : NaN;
};

// 비율은 단위를 추측하지 않는다. `%` 접미사가 실제로 붙어 있을 때만 100으로 나누고,
// 그 외에는 선언된 rateUnit을 따른다. 0.086과 8.6을 눈치로 가르면 언젠가 반드시 틀린다.
const parseRate = (value, rateUnit) => {
  const source = clean(value);
  if (!source) return null;
  const hasPercentSign = source.endsWith("%");
  const parsed = parseNumber(hasPercentSign ? source.slice(0, -1) : source);
  if (parsed == null || Number.isNaN(parsed)) return parsed;
  return hasPercentSign || rateUnit === "percent" ? parsed / 100 : parsed;
};

// 날짜는 ISO로 정규화하고, 주차 라벨(`2026-W27`)처럼 날짜가 아닌 기간은 원문 그대로
// 불투명한 키로 둔다. 억지로 날짜를 만들어 내지 않는다.
export function normalizePeriod(value) {
  const source = clean(value);
  if (!source) return null;
  const match = source.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (!match) return { key: source, isDate: false };
  const [, year, month, day] = match;
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
    return { key: source, isDate: false };
  }
  return { key: iso, isDate: true };
}

function makeIssueCollector() {
  const entries = new Map();
  return {
    add(code, level, { dimensionId = null, scope = "panel", rowNumber = null, ...params } = {}) {
      const key = `${code}|${dimensionId ?? ""}|${params.measure ?? ""}`;
      let entry = entries.get(key);
      if (!entry) {
        entry = { code, level, scope, dimensionId, count: 0, rowNumbers: [], params };
        entries.set(key, entry);
      }
      entry.count += 1;
      if (rowNumber != null && entry.rowNumbers.length < 3) entry.rowNumbers.push(rowNumber);
      return entry;
    },
    list() {
      const rank = { [ISSUE_LEVEL.BLOCK]: 0, [ISSUE_LEVEL.WARN]: 1, [ISSUE_LEVEL.INFO]: 2 };
      return [...entries.values()].sort((a, b) => (
        rank[a.level] - rank[b.level]
        || a.code.localeCompare(b.code)
        || String(a.dimensionId ?? "").localeCompare(String(b.dimensionId ?? ""))
      ));
    },
  };
}

const pickColumns = (row, columns) => {
  const out = {};
  columns.forEach((column) => { out[column] = clean(row?.[column]); });
  return out;
};

const cellKeyOf = (period, entity, scope) => JSON.stringify([period, Object.values(entity), Object.values(scope)]);

/* 셀 하나에 여러 행이 들어올 때 모수·비용·예산을 어떻게 접을지는 shape이 결정한다.
 *
 *  long  — 한 행 = 한 멤버. 전체 모수·비용은 멤버 행마다 **반복**되므로 절대 합산하지
 *          않는다. 합산하면 세그먼트 수만큼 배수로 부풀어 오른다(§9.1의 독립 그룹이
 *          필요한 바로 그 이유).
 *  wide/rate — 한 행이 이미 멤버 전부를 담은 완결된 셀이다. 매핑하지 않은 차원(예:
 *          entity 역할을 비운 캠페인) 때문에 여러 행이 한 셀로 접히면 그 값들은 서로
 *          다른 부분모집단이라 **합산**이 맞다.
 */
function resolveSharedValue(values) {
  const unique = [...new Set(values.filter((value) => value != null && !Number.isNaN(value)))];
  if (unique.length === 0) return { value: null, state: "missing" };
  if (unique.length === 1) return { value: unique[0], state: values.length > 1 ? "repeated" : "single" };
  return { value: null, state: "conflict", candidates: unique };
}

function sumCellValues(values) {
  const usable = values.filter((value) => value != null && !Number.isNaN(value));
  if (!usable.length) return { value: null, state: "missing" };
  return { value: usable.reduce((sum, value) => sum + value, 0), state: usable.length > 1 ? "summed" : "single" };
}

const foldCellValue = (values, shape) => (
  shape === SEGMENT_SHAPE.LONG_COUNT ? resolveSharedValue(values) : sumCellValues(values)
);

function normalizeMembers(dimension) {
  const declared = Array.isArray(dimension.members) ? dimension.members : [];
  return declared.map((member, index) => ({
    id: clean(member.id) || `member_${index + 1}`,
    label: clean(member.label) || clean(member.id) || `member_${index + 1}`,
    sourceColumn: member.sourceColumn ? clean(member.sourceColumn) : null,
    matchValues: (member.matchValues || []).map((value) => clean(value)),
    order: index,
  }));
}

/**
 * 원본 행 + 역할 선언 → SegmentPanelV1.
 *
 * @param {object[]} rows            매핑 전 원본 행(값은 전부 문자열이어도 된다)
 * @param {object}   roles           { time, entity[], scope[], population, measures:{spend,budget} }
 * @param {object[]} dimensions      세그먼트 정의 배열(§4.3)
 * @returns {{schemaVersion:number, records:object[], dimensions:object[], quality:object}}
 */
export function buildSegmentPanel({ rows = [], roles = {}, dimensions = [] } = {}) {
  const issues = makeIssueCollector();
  const timeColumn = clean(roles.time);
  const entityColumns = (roles.entity || []).map(clean).filter(Boolean);
  const scopeColumns = (roles.scope || []).map(clean).filter(Boolean);
  const populationColumn = clean(roles.population) || null;
  const measureColumns = Object.entries(roles.measures || {})
    .filter(([, column]) => clean(column))
    .map(([name, column]) => [name, clean(column)]);

  if (!timeColumn) issues.add(SEGMENT_ISSUE.MISSING_TIME_ROLE, ISSUE_LEVEL.BLOCK);
  if (!dimensions.length) issues.add(SEGMENT_ISSUE.MISSING_DIMENSION, ISSUE_LEVEL.BLOCK);

  const dimensionOutputs = [];
  const records = [];
  const usedRowNumbers = new Set();

  if (timeColumn && dimensions.length) {
    dimensions.forEach((dimension) => {
      const built = buildDimension({
        dimension,
        rows,
        issues,
        timeColumn,
        entityColumns,
        scopeColumns,
        populationColumn,
        measureColumns,
        hasEntityRole: entityColumns.length > 0,
      });
      dimensionOutputs.push(built.dimension);
      built.records.forEach((record) => {
        records.push(record);
        record.source.rowNumbers.forEach((rowNumber) => usedRowNumbers.add(rowNumber));
      });
    });
  }

  if (!records.length && !issues.list().some((issue) => issue.level === ISSUE_LEVEL.BLOCK)) {
    issues.add(SEGMENT_ISSUE.NO_USABLE_ROWS, ISSUE_LEVEL.BLOCK);
  }

  const issueList = issues.list();
  const hasBlock = issueList.some((issue) => issue.level === ISSUE_LEVEL.BLOCK);
  const hasWarn = issueList.some((issue) => issue.level === ISSUE_LEVEL.WARN);

  return {
    schemaVersion: SEGMENT_PANEL_SCHEMA_VERSION,
    records: hasBlock ? [] : records,
    dimensions: dimensionOutputs,
    quality: {
      status: hasBlock ? PANEL_STATUS.BLOCKED : hasWarn ? PANEL_STATUS.CAUTION : PANEL_STATUS.READY,
      issues: issueList,
      rows: { total: rows.length, used: usedRowNumbers.size },
      periods: [...new Set(records.map((record) => record.time))].sort(),
      entityColumns,
      scopeColumns,
    },
  };
}

function buildDimension(ctx) {
  const {
    dimension, rows, issues, timeColumn, entityColumns, scopeColumns,
    populationColumn, measureColumns, hasEntityRole,
  } = ctx;

  const dimensionId = clean(dimension.id) || "dimension";
  const shape = dimension.sourceShape || SEGMENT_SHAPE.LONG_COUNT;
  const rateUnit = dimension.rateUnit === "percent" ? "percent" : "ratio";
  const isExclusive = dimension.isExclusive !== false;
  const isExhaustive = dimension.isExhaustive === true;
  const denominatorColumn = clean(dimension.denominatorColumn) || populationColumn;
  const declaredMembers = normalizeMembers(dimension);
  const addIssue = (code, level, extra = {}) => issues.add(code, level, { dimensionId, scope: "dimension", ...extra });

  const cells = new Map();
  const memberOrder = new Map(declaredMembers.map((member) => [member.id, member.order]));
  const memberLabels = new Map(declaredMembers.map((member) => [member.id, member.label]));
  // long shape에서 여러 원본 값을 한 멤버로 묶는 선언(matchValues) 역인덱스.
  const valueToMember = new Map();
  declaredMembers.forEach((member) => {
    member.matchValues.forEach((value) => valueToMember.set(value, member.id));
    if (!member.matchValues.length && !member.sourceColumn) valueToMember.set(member.label, member.id);
  });

  const categoryColumn = clean(dimension.categoryColumn);
  const countColumn = clean(dimension.countColumn);
  if (shape === SEGMENT_SHAPE.LONG_COUNT) {
    if (!categoryColumn) addIssue(SEGMENT_ISSUE.MISSING_MEMBER_COLUMN, ISSUE_LEVEL.BLOCK);
    if (!countColumn) addIssue(SEGMENT_ISSUE.MISSING_COUNT_COLUMN, ISSUE_LEVEL.BLOCK);
  } else if (!declaredMembers.some((member) => member.sourceColumn)) {
    addIssue(SEGMENT_ISSUE.MISSING_MEMBER_COLUMN, ISSUE_LEVEL.BLOCK);
  }
  if (shape === SEGMENT_SHAPE.RATE && !denominatorColumn) {
    addIssue(SEGMENT_ISSUE.RATE_WITHOUT_DENOMINATOR, ISSUE_LEVEL.BLOCK);
  }

  const ensureCell = (period, entity, scope) => {
    const key = cellKeyOf(period, entity, scope);
    let cell = cells.get(key);
    if (!cell) {
      cell = {
        key, time: period, entity, scope,
        members: new Map(),
        denominatorValues: [],
        measureValues: new Map(measureColumns.map(([name]) => [name, []])),
        rowNumbers: [],
        rateRowCount: 0,
      };
      cells.set(key, cell);
    }
    return cell;
  };

  const addMemberValue = (cell, memberId, { count = null, rate = null, rowNumber }) => {
    let member = cell.members.get(memberId);
    if (!member) {
      member = { id: memberId, count: 0, rate: null, rowNumbers: [], contributions: 0 };
      cell.members.set(memberId, member);
    }
    member.contributions += 1;
    if (count != null) member.count += count;
    if (rate != null) member.rate = member.rate == null ? rate : member.rate + rate;
    if (member.rowNumbers.length < 5) member.rowNumbers.push(rowNumber);
    return member;
  };

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // 헤더가 1행
    const period = normalizePeriod(row?.[timeColumn]);
    if (!period) {
      addIssue(SEGMENT_ISSUE.MISSING_TIME_VALUE, ISSUE_LEVEL.WARN, { rowNumber });
      return;
    }
    const entity = pickColumns(row, entityColumns);
    const scope = pickColumns(row, scopeColumns);
    const cell = ensureCell(period.key, entity, scope);
    cell.rowNumbers.push(rowNumber);

    if (denominatorColumn) cell.denominatorValues.push(parseNumber(row?.[denominatorColumn]));
    measureColumns.forEach(([name, column]) => {
      cell.measureValues.get(name).push(parseNumber(row?.[column]));
    });

    if (shape === SEGMENT_SHAPE.LONG_COUNT) {
      if (!categoryColumn || !countColumn) return;
      const rawValue = clean(row?.[categoryColumn]);
      if (!rawValue) {
        addIssue(SEGMENT_ISSUE.MISSING_CATEGORY_VALUE, ISSUE_LEVEL.WARN, { rowNumber });
        return;
      }
      const memberId = valueToMember.get(rawValue) || rawValue;
      if (!memberLabels.has(memberId)) memberLabels.set(memberId, rawValue);
      const count = parseNumber(row?.[countColumn]);
      if (count == null) { addIssue(SEGMENT_ISSUE.MISSING_COUNT_VALUE, ISSUE_LEVEL.WARN, { rowNumber }); return; }
      if (Number.isNaN(count)) { addIssue(SEGMENT_ISSUE.NON_NUMERIC_COUNT, ISSUE_LEVEL.BLOCK, { rowNumber }); return; }
      if (count < 0) { addIssue(SEGMENT_ISSUE.NEGATIVE_COUNT, ISSUE_LEVEL.BLOCK, { rowNumber }); return; }
      addMemberValue(cell, memberId, { count, rowNumber });
      return;
    }

    if (shape === SEGMENT_SHAPE.WIDE_COUNT) {
      declaredMembers.forEach((member) => {
        if (!member.sourceColumn) return;
        const count = parseNumber(row?.[member.sourceColumn]);
        if (count == null) { addIssue(SEGMENT_ISSUE.MISSING_COUNT_VALUE, ISSUE_LEVEL.WARN, { rowNumber }); return; }
        if (Number.isNaN(count)) { addIssue(SEGMENT_ISSUE.NON_NUMERIC_COUNT, ISSUE_LEVEL.BLOCK, { rowNumber }); return; }
        if (count < 0) { addIssue(SEGMENT_ISSUE.NEGATIVE_COUNT, ISSUE_LEVEL.BLOCK, { rowNumber }); return; }
        addMemberValue(cell, member.id, { count, rowNumber });
      });
      return;
    }

    // rate shape — 비율은 합산·마지널라이즈가 불가능하다. 같은 셀이 두 번 나오면
    // 조용히 더하지 않고 차단한다(더하면 200%짜리 구성이 만들어진다).
    cell.rateRowCount += 1;
    if (cell.rateRowCount > 1) {
      addIssue(SEGMENT_ISSUE.DUPLICATE_RATE_CELL, ISSUE_LEVEL.BLOCK, { rowNumber });
      return;
    }
    declaredMembers.forEach((member) => {
      if (!member.sourceColumn) return;
      const rate = parseRate(row?.[member.sourceColumn], rateUnit);
      if (rate == null) { addIssue(SEGMENT_ISSUE.MISSING_COUNT_VALUE, ISSUE_LEVEL.WARN, { rowNumber }); return; }
      if (Number.isNaN(rate)) { addIssue(SEGMENT_ISSUE.NON_NUMERIC_COUNT, ISSUE_LEVEL.BLOCK, { rowNumber }); return; }
      if (rate < 0 || rate > 1) { addIssue(SEGMENT_ISSUE.RATE_OUT_OF_RANGE, ISSUE_LEVEL.BLOCK, { rowNumber, rate }); return; }
      addMemberValue(cell, member.id, { rate, rowNumber });
    });
  });

  const dimensionRecords = [];
  const seenMembers = new Map();
  let hasDenominator = false;

  const sortedCells = [...cells.values()].sort((a, b) => a.key.localeCompare(b.key));
  sortedCells.forEach((cell) => {
    if (!cell.members.size) return;

    const declaredDenominator = denominatorColumn ? foldCellValue(cell.denominatorValues, shape) : { value: null, state: "missing" };
    if (denominatorColumn && declaredDenominator.state === "conflict") {
      // 한 셀 안에서 모수가 서로 다르게 적혀 있다 → 둘 중 하나를 고르지 않는다.
      // 포괄 축이면 멤버 합으로 떨어지고, 아니면 분모 없이 남긴다(보유율 잠금).
      addIssue(SEGMENT_ISSUE.DENOMINATOR_CONFLICT, ISSUE_LEVEL.WARN, { rowNumber: cell.rowNumbers[0] });
    }

    const memberCountSum = [...cell.members.values()].reduce((sum, member) => sum + member.count, 0);
    const isRate = shape === SEGMENT_SHAPE.RATE;
    let denominator = declaredDenominator.value;
    if (denominator == null && !isRate && isExclusive && isExhaustive) denominator = memberCountSum;

    if (denominator != null && denominator <= 0) {
      addIssue(SEGMENT_ISSUE.NON_POSITIVE_DENOMINATOR, ISSUE_LEVEL.BLOCK, { rowNumber: cell.rowNumbers[0] });
      return;
    }
    if (denominator == null) {
      addIssue(SEGMENT_ISSUE.DENOMINATOR_UNAVAILABLE, ISSUE_LEVEL.WARN, { rowNumber: cell.rowNumbers[0] });
    } else {
      hasDenominator = true;
    }

    if (!isRate && declaredDenominator.value != null && isExclusive && isExhaustive) {
      const drift = Math.abs(memberCountSum - declaredDenominator.value) / declaredDenominator.value;
      if (drift > PANEL_TOLERANCE.memberSum) {
        addIssue(SEGMENT_ISSUE.MEMBER_SUM_MISMATCH, ISSUE_LEVEL.WARN, {
          rowNumber: cell.rowNumbers[0], memberSum: memberCountSum, declared: declaredDenominator.value,
        });
      }
    }

    if (isRate && isExclusive && isExhaustive) {
      const rateSum = [...cell.members.values()].reduce((sum, member) => sum + (member.rate ?? 0), 0);
      if (Math.abs(rateSum - 1) > PANEL_TOLERANCE.rateSum) {
        addIssue(SEGMENT_ISSUE.RATE_SUM_OFF, ISSUE_LEVEL.WARN, { rowNumber: cell.rowNumbers[0], rateSum });
      }
    }

    const measures = {};
    measureColumns.forEach(([name]) => {
      const resolved = foldCellValue(cell.measureValues.get(name), shape);
      measures[name] = resolved.value;
      if (resolved.state === "conflict") {
        // 멤버마다 다른 비용이 적혀 있으면 합산 규칙을 알 수 없다 → 그 지표만 잠근다.
        addIssue(SEGMENT_ISSUE.MEASURE_GRAIN_AMBIGUOUS, ISSUE_LEVEL.WARN, { rowNumber: cell.rowNumbers[0], measure: name });
      } else if (resolved.state === "repeated") {
        addIssue(SEGMENT_ISSUE.MEASURE_REPEATED_ACROSS_MEMBERS, ISSUE_LEVEL.INFO, { measure: name });
      }
    });

    // 여러 원본 행이 한 셀로 접혔다는 사실 자체를 남긴다 — long은 멤버 수보다 많은
    // 행, wide는 2행 이상이면 매핑하지 않은 차원이 뒤에 있다는 뜻이다.
    const foldedRows = shape === SEGMENT_SHAPE.LONG_COUNT
      ? cell.rowNumbers.length > cell.members.size
      : cell.rowNumbers.length > 1;
    if (cell.members.size && foldedRows && !isRate) {
      addIssue(SEGMENT_ISSUE.AGGREGATED_DUPLICATE_ROWS, ISSUE_LEVEL.INFO, { rowNumber: cell.rowNumbers[0] });
    }

    const orderedMembers = [...cell.members.values()].sort((a, b) => (
      (memberOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (memberOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER)
      || a.id.localeCompare(b.id)
    ));

    orderedMembers.forEach((member) => {
      const isEstimated = isRate;
      const count = isEstimated ? (member.rate ?? 0) * denominator : member.count;
      if (denominator != null && count - denominator > denominator * PANEL_TOLERANCE.countOverflow) {
        addIssue(SEGMENT_ISSUE.COUNT_EXCEEDS_DENOMINATOR, ISSUE_LEVEL.BLOCK, { rowNumber: member.rowNumbers[0] });
        return;
      }
      if (!seenMembers.has(member.id)) {
        seenMembers.set(member.id, { id: member.id, label: memberLabels.get(member.id) || member.id });
      }
      dimensionRecords.push({
        time: cell.time,
        entity: cell.entity,
        scope: cell.scope,
        dimensionId,
        memberId: member.id,
        memberLabel: memberLabels.get(member.id) || member.id,
        count,
        // 반올림된 비율에서 되만든 인원수는 정수인 척하지 않는다(§4.2 C).
        isCountEstimated: isEstimated,
        rate: isEstimated ? member.rate : null,
        denominator,
        optionalMeasures: measures,
        source: { rowNumbers: member.rowNumbers.slice() },
      });
    });
  });

  if (shape === SEGMENT_SHAPE.RATE && dimensionRecords.length) {
    addIssue(SEGMENT_ISSUE.ESTIMATED_COUNT_FROM_RATE, ISSUE_LEVEL.WARN);
  }

  const memberList = [...seenMembers.values()].sort((a, b) => (
    (memberOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (memberOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    || a.id.localeCompare(b.id)
  ));

  return {
    records: dimensionRecords,
    dimension: {
      id: dimensionId,
      label: clean(dimension.label) || dimensionId,
      sourceShape: shape,
      rateUnit: shape === SEGMENT_SHAPE.RATE ? rateUnit : null,
      isExclusive,
      isExhaustive,
      members: memberList,
      // §5.3 계약표. 여기서 false인 분석은 화면에서 열지 않는다 — 열면 거짓 숫자가 된다.
      contract: {
        canTotalVariation: isExclusive && isExhaustive && dimensionRecords.length > 0,
        canMixRate: hasEntityRole && hasDenominator && dimensionRecords.length > 0,
        canMemberRate: hasDenominator && dimensionRecords.length > 0,
        canClaimFullPopulation: isExclusive && isExhaustive,
      },
    },
  };
}
