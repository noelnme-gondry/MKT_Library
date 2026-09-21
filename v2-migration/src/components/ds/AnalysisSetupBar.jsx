"use client";
import { hasPaidAccess } from "@/lib/subscription/entitlement";
import { TOOL_INPUT_KEYS } from "@/lib/analysis-settings/toolInputs";
import SavedSetupReview from "./SavedSetupReview";
import { useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/store/useDataStore";
import { TOOL_GROUP } from "@/lib/toolGroups";
import { captureSavedAnalysis, MAX_SAVED_ANALYSES } from "@/lib/project/savedAnalyses";
import { updateProject } from "@/lib/project/repository";
import { toolIndexEntry } from "@/lib/toolIndex";

/* ============================================================
 * 한 컴포넌트가 두 자리에 나눠 렌더된다.
 *
 *   slot="context" (본문 맨 위) — 적용된 설정 검토 · 현재 입력 행수·기간.
 *     §5.2의 읽기 순서 1번이 "현재 문맥"이고, "저장한 설정을 적용했습니다.
 *     아래 입력을 확인한 뒤…"라는 문구가 **아래를** 가리키므로 위에 있어야 한다.
 *   slot="actions" (결과 뒤) — 분석 설정 저장 · 저장한 설정 보관함.
 *     예전에는 이 둘도 맨 위에 있었다. 분석하기 전에 "설정 저장"을 물을 이유가
 *     없고, 결론을 본 사용자에게는 화면 밖이라 프로젝트 동선이 끊겼다.
 *
 * 통째로 내리면 위 문구가 거짓이 되고, 통째로 두면 프로젝트로 가는 길이 없다.
 * 그래서 이동이 아니라 분리다.
 * ============================================================ */
export default function AnalysisSetupBar({ toolId, locale = "ko", slot = "context" }) {
  const en = locale === "en";
  const group = TOOL_GROUP[toolId];
  const data = useAppStore(state => state.csvGroups[group]);
  const filter = useAppStore(state => state.dashboardFilterGroups[group]);
  const activeId = useAppStore(state => state.activeProjectId);
  const projects = useAppStore(state => state.projects);
  const entitlement = useAppStore(state => state.entitlement);
  const enabled = useAppStore(state => hasPaidAccess(state.entitlement) && state.decisionPersistenceEnabled && state.projectsReady && !state.projectSwitching && state.workspaceRestoreStatus !== "loading");
  const applied = useAppStore(state => state.savedSetupAppliedTool === toolId && state.savedSetupAppliedProject === state.activeProjectId && Boolean(state.savedSetupApplied));
  const pending = useAppStore(state => state.pendingSavedAnalysis);
  const applicablePending = pending?.projectId === activeId && pending.item.toolId === toolId ? pending : null;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!group || (!data?.headers?.length && !applicablePending && !TOOL_INPUT_KEYS[toolId]?.length)) return null;
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
      }, () => useAppStore.getState().activeProjectId === activeId && useAppStore.getState().decisionPersistenceEnabled && hasPaidAccess(useAppStore.getState().entitlement), entitlement);
      if (!saved) throw new Error("PROJECT_CHANGED");
      await useAppStore.getState().refreshProjects(); setEditing(false);
      setMessage(en ? "Saved. Open it from Projects next time." : "저장했습니다. 다음에는 프로젝트 보관함에서 열어보세요.");
    } catch { setMessage(en ? "Could not save. Check device storage and the 20-setup limit." : "저장하지 못했습니다. 기기 저장 상태와 설정 20개 한도를 확인하세요."); }
    finally { setBusy(false); }
  };
  if (slot === "context") {
    return <section className="analysis-setup no-print" aria-label={en ? "Data and applied setup" : "데이터와 적용된 설정"}>
      {applied && !applicablePending && <p className="setup-applied-note">{en ? "Saved settings applied. Check the inputs below before using the results." : "저장한 설정을 적용했습니다. 아래 입력을 확인한 뒤 결과를 사용하세요."}</p>}
      {applicablePending && <SavedSetupReview key={applicablePending.item.id} pending={applicablePending} locale={locale} />}
      <div className="analysis-setup__context"><strong>{en ? "Current input" : "현재 입력"}</strong><span>{data?.raw?.length?.toLocaleString() || 0} {en ? "source rows" : "원본 행"}</span><span>{en ? "Shared date filter" : "공통 기간 필터"}: {filter?.dateStart || (en ? "Unrestricted" : "제한 없음")} — {filter?.dateEnd || (en ? "Unrestricted" : "제한 없음")}</span></div>
    </section>;
  }
  // 여기서 데이터 유무를 다시 막지 않는다. 위의 최상단 가드가 이미
  // "CSV도 없고 저장할 수동 입력도 없으면 null"을 처리한다. 헤더만 보고
  // 막았더니 CSV 없이 수동 입력만 쓰는 도구(ASA 키워드의 목표 CPA 등)에서
  // 저장 동선이 통째로 사라졌다 — e2e가 잡았다.
  return <section className="analysis-setup analysis-setup--actions no-print" aria-label={en ? "Keep this setup" : "이 설정 보관하기"}>
    {/* 위계를 준다 — 저장이 행동이고 보관함은 이동이다. 둘을 같은 버튼으로 두면
        §5.3이 금지하는 "동급으로 보이는 CTA 여럿"이 된다. */}
    <div className="workflow-next-step__actions">
      <button className="btn primary" type="button" disabled={!enabled || !project || busy} onClick={() => { setName(toolIndexEntry(toolId, locale)?.name || toolId); setEditing(true); }}>{en ? "Save this setup to the project" : "이 설정을 프로젝트에 저장"}</button>
      <Link className="analysis-setup__link" href={en ? "/en/projects" : "/projects"}>{en ? "Open saved setups" : "저장한 설정 보관함"}</Link>
    </div>
    {(!project || !hasPaidAccess(entitlement)) && <p>{en ? "Active Pro and a project with device storage are required to save setups." : "유효한 Pro와 기기 저장을 켠 프로젝트가 있어야 설정을 보관할 수 있습니다."}</p>}
    {editing && <form className="analysis-setup__form" onSubmit={save}><label>{en ? "Setup name" : "설정 이름"}<input value={name} maxLength={120} onChange={event => setName(event.target.value)} required /></label><p>{en ? "Saves mappings, shared filters and supported model options. Results and validation approvals are excluded. Check inputs before rerunning." : "컬럼 매핑·공통 필터·지원하는 모델 옵션을 저장합니다. 결과와 검증 완료 상태는 포함하지 않습니다. 입력을 확인한 뒤 다시 분석하세요."}</p><button className="btn primary" disabled={busy || !name.trim()}>{en ? "Save" : "저장"}</button><button className="btn" type="button" disabled={busy} onClick={() => setEditing(false)}>{en ? "Cancel" : "취소"}</button></form>}
    {message && <p role="status">{message}</p>}
  </section>;
}
