"use client";
import { useEffect, useMemo, useState } from "react";
import { listAnalysisRuns, saveAnalysisRun } from "@/lib/data-import/localHistory";

export default function AnalysisHistory({ toolId, summary, locale = "ko" }) {
  const [runs, setRuns] = useState([]);
  const summarySignature = useMemo(() => JSON.stringify(summary), [summary]);
  useEffect(() => {
    if (!summarySignature) return;
    const parsedSummary = JSON.parse(summarySignature);
    saveAnalysisRun({ toolId, summary: parsedSummary }).then(() => listAnalysisRuns(toolId)).then(setRuns).catch(() => {});
  }, [toolId, summarySignature]);
  if (runs.length < 2) return null;
  const previous = runs[1];
  return <div className="callout" style={{ marginTop: "12px" }}><div className="ico">◷</div><div className="body"><strong>{locale === "en" ? "Previous run available" : "이전 분석과 비교할 수 있어요"}</strong><br /><span style={{ color: "var(--text-muted)", fontSize: 12 }}>{locale === "en" ? `Prior result: ${previous.summary?.headline || "—"}` : `직전 결론: ${previous.summary?.headline || "—"}`}</span></div></div>;
}
