import { decisionPlanRows, decisionObservationRows } from "@/lib/decisionPlan";
import { decisionClosureLabel } from "@/lib/decisionClosure";
import { decisionEpisodeList, decisionGuardrailList, getDecisionReviewBucket } from "@/lib/decisionReview";
import { reviewScopeRows, readReviewEvidence } from "@/lib/reviewEvidence";

const text = (value, limit = 1000) => ["string", "number"].includes(typeof value) ? String(value).slice(0, limit) : "";
export function buildReviewBrief({ projectName = "", records = [], locale = "ko", limit = 20 } = {}) {
  const en = locale === "en";
  const statuses = en ? { overdue: "Overdue", today: "Review today", upcoming: "Upcoming", unscheduled: "Date not set", reviewed: "Reviewed" } : { overdue: "기한 지남", today: "오늘 검토", upcoming: "검토 예정", unscheduled: "검토일 미정", reviewed: "검토 완료" };
  const selected = records.filter(record => record?.action).slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return { projectName: text(projectName, 120), total: selected.length, decisions: selected.slice(0, Number.isInteger(limit) && limit >= 0 ? limit : 20).map(record => {
    const evidence = readReviewEvidence(record.evidence);
    const effect = readReviewEvidence(record.effectEvidence);
    const episodes = decisionEpisodeList(record);
    const parent = records.find(item => item.id === record.parentDecisionId);
    return { action: text(record.action, 500), fields: [
      [en ? "Recorded / review date" : "작성일 / 검토일", `${String(record.createdAt || "").slice(0, 10) || "—"} / ${record.reviewDate || "—"}`],
      [en ? "Review status" : "검토 상태", decisionClosureLabel(record.closureReason, locale) || statuses[getDecisionReviewBucket(record)]],
      [en ? "Decision basis" : "판단 근거", text(record.conclusion)],
      ...decisionPlanRows(record.reviewPlan, locale),
      ...decisionObservationRows(record.reviewPlan, record.targetActual, locale),
      ...(effect ? [[en ? "Linked effect analysis" : "연결한 효과 분석", effect.headline], [en ? "Effect estimate and uncertainty" : "효과 추정치와 불확실성", effect.stats.map(stat => `${stat.label}: ${stat.value}${stat.detail ? ` (${stat.detail})` : ""}`).join(" · ")], [en ? "Effect analysis scope" : "효과 분석 범위", reviewScopeRows(effect.scope, locale).map(([key, value]) => `${key}: ${value}`).join(" · ")], [en ? "Design and limitations" : "설계와 한계", effect.points.map(point => [point.label, point.text, point.detail].filter(Boolean).join(" · ")).join("; ")]] : record.reviewPlan ? [[en ? "Effect evidence" : "효과 근거", en ? "Not linked; an operating target does not establish or rule out cannibalization" : "미연결 · 운영 목표 도달 여부로 카니발 유무를 판정하지 않음"]] : []),
      [en ? "Hypothesis" : "가설", text(record.hypothesis)],
      [en ? "Metric / baseline" : "지표 / 기준값", [record.metric || record.goalMetric, record.baseline].filter(value => value !== undefined && value !== null && value !== "").map(value => text(value, 160)).join(" / ")],
      [en ? "Guardrails" : "유지할 조건", decisionGuardrailList(record).map(rail => `${rail.metric} ${rail.op === "lte" ? "≤" : "≥"} ${rail.value}`).join(" · ")],
      [en ? "Next check" : "다음 확인 질문", text(record.reviewQuestion)],
      [en ? "Observed result" : "관측한 결과", text(record.actual)],
      [en ? "Learning" : "배운 점", text(record.learning)],
      ...(episodes.length > 1 ? [[en ? "Observation history (latest 5)" : "관측 이력 (최근 5회)", episodes.slice(-5).map(episode => [episode.observedAt?.slice(0, 10), episode.actual, episode.learning].filter(Boolean).join(" · ")).join("; ")]] : []),
      [en ? "Follow-up decisions" : "이어지는 다음 행동", records.filter(item => record.id && item.parentDecisionId === record.id && item.action).map(item => `${text(item.action, 500)} (${en ? "review" : "검토"}: ${item.reviewDate || (en ? "Date not set" : "날짜 미정")})`).join("; ")],
      [en ? "Previous decision" : "이전 결정", parent ? text(parent.action, 500) : record.parentDecisionId ? (en ? "Linked record is not included" : "연결된 기록이 이 문서에 없음") : ""],
      ...(evidence ? [[en ? "Evidence at decision time" : "결정 당시 근거", [evidence.headline, ...evidence.stats.map(stat => `${stat.label}: ${stat.value}${stat.detail ? ` (${stat.detail})` : ""}`)].join(" · ")], [en ? "Evidence scope" : "근거 범위", reviewScopeRows(evidence.scope, locale).map(([key, value]) => `${key}: ${value}`).join(" · ")]] : []),
      [en ? "Saved evidence date" : "근거 보관일", evidence?.capturedAt?.slice(0, 10) || (en ? "Not recorded" : "미보관")],
    ].filter(([, value]) => value) };
  }) };
}
export function reviewBriefRows(review, locale = "ko") {
  const en = locale === "en";
  const rows = (review?.decisions || []).flatMap(decision => [[en ? "Decision" : "결정", decision.action], ...decision.fields]);
  if (review?.total > review.decisions.length) rows.push([en ? "Coverage" : "포함 범위", en ? `Latest ${review.decisions.length} of ${review.total} decisions` : `전체 ${review.total}건 중 최근 ${review.decisions.length}건`]);
  return rows;
}
export function renderAnalysisBrief(payload) {
  const en = payload.locale === "en";
  const lines = [payload.toolTitle, payload.summary.headline];
  if (payload.review?.projectName) lines.push(`${en ? "Project" : "프로젝트"}: ${payload.review.projectName}`);
  lines.push(...reviewScopeRows(payload.scope, payload.locale).map(([key, value]) => `${key}: ${value}`));
  lines.push("", en ? "Key results" : "핵심 수치", ...payload.summary.stats.map(stat => `${stat.label}: ${stat.value}${stat.detail ? ` (${stat.detail})` : ""}`));
  lines.push("", en ? "Evidence / next steps" : "근거 / 다음 행동", ...payload.summary.points.map(point => [point.label, point.text, point.detail].filter(Boolean).join(" · ")));
  if (payload.review?.decisions.length) lines.push("", en ? "Saved decisions — historical records, not a new causal assessment" : "저장한 결정 — 과거 기록이며 새로운 인과효과 판정이 아닙니다", ...reviewBriefRows(payload.review, payload.locale).map(([key, value]) => `${key}: ${value}`));
  if (payload.review?.total > payload.review.decisions.length) lines.push(en ? `Showing the latest ${payload.review.decisions.length} of ${payload.review.total} decisions.` : `전체 ${payload.review.total}건 중 최근 ${payload.review.decisions.length}건을 담았습니다.`);
  lines.push("", en ? "Method / limitations" : "방법 / 해석 한계", payload.method.name, ...payload.method.assumptions, ...payload.method.limitations);
  return lines.filter(line => typeof line === "string").join("\n");
}
// Every column remains visible. Repeat the identifier when a wide table is split.
export function documentTableBands(rows = [], maxColumns = 6, maxRecords = 20) {
  if (!rows.length) return [];
  const width = Math.max(...rows.slice(0, maxRecords + 1).map(row => row.length));
  const limited = rows.slice(0, maxRecords + 1);
  if (width <= maxColumns) return [limited];
  const bands = [];
  for (let start = 1; start < width; start += maxColumns - 1) bands.push(limited.map(row => [row[0], ...row.slice(start, start + maxColumns - 1)]));
  return bands;
}
export function reportCellText(value, locale = "ko") {
  if (value == null) return "—";
  if (typeof value !== "object") return String(value);
  if (value.formula) {
    if (typeof value.value === "number" && Number.isFinite(value.value)) return value.numberFormat?.includes("%") ? `${(value.value * 100).toFixed(1)}%` : value.value.toLocaleString(locale === "en" ? "en-US" : "ko-KR", { maximumFractionDigits: 4 });
    return locale === "en" ? "See Excel formula; no cached result" : "Excel 수식 참조 · 보관된 계산값 없음";
  }
  return JSON.stringify(value);
}
