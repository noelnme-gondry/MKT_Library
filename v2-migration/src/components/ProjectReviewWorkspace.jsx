"use client";
import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useDataStore";
import ProjectsPage from "./ProjectsPage";
import WeeklyReviewScreen from "./weekly-review/WeeklyReviewScreen";

export default function ProjectReviewWorkspace({ locale = "ko", initialView = "review" }) {
  const en = locale === "en";
  const [view, setView] = useState(initialView);
  const [error, setError] = useState(false);
  const projects = useAppStore(state => state.projects);
  const activeId = useAppStore(state => state.activeProjectId);
  const switching = useAppStore(state => state.projectSwitching);
  const ready = useAppStore(state => state.projectsReady);
  useEffect(() => {
    const hash = () => setView(window.location.hash === "#project-management" ? "manage" : initialView);
    hash(); window.addEventListener("hashchange", hash);
    return () => window.removeEventListener("hashchange", hash);
  }, [initialView]);
  const show = next => { setView(next); window.history.replaceState(null, "", next === "manage" ? "#project-management" : window.location.pathname); };
  return <div className="project-review-workspace">
    <header className="project-review-workspace__bar">
      {view === "review" && <div className="project-review-workspace__title"><h1>{en ? "Project review" : "프로젝트 리뷰"}</h1><p>{en ? "Weekly comparisons, decisions and reports belong to this project." : "이번 주 비교부터 지난 결정·보고서까지, 이 프로젝트에서 이어갑니다."}</p></div>}
      <div className="project-review-workspace__tools">
      <label>{en ? "Current project" : "현재 프로젝트"}<select value={activeId} disabled={!ready || switching || !projects.length} onChange={async event => {
        setError(false);
        if (event.target.value === activeId) return;
        const ok = await useAppStore.getState().switchProject(event.target.value);
        if (ok) show("review"); else setError(true);
      }}>{!projects.length && <option value={activeId}>{en ? "Current review · this session" : "현재 리뷰 · 세션 작업"}</option>}{projects.map(project => <option key={project.id} value={project.id}>{project.name || (en ? "Existing project" : "기존 프로젝트")}</option>)}</select></label>
      <div className="project-review-workspace__views" aria-label={en ? "Project views" : "프로젝트 화면"}>
        <button type="button" className="btn" aria-pressed={view === "review"} onClick={() => show("review")}>{en ? "Weekly review" : "이번 주 리뷰"}</button>
        <button type="button" className="btn" aria-pressed={view === "manage"} onClick={() => show("manage")}>{en ? "Manage projects" : "프로젝트 관리"}</button>
      </div>
      </div>
    </header>
    {error && <p role="alert">{en ? "Could not open this project. Your current review remains available." : "프로젝트를 열지 못했습니다. 현재 리뷰는 유지됩니다."}</p>}
    {switching && <p role="status">{en ? "Opening project…" : "프로젝트를 불러오는 중입니다…"}</p>}
    <div hidden={view !== "review" || switching}><WeeklyReviewScreen key={activeId} locale={locale} embedded /></div>
    {view === "manage" && <section id="project-management"><ProjectsPage locale={locale} embedded onReview={() => show("review")} /></section>}
  </div>;
}
