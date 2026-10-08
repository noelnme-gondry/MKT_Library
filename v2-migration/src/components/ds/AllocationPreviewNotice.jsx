"use client";
import { readAllocationPreview, allocationPreviewExplanation } from "@/lib/assistant/allocationPreview";
import { fmtCurrency } from "@/utils/format";

export default function AllocationPreviewNotice({ csvData, locale, recentDays, allocMode, holdLowConfidence, range, excluded }) {
  const preview = readAllocationPreview(csvData);
  if (!preview) return null;
  const en = locale === "en";
  const stat = id => preview.stats.find(item => item.id === id)?.value;
  return <section className="allocation-preview-notice" aria-label={en ? "Preview and current calculation" : "미리보기와 현재 계산"}>
    <h2>{en ? "This tool recalculates the preview scenario" : "상세 도구에서는 다른 조건으로 다시 계산합니다"}</h2>
    <p>{allocationPreviewExplanation(locale)}</p>
    <p>{en ? "Earlier preview: " : "이동 전 미리보기: "}{preview.basis?.start} — {preview.basis?.end} · {fmtCurrency(stat("budget"), { currency: preview.currency })} · {preview.headline}</p>
    <p>{en ? "Current settings: " : "현재 조건: "}{range.start} — {range.end} · {en ? `baseline ${recentDays} days` : `최근 ${recentDays}일 기준`} · {allocMode === "b" ? (en ? "Marginal-utility allocation" : "한계효용 배분") : (en ? "Stable efficiency weighting" : "안정적 효율 가중")} · {holdLowConfidence ? (en ? "Hold low-confidence targets" : "저신뢰 대상 유지") : (en ? "No low-confidence holds" : "저신뢰 대상 고정 안 함")} · {en ? `${excluded} rows excluded` : `${excluded}행 제외`}</p>
  </section>;
}
