/* ============================================================
 * autoDeclare — 업로드한 CSV에서 역할·세그먼트 축을 자동으로 선언한다 (5-29)
 *
 * 설계 초안은 "추천까지만 하고 확정은 사용자가"였는데, 실제로 만들어 보니 첫 화면이
 * 6칸짜리 폼이 됐다. 마케터가 세그먼트를 보러 와서 매핑을 먼저 공부해야 하는 화면은
 * 쓸 수 없다. 그래서 기본값을 뒤집는다 — **일단 다 잡아서 다 돌리고, 틀린 것만 고친다.**
 *
 * 정직성은 그대로다:
 *  - 무엇을 무엇으로 잡았는지 화면이 한 줄로 말한다(`notes`).
 *  - 확신이 없는 컬럼(0/1 플래그·연속형·다중값 태그)은 자동 채택하지 않고 `review`로 남긴다.
 *  - 자동 선언은 사용자가 손대는 순간 멈춘다(호출부 책임).
 * ============================================================ */

import { profileSegmentCandidates, CANDIDATE_REASON } from "@/lib/segment-composition/profileSegmentCandidates";
import { normalizePeriod } from "@/lib/segment-composition/segmentPanel";

export const AUTO_LIMITS = {
  maxAxes: 6,        // 축이 이보다 많으면 랭킹이 아니라 벽이 된다
  maxEntities: 1,    // 분석 단위는 하나로 시작한다(중첩은 사용자가 늘린다)
  maxScopes: 1,
};

// 역할 어휘. 헤더 이름만 보는 최소 사전이고, 못 찾으면 값 분포로 넘어간다.
const PATTERNS = {
  time: /(^|[_\s-])(date|day|week|month|일자|날짜|주차|기간|월)([_\s-]|$)/i,
  entity: /(캠페인|캠페인명|채널|매체|광고그룹|소재|campaign|channel|media|adgroup|ad_group|creative)/i,
  scope: /(os|platform|플랫폼|기기|device|국가|country|지역|region|market|시장)/i,
  count: /(가입|설치|전환|사용자|유저|인원|명수|건수|signup|install|action|conversion|user|count|volume)/i,
  spend: /(비용|광고비|소진|지출|금액|cost|spend|budget)/i,
  total: /(^|[_\s-])(전체|합계|총|total|all|overall|sum)/i,
};

const roleNote = (column, role, why) => ({ column, role, why });

/**
 * @returns {{roles, dimensions, notes, review, ok}}
 *   ok=false면 자동으로 열 수 없다 — 무엇이 없어서인지는 review가 말한다.
 */
export function autoDeclare({ headers = [], rows = [], limits = AUTO_LIMITS } = {}) {
  const profile = profileSegmentCandidates({ headers, rows });
  const byHeader = new Map(profile.columns.map((column) => [column.header, column]));
  const notes = [];
  const used = new Set();

  const take = (header, role, why) => {
    used.add(header);
    notes.push(roleNote(header, role, why));
    return header;
  };

  // ① 기간 — 날짜로 판정된 컬럼이 먼저고, 없으면 이름으로 찾는다.
  const dateColumns = profile.columns.filter((column) => column.reasons.includes(CANDIDATE_REASON.DATE_COLUMN));
  const timeColumn = dateColumns.find((column) => PATTERNS.time.test(column.header))?.header
    || dateColumns[0]?.header
    || headers.find((header) => PATTERNS.time.test(header))
    || "";
  if (timeColumn) take(timeColumn, "time", "날짜로 읽히는 컬럼");

  /* ② 인원수 — 지표로 걸러진 숫자 컬럼 중 이름이 인원에 가까운 것.
   * 단 값마다 컬럼이 나뉜 형태(wide)에서는 **멤버 컬럼 자체가 인원수**다. 먼저
   * 묶음 후보를 확인해 그 컬럼들을 인원수 후보에서 빼지 않으면, 멤버 하나를
   * 인원수로 뺏어 가 묶음이 1개짜리가 되고 축이 통째로 사라진다. */
  const wideMemberColumns = new Set(
    profile.wideGroups.flatMap((group) => group.members.map((member) => member.sourceColumn)),
  );
  const numericColumns = profile.columns.filter((column) => (
    !used.has(column.header)
    && !wideMemberColumns.has(column.header)
    && column.reasons.includes(CANDIDATE_REASON.MEASURE_LIKE)
  ));
  const spendColumn = numericColumns.find((column) => PATTERNS.spend.test(column.header))?.header || "";
  const totalColumn = numericColumns.find((column) => PATTERNS.total.test(column.header) && column.header !== spendColumn)?.header || "";
  const countColumn = numericColumns.find((column) => (
    column.header !== spendColumn && column.header !== totalColumn && PATTERNS.count.test(column.header)
  ))?.header
    || numericColumns.find((column) => column.header !== spendColumn && column.header !== totalColumn)?.header
    || "";
  if (countColumn) take(countColumn, "count", "세그먼트별 인원수로 읽히는 컬럼");
  if (spendColumn) take(spendColumn, "spend", "비용으로 읽히는 컬럼");
  if (totalColumn) take(totalColumn, "population", "전체 모수로 읽히는 컬럼");

  /* ③ 분석 단위·경쟁 범위 — 세그먼트 축의 cardinality 제한을 역할 컬럼에
   * 재사용하지 않는다. 캠페인이 20개를 넘는다는 이유로 분석 단위가 사라지면
   * 핵심인 캠페인 간 이동 vs 내부 변화 분해가 잠긴다. */
  const roleCandidates = profile.columns.filter((column) => (
    !used.has(column.header)
    && !column.reasons.includes(CANDIDATE_REASON.DATE_COLUMN)
    && !column.reasons.includes(CANDIDATE_REASON.MEASURE_LIKE)
    // #749가 풀려던 것은 cardinality 상한뿐이다. 식별자·자유 텍스트·단일값까지
    // 역할로 올리면 사람이 읽을 수 없는 분석이 된다.
    && !column.reasons.includes(CANDIDATE_REASON.IDENTIFIER_LIKE)
    && !column.reasons.includes(CANDIDATE_REASON.FREE_TEXT)
    && !column.reasons.includes(CANDIDATE_REASON.SINGLE_VALUE)
  ));
  const entity = roleCandidates.filter((column) => PATTERNS.entity.test(column.header)).slice(0, limits.maxEntities);
  entity.forEach((column) => take(column.header, "entity", "캠페인·채널로 읽히는 컬럼"));
  const scope = roleCandidates.filter((column) => (
    !used.has(column.header)
    && PATTERNS.scope.test(column.header)
  )).slice(0, limits.maxScopes);
  scope.forEach((column) => take(column.header, "scope", "OS·국가처럼 섞으면 안 되는 범위"));

  // ④ 남은 후보 전부가 세그먼트 축이다. 하나만 고르라고 하지 않는다 — 엔진이 랭킹한다.
  const axisColumns = profile.candidates.filter((column) => !used.has(column.header)).slice(0, limits.maxAxes);
  const dimensions = countColumn ? axisColumns.map((column) => {
    take(column.header, "segment", "값이 몇 개뿐인 구분 컬럼");
    return {
      id: column.header,
      label: column.header,
      sourceShape: "long_count",
      isExclusive: true,
      isExhaustive: true,
      categoryColumn: column.header,
      countColumn,
      members: [],
    };
  }) : [];

  // ⑤ wide 묶음 — long 축을 못 찾았을 때만 본다(둘 다 잡으면 같은 사실을 두 번 센다).
  if (!dimensions.length) {
    profile.wideGroups.slice(0, limits.maxAxes).forEach((group) => {
      const members = group.members.filter((member) => !used.has(member.sourceColumn));
      if (members.length < 2) return;
      members.forEach((member) => used.add(member.sourceColumn));
      notes.push(roleNote(members.map((member) => member.sourceColumn).join(", "), "segment", "값마다 컬럼이 나뉜 묶음"));
      dimensions.push({
        id: group.id,
        label: group.id,
        sourceShape: "wide_count",
        isExclusive: true,
        isExhaustive: true,
        denominatorColumn: group.denominatorCandidate || totalColumn || "",
        members: members.map((member) => ({ id: member.sourceColumn, label: member.label, sourceColumn: member.sourceColumn })),
      });
    });
  }

  // 확신이 없어 자동 채택하지 않은 것들 — 화면이 "확인해 보세요"로 보여 준다.
  const review = profile.review
    .filter((column) => !used.has(column.header))
    .map((column) => ({ header: column.header, reasons: column.reasons }));

  return {
    ok: Boolean(timeColumn) && dimensions.length > 0,
    roles: {
      time: timeColumn,
      entity: entity.map((column) => column.header),
      scope: scope.map((column) => column.header),
      population: totalColumn,
      measures: spendColumn ? { spend: spendColumn } : {},
    },
    dimensions,
    notes,
    review,
    missing: [
      ...(timeColumn ? [] : ["time"]),
      ...(countColumn || dimensions.length ? [] : ["count"]),
      ...(dimensions.length ? [] : ["segment"]),
    ],
  };
}

/** 최근 기간 vs 직전 기간 — 사용자가 고르기 전의 기본 비교. */
export function defaultPeriods(rows, timeColumn) {
  const periods = periodKeys(rows, timeColumn);
  if (periods.length < 2) return { pre: "", post: "" };
  return { pre: periods[periods.length - 2], post: periods[periods.length - 1] };
}

/** 패널과 같은 기간 키를 써 필터 선택값과 정규화 레코드가 어긋나지 않게 한다. */
export function periodKeys(rows, timeColumn) {
  if (!timeColumn) return [];
  return [...new Set(rows
    .map((row) => normalizePeriod(row?.[timeColumn])?.key || "")
    .filter(Boolean))].sort();
}
