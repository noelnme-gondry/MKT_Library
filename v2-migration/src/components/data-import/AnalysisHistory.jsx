"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearAnalysisRuns, deleteAnalysisRun, listAnalysisRuns, saveAnalysisRun } from "@/lib/data-import/localHistory";

function matchesLocale(run, locale) {
  if (run.locale) return run.locale === locale;
  const headline = String(run.summary?.headline || "");
  const hasKorean = /[가-힣]/.test(headline);
  return locale === "en" ? !hasKorean : hasKorean;
}

export default function AnalysisHistory({ toolId, summary, locale = "ko" }) {
  const [runs, setRuns] = useState([]);
  const summarySignature = useMemo(() => JSON.stringify(summary), [summary]);
  const lastSavedSignature = useRef("");
  const load = useCallback(() => listAnalysisRuns(toolId)
    .then((items) => items.filter((run) => matchesLocale(run, locale)))
    .then(setRuns)
    .catch(() => {}), [locale, toolId]);
  useEffect(() => {
    const localizedSignature = `${locale}|${summarySignature}`;
    if (!summarySignature || localizedSignature === lastSavedSignature.current) return;
    lastSavedSignature.current = localizedSignature;
    const parsedSummary = JSON.parse(summarySignature);
    saveAnalysisRun({
      toolId,
      locale,
      summary: parsedSummary,
      signature: localizedSignature,
    }).then(load).catch(() => {});
  }, [toolId, locale, summarySignature, load]);
  if (runs.length === 0) return null;
  const previous = runs[1];
  const remove = (id) => deleteAnalysisRun(id).then(load).catch(() => {});
  const clear = () => clearAnalysisRuns(toolId).then(() => setRuns([])).catch(() => {});
  const dateLocale = locale === "en" ? "en-US" : "ko-KR";
  const copy = locale === "en"
    ? {
        title: "Saved decisions",
        local: "Stored only in this browser",
        current: "Current result",
        previous: "Previous result",
        clear: "Clear history",
        remove: "Delete",
        count: `${runs.length} saved`,
      }
    : {
        title: "저장된 판단 기록",
        local: "이 브라우저에만 보관",
        current: "현재 결과",
        previous: "직전 결과",
        clear: "기록 전체 삭제",
        remove: "삭제",
        count: `${runs.length}개 저장`,
      };
  return (
    <section className="analysis-history">
      <header>
        <div>
          <span>DECISION LOG</span>
          <strong>{copy.title}</strong>
        </div>
        <small>{copy.count} · {copy.local}</small>
        <button type="button" onClick={clear}>{copy.clear}</button>
      </header>
      {previous && (
        <div className="analysis-history__compare">
          <span>{copy.previous}</span>
          <p>{previous.summary?.headline || "—"}</p>
        </div>
      )}
      <div className="analysis-history__runs">
        {runs.map((run, index) => (
          <article key={run.id}>
            <div className="analysis-history__run-meta">
              <span>{index === 0 ? copy.current : new Date(run.savedAt).toLocaleString(dateLocale, { dateStyle: "medium", timeStyle: "short" })}</span>
              <button type="button" onClick={() => remove(run.id)}>{copy.remove}</button>
            </div>
            <strong>{run.summary?.headline || "—"}</strong>
            <div className="analysis-history__stats">
              {(run.summary?.stats || []).slice(0, 3).map((stat, statIndex) => (
                <span key={`${stat.label}-${statIndex}`}>{stat.label} <b>{stat.value}</b></span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
