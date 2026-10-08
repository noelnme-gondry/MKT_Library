// Session-only comparison context. Never persists source rows or replaces tool settings.
const previews = new WeakMap();
export function rememberAllocationPreview(csvData, result) {
  if (csvData?.raw && result?.toolId === "5-3" && result.status === "success") {
    previews.set(csvData.raw, { mapping: csvData.mapping, currency: csvData.currency, headline: result.verdict.headline, stats: result.verdict.stats, basis: result.manifest.previewBasis });
  }
}
export function readAllocationPreview(csvData) {
  const preview = csvData?.raw && previews.get(csvData.raw);
  return preview?.mapping === csvData.mapping ? preview : null;
}
export function allocationPreviewExplanation(locale = "ko") {
  return locale === "en"
    ? "Preview scenario: all mapped dates, average daily budget and marginal-utility allocation, without low-confidence holds. Opening the tool recalculates with its own period, method and constraints; budget and projected outcomes can change."
    : "미리보기는 매핑된 전체 기간의 일평균 예산으로 계산한 한계효용 배분이며, 저신뢰 대상 고정은 적용하지 않습니다. 도구를 열면 해당 화면의 기간·배분 방식·제약으로 다시 계산하므로 예산과 예상 성과가 달라질 수 있습니다.";
}
