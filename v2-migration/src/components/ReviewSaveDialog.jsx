"use client";
import { useState } from "react";
import Link from "next/link";
import ModalDialog from "./ds/ModalDialog";
import AccountArchive from "./AccountArchive";
import ProjectReviewLink from "./ProjectReviewLink";
import { hasPaidAccess } from "@/lib/subscription/entitlement";
import { refreshAccount } from "@/lib/account/accountClient";
import { useAppStore } from "@/store/useDataStore";
import { saveProjectReview } from "@/lib/project/saveReview";
import { serializeDecisionReviewIcs } from "@/lib/decisionReview";
import { downloadCalendar } from "@/utils/download";
import { trackProductEvent } from "@/lib/analytics";
import { TOOL_GROUP } from "@/lib/toolGroups";

/**
 * 저장 실패 안내.
 *
 * 예전에는 Pro·로그인 말고는 전부 "로그인·기기 저장 상태를 확인하고 다시
 * 시도하세요" 하나로 수렴했다. 거기엔 **다시 시도해도 절대 안 되는 것**이
 * 섞여 있었다 — 프로젝트 메타데이터 10 MiB 초과는 재시도로 안 풀리고,
 * 저장 도중 프로젝트가 바뀐 것은 로그인·저장 설정과 무관하다. 사용자를
 * 무한 재시도로 보내는 안내는 안내가 아니다(§8).
 */
export function saveFailureMessage(code, en) {
  if (["PROJECT_LIMIT", "PRO_REQUIRED"].includes(code)) {
    return en
      ? "Saving projects and reviews requires active Pro, including a trial. Your draft is unchanged."
      : "프로젝트·리뷰 저장에는 유효한 Pro가 필요합니다. 14일 체험도 포함되며, 작성 내용은 그대로 있습니다.";
  }
  if (code === "LOGIN_REQUIRED") {
    return en
      ? "Sign in before saving. Your draft is still here."
      : "저장하려면 로그인해 주세요. 작성 내용은 그대로 있습니다.";
  }
  if (code === "PROJECT_METADATA_LIMIT") {
    return en
      ? "This project has reached its saved-record limit, so retrying will not help. Export a backup, then start a new project for the next reviews. Your draft is unchanged."
      : "이 프로젝트에 쌓인 기록이 상한에 닿아 다시 시도해도 저장되지 않습니다. 백업을 내보낸 뒤 다음 리뷰는 새 프로젝트에 저장하세요. 작성 내용은 그대로 있습니다.";
  }
  if (code === "SAVE_CONTEXT_CHANGED") {
    return en
      ? "The active project changed while saving, so nothing was written. Reopen the project you meant and save again. Your draft is unchanged."
      : "저장하는 동안 열린 프로젝트가 바뀌어 아무것도 쓰지 않았습니다. 저장하려던 프로젝트를 다시 연 뒤 저장하세요. 작성 내용은 그대로 있습니다.";
  }
  if (code === "STORAGE_DISABLED") {
    return en
      ? "Device storage is off, so this review cannot be kept. Turn it on above, then save. Your draft is unchanged."
      : "기기 저장이 꺼져 있어 리뷰를 보관할 수 없습니다. 위에서 저장을 켠 뒤 저장하세요. 작성 내용은 그대로 있습니다.";
  }
  if (code === "PROJECT_NAME_REQUIRED") {
    return en ? "Name the project before saving." : "저장할 프로젝트 이름을 입력해 주세요.";
  }
  if (code === "INVALID_REVIEW") {
    return en
      ? "This review is missing required fields, so it was not saved. Check the decision and its conditions."
      : "필수 항목이 비어 있어 저장하지 않았습니다. 결정과 확인 조건을 다시 봐 주세요.";
  }
  if (code === "PROJECT_MISSING") {
    return en
      ? "That project no longer exists on this device. Choose another project or create one."
      : "그 프로젝트가 이 기기에 없습니다. 다른 프로젝트를 고르거나 새로 만들어 주세요.";
  }
  return en
    ? "Could not save. Check sign-in and device storage, then retry. Your draft is unchanged."
    : "저장하지 못했습니다. 로그인·기기 저장 상태를 확인하고 다시 시도하세요. 작성 내용은 그대로 있습니다.";
}

// 저장 실패 사유는 범주형 코드만 GA에 싣는다. 목록 밖 메시지(IndexedDB 원문 등)는
// 사용자 데이터가 섞일 수 있으므로 통째로 "unknown"으로 접는다(§2.2).
const SAVE_FAILURE_STATES = new Set([
  "PRO_REQUIRED", "LOGIN_REQUIRED", "PROJECT_LIMIT", "PROJECT_METADATA_LIMIT",
  "SAVE_CONTEXT_CHANGED", "STORAGE_DISABLED", "PROJECT_NAME_REQUIRED", "INVALID_REVIEW", "PROJECT_MISSING",
]);

export function saveFailureState(code) {
  return (SAVE_FAILURE_STATES.has(code) ? code : "UNKNOWN").toLowerCase();
}

export default function ReviewSaveDialog({ locale = "ko", record, report, onSaved, onClose, onConfirm }) {
  const en = locale === "en";
  const entitlement = useAppStore(state => state.entitlement);
  const [draftRecord] = useState(() => record ? { ...record, id: record.id || crypto.randomUUID() } : null);
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
      const access = verified.entitlement || useAppStore.getState().entitlement;
      if (!hasPaidAccess(access)) throw new Error("PRO_REQUIRED");
      if (useAppStore.getState().activeProjectId !== sourceId) throw new Error("SAVE_CONTEXT_CHANGED");
      if (onConfirm) { await onConfirm(); onClose(); return; }
      if (!useAppStore.getState().decisionPersistenceEnabled) throw new Error("STORAGE_DISABLED");
      const result = await saveProjectReview({ projectId: target, name, record: draftRecord, report, entitlement: access,
        initialDecisions: useAppStore.getState().decisionRecords,
        shouldSave: () => hasPaidAccess(useAppStore.getState().entitlement || verified.entitlement) && useAppStore.getState().decisionPersistenceEnabled && useAppStore.getState().activeProjectId === sourceId });
      if (result.project.id === useAppStore.getState().activeProjectId && result.record) {
        const state = useAppStore.getState();
        useAppStore.setState({ decisionRecords: result.project.decisions, decisionSessionRecordIds: new Set([...state.decisionSessionRecordIds, result.record.id]) });
      }
      await useAppStore.getState().refreshProjects();
      // Files uploaded before the trial were memory-only. Persist only the source
      // project's active group after explicit local saving, never into another project.
      const state = useAppStore.getState();
      const group = state.activeDataGroup;
      if (result.project.id === state.activeProjectId && state.csvGroups[group]?.workspaceSource) {
        const fileSaved = await state.persistWorkspaceGroup(group, result.project.id);
        if (!fileSaved) result.fileSaveFailed = true;
      }
      setSaved(result);
      onSaved?.(result);
      // 저장 실행의 단일 통과 지점. 표면별 이벤트(weekly_decision_saved 등)는 각 퍼널의
      // 단계이고, 이 이벤트만이 "프로젝트 리뷰 저장이 실제로 일어난 횟수"다 — 합산 금지.
      trackProductEvent("project_review_saved", {
        ...(result.record?.toolId ? { tool_id: result.record.toolId } : {}),
        state: target ? "existing_project" : "new_project",
        result_state: result.record ? (report ? "review_report" : "review") : "report",
        locale,
      });
    } catch (error) {
      setMessage(saveFailureMessage(error.message, en));
      if (!onConfirm) trackProductEvent("project_review_save_failed", {
        ...(draftRecord?.toolId ? { tool_id: draftRecord.toolId } : {}),
        state: saveFailureState(error.message), locale,
      });
    } finally { setBusy(false); }
  };
  return <ModalDialog open onClose={() => { if (!busy) onClose(); }} ariaLabel={en ? "Save review" : "리뷰 저장"} overlayClassName="review-save-overlay" panelClassName="review-save-dialog" closeOnEscape={!busy} closeOnBackdrop={!busy}>
    <h2>{saved ? (en ? "Review saved" : "리뷰를 저장했습니다") : (en ? "Save review" : "리뷰 저장")}</h2>
    {saved ? <>
      <p role="status">{en ? `Saved on this device in ${saved.project.name || "your existing project"}.` : `이 기기의 ‘${saved.project.name || "기존 프로젝트"}’에 저장했습니다.`}</p>
      {saved.fileSaveFailed && <p role="alert">{en ? "The review was saved, but the source file was not. Keep the original file for your next visit." : "리뷰는 저장했지만 원본 파일은 저장하지 못했습니다. 다음 방문을 위해 원본 파일을 따로 보관해 주세요."}</p>}
      {saved.record && <section className="review-next-visit">
        <h3>{en ? "For your next review" : "다음 검토 준비"}</h3>
        {saved.record.sourcePeriod && <p>{en ? "Saved analysis period: " : "저장한 분석 기간: "}{saved.record.sourcePeriod}</p>}
        <p>{TOOL_GROUP[saved.record.toolId] === "efficiency" ? (en ? "Return to this project with a new-period file using the same currency, conversion definition and columns. Check the dates before comparing. Data does not refresh automatically." : "같은 통화·전환 기준·컬럼으로 새 기간의 파일을 준비해 이 프로젝트로 돌아오세요. 비교 전에 날짜를 확인하세요. 데이터는 자동으로 갱신되지 않습니다.") : (en ? "Return to this decision with the next observed results. Keep the measurement definition consistent and check that the observation period is complete before reviewing." : "다음에 관측한 결과를 준비해 이 결정으로 돌아오세요. 같은 측정 기준을 유지하고 관측 기간이 끝났는지 확인한 뒤 검토하세요.")}</p>
        {saved.record.reviewDate && <button className="btn" type="button" onClick={() => {
          const calendar = serializeDecisionReviewIcs(saved.record, locale);
          if (calendar && downloadCalendar(calendar, "decision-review") !== false) trackProductEvent("review_calendar_downloaded", { locale, source: "review_save" });
        }}>{en ? `Add ${saved.record.reviewDate} to calendar · free` : `${saved.record.reviewDate} 캘린더에 추가 · 무료`}</button>}
      </section>}
      {saved.record && <p>{en ? "Optional: keep the selected memo in your account to revisit it on another device. Your local project has been saved; source files are not synced." : "선택 사항: 선택한 메모를 계정에 보관하면 다른 기기에서도 읽을 수 있습니다. 이 기기의 프로젝트 저장은 끝났으며, 원본 파일은 동기화되지 않습니다."}</p>}
      {saved.record && <AccountArchive record={saved.record} locale={locale} />}
      {saved.record && <ProjectReviewLink projectId={saved.project.id} locale={locale} onNavigate={onClose} />}
      <Link className="btn" href={`${en ? "/en" : ""}/weekly-review#project-management`}>{en ? "Open my projects" : "내 프로젝트 열기"}</Link>
    </> : <>
      <p>{en ? "Saving requires sign-in and active Pro, including the 14-day trial. Source CSVs and full reports stay on this device; account memo storage requires separate consent." : "리뷰 저장은 로그인과 유효한 Pro가 필요합니다. 14일 체험도 포함됩니다. CSV·전체 보고서는 이 기기에만 보관하며, 결정 메모의 계정 보관은 별도 동의를 받습니다."}</p>
      <AccountArchive profile compact locale={locale} onSession={setSession} />
      {session?.account && !hasPaidAccess(entitlement || session.entitlement) && <section className="review-next-visit">
        <h3>{en ? "Keep your work with Pro" : "Pro로 기록을 이어가세요"}</h3>
        {!session.account.trialStartedAt ? <>
          <p>{en ? "Create a project to start your 14-day Pro trial, with no automatic payment." : "프로젝트를 만들면 14일 Pro 체험이 시작되며 자동 결제되지 않습니다."}</p>
          {draftRecord ? <AccountArchive record={draftRecord} locale={locale} onSession={setSession} /> : <Link className="btn" href={`${en ? "/en" : ""}/weekly-review#wr-next`} onClick={onClose}>{en ? "Draft a decision to start your trial" : "결정을 작성하고 체험 시작하기"}</Link>}
        </> : <p>{en ? "Your trial has ended. Renew Pro to save or update projects and reviews. Existing records remain readable and exportable." : "체험이 종료되었습니다. 프로젝트·리뷰를 저장하거나 수정하려면 Pro 이용권이 필요합니다. 기존 기록은 계속 읽고 내보낼 수 있습니다."}</p>}
        <Link className="btn" href={en ? "/en/subscription" : "/subscription"}>{en ? "View Pro plans" : "Pro 이용권 보기"}</Link>
      </section>}
      {!onConfirm && <>
        <label>{en ? "Save to project" : "저장할 프로젝트"}<select value={target} onChange={event => setTarget(event.target.value)} disabled={busy}>{projects.map(item => <option key={item.id} value={item.id}>{item.name || (en ? "Existing project" : "기존 프로젝트")}</option>)}<option value="">{en ? "New project" : "새 프로젝트"}</option></select></label>
        {needsName && <label>{en ? "Project name" : "프로젝트 이름"}<input value={name} onChange={event => setName(event.target.value)} maxLength={120} placeholder={en ? "Client or app name" : "고객 또는 앱 이름"} disabled={busy} /></label>}
        {target && target !== activeId && <p>{en ? "Only this record is saved to the selected project. Its CSV and analysis setup are not moved." : "선택한 프로젝트에는 이 기록만 저장합니다. CSV·분석 설정은 옮기지 않습니다."}</p>}
        {!persistence && <label><input type="checkbox" checked={false} onChange={() => useAppStore.getState().setDecisionPersistenceEnabled(true)} />{en ? "Enable device storage to keep this review (90 days since last use)." : "이 기기에 리뷰 보관하기 (마지막 사용 후 90일)"}</label>}
      </>}
      <button className="btn primary" disabled={busy || !session?.account || !hasPaidAccess(entitlement || session?.entitlement) || (!onConfirm && (!persistence || (needsName && !name.trim())))} onClick={save}>{busy ? (en ? "Saving…" : "저장 중…") : !target && !onConfirm ? (en ? "Create project and save" : "프로젝트 만들고 저장") : (en ? "Save review" : "리뷰 저장")}</button>
      {message && <p role="alert">{message} <Link href={en ? "/en/subscription" : "/subscription"}>{en ? "Plans" : "요금제"}</Link></p>}
    </>}
    <button className="btn" disabled={busy} onClick={onClose}>{saved ? (en ? "Done" : "닫기") : (en ? "Cancel" : "취소")}</button>
  </ModalDialog>;
}
