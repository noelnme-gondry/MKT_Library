"use client";
import { useState } from "react";
import { selectProjectReviewRecords } from "@/lib/projectReviewSelection";
import DownloadHub from "@/components/ds/DownloadHub";
import { AnalysisExportProvider } from "@/lib/analysis-export/AnalysisExportContext";
import { buildAnalysisExportPayload } from "@/lib/analysis-export/exportContract";
import { useAppStore } from "@/store/useDataStore";
import { getDecisionReviewBucket, decisionReviewFollowUpMode } from "@/lib/decisionReview";
import { localizedTool } from "@/lib/toolConnections";
import { PROJECT_REVIEW_TOOL_EVENT } from "@/lib/decisionReviewUi";

export default function ProjectReviewPortfolio({ locale = "ko" }) {
  const en = locale === "en";
  const records = useAppStore(state => state.decisionRecords);
  const [selection, setSelection] = useState({ toolId: "", start: "", end: "", threadId: "" });
  const selected = selectProjectReviewRecords(records, selection);
  const reportRecords = selected.records;
  if (!records.length) return null;
  const groups = [...new Set(records.map(record => record.toolId))].map(toolId => {
    const items = records.filter(record => record.toolId === toolId);
    return { toolId, items, due: items.filter(record => ["overdue", "today"].includes(getDecisionReviewBucket(record))).length };
  }).sort((a, b) => b.due - a.due);
  const observed = records.filter(record => record.actual?.trim() || record.learning?.trim()).length;
  const exportContext = { recordOnly: true, buildPayload: () => buildAnalysisExportPayload({
    toolId: "weekly-review", toolTitle: en ? "Project decision review" : "프로젝트 의사결정 리뷰", locale,
    headline: en ? `${reportRecords.length} selected decisions` : `선택한 결정 ${reportRecords.length}건 검토`,
    stats: [{ label: en ? "With observations" : "관측 결과가 있는 결정", value: reportRecords.filter(record => record.actual?.trim() || record.learning?.trim()).length }, { label: en ? "Due for review" : "지금 검토할 결정", value: reportRecords.filter(record => ["overdue", "today"].includes(getDecisionReviewBucket(record))).length }],
    reviewRecords: reportRecords, reviewLimit: reportRecords.length, projectName: useAppStore.getState().projects.find(project => project.id === useAppStore.getState().activeProjectId)?.name,
    generatedAt: new Date().toISOString(), source: { importSource: "project_records" },
    addon: { method: { name: en ? "Saved decision and observation review" : "저장된 결정·관측 기록 검토", limitations: [en ? `${selected.matched} selected, ${selected.ancestors} ancestors included, ${selected.excluded} excluded.` : `선택 ${selected.matched}건·이전 결정 추가 ${selected.ancestors}건·제외 ${selected.excluded}건.`, en ? "User-recorded observations; no fresh statistical analysis or causal attribution. All selected records and their available ancestors are included." : "사용자가 기록한 관측입니다. 새 통계 분석이나 인과효과 판정이 아닙니다. 선택한 기록과 연결된 이전 결정을 모두 포함합니다."] } },
  }) };
  return <AnalysisExportProvider value={exportContext}><section className="project-review-portfolio wr-card" aria-labelledby="project-review-portfolio-title">
    <header><h2 id="project-review-portfolio-title">{en ? "Decision review agenda" : "프로젝트 의사결정 리뷰"}</h2><p>{en ? "Analysis evidence → committed decision → observed outcome → next decision. Review each tool using its own comparison method." : "분석 근거 → 결정 저장 → 결과 관측 → 다음 결정. 도구마다 맞는 비교 방법으로 검토합니다."}</p></header>
    <details className="project-review-report-scope"><summary>{en ? "Choose report scope" : "보고서에 담을 결정 선택"}</summary>
      <label>{en ? "Analysis topic" : "분석 주제"}<select value={selection.toolId} onChange={event => setSelection(current => ({ ...current, toolId: event.target.value }))}><option value="">{en ? "All tools" : "모든 도구"}</option>{groups.map(group => <option key={group.toolId} value={group.toolId}>{localizedTool(group.toolId, locale)?.title || group.toolId}</option>)}</select></label>
      <label>{en ? "Review dates from" : "검토일 시작"}<input type="date" value={selection.start} onChange={event => setSelection(current => ({ ...current, start: event.target.value }))} /></label>
      <label>{en ? "Review dates through" : "검토일 종료"}<input type="date" value={selection.end} onChange={event => setSelection(current => ({ ...current, end: event.target.value }))} /></label>
      <label>{en ? "Decision thread" : "결정 흐름"}<select value={selection.threadId} onChange={event => setSelection(current => ({ ...current, threadId: event.target.value }))}><option value="">{en ? "All decisions" : "전체 결정"}</option>{records.map(record => <option key={record.id} value={record.id}>{record.action}</option>)}</select></label>
      <p>{en ? "Date filters use the planned review date. Records without one are excluded when a date filter is set. Ancestors are included even outside the filters." : "기간은 예정 검토일 기준입니다. 기간을 설정하면 검토일 미정 기록은 제외합니다. 연결된 이전 결정은 필터 밖이어도 함께 담습니다."}</p>
    </details>
    <p role="status">{en ? `Report: ${selected.matched} selected + ${selected.ancestors} previous decisions · ${selected.excluded} excluded` : `보고서: 선택 ${selected.matched}건 + 이전 결정 ${selected.ancestors}건 · 제외 ${selected.excluded}건`}</p>
    {reportRecords.length > 0 ? <DownloadHub toolId="weekly-review" locale={locale} label={en ? "Share / download project review" : "프로젝트 리뷰 공유·다운로드"} /> : <p>{en ? "No matching decisions. Adjust the filters to export." : "조건에 맞는 결정이 없습니다. 필터를 조정한 뒤 내보내세요."}</p>}
    <dl className="project-review-portfolio__counts"><div><dt>{en ? "Decisions" : "저장한 결정"}</dt><dd>{records.length}</dd></div><div><dt>{en ? "Due for review" : "지금 검토할 결정"}</dt><dd>{groups.reduce((sum, group) => sum + group.due, 0)}</dd></div><div><dt>{en ? "With observations" : "결과를 기록한 결정"}</dt><dd>{observed}</dd></div><div><dt>{en ? "Linked next decisions" : "이어진 후속 결정"}</dt><dd>{records.filter(record => record.parentDecisionId).length}</dd></div></dl>
    <details><summary>{en ? "Browse decisions by tool" : "도구별 결정 찾아보기"}</summary><div className="project-review-portfolio__tools">{groups.map(group => {
      const mode = decisionReviewFollowUpMode(group.items[0]);
      const period = ["period_auto", "period_setup"].includes(mode);
      return <article key={group.toolId}><h3>{localizedTool(group.toolId, locale)?.title || (group.toolId === "weekly-review" ? (en ? "Weekly review" : "주간 리뷰") : group.toolId)}</h3><p>{en ? `${group.items.length} decisions · ${group.due} due` : `결정 ${group.items.length}건 · 검토 필요 ${group.due}건`}</p><p className="wr-note">{period ? (en ? "Compare matching periods, scope and units." : "같은 범위·단위의 기간 데이터를 비교합니다.") : (en ? "Rerun the source analysis and record its result and limitations." : "원본 도구를 다시 실행해 결과와 한계를 기록합니다.")}</p><a className="btn" href="#wr-history" onClick={() => window.dispatchEvent(new CustomEvent(PROJECT_REVIEW_TOOL_EVENT, { detail: { toolId: group.toolId } }))}>{en ? "Review these decisions" : "이 도구의 결정 검토"}</a></article>;
    })}</div></details>
  </section></AnalysisExportProvider>;
}
