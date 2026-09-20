"use client";
import { useEffect, useId } from "react";
import { useAppStore } from "@/store/useDataStore";

const drafts = new Map();
export function hasReviewDraft(projectId) {
  return [...drafts.values()].some(id => id === projectId);
}
export function confirmProjectExit(state) {
  if (typeof window === "undefined") return true;
  const data = state.csvData;
  const unsavedFile = data.raw?.length && data.importSource !== "demo"
    && (!data.workspaceSource?.blob || data.workspacePersistedSource !== data.workspaceSource.blob);
  if (!hasReviewDraft(state.activeProjectId) && !unsavedFile && !state.reportDraft?.blocks?.length) return true;
  const en = window.location.pathname.startsWith("/en/");
  return window.confirm(en
    ? "Switch projects? Unsaved review input and the current analysis will close. Saved records remain available."
    : "프로젝트를 바꿀까요? 저장하지 않은 리뷰 입력과 현재 분석 화면이 닫힙니다. 저장한 기록은 남습니다.");
}
export function useReviewDraftGuard(dirty) {
  const id = useId();
  const projectId = useAppStore(state => state.activeProjectId);
  useEffect(() => {
    if (!dirty) return undefined;
    drafts.set(id, projectId);
    const unload = event => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", unload);
    return () => { drafts.delete(id); window.removeEventListener("beforeunload", unload); };
  }, [dirty, id, projectId]);
}

export function confirmReviewExit(projectId, locale = "ko") {
  return !hasReviewDraft(projectId) || window.confirm(locale === "en"
    ? "Leave this decision? Unsaved review input will be lost."
    : "다른 검토로 이동할까요? 저장하지 않은 리뷰 입력이 사라집니다.");
}
