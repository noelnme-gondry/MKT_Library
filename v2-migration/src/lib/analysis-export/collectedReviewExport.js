import { buildAnalysisExportPayload } from "./exportContract";
import { reviewScopeRows } from "@/lib/reviewEvidence";

export function buildCollectedReviewExport(draft, { locale = "ko", projectName = "", reviewRecords = [] } = {}) {
  const en = locale === "en";
  const blocks = draft.blocks || [];
  const toolIds = new Set(blocks.map(block => block.toolId));
  return buildAnalysisExportPayload({
    toolId: "weekly-report", toolTitle: draft.title, locale, projectName,
    headline: en ? `${blocks.length} selected analysis conclusions` : `선택한 분석 결론 ${blocks.length}건`,
    points: blocks.map(block => ({ label: block.toolTitle, text: block.headline, detail: block.points.join(" · ") })),
    reviewRecords: reviewRecords.filter(record => toolIds.has(record.toolId)),
    source: { rows: [], importSource: "project_records" },
    scope: { dateStart: draft.period?.start, dateEnd: draft.period?.end },
    addon: {
      calculationTables: blocks.map((block, index) => ({ name: `RESULT_${index + 1}`, title: block.toolTitle,
        note: reviewScopeRows(block.scope, locale).map(([key, value]) => `${key}: ${value}`).join(" · "),
        rows: [[en ? "Metric" : "지표", en ? "Result" : "결과", en ? "Context" : "설명"], ...block.stats.map(stat => [stat.label, stat.displayValue, stat.detail || ""])],
      })),
      method: { name: en ? "Collected analysis and decision review" : "분석 결론·결정 검토 모음",
        assumptions: (draft.notes || []).filter(note => note.text).map(note => note.text),
        limitations: [en ? "Saved conclusions may use different periods and inputs. Check each section’s scope; rerun the source tool for updated results. No source rows or new calculations are included." : "결론마다 기간과 입력이 다를 수 있습니다. 각 항목의 분석 범위를 확인하고 최신 결과는 원본 도구에서 다시 분석하세요. 원본 행과 새로운 계산은 포함하지 않습니다."],
      },
    },
  });
}
