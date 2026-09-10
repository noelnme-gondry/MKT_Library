"use client";
import { useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/store/useDataStore";
import { TOOL_GROUP } from "@/lib/toolGroups";
import { captureSavedAnalysis, MAX_SAVED_ANALYSES } from "@/lib/project/savedAnalyses";
import { updateProject } from "@/lib/project/repository";
import { toolIndexEntry } from "@/lib/toolIndex";

export default function AnalysisSetupBar({ toolId, locale = "ko" }) {
  const en = locale === "en";
  const group = TOOL_GROUP[toolId];
  const data = useAppStore(state => state.csvGroups[group]);
  const filter = useAppStore(state => state.dashboardFilterGroups[group]);
  const activeId = useAppStore(state => state.activeProjectId);
  const projects = useAppStore(state => state.projects);
  const enabled = useAppStore(state => state.decisionPersistenceEnabled && state.projectsReady && !state.projectSwitching);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!group || !data?.headers?.length) return null;
  const project = projects.find(item => item.id === activeId);
  const save = async event => {
    event.preventDefault();
    if (busy || !enabled || !project) return;
    setBusy(true); setMessage("");
    try {
      const item = await captureSavedAnalysis(useAppStore.getState(), toolId, name.trim(), locale);
      const saved = await updateProject(activeId, current => {
        if ((current.savedAnalyses || []).length >= MAX_SAVED_ANALYSES) throw new Error("LIMIT");
        return { savedAnalyses: [...(current.savedAnalyses || []), item] };
      }, () => useAppStore.getState().activeProjectId === activeId && useAppStore.getState().decisionPersistenceEnabled);
      if (!saved) throw new Error("PROJECT_CHANGED");
      await useAppStore.getState().refreshProjects(); setEditing(false);
      setMessage(en ? "Saved. Open it from Projects next time." : "저장했습니다. 다음에는 프로젝트 보관함에서 열어보세요.");
    } catch { setMessage(en ? "Could not save. Check device storage and the 20-setup limit." : "저장하지 못했습니다. 기기 저장 상태와 설정 20개 한도를 확인하세요."); }
    finally { setBusy(false); }
  };
  return <section className="analysis-setup no-print" aria-label={en ? "Data and saved setup" : "데이터와 저장 설정"}>
    <div className="analysis-setup__context"><strong>{en ? "Current input" : "현재 입력"}</strong><span>{data.raw?.length?.toLocaleString() || 0} {en ? "source rows" : "원본 행"}</span><span>{en ? "Shared date filter" : "공통 기간 필터"}: {filter?.dateStart || (en ? "Unrestricted" : "제한 없음")} — {filter?.dateEnd || (en ? "Unrestricted" : "제한 없음")}</span></div>
    <div className="workflow-next-step__actions"><button className="btn" type="button" disabled={!enabled || !project || busy} onClick={() => { setName(toolIndexEntry(toolId, locale)?.name || toolId); setEditing(true); }}>{en ? "Save analysis setup" : "분석 설정 저장"}</button><Link className="btn" href={en ? "/en/projects" : "/projects"}>{en ? "Saved setups" : "저장한 설정"}</Link></div>
    {!project && <p>{en ? "Create a project and enable device storage to save setups." : "프로젝트를 만들고 기기 저장을 켜면 설정을 보관할 수 있습니다."}</p>}
    {editing && <form className="analysis-setup__form" onSubmit={save}><label>{en ? "Setup name" : "설정 이름"}<input value={name} maxLength={120} onChange={event => setName(event.target.value)} required /></label><p>{en ? "Saves column mappings and shared filters. Tool-specific model inputs are not included. Loading this setup requires running analysis again." : "컬럼 매핑과 공통 필터를 저장합니다. 도구별 모델 입력값은 포함하지 않습니다. 불러온 뒤 분석을 다시 실행하세요."}</p><button className="btn primary" disabled={busy || !name.trim()}>{en ? "Save" : "저장"}</button><button className="btn" type="button" disabled={busy} onClick={() => setEditing(false)}>{en ? "Cancel" : "취소"}</button></form>}
    {message && <p role="status">{message}</p>}
  </section>;
}
