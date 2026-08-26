export const MMM_CONTROL_ROLE = "external";

/** 모델이 실제로 사용한 연속형 컨트롤과 랭크 결손으로 제외한 항목을 연결한다. */
export function mmmControlFitRows(panel, run) {
  const included = new Set(run?.names || []);
  const dropped = new Set(run?.droppedFeatures || []);
  return (panel?.externalDefs || []).map((definition) => {
    const feature = `industry_${definition.key}`;
    const transform = run?.externalTransforms?.[definition.key] || null;
    return {
      key: definition.key,
      label: definition.label || definition.key,
      feature,
      status: included.has(feature) ? "included" : dropped.has(feature) ? "dropped-collinear" : "not-used",
      transformMode: transform?.mode || null,
      reference: Number.isFinite(transform?.reference) ? transform.reference : null,
    };
  });
}
