"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useDataStore";
import { exportProjectBackup, parseProjectBackup, importProjectBackup } from "@/lib/project/backup";
import { sanitizeEventMarkers } from "@/lib/project/eventMarkers";
import { serializeProject } from "@/lib/project/serializeProject";
import { updateProject } from "@/lib/project/repository";
import { PROJECT_LIMITS, bytesLabel } from "@/lib/project/projectLimits";
import { hasPaidAccess, canCreateProject } from "@/lib/subscription/entitlement";
import { downloadFile } from "@/utils/download";
import ProjectStorageSummary from "./ProjectStorageSummary";
import WeeklyReportDocument from "./weekly-review/WeeklyReportDocument";

function nextReview(project) {
  return (project.decisions || []).filter(record => record.status !== "reviewed" && record.reviewDate).map(record => record.reviewDate).sort()[0] || "";
}
export default function ProjectsPage({ locale = "ko" }) {
  const en = locale === "en";
  const backupInput = useRef(null);
  const router = useRouter();
  const projects = useAppStore(state => state.projects);
  const activeId = useAppStore(state => state.activeProjectId);
  const ready = useAppStore(state => state.projectsReady);
  const storageEnabled = useAppStore(state => state.decisionPersistenceEnabled);
  const storageError = useAppStore(state => state.projectError);
  const switching = useAppStore(state => state.projectSwitching);
  const entitlement = useAppStore(state => state.entitlement);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [backup, setBackup] = useState(null);
  const [batch, setBatch] = useState(false);
  const [branding, setBranding] = useState({ company: "", footer: "", logo: "" });
  const active = projects.find(project => project.id === activeId);
  useEffect(() => { useAppStore.getState().refreshProjects(); }, []);
  const upgrade = reason => { useAppStore.setState({ upgradeReason: reason }); router.push(en ? "/en/subscription" : "/subscription"); };
  const run = async action => {
    if (busy || switching || !ready) return;
    setBusy(true); setMessage("");
    try { await action(); }
    catch { setMessage(en ? "Could not complete this action. Check the backup format and available storage. Your current analysis remains open." : "작업을 완료하지 못했습니다. 백업 형식과 저장 공간을 확인해 주세요. 현재 분석은 유지됩니다."); }
    finally { setBusy(false); }
  };
  const create = () => run(async () => {
    const result = await useAppStore.getState().createProject(name);
    if (result.reason === "project_limit") return upgrade("project_limit");
    if (!result.ok) throw new Error("PROJECT_CREATE_FAILED");
    router.push(en ? "/en/weekly-review" : "/weekly-review");
  });
  const open = id => run(async () => {
    if (!await useAppStore.getState().switchProject(id)) throw new Error("PROJECT_OPEN_FAILED");
    router.push(en ? "/en/weekly-review" : "/weekly-review");
  });
  const exportOne = id => run(async () => {
    if (id === activeId) await updateProject(id, { decisions: useAppStore.getState().decisionRecords, configuration: await serializeProject(useAppStore.getState(), locale), eventMarkers: sanitizeEventMarkers(useAppStore.getState().eventMarkers) });
    const blob = await exportProjectBackup(id);
    downloadFile(blob, "growthopt-project-backup.json");
  });
  const preview = event => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    run(async () => {
      if (file.size > PROJECT_LIMITS.backupBytes) throw new Error("BACKUP_TOO_LARGE");
      setBackup(parseProjectBackup(await file.text()));
    });
  };
  const restore = replace => run(async () => {
    if (!replace && !canCreateProject(projects.length, entitlement)) return upgrade("project_limit");
    if (replace && !window.confirm(en ? "Replace this project's files, settings and review history? Export a backup first if needed." : "현재 프로젝트의 파일·설정·검토 이력을 백업 내용으로 교체할까요? 필요하면 먼저 내보내세요.")) return;
    const id = replace ? activeId : crypto.randomUUID();
    await importProjectBackup(backup, id, { replace, entitlement });
    if (!await useAppStore.getState().switchProject(id, { saveCurrent: !replace })) throw new Error("PROJECT_RESTORE_FAILED");
    await useAppStore.getState().refreshProjects(); setBackup(null);
    setMessage(en ? "Backup restored. Source files are ready; run analysis to refresh results." : "백업을 복원했습니다. 원본 파일을 불러왔으며 최신 결과는 분석을 실행해 확인하세요.");
  });
  const loadLogo = event => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    run(async () => {
      if (!hasPaidAccess(entitlement)) return upgrade("branding");
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > PROJECT_LIMITS.logoBytes) throw new Error("LOGO_INVALID");
      const bitmap = await createImageBitmap(file);
      if (bitmap.width > 4096 || bitmap.height > 4096) { bitmap.close(); throw new Error("LOGO_DIMENSIONS"); }
      bitmap.close();
      const logo = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      setBranding(value => ({ ...value, logo }));
    });
  };
  return <div className="projects-page">
    <header><h1>{en ? "Projects" : "프로젝트 보관함"}</h1><p>{en ? "Keep each client or app separate. Select the project before uploading next week's file; filenames may change." : "고객·앱별 데이터를 따로 관리합니다. 다음 주 파일을 올리기 전에 프로젝트를 선택하세요. 파일명은 달라도 됩니다."}</p><Link className="btn" href={en ? "/en/subscription" : "/subscription"}>{en ? "Subscription and storage guide" : "구독·저장 용량 안내"}</Link></header>
    <section className="project-start-panel" id="project-backup">
      <h2>{en ? "Your next review starts here" : "다음 주 리뷰도 여기서 이어가세요"}</h2>
      <p>{en ? "Choose a project, upload this week's CSV, and save your review. Keep each client's decisions together." : "프로젝트 선택 → 이번 주 CSV 업로드 → 리뷰 저장. 고객·앱별로 지난 결정과 다음 결과를 한곳에 모읍니다."}</p>
      <div className="project-create"><label className="wr-field"><span>{en ? "New project name" : "새 프로젝트 이름"}</span><input value={name} onChange={event => setName(event.target.value)} maxLength={120} placeholder={en ? "Client or app name" : "고객 또는 앱 이름"} /></label><button className="btn primary" type="button" disabled={!storageEnabled || !ready || busy || switching} onClick={create}>{en ? "Create project" : "프로젝트 만들기"}</button><button className="btn" type="button" disabled={!storageEnabled || busy || switching || !ready} onClick={() => backupInput.current?.click()}>{en ? "Import project backup" : "프로젝트 백업 가져오기"}</button><input ref={backupInput} hidden type="file" accept="application/json,.json" disabled={!storageEnabled || busy || switching || !ready} onChange={preview} /></div>
    </section>
    {!storageEnabled && <section><h2>{en ? "Keep your next review on this device" : "다음 리뷰를 이 기기에 보관하세요"}</h2><p>{en ? "Device storage is off. Enable it to keep or restore projects; files stay in this browser." : "기기 저장이 꺼져 있습니다. 저장을 켜면 프로젝트를 보관·복원할 수 있습니다. 파일은 이 브라우저에만 저장됩니다."}</p><button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); try { useAppStore.getState().setDecisionPersistenceEnabled(true); await useAppStore.getState().initializeProjects(); } catch { setMessage(en ? "Could not enable storage. Check your browser settings." : "저장을 켜지 못했습니다. 브라우저 설정을 확인해 주세요."); } finally { setBusy(false); } }}>{en ? "Enable device storage" : "기기 저장 켜기"}</button> <Link href={en ? "/en/storage" : "/storage"}>{en ? "Storage settings" : "저장 설정"}</Link></section>}
    {storageError && <p role="alert">{en ? "Project storage is unavailable or a write failed. Keep a downloaded copy of your current results; saved records may not include the latest changes." : "프로젝트 저장소를 사용할 수 없거나 저장에 실패했습니다. 현재 결과를 내려받아 보관해 주세요. 저장된 기록에는 최신 변경이 빠져 있을 수 있습니다."}</p>}
    {message && <p role="status">{message}</p>}
    {backup && <section className="project-import-preview"><h2>{en ? "Check before restoring" : "복원 전 확인"}</h2><p>{backup.project.name || (en ? "Unnamed project" : "이름 없는 프로젝트")} · {backup.files.length} {en ? "files" : "파일"} · {bytesLabel(backup.bytes)} · {backup.project.decisions.length} {en ? "decisions" : "결정"}</p><p>{en ? "Includes source files, mappings, settings, period snapshots and decisions. Import stays in this browser and does not run analysis automatically." : "원본 파일·매핑·설정·기간 집계·결정 기록을 포함합니다. 이 브라우저에서만 가져오며 분석은 자동 실행하지 않습니다."}</p><button className="btn" disabled={busy || switching || !ready} onClick={() => restore(false)}>{en ? "Restore as new project" : "새 프로젝트로 복원"}</button>{active && <button className="btn" disabled={busy || switching || !ready} onClick={() => restore(true)}>{en ? "Replace current project" : "현재 프로젝트에 복원"}</button>}<button className="btn ghost" onClick={() => setBackup(null)}>{en ? "Cancel" : "취소"}</button></section>}
    <div className="project-list">
      {!projects.length && <section className="project-empty"><h2>{en ? "Make your first review worth returning to" : "첫 리뷰를 다음 주의 기준으로 만드세요"}</h2><p>{en ? "Compare performance, record what you will change, then check the next results. Explore a review before creating a project." : "성과를 비교하고 바꿀 행동을 기록한 뒤, 다음 결과를 확인하세요. 프로젝트를 만들기 전에 주간 리뷰를 먼저 살펴볼 수도 있습니다."}</p><Link className="btn primary" href={en ? "/en/weekly-review" : "/weekly-review"}>{en ? "Start a weekly review" : "주간 리뷰 시작"}</Link></section>}
      {[...projects].sort((a, b) => (nextReview(a) || "9999").localeCompare(nextReview(b) || "9999")).map(project => {
        const due = nextReview(project);
        const end = [...(project.snapshots || [])].map(snapshot => snapshot.period?.end).filter(Boolean).sort().at(-1);
        return <article className="project-card" key={project.id}>
          <h2>{project.name || (en ? "Existing records" : "기존 기록")}{project.id === activeId ? (en ? " · Current" : " · 현재") : ""}</h2>
          <p>{project.settings?.metric?.toUpperCase() || "—"} · {project.settings?.currency || "—"}</p>
          {project.report?.text && <details><summary>{en ? "Read saved report" : "저장한 보고서 읽기"}</summary><p>{project.report.generatedAt}</p><WeeklyReportDocument text={project.report.text} /></details>}
          <dl><dt>{en ? "Latest snapshot period end" : "최근 집계 기간 종료일"}</dt><dd>{end || "—"}</dd><dt>{en ? "Next review" : "다음 검토일"}</dt><dd>{due || "—"}</dd><dt>{en ? "Open decisions" : "미완료 결정"}</dt><dd>{(project.decisions || []).filter(record => record.status !== "reviewed").length}</dd></dl>
          <div className="project-actions"><button className="btn primary" disabled={busy || switching || !ready} onClick={() => open(project.id)}>{en ? "Open review" : "리뷰 열기"}</button><button className="btn" disabled={busy || switching || !ready} onClick={() => exportOne(project.id)}>{en ? "Export backup" : "백업 내보내기"}</button><button className="btn ghost" disabled={busy || switching || !ready} onClick={() => run(async () => { if (window.confirm(en ? "Delete this project and its stored files and records?" : "프로젝트와 저장된 파일·기록을 삭제할까요?")) await useAppStore.getState().deleteProject(project.id); })}>{en ? "Delete" : "삭제"}</button></div>
        </article>;
      })}
    </div>
    <section><h2>{en ? "Reports and branding" : "보고서·브랜딩"}</h2><button className="btn" onClick={() => hasPaidAccess(entitlement) ? setBatch(!batch) : upgrade("batch_report")}>{en ? "Batch reports" : "일괄 보고서"}</button><p>{en ? "Reports contain the last explicitly saved review for each project, with its period and save date. Missing reports are not estimated." : "프로젝트마다 명시적으로 저장한 마지막 리뷰를 기간·저장일과 함께 모읍니다. 보고서가 없으면 추정해서 채우지 않습니다."}</p>
      <details key={activeId} onToggle={event => { if (event.currentTarget.open) setBranding(active?.branding || { company: "", footer: "", logo: "" }); }}><summary>{en ? "Report branding" : "보고서 브랜딩"}</summary><label className="wr-field">{en ? "Company" : "회사명"}<input maxLength={120} value={branding.company} onChange={event => setBranding(value => ({ ...value, company: event.target.value }))} /></label><label className="wr-field">{en ? "Footer" : "푸터"}<input maxLength={300} value={branding.footer} onChange={event => setBranding(value => ({ ...value, footer: event.target.value }))} /></label><label>{en ? "Logo: PNG/JPEG/WebP, up to 1 MiB and 4096px" : "로고: PNG/JPEG/WebP, 1 MiB·4096px 이하"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={loadLogo} /></label><button className="btn" disabled={!active || busy || switching || !ready} onClick={() => run(async () => { if (!hasPaidAccess(entitlement)) return upgrade("branding"); await updateProject(activeId, { branding }); await useAppStore.getState().refreshProjects(); setMessage(en ? "Branding saved on this device." : "이 기기에 브랜딩을 저장했습니다."); })}>{en ? "Save branding" : "브랜딩 저장"}</button></details>
    </section>
    {batch && hasPaidAccess(entitlement) && <section className="project-batch"><h2>{en ? "Saved weekly reports" : "저장된 주간 보고서"}</h2><button className="btn no-print" onClick={() => window.print()}>{en ? "Print / save PDF" : "인쇄 / PDF 저장"}</button>{projects.map(project => <article key={project.id}><h3>{project.name || (en ? "Existing records" : "기존 기록")}</h3>{project.branding?.logo && <Image unoptimized src={project.branding.logo} alt={project.branding.company || ""} width={120} height={60} />}<p>{project.branding?.company}</p><p>{project.report?.generatedAt || "—"}</p>{project.report?.text ? <WeeklyReportDocument text={project.report.text} /> : <p>{en ? "No saved report." : "저장된 보고서가 없습니다."}</p>}<p>{project.branding?.footer}</p></article>)}</section>}
    <ProjectStorageSummary locale={locale} refreshKey={projects} />
  </div>;
}
