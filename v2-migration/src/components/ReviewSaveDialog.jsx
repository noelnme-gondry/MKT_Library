"use client";
import { useState } from "react";
import Link from "next/link";
import ModalDialog from "./ds/ModalDialog";
import AccountArchive from "./AccountArchive";
import ProjectReviewLink from "./ProjectReviewLink";
import { refreshAccount } from "@/lib/account/accountClient";
import { useAppStore } from "@/store/useDataStore";
import { saveProjectReview } from "@/lib/project/saveReview";

export default function ReviewSaveDialog({ locale = "ko", record, report, onSaved, onClose, onConfirm }) {
  const en = locale === "en";
  const projects = useAppStore(state => state.projects);
  const activeId = useAppStore(state => state.activeProjectId);
  const [sourceId] = useState(activeId);
  const persistence = useAppStore(state => state.decisionPersistenceEnabled);
  const [target, setTarget] = useState(projects.some(item => item.id === activeId) ? activeId : "");
  const [name, setName] = useState("");
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(null);
  const needsName = !target || !projects.find(item => item.id === target)?.name?.trim();
  const save = async () => {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const verified = await refreshAccount();
      setSession(verified);
      if (!verified.account) throw new Error("LOGIN_REQUIRED");
      if (useAppStore.getState().activeProjectId !== sourceId) throw new Error("SAVE_CONTEXT_CHANGED");
      if (onConfirm) { await onConfirm(); onClose(); return; }
      if (!useAppStore.getState().decisionPersistenceEnabled) throw new Error("STORAGE_DISABLED");
      const result = await saveProjectReview({ projectId: target, name, record, report, entitlement: verified.entitlement,
        initialDecisions: useAppStore.getState().decisionRecords,
        shouldSave: () => useAppStore.getState().decisionPersistenceEnabled && useAppStore.getState().activeProjectId === sourceId });
      if (result.project.id === useAppStore.getState().activeProjectId && result.record) {
        const state = useAppStore.getState();
        useAppStore.setState({ decisionRecords: result.project.decisions, decisionSessionRecordIds: new Set([...state.decisionSessionRecordIds, result.record.id]) });
      }
      await useAppStore.getState().refreshProjects();
      setSaved(result);
      onSaved?.(result);
    } catch (error) {
      setMessage(error.message === "PROJECT_LIMIT" ? (en ? "Another project requires Pro. Choose an existing project or view plans." : "추가 프로젝트는 Pro에서 만들 수 있습니다. 기존 프로젝트를 선택하거나 요금제를 확인하세요.") : error.message === "LOGIN_REQUIRED" ? (en ? "Sign in before saving. Your draft is still here." : "저장하려면 로그인해 주세요. 작성 내용은 그대로 있습니다.") : (en ? "Could not save. Check sign-in and device storage, then retry. Your draft is unchanged." : "저장하지 못했습니다. 로그인·기기 저장 상태를 확인하고 다시 시도하세요. 작성 내용은 그대로 있습니다."));
    } finally { setBusy(false); }
  };
  return <ModalDialog open onClose={() => { if (!busy) onClose(); }} ariaLabel={en ? "Save review" : "리뷰 저장"} overlayClassName="review-save-overlay" panelClassName="review-save-dialog" closeOnEscape={!busy} closeOnBackdrop={!busy}>
    <h2>{saved ? (en ? "Review saved" : "리뷰를 저장했습니다") : (en ? "Save review" : "리뷰 저장")}</h2>
    {saved ? <>
      <p role="status">{en ? `Saved on this device in ${saved.project.name || "your existing project"}.` : `이 기기의 ‘${saved.project.name || "기존 프로젝트"}’에 저장했습니다.`}</p>
      {saved.record && <AccountArchive record={saved.record} locale={locale} />}
      {saved.record && <ProjectReviewLink projectId={saved.project.id} locale={locale} onNavigate={onClose} />}
      <Link className="btn" href={`${en ? "/en" : ""}/weekly-review#project-management`}>{en ? "Open my projects" : "내 프로젝트 열기"}</Link>
    </> : <>
      <p>{en ? "Sign-in is required to save. Source CSVs and full reports stay on this device; account memo storage requires separate consent." : "리뷰 저장은 로그인이 필요합니다. CSV·전체 보고서는 이 기기에만 보관하며, 결정 메모의 계정 보관은 별도 동의를 받습니다."}</p>
      <AccountArchive profile compact locale={locale} onSession={setSession} />
      {!onConfirm && <>
        <label>{en ? "Save to project" : "저장할 프로젝트"}<select value={target} onChange={event => setTarget(event.target.value)} disabled={busy}>{projects.map(item => <option key={item.id} value={item.id}>{item.name || (en ? "Existing project" : "기존 프로젝트")}</option>)}<option value="">{en ? "New project" : "새 프로젝트"}</option></select></label>
        {needsName && <label>{en ? "Project name" : "프로젝트 이름"}<input value={name} onChange={event => setName(event.target.value)} maxLength={120} placeholder={en ? "Client or app name" : "고객 또는 앱 이름"} disabled={busy} /></label>}
        {target && target !== activeId && <p>{en ? "Only this record is saved to the selected project. Its CSV and analysis setup are not moved." : "선택한 프로젝트에는 이 기록만 저장합니다. CSV·분석 설정은 옮기지 않습니다."}</p>}
        {!persistence && <label><input type="checkbox" checked={false} onChange={() => useAppStore.getState().setDecisionPersistenceEnabled(true)} />{en ? "Enable device storage to keep this review (90 days since last use)." : "이 기기에 리뷰 보관하기 (마지막 사용 후 90일)"}</label>}
      </>}
      <button className="btn primary" disabled={busy || !session?.account || (!onConfirm && (!persistence || (needsName && !name.trim())))} onClick={save}>{busy ? (en ? "Saving…" : "저장 중…") : !target && !onConfirm ? (en ? "Create project and save" : "프로젝트 만들고 저장") : (en ? "Save review" : "리뷰 저장")}</button>
      {message && <p role="alert">{message} <Link href={en ? "/en/subscription" : "/subscription"}>{en ? "Plans" : "요금제"}</Link></p>}
    </>}
    <button className="btn" disabled={busy} onClick={onClose}>{saved ? (en ? "Done" : "닫기") : (en ? "Cancel" : "취소")}</button>
  </ModalDialog>;
}
