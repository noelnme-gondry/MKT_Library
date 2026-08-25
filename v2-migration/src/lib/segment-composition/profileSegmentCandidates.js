/* ============================================================
 * profileSegmentCandidates — 세그먼트 축 후보 탐색 (5-29)
 *
 * 컬럼 이름의 의미를 추측해서 확정하지 않는다. 여기서 하는 일은 "이 컬럼은
 * 세그먼트 축이 될 수 있다/확인이 필요하다/될 수 없다"를 사유와 함께 제시하는
 * 것까지고, 무엇이 성별이고 무엇이 플랜인지는 사용자가 선언한다(설계 §7).
 *
 * `Female`·`Plan`·`Tier`의 비즈니스 의미는 헤더만으로 확정할 수 없다 —
 * 자동 확정은 그 순간 조용한 오분석이 된다.
 * ============================================================ */

import { profileColumns } from "@/lib/data-import/profileColumns";

export const CANDIDATE_LIMITS = {
  minCardinality: 2,
  maxCardinality: 20,   // 10은 안전하지만 실무 플랜·지역 분류를 너무 자주 막는다
  maxMissingRate: 0.1,
  maxDistinctScan: 500,  // 고유값 스캔 상한(고카디널리티 컬럼 메모리 방어)
  rowScanLimit: 2000,    // 역할 편집 중에는 전체 행을 순회하지 않는다(§4.4 계산 위치)
};

export const CANDIDATE_STATUS = {
  CANDIDATE: "CANDIDATE",       // 바로 세그먼트 축으로 제안
  NEEDS_REVIEW: "NEEDS_REVIEW", // 쓸 수 있지만 사용자가 확인해야 함(bin·배타성·결측)
  REJECTED: "REJECTED",         // 세그먼트 축이 될 수 없음
};

export const CANDIDATE_REASON = {
  DATE_COLUMN: "DATE_COLUMN",
  IDENTIFIER_LIKE: "IDENTIFIER_LIKE",
  MEASURE_LIKE: "MEASURE_LIKE",
  HIGH_CARDINALITY: "HIGH_CARDINALITY",
  SINGLE_VALUE: "SINGLE_VALUE",
  FREE_TEXT: "FREE_TEXT",
  CONTINUOUS_NUMERIC: "CONTINUOUS_NUMERIC",
  BINARY_FLAG_AMBIGUOUS: "BINARY_FLAG_AMBIGUOUS",
  MULTI_VALUE_TAGS: "MULTI_VALUE_TAGS",
  HIGH_MISSING: "HIGH_MISSING",
  MISSING_IN_PERIOD: "MISSING_IN_PERIOD",
};

// 값 어휘가 아니라 헤더로만 거르는 최소 패턴. 여기 걸린다고 확정하지 않고 사유를 붙인다.
const IDENTIFIER_PATTERN = /(^|[_\s-])(id|uuid|guid|key|url|link|email|phone)([_\s-]|$)/i;
const MEASURE_PATTERN = /(비용|광고비|소진|매출|수익|예산|가입|설치|전환|클릭|노출|조회|금액|건수|인원|수량|cost|spend|budget|revenue|sales|install|signup|conversion|click|impression|view|count|amount|rate|ratio)/i;
const TOTAL_PATTERN = /(^|[_\s-])(전체|합계|총|total|all|overall|sum)/i;
const MULTI_VALUE_PATTERN = /[,;|]/;

const clean = (value) => String(value ?? "").trim();

function distinctValues(rows, header, limit) {
  const values = new Set();
  for (const row of rows) {
    const value = clean(row?.[header]);
    if (!value) continue;
    values.add(value);
    if (values.size > limit) break;
  }
  return values;
}

/**
 * 컬럼별 후보 판정. `periods`(선택)를 주면 PRE/POST 양쪽에서 관측되는지도 본다.
 *
 * @param {object[]} rows
 * @param {string[]} headers
 * @param {object}   options { timeColumn, prePeriods, postPeriods, limits }
 */
export function profileSegmentCandidates({ headers = [], rows = [], options = {} } = {}) {
  const limits = { ...CANDIDATE_LIMITS, ...(options.limits || {}) };
  // 매핑 편집 중 호출되는 함수다. 20만 행을 매 변경마다 순회하면 화면이 멈춘다 —
  // 앞부분만 훑고 그 사실을 결과에 남긴다(무거운 계산은 분석 게이트 뒤).
  const scanned = rows.length > limits.rowScanLimit ? rows.slice(0, limits.rowScanLimit) : rows;
  const profiles = profileColumns(headers, scanned);
  const timeColumn = clean(options.timeColumn) || null;

  const columns = profiles.map((profile) => {
    const reasons = new Set();
    const values = distinctValues(scanned, profile.header, limits.maxDistinctScan);
    const cardinality = values.size;
    const sample = [...values].slice(0, 8);
    // 공용 프로파일러의 두 판정이 서로를 오염시킨다.
    //  ① `new Date("1")`이 2001-01-01로 파싱돼 **맨 정수가 날짜로** 잡힌다.
    //  ② `parseFloat("2026-07-01")`이 2026을 뽑아 **날짜가 숫자로** 잡힌다(§7).
    // 둘을 가르는 신호는 "값이 순수한 숫자 표기인가"뿐이다.
    const bareNumeric = sample.length > 0 && sample.every((value) => /^-?[\d,]+(\.\d+)?$/.test(value));
    const looksLikeDate = profile.dateRate >= 0.8 && !bareNumeric;
    const isNumeric = profile.numericRate >= 0.8 && !looksLikeDate;

    if (profile.header === timeColumn || looksLikeDate) reasons.add(CANDIDATE_REASON.DATE_COLUMN);
    if (IDENTIFIER_PATTERN.test(profile.header)) reasons.add(CANDIDATE_REASON.IDENTIFIER_LIKE);
    if (isNumeric && MEASURE_PATTERN.test(profile.header)) reasons.add(CANDIDATE_REASON.MEASURE_LIKE);
    if (cardinality > limits.maxCardinality) {
      // 숫자면 구간을 나눌 수 있고(확인 필요), 문자열이면 축이 될 수 없다.
      reasons.add(isNumeric ? CANDIDATE_REASON.CONTINUOUS_NUMERIC : CANDIDATE_REASON.HIGH_CARDINALITY);
    }
    if (cardinality < limits.minCardinality) reasons.add(CANDIDATE_REASON.SINGLE_VALUE);
    // 자유 텍스트 판정은 "긴 값이 하나 있다"가 아니라 "대체로 길다"로 본다.
    // 한 컬럼에 긴 값 하나가 섞였다고 축 자격을 뺏으면 실무 라벨이 자주 막힌다.
    const longValues = sample.filter((value) => value.length > 30).length;
    if (!isNumeric && sample.length && longValues >= Math.ceil(sample.length / 2)) reasons.add(CANDIDATE_REASON.FREE_TEXT);
    if (isNumeric && cardinality === 2 && [...values].every((value) => value === "0" || value === "1")) {
      // 0/1이 성과 플래그인지 세그먼트인지는 데이터만으로 가를 수 없다.
      reasons.add(CANDIDATE_REASON.BINARY_FLAG_AMBIGUOUS);
    }
    if (sample.filter((value) => MULTI_VALUE_PATTERN.test(value)).length >= Math.ceil(sample.length * 0.3) && sample.length) {
      reasons.add(CANDIDATE_REASON.MULTI_VALUE_TAGS);
    }
    if (profile.missingRate > limits.maxMissingRate) reasons.add(CANDIDATE_REASON.HIGH_MISSING);
    if (timeColumn && options.prePeriods && options.postPeriods) {
      if (!observedInBothPeriods(scanned, profile.header, timeColumn, options)) reasons.add(CANDIDATE_REASON.MISSING_IN_PERIOD);
    }

    return {
      header: profile.header,
      inferredType: profile.inferredType,
      cardinality,
      truncated: cardinality > limits.maxDistinctScan,
      missingRate: profile.missingRate,
      sampleValues: sample,
      status: resolveCandidateStatus(reasons),
      reasons: [...reasons].sort(),
    };
  });

  return {
    scannedRows: scanned.length,
    isSampled: scanned.length < rows.length,
    columns,
    candidates: columns.filter((column) => column.status === CANDIDATE_STATUS.CANDIDATE),
    review: columns.filter((column) => column.status === CANDIDATE_STATUS.NEEDS_REVIEW),
    wideGroups: suggestWideMemberGroups(profiles),
  };
}

const REJECTING_REASONS = [
  CANDIDATE_REASON.DATE_COLUMN,
  CANDIDATE_REASON.IDENTIFIER_LIKE,
  CANDIDATE_REASON.MEASURE_LIKE,
  CANDIDATE_REASON.HIGH_CARDINALITY,
  CANDIDATE_REASON.SINGLE_VALUE,
  CANDIDATE_REASON.FREE_TEXT,
];

function resolveCandidateStatus(reasons) {
  if (REJECTING_REASONS.some((reason) => reasons.has(reason))) return CANDIDATE_STATUS.REJECTED;
  return reasons.size ? CANDIDATE_STATUS.NEEDS_REVIEW : CANDIDATE_STATUS.CANDIDATE;
}

function observedInBothPeriods(rows, header, timeColumn, { prePeriods, postPeriods }) {
  const inBucket = (time, bucket) => (Array.isArray(bucket) ? bucket.includes(time) : false);
  const pre = new Set();
  const post = new Set();
  rows.forEach((row) => {
    const value = clean(row?.[header]);
    if (!value) return;
    const time = clean(row?.[timeColumn]);
    if (inBucket(time, prePeriods)) pre.add(value);
    if (inBucket(time, postPeriods)) post.add(value);
  });
  return pre.size >= 2 && post.size >= 2;
}

/* wide 입력의 멤버 컬럼 묶음 제안.
 * `여성가입`·`남성가입`처럼 접미사를, `age_u29`·`age_30_39`처럼 접두사를 공유하는
 * 숫자 컬럼을 한 축의 멤버 후보로 묶는다. `전체가입`처럼 total 어휘가 붙은 컬럼은
 * 멤버가 아니라 **분모 후보**로 따로 뺀다 — 멤버로 넣으면 자기 자신을 포함한
 * 분포가 만들어져 비중이 절반으로 눌린다. */
export function suggestWideMemberGroups(profiles = []) {
  const numeric = profiles.filter((profile) => profile.numericRate >= 0.8 || profile.inferredType === "percent");
  const groups = new Map();

  const push = (key, profile) => {
    const group = groups.get(key) || { key, members: [], denominators: [] };
    if (TOTAL_PATTERN.test(profile.header)) group.denominators.push(profile.header);
    else group.members.push(profile.header);
    groups.set(key, group);
  };

  numeric.forEach((profile) => {
    const header = profile.header;
    if (header.includes("_")) { push(header.split("_")[0], profile); return; }
    const suffix = header.length > 2 ? header.slice(-2) : header;
    push(`*${suffix}`, profile);
  });

  return [...groups.values()]
    .filter((group) => group.members.length >= 2)
    .map((group) => ({
      id: group.key.replace(/^\*/, ""),
      key: group.key,
      members: group.members.map((header) => ({ sourceColumn: header, label: header })),
      denominatorCandidate: group.denominators[0] || null,
    }))
    .sort((a, b) => b.members.length - a.members.length || a.key.localeCompare(b.key));
}
