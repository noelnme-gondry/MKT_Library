const TOOL_KIND = { "5-2": "anomaly", "5-21": "quality", "5-22": "saturation", "5-3": "allocation" };
const TOOL_TARGET = { "5-2": "5-21", "5-21": "5-3", "5-22": "5-3", "5-3": "5-4" };

function plain(value) {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

export function findingFromResultCard({ toolId, tone, headline, points, stats, inputSignature, locale, dataGroup, scope = {} }) {
  const title = plain(headline);
  if (!TOOL_KIND[toolId] || !title || !inputSignature) return null;
  const evidence = (stats || []).slice(0, 2).map((stat) => ({
    label: plain(stat.label) || "",
    displayValue: plain(stat.value) || "",
  })).filter((item) => item.label && item.displayValue);
  const firstPoint = plain(points?.[0]?.text);
  const resultSignature = `${inputSignature}|result:${[title, firstPoint, ...evidence.map((item) => `${item.label}:${item.displayValue}`)].filter(Boolean).join("|")}`;
  return {
    schemaVersion: 1,
    id: `${toolId}:${resultSignature}:primary`,
    toolId,
    dataGroup,
    kind: TOOL_KIND[toolId],
    severity: tone === "bad" ? "action" : tone === "good" ? "info" : "watch",
    score: tone === "bad" ? 90 : tone === "good" ? 55 : 70,
    headline: title.slice(0, 180),
    detail: (firstPoint || (locale === "en" ? "Review the supporting result before acting." : "실행 전 근거 결과를 확인하세요.")).slice(0, 240),
    evidence,
    scope,
    suggestedTargets: TOOL_TARGET[toolId] ? [{
      toolId: TOOL_TARGET[toolId],
      actionLabel: locale === "en" ? "Continue analysis" : "다음 분석으로",
      reason: locale === "en" ? "Validate this finding in the connected tool." : "연결된 도구에서 이 발견을 재검증합니다.",
    }] : [],
    inputSignature: resultSignature,
    locale: locale === "en" ? "en" : "ko",
  };
}
