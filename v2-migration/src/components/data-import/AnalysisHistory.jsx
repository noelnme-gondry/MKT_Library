"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { clearAnalysisRuns, deleteAnalysisRun, listAnalysisRuns, saveAnalysisRun } from "@/lib/data-import/localHistory";

export default function AnalysisHistory({ toolId, summary, locale = "ko" }) {
  const [runs, setRuns] = useState([]);
  const summarySignature = useMemo(() => JSON.stringify(summary), [summary]);
  const lastSavedSignature = useRef("");
  useEffect(() => {
    if (!summarySignature || summarySignature === lastSavedSignature.current) return;
    lastSavedSignature.current = summarySignature;
    const parsedSummary = JSON.parse(summarySignature);
    saveAnalysisRun({ toolId, summary: parsedSummary, signature: summarySignature }).then(() => listAnalysisRuns(toolId)).then(setRuns).catch(() => {});
  }, [toolId, summarySignature]);
  if (runs.length === 0) return null;
  const previous = runs[1];
  const refresh = () => listAnalysisRuns(toolId).then(setRuns).catch(() => {});
  const remove = (id) => deleteAnalysisRun(id).then(refresh).catch(() => {});
  const clear = () => clearAnalysisRuns(toolId).then(() => setRuns([])).catch(() => {});
  return (
    <div className="callout" style={{ marginTop: "12px" }}>
      <div className="ico">◷</div>
      <div className="body" style={{ width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <strong>{locale === "en" ? "Local analysis history" : "로컬 분석 기록"}</strong>
          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{locale === "en" ? `${runs.length} saved run(s), browser-only` : `${runs.length}개 저장됨 · 이 브라우저에만 보관`}</span>
          <button type="button" className="ab-pill" style={{ marginLeft: "auto", fontSize: 11 }} onClick={clear}>{locale === "en" ? "Clear all" : "전체 삭제"}</button>
        </div>
        {previous && <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 6 }}>{locale === "en" ? `Prior result: ${previous.summary?.headline || "—"}` : `직전 결론: ${previous.summary?.headline || "—"}`}</div>}
        <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
          {runs.map((run, index) => (
            <div key={run.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-muted)" }}>
              <span style={{ flex: 1 }}>{index === 0 ? (locale === "en" ? "Current" : "현재") : new Date(run.savedAt).toLocaleString(locale === "en" ? "en-US" : "ko-KR")} · {run.summary?.headline || "—"}</span>
              <button type="button" className="ab-pill" style={{ fontSize: 10, padding: "3px 7px" }} onClick={() => remove(run.id)}>{locale === "en" ? "Delete" : "삭제"}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
