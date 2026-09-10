"use client";
import { useState } from "react";
import { useAppStore } from "@/store/useDataStore";
import { inputScope } from "@/lib/analysis-settings/toolInputs";
import { TOOL_GROUP } from "@/lib/toolGroups";
import { compareSavedInput, compatibleSavedAnalysis, savedAnalysisConfiguration } from "@/lib/project/savedAnalyses";

export default function SavedSetupReview({ pending, locale = "ko" }) {
  const en = locale === "en";
  const [comparison, setComparison] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const csv = useAppStore(state => state.csvGroups[TOOL_GROUP[pending.item.toolId]]);
  const check = () => { setComparison({ csv, result: compareSavedInput(pending.item, useAppStore.getState()) }); setMessage(""); };
  const result = comparison?.csv === csv ? comparison.result : null;
  const apply = async () => {
    setBusy(true);
    try {
      const state = useAppStore.getState();
      if (state.activeProjectId !== pending.projectId || !await compatibleSavedAnalysis(pending.item, state) || state.csvGroups !== useAppStore.getState().csvGroups) throw new Error("INCOMPATIBLE");
      const diff = compareSavedInput(pending.item, state);
      if (diff.currencyChanged || diff.basisChanged) throw new Error("UNIT_CHANGED");
      const config = savedAnalysisConfiguration(pending.item, state, pending.currentPeriod);
      if (pending.currentPeriod === "newFile") Object.assign(config.groups[TOOL_GROUP[pending.item.toolId]].filters, { dateStart: null, dateEnd: null, comparisonStart: null, comparisonEnd: null, compareEnabled: false });
      if (pending.item.hasCsv === false) config.groups = {};
      state.applyProjectConfig(config, pending.item.hasCsv === false ? [] : [TOOL_GROUP[pending.item.toolId]]);
      useAppStore.setState({ pendingSavedAnalysis: null });
      setMessage(en ? "Applied. Check model inputs and run analysis." : "적용했습니다. 모델 입력을 확인하고 분석을 실행하세요.");
      useAppStore.setState({ savedSetupAppliedInputs: config.viewConfig[inputScope(pending.item.toolId)] || {}, savedSetupAppliedTool: pending.item.toolId, savedSetupAppliedProject: pending.projectId, savedSetupApplied: (useAppStore.getState().savedSetupApplied || 0) + 1 });
    } catch { setMessage(en ? "Cannot apply: column names or units differ. Adjust the current input or use a matching file." : "컬럼명 또는 단위가 달라 적용할 수 없습니다. 현재 입력을 확인하거나 일치하는 파일을 사용하세요."); }
    finally { setBusy(false); }
  };
  const period = data => data.start && data.end ? `${data.start} — ${data.end}` : (en ? "Unknown" : "확인 불가");
  return <section className="saved-setup-review"><h3>{en ? "Continue a saved analysis" : "저장한 분석 이어가기"} · {pending.item.name}</h3><p>{en ? "Upload the next CSV below, then compare it with the saved input. Existing data stays until you choose another file." : "아래에서 다음 CSV를 올린 뒤 저장 당시 입력과 비교하세요. 다른 파일을 선택하기 전까지 기존 데이터는 유지됩니다."}</p><button className="btn primary" onClick={check} disabled={(pending.item.hasCsv !== false && !csv?.headers?.length) || busy}>{en ? "Compare current CSV" : "현재 CSV와 비교"}</button> <button className="btn" onClick={() => useAppStore.setState({ pendingSavedAnalysis: null })}>{en ? "Cancel setup" : "설정 불러오기 취소"}</button>{result && <><dl className="setup-comparison"><dt>{en ? "Saved period" : "저장 당시 기간"}</dt><dd>{period(result.previous)}</dd><dt>{en ? "Current file period" : "현재 파일 기간"}</dt><dd>{period(result.current)}</dd><dt>{en ? "Missing columns" : "없는 컬럼"}</dt><dd>{result.missing.join(", ") || (en ? "None" : "없음")}</dd><dt>{en ? "Added columns" : "추가된 컬럼"}</dt><dd>{result.added.join(", ") || (en ? "None" : "없음")}</dd><dt>{en ? "Currency / conversion basis" : "통화 / 전환 기준"}</dt><dd>{result.previous.currency || "—"} / {result.previous.basis || "—"} → {result.current.currency || "—"} / {result.current.basis || "—"}</dd></dl><p>{result.added.length > 0 && (en ? "Added columns are not added to the saved mapping. " : "추가된 컬럼은 저장 매핑에 추가하지 않습니다. ")}{pending.currentPeriod === "newFile" ? (en ? "Clears old date filters so the new file is not excluded." : "새 파일이 제외되지 않도록 이전 기간 필터를 해제합니다.") : pending.currentPeriod ? (en ? "Keeps current date filters. Clear old dates if they exclude the new file." : "현재 기간 필터를 유지합니다. 이전 날짜가 새 파일을 제외한다면 기간 필터를 먼저 해제하세요.") : (en ? "Restores the saved date filters." : "저장했던 기간 필터를 적용합니다.")}</p><p>{en ? "Model-specific dates (such as intervention or observation end dates) do not shift automatically. Check them in the tool below." : "개입일·관측 종료일 등 모델별 날짜는 자동 이동하지 않습니다. 아래 도구 입력에서 확인하세요."}</p><button className="btn primary" disabled={busy || !!result.missing.length || result.currencyChanged || result.basisChanged} onClick={apply}>{en ? "Apply checked setup" : "확인한 설정 적용"}</button></>}{message && <p role="status">{message}</p>}</section>;
}
