"use client";
import DownloadHub from "@/components/ds/DownloadHub";
import { AnalysisExportProvider } from "@/lib/analysis-export/AnalysisExportContext";
import { buildAnalysisExportPayload } from "@/lib/analysis-export/exportContract";
import { useAppStore } from "@/store/useDataStore";
import { getDecisionReviewBucket, decisionReviewFollowUpMode } from "@/lib/decisionReview";
import { localizedTool } from "@/lib/toolConnections";
import { isDemoData } from "@/lib/dataOrigin";
import { PROJECT_REVIEW_TOOL_EVENT } from "@/lib/decisionReviewUi";

export default function ProjectReviewPortfolio({ locale = "ko" }) {
  const en = locale === "en";
  const records = useAppStore(state => state.decisionRecords);
  const csv = useAppStore(state => state.csvData);
  if (!records.length || isDemoData(csv)) return null;
  const groups = [...new Set(records.map(record => record.toolId))].map(toolId => {
    const items = records.filter(record => record.toolId === toolId);
    return { toolId, items, due: items.filter(record => ["overdue", "today"].includes(getDecisionReviewBucket(record))).length };
  }).sort((a, b) => b.due - a.due);
  const observed = records.filter(record => record.actual?.trim() || record.learning?.trim()).length;
  const exportContext = { recordOnly: true, buildPayload: () => buildAnalysisExportPayload({
    toolId: "weekly-review", toolTitle: en ? "Project decision review" : "프로젝트 의사결정 리뷰", locale,
    headline: en ? `${records.length} saved decisions across ${groups.length} analyses` : `${groups.length}개 분석의 결정 ${records.length}건 검토`,
    stats: [{ label: en ? "With observations" : "관측 결과가 있는 결정", value: observed }, { label: en ? "Due for review" : "지금 검토할 결정", value: groups.reduce((sum, group) => sum + group.due, 0) }],
    reviewRecords: records, projectName: useAppStore.getState().projects.find(project => project.id === useAppStore.getState().activeProjectId)?.name,
    generatedAt: new Date().toISOString(), source: { importSource: "project_records" },
    addon: { method: { name: en ? "Saved decision and observation review" : "저장된 결정·관측 기록 검토", limitations: [en ? "User-recorded observations; no fresh statistical analysis or causal attribution. The latest 20 decisions are included; export decision CSV for all records." : "사용자가 기록한 관측입니다. 새 통계 분석이나 인과효과 판정이 아닙니다. 최근 결정 20건을 담으며 전체 기록은 결정 CSV로 내보낼 수 있습니다."] } },
  }) };
  return <AnalysisExportProvider value={exportContext}><section className="project-review-portfolio wr-card" aria-labelledby="project-review-portfolio-title">
    <header><h2 id="project-review-portfolio-title">{en ? "Decision review agenda" : "프로젝트 의사결정 리뷰"}</h2><p>{en ? "Analysis evidence → committed decision → observed outcome → next decision. Review each tool using its own comparison method." : "분석 근거 → 결정 저장 → 결과 관측 → 다음 결정. 도구마다 맞는 비교 방법으로 검토합니다."}</p></header>
    <DownloadHub toolId="weekly-review" locale={locale} label={en ? "Share / download project review" : "프로젝트 리뷰 공유·다운로드"} />
    <dl className="project-review-portfolio__counts"><div><dt>{en ? "Decisions" : "저장한 결정"}</dt><dd>{records.length}</dd></div><div><dt>{en ? "Due for review" : "지금 검토할 결정"}</dt><dd>{groups.reduce((sum, group) => sum + group.due, 0)}</dd></div><div><dt>{en ? "With observations" : "결과를 기록한 결정"}</dt><dd>{observed}</dd></div><div><dt>{en ? "Linked next decisions" : "이어진 후속 결정"}</dt><dd>{records.filter(record => record.parentDecisionId).length}</dd></div></dl>
    <div className="project-review-portfolio__tools">{groups.map(group => {
      const mode = decisionReviewFollowUpMode(group.items[0]);
      const period = ["period_auto", "period_setup"].includes(mode);
      return <article key={group.toolId}><h3>{localizedTool(group.toolId, locale)?.title || (group.toolId === "weekly-review" ? (en ? "Weekly review" : "주간 리뷰") : group.toolId)}</h3><p>{en ? `${group.items.length} decisions · ${group.due} due` : `결정 ${group.items.length}건 · 검토 필요 ${group.due}건`}</p><p className="wr-note">{period ? (en ? "Compare matching periods, scope and units." : "같은 범위·단위의 기간 데이터를 비교합니다.") : (en ? "Rerun the source analysis and record its result and limitations." : "원본 도구를 다시 실행해 결과와 한계를 기록합니다.")}</p><a className="btn" href="#wr-history" onClick={() => window.dispatchEvent(new CustomEvent(PROJECT_REVIEW_TOOL_EVENT, { detail: { toolId: group.toolId } }))}>{en ? "Review these decisions" : "이 도구의 결정 검토"}</a></article>;
    })}</div>
  </section></AnalysisExportProvider>;
}
