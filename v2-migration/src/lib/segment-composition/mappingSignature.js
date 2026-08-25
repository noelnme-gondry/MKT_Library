/* 분석 서명 — 결과가 어떤 선언 위에서 나왔는지 고정한다(설계 §9.3).
 *
 * 파일·행 수·매핑만으로는 부족하다. 배타·포괄 선언과 bin 경계가 바뀌면 같은 CSV라도
 * 다른 결과가 나오므로 서명에 포함해야 하고, 그래야 "경계만 바꿨는데 옛 결과가
 * 그대로 남아 있는" 상태를 막을 수 있다.
 *
 * 기간·선택 멤버 같은 탐색 토글은 mappingSignature가 아니라 analysisKey에만 들어간다 —
 * 기간을 바꿨다고 매핑 확인 상태까지 초기화하면 사용자가 같은 선언을 매번 다시 한다.
 */

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = stable(value[key]);
      return out;
    }, {});
  }
  return value ?? null;
};

export function segmentMappingSignature({ fileName = "", rowCount = 0, roles = {}, dimensions = [] } = {}) {
  const signature = {
    fileName,
    rowCount,
    roles: stable({
      time: roles.time || null,
      entity: [...(roles.entity || [])],
      scope: [...(roles.scope || [])],
      population: roles.population || null,
      measures: roles.measures || {},
    }),
    dimensions: dimensions.map((dimension) => stable({
      id: dimension.id,
      sourceShape: dimension.sourceShape,
      rateUnit: dimension.rateUnit || null,
      isExclusive: dimension.isExclusive !== false,
      isExhaustive: dimension.isExhaustive === true,
      categoryColumn: dimension.categoryColumn || null,
      countColumn: dimension.countColumn || null,
      denominatorColumn: dimension.denominatorColumn || null,
      binning: dimension.binning || null,
      members: (dimension.members || []).map((member) => [member.id, member.sourceColumn || null, ...(member.matchValues || [])]),
    })),
  };
  return JSON.stringify(signature);
}

export function segmentAnalysisKey({ mappingSignature, pre, post, scopeFilter, selectedDimensionId, selectedMemberId } = {}) {
  return JSON.stringify([mappingSignature, stable(pre), stable(post), stable(scopeFilter), selectedDimensionId || null, selectedMemberId || null]);
}
