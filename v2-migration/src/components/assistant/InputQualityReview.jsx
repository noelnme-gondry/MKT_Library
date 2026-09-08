"use client";

import { useEffect, useState } from "react";
import { prepareAnalysisHandoff } from "@/lib/assistant/prepareAnalysisHandoff";
import { executionPreflight } from "@/lib/analysis-router/executionPreflight";
import { formatEligibilityBlocker } from "@/lib/analysis-router/evaluateEligibility";

// The owner keys this panel by input + mapping + locale so stale checks cannot survive edits.
export default function InputQualityReview({ csvData, toolId, locale = "ko" }) {
  const en = locale === "en";
  const [requested, setRequested] = useState(false);
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!requested) return undefined;
    let cancelled = false;
    let inner;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        if (cancelled) return;
        try {
          setResult(executionPreflight(prepareAnalysisHandoff(csvData, toolId), toolId, locale));
        } catch {
          setResult({ status: "error" });
        }
      });
    });
    return () => { cancelled = true; cancelAnimationFrame(outer); if (inner != null) cancelAnimationFrame(inner); };
  }, [requested, csvData, toolId, locale]);
  const messages = result ? [
    ...(result.scope === "tool_design" ? [result.message] : (result.blockers || []).map((blocker) => formatEligibilityBlocker({ blockers: [blocker] }, locale))),
    ...(result.reasonDetails || []),
  ].filter(Boolean) : [];
  return <section className="dochi-workspace__adapter-note" aria-label={en ? "Detailed input quality" : "상세 입력 품질"}>
    <strong>{result?.status === "blocked" ? (en ? "Input blocked" : "입력 조건 미충족")
      : result?.status === "caution" ? (en ? "Review input cautions" : "입력 주의사항 확인")
      : result?.status === "ready" ? (en ? "Input checks passed" : "입력 검사 통과")
      : result?.status === "error" ? (en ? "Quality check unavailable" : "품질 검사 불가")
      : (en ? "Detailed quality not checked yet" : "상세 품질 아직 미검사")}</strong>
    <p>{en ? "Recommendation is an initial candidate. This uses the same input checks as execution; passing does not validate the model or causal design." : "추천은 1차 후보입니다. 실행 직전과 같은 입력 검사를 사용하며 통과가 모형·인과 설계의 타당성을 뜻하지는 않습니다."}</p>
    {!requested && <button type="button" className="ab-pill" onClick={() => setRequested(true)}>{en ? "Check detailed input quality" : "상세 입력 품질 확인"}</button>}
    {requested && !result && <span role="status">{en ? "Checking input…" : "입력을 확인하고 있습니다…"}</span>}
    {messages.length > 0 && <ul>{messages.map((message, index) => <li key={index}>{message}</li>)}</ul>}
    {result?.status === "error" && <p>{en ? "No quality verdict was produced. Review the detailed tool before proceeding." : "품질 판정을 만들지 못했습니다. 상세 도구에서 입력을 확인하세요."}</p>}
  </section>;
}
