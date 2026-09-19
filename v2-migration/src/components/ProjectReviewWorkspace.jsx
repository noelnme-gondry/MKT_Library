"use client";
import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useDataStore";
import ProjectsPage from "./ProjectsPage";
import ProjectReviewPortfolio from "./weekly-review/ProjectReviewPortfolio";
import WeeklyReviewScreen from "./weekly-review/WeeklyReviewScreen";

export default function ProjectReviewWorkspace({ locale = "ko", initialView = "review" }) {
  const en = locale === "en";
  const [view, setView] = useState(initialView);
  const [error, setError] = useState(false);
  const [switched, setSwitched] = useState(false);
  const projects = useAppStore(state => state.projects);
  const activeId = useAppStore(state => state.activeProjectId);
  const switching = useAppStore(state => state.projectSwitching);
  const ready = useAppStore(state => state.projectsReady);
  const active = projects.find(project => project.id === activeId);
  useEffect(() => {
    const hash = () => setView(window.location.hash === "#project-management" ? "manage" : initialView);
    hash(); window.addEventListener("hashchange", hash);
    return () => window.removeEventListener("hashchange", hash);
  }, [initialView]);
  const show = next => { setView(next); window.history.replaceState(null, "", next === "manage" ? "#project-management" : window.location.pathname); };
  return <div className="project-review-workspace">
    <header className="project-review-workspace__bar">
      <div className="project-review-workspace__title">
        {view === "review" && <button className="btn ghost" onClick={() => show("manage")}>{en ? "My projects" : "내 프로젝트"}</button>}
        <h1>{view === "manage" ? (en ? "My projects" : "내 프로젝트") : active ? (active.name || (en ? "Existing project" : "기존 프로젝트")) : (en ? "New project" : "새 프로젝트")}</h1>
        <p>{view === "manage" ? (en ? "Open a project to continue its reviews and decisions." : "프로젝트를 열면 지난 결정과 이번 주 리뷰를 이어갈 수 있습니다.") : active ? (en ? "Review this week, then check your previous decisions below." : "이번 주 성과를 확인하고, 아래에서 지난 결정의 결과를 검토하세요.") : (en ? "Start with your data. Choose a project when you save." : "데이터부터 확인하세요. 저장할 때 프로젝트를 정하면 됩니다.")}</p>
      </div>
      {view === "review" && <div className="project-review-workspace__tools">
      {projects.length > 0 &&
      <label>{en ? "Current project" : "현재 프로젝트"}<select value={activeId} disabled={!ready || switching || !projects.length} onChange={async event => {
        setError(false);
        if (event.target.value === activeId) return;
        // 프로젝트를 바꾸면 작성 중인 결정 초안·기간 설정이 사라지고(리뷰 화면이
        // key로 리마운트된다) 올린 CSV·분석 게이트·보고서 초안도 비워진다. 삭제는
        // 확인을 받는데 전환은 안 받고 있었다 — 잃는 양은 비슷하다.
        setSwitched(false);
        const ok = await useAppStore.getState().switchProject(event.target.value);
        if (ok) { setSwitched(true); show("review"); } else if (!useAppStore.getState().projectSwitchCancelled) setError(true);
      }}>{projects.map(project => <option key={project.id} value={project.id}>{project.name || (en ? "Existing project" : "기존 프로젝트")}</option>)}</select></label>}
      </div>}
    </header>
    {error && <p role="alert">{en ? "Could not open this project. Your current review remains available." : "프로젝트를 열지 못했습니다. 현재 리뷰는 유지됩니다."}</p>}
    {switching && <p role="status">{en ? "Opening project…" : "프로젝트를 불러오는 중입니다…"}</p>}
    {/* 저장된 파일은 복원되지만 분석 게이트는 닫힌 채로 온다(매핑을 다시 확인해야
        하므로 의도된 동작이다). 그 사실을 말하지 않으면 사용자는 파일 이름이
        보이는데 결과가 비어 있는 화면을 보고 고장으로 읽는다(§8). */}
    {switched && !switching && <p role="status" className="wr-notice">{en
      ? "Project opened. Saved files are restored, but each tool needs “Run analysis” again so its column mapping is confirmed against this project."
      : "프로젝트를 열었습니다. 저장된 파일은 복원되지만, 결과는 각 도구에서 ‘분석하기’를 다시 눌러야 나옵니다(컬럼 매핑을 다시 확인합니다)."}</p>}
    <div hidden={view !== "review" || switching}><ProjectReviewPortfolio locale={locale} /><WeeklyReviewScreen key={activeId} locale={locale} embedded /></div>
    {view === "manage" && <section id="project-management"><ProjectsPage locale={locale} embedded onReview={() => show("review")} /></section>}
  </div>;
}
