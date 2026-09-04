// 도구 사이의 결론 모순 검출 — 순수 함수(골든).
//
// 20개 도구가 각각 독립적으로 결론을 낸다. 같은 CSV에서 포화도 진단은 "여유"라
// 하고 예산 배분은 "감액"을 권하는 상황을, 지금은 사용자가 스스로 발견해야 한다.
// claude-ux §4는 한 화면 안의 모순만 다루고 도구 사이는 계약이 없었다.
//
// 여기서 하는 일은 판정이 아니라 **대조**다. 어느 쪽이 옳은지 정하지 않고
// "두 결론이 서로 다른 방향을 가리킨다"는 사실과 확인 순서만 말한다(§8 정직성 —
// 근거 없이 한쪽을 채택하면 그게 곧 거짓 결론이다).

const DIRECTION_RULES = [
  // [정규식, 방향] — 결론 문장에서 읽어낼 수 있는 행동 방향만 본다.
  [/증액|늘리|scale up|increase budget|room to scale|헤드룸|여력|여유/i, "expand"],
  [/감액|줄이|축소|cut|reduce budget|decrease|중단/i, "contract"],
];

const KIND_LABEL = {
  ko: { saturation: "포화도 진단", allocation: "예산 배분", anomaly: "운영 대시보드", quality: "성과 변동", opportunity: "기회 탐색" },
  en: { saturation: "Saturation", allocation: "Budget allocation", anomaly: "Operations dashboard", quality: "Performance variance", opportunity: "Opportunity" },
};

export function directionOfFinding(finding) {
  const text = `${finding?.headline || ""} ${finding?.detail || ""}`;
  for (const [pattern, direction] of DIRECTION_RULES) {
    if (pattern.test(text)) return direction;
  }
  return null;
}

/**
 * 같은 데이터에서 나온 결론들 사이의 방향 충돌을 찾는다.
 * @param {Array} findings 같은 dataGroup의 finding 목록
 * @param {object} [options]
 * @param {"ko"|"en"} [options.locale]
 * @returns {Array<{id:string, left:object, right:object, headline:string, detail:string}>}
 */
export function detectFindingConflicts(findings, { locale = "ko" } = {}) {
  const labels = KIND_LABEL[locale === "en" ? "en" : "ko"];
  const withDirection = (findings || [])
    .filter((finding) => finding && finding.toolId && finding.headline)
    .map((finding) => ({ finding, direction: directionOfFinding(finding) }))
    .filter((item) => item.direction);

  const conflicts = [];
  for (let i = 0; i < withDirection.length; i += 1) {
    for (let j = i + 1; j < withDirection.length; j += 1) {
      const left = withDirection[i];
      const right = withDirection[j];
      // 같은 도구가 낸 두 결론은 그 도구 안에서 이미 한 규칙으로 계산된다(claude-ux §4).
      if (left.finding.toolId === right.finding.toolId) continue;
      if (left.direction === right.direction) continue;
      const expand = left.direction === "expand" ? left.finding : right.finding;
      const contract = left.direction === "expand" ? right.finding : left.finding;
      conflicts.push({
        id: `conflict:${[expand.id, contract.id].sort().join("|")}`,
        left: expand,
        right: contract,
        headline: locale === "en"
          ? `${labels[expand.kind] || expand.toolId} points to scaling up while ${labels[contract.kind] || contract.toolId} points to pulling back.`
          : `${labels[expand.kind] || expand.toolId}는 늘리는 쪽, ${labels[contract.kind] || contract.toolId}는 줄이는 쪽을 가리킵니다.`,
        detail: locale === "en"
          ? "Both read the same upload. Neither is corrected here — open both results and check which period, channel filter, and denominator each one used before acting."
          : "같은 업로드에서 나온 두 결론입니다. 어느 쪽이 맞는지는 여기서 정하지 않습니다 — 두 결과를 열어 기간·채널 필터·분모 기준이 서로 같은지 먼저 확인하세요.",
      });
    }
  }
  // 결정론: 같은 입력이면 같은 순서.
  return conflicts.sort((a, b) => a.id.localeCompare(b.id));
}
