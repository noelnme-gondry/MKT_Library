"use client";
import ProjectCreateGate from "./ProjectCreateGate";
import { refreshAccount } from "@/lib/account/accountClient";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useDataStore";
import { exportProjectBackup, parseProjectBackup, importProjectBackup } from "@/lib/project/backup";
import { getDecisionReviewBucket } from "@/lib/decisionReview";
import { sanitizeEventMarkers } from "@/lib/project/eventMarkers";
import { toolIndexEntry } from "@/lib/toolIndex";
import { serializeProject } from "@/lib/project/serializeProject";
import { updateProject } from "@/lib/project/repository";
import { PROJECT_LIMITS, bytesLabel } from "@/lib/project/projectLimits";
import { hasPaidAccess, canCreateProject } from "@/lib/subscription/entitlement";
import { downloadFile } from "@/utils/download";
import ProjectStorageSummary from "./ProjectStorageSummary";
import WeeklyReportDocument from "./weekly-review/WeeklyReportDocument";
import ReviewSaveDialog from "./ReviewSaveDialog";
import { requirePaidExport } from "@/lib/subscription/paidExport";

function nextReview(project) {
  return (project.decisions || []).filter(record => record.status !== "reviewed" && record.reviewDate).map(record => record.reviewDate).sort()[0] || "";
}
// 저장된 브랜딩을 초기값으로 갖는다. 부모가 들고 있으면 프로젝트가 바뀔 때 채워 줄
// 방법이 effect뿐이라(§5 금지) `key`로 다시 마운트해 초기값을 잡는다.
function ProjectBrandingForm({ en, initial, disabled, onLogo, onSave }) {
  const [branding, setBranding] = useState(initial || { company: "", footer: "", logo: "" });
  return <section className="project-branding" aria-labelledby="project-branding-title">
    <h3 id="project-branding-title">{en ? "Report branding" : "보고서 브랜딩"}</h3>
    <label className="wr-field">{en ? "Company" : "회사명"}<input maxLength={120} value={branding.company} onChange={event => setBranding(value => ({ ...value, company: event.target.value }))} /></label>
    <label className="wr-field">{en ? "Footer" : "푸터"}<input maxLength={300} value={branding.footer} onChange={event => setBranding(value => ({ ...value, footer: event.target.value }))} /></label>
    <label>{en ? "Logo: PNG/JPEG/WebP, up to 1 MiB and 4096px" : "로고: PNG/JPEG/WebP, 1 MiB·4096px 이하"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => onLogo(event, logo => setBranding(value => ({ ...value, logo })))} /></label>
    <button className="btn" disabled={disabled} onClick={() => onSave(branding)}>{en ? "Save branding" : "브랜딩 저장"}</button>
  </section>;
}
export default function ProjectsPage({ locale = "ko", embedded = false, onReview }) {
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
  const [createGateOpen, setCreateGateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [backup, setBackup] = useState(null);
  const [pendingRestore, setPendingRestore] = useState(null);
  const [batch, setBatch] = useState(false);
  const [openReport, setOpenReport] = useState("");
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
    const session = await refreshAccount();
    if (!hasPaidAccess(useAppStore.getState().entitlement)) {
      if (session.account?.trialStartedAt) return upgrade("project_limit");
      setCreateGateOpen(true); return;
    }
    if (!name.trim()) { setMessage(en ? "Enter a project name." : "프로젝트 이름을 입력해 주세요."); return; }
    const result = await useAppStore.getState().createProject(name);
    if (result.reason === "project_limit") return upgrade("project_limit");
    if (result.reason === "cancelled") return;
    if (!result.ok) throw new Error("PROJECT_CREATE_FAILED");
    if (onReview) onReview(); else router.push(en ? "/en/weekly-review" : "/weekly-review");
  });
  const open = (id, path = "/weekly-review") => run(async () => {
    if (id !== activeId && !await useAppStore.getState().switchProject(id)) { if (useAppStore.getState().projectSwitchCancelled) return; throw new Error("PROJECT_OPEN_FAILED"); }
    if (path === "/weekly-review" && onReview) return onReview();
    router.push(en ? `/en${path}` : path);
  });
  const restoreSetup = (project, item, currentPeriod) => run(async () => {
    if (project.id !== activeId && !await useAppStore.getState().switchProject(project.id)) { if (useAppStore.getState().projectSwitchCancelled) return; throw new Error("PROJECT_OPEN_FAILED"); }
    useAppStore.setState({ pendingSavedAnalysis: { projectId: project.id, item, currentPeriod } });
    const entry = toolIndexEntry(item.toolId, locale);
    if (entry) router.push(en ? `/en${entry.href}` : entry.href);
  });
  const exportOne = id => run(async () => {
    if (id === activeId && hasPaidAccess(useAppStore.getState().entitlement)) await updateProject(id, { decisions: useAppStore.getState().decisionRecords, configuration: await serializeProject(useAppStore.getState(), locale), eventMarkers: sanitizeEventMarkers(useAppStore.getState().eventMarkers) }, () => hasPaidAccess(useAppStore.getState().entitlement), useAppStore.getState().entitlement);
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
    if (!canCreateProject(projects.length, useAppStore.getState().entitlement)) return upgrade("project_limit");
    if (replace && !window.confirm(en ? "Replace this project's files, settings and review history? Export a backup first if needed." : "현재 프로젝트의 파일·설정·검토 이력을 백업 내용으로 교체할까요? 필요하면 먼저 내보내세요.")) return;
    const id = replace ? activeId : crypto.randomUUID();
    await importProjectBackup(backup, id, { replace, entitlement: useAppStore.getState().entitlement });
    if (!await useAppStore.getState().switchProject(id, { saveCurrent: !replace })) throw new Error("PROJECT_RESTORE_FAILED");
    await useAppStore.getState().refreshProjects(); setBackup(null);
    setMessage(en ? "Backup restored. Source files are ready; run analysis to refresh results." : "백업을 복원했습니다. 원본 파일을 불러왔으며 최신 결과는 분석을 실행해 확인하세요.");
  });
  const loadLogo = (event, apply) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    run(async () => {
      if (!hasPaidAccess(entitlement)) return upgrade("branding");
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > PROJECT_LIMITS.logoBytes) throw new Error("LOGO_INVALID");
      const bitmap = await createImageBitmap(file);
      if (bitmap.width > 4096 || bitmap.height > 4096) { bitmap.close(); throw new Error("LOGO_DIMENSIONS"); }
      bitmap.close();
      apply(await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }));
    });
  };
  return <div className="projects-page">
    {createGateOpen && <ProjectCreateGate locale={locale} open onClose={() => setCreateGateOpen(false)} onReady={() => { setCreateGateOpen(false); create(); }} />}
    {pendingRestore && <ReviewSaveDialog locale={locale} onConfirm={pendingRestore} onClose={() => setPendingRestore(null)} />}
    {!embedded && <header><h1>{en ? "My projects" : "내 프로젝트"}</h1><p>{en ? "Open a project to continue its reviews and decisions." : "프로젝트를 열면 지난 결정과 이번 주 리뷰를 이어갈 수 있습니다."}</p></header>}
    {!projects.length && <section className="project-empty"><h2>{en ? "Start with a review" : "리뷰부터 시작하세요"}</h2><p>{en ? "Analyzing needs no project. Create one here to keep reviews together, or just name it when you save your first decision." : "분석만 할 거면 프로젝트가 없어도 됩니다. 리뷰를 모아 두려면 아래에서 만들고, 아니면 첫 결정을 저장할 때 이름을 정해도 됩니다."}</p><Link className="btn primary" href={en ? "/en/start" : "/start"}>{en ? "Start your first review" : "첫 리뷰 시작하기"}</Link></section>}
    {/* 프로젝트를 만드는 것은 이 화면의 주된 행동이다. 주된 행동을 토글 뒤에 두지 않는다. */}
    <section className="project-start-panel" id="project-backup" aria-labelledby="project-start-title">
      <h2 id="project-start-title">{en ? "Create a project or restore a backup" : "새 프로젝트 만들기·백업 복원"}</h2>
      {/* 비활성 이유를 버튼 아래 섹션에만 두면, 위에서 아래로 읽는 사람은 눌리지
          않는 버튼을 먼저 만난다. 이유는 버튼과 같은 자리에 있어야 한다. */}
      {!storageEnabled && <p className="wr-notice">{en ? "Device storage is off, so projects cannot be created yet. Turn it on below." : "기기 저장이 꺼져 있어 아직 프로젝트를 만들 수 없습니다. 아래에서 저장을 켜 주세요."}</p>}
      <div className="project-create"><label className="wr-field"><span>{en ? "New project name" : "새 프로젝트 이름"}</span><input value={name} onChange={event => setName(event.target.value)} maxLength={120} placeholder={en ? "Client or app name" : "고객 또는 앱 이름"} /></label><button className="btn primary" type="button" disabled={!storageEnabled || !ready || busy || switching} onClick={create}>{en ? "Create project" : "프로젝트 만들기"}</button><button className="btn" type="button" disabled={!storageEnabled || busy || switching || !ready} onClick={() => backupInput.current?.click()}>{en ? "Import project backup" : "프로젝트 백업 가져오기"}</button><input ref={backupInput} hidden type="file" accept="application/json,.json" disabled={!storageEnabled || busy || switching || !ready} onChange={preview} /></div>
    </section>
    {!storageEnabled && <section><h2>{en ? "Keep your next review on this device" : "다음 리뷰를 이 기기에 보관하세요"}</h2><p>{en ? "Device storage is off. Enable it to keep or restore projects; files stay in this browser." : "기기 저장이 꺼져 있습니다. 저장을 켜면 프로젝트를 보관·복원할 수 있습니다. 파일은 이 브라우저에만 저장됩니다."}</p><button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); try { useAppStore.getState().setDecisionPersistenceEnabled(true); await useAppStore.getState().initializeProjects(); } catch { setMessage(en ? "Could not enable storage. Check your browser settings." : "저장을 켜지 못했습니다. 브라우저 설정을 확인해 주세요."); } finally { setBusy(false); } }}>{en ? "Enable device storage" : "기기 저장 켜기"}</button> <Link href={en ? "/en/storage" : "/storage"}>{en ? "Storage settings" : "저장 설정"}</Link></section>}
    {!hasPaidAccess(entitlement) && <p className="wr-notice">{en ? "Analysis is free. Creating projects, saving reviews and restoring backups requires Pro. Existing records remain readable and exportable." : "분석은 무료입니다. 프로젝트 생성·리뷰 저장·백업 복원은 Pro 기능이며, 기존 기록은 계속 읽고 내보낼 수 있습니다."} <Link href={en ? "/en/subscription" : "/subscription"}>{en ? "View Pro" : "Pro 안내"}</Link></p>}
    {storageError && <p role="alert">{en ? "Project storage is unavailable or a write failed. Keep a downloaded copy of your current results; saved records may not include the latest changes." : "프로젝트 저장소를 사용할 수 없거나 저장에 실패했습니다. 현재 결과를 내려받아 보관해 주세요. 저장된 기록에는 최신 변경이 빠져 있을 수 있습니다."}</p>}
    {message && <p role="status">{message}</p>}
    {backup && <section className="project-import-preview"><h2>{en ? "Check before restoring" : "복원 전 확인"}</h2><p>{backup.project.name || (en ? "Unnamed project" : "이름 없는 프로젝트")} · {backup.files.length} {en ? "files" : "파일"} · {bytesLabel(backup.bytes)} · {backup.project.decisions.length} {en ? "decisions" : "결정"}</p><p>{en ? "Includes source files, mappings, settings, period snapshots and decisions. Import stays in this browser and does not run analysis automatically." : "원본 파일·매핑·설정·기간 집계·결정 기록을 포함합니다. 이 브라우저에서만 가져오며 분석은 자동 실행하지 않습니다."}</p><button className="btn" disabled={busy || switching || !ready} onClick={() => setPendingRestore(() => () => restore(false))}>{en ? "Restore as new project" : "새 프로젝트로 복원"}</button>{active && <button className="btn" disabled={busy || switching || !ready} onClick={() => setPendingRestore(() => () => restore(true))}>{en ? "Replace current project" : "현재 프로젝트에 복원"}</button>}<button className="btn ghost" onClick={() => setBackup(null)}>{en ? "Cancel" : "취소"}</button></section>}
    <div className="project-list">
      {[...projects].sort((a, b) => (nextReview(a) || "9999").localeCompare(nextReview(b) || "9999")).map(project => {
        const due = nextReview(project);
        const dueRecords = (project.decisions || []).filter(record => ["overdue", "today"].includes(getDecisionReviewBucket(record)));
        const end = [...(project.snapshots || [])].map(snapshot => snapshot.period?.end).filter(Boolean).sort().at(-1);
        return <article className="project-card" key={project.id}>
          <h2>{project.name || (en ? "Existing records" : "기존 기록")}{project.id === activeId ? (en ? " · Current" : " · 현재") : ""}</h2>
          <p>{project.settings?.metric?.toUpperCase() || "—"} · {project.settings?.currency || "—"}</p>
          {/* 보고서 본문은 길어 목록을 밀어내므로 기본은 닫아 두되, 여는 것은 버튼이다. */}
          {project.report?.text && <div className="project-report-reader">
            <button type="button" className="btn" aria-expanded={openReport === project.id} onClick={() => setOpenReport(openReport === project.id ? "" : project.id)}>{openReport === project.id ? (en ? "Close saved report" : "저장한 보고서 닫기") : (en ? "Read saved report" : "저장한 보고서 읽기")}</button>
            {openReport === project.id && <><p>{project.report.generatedAt}</p><WeeklyReportDocument text={project.report.text} /></>}
          </div>}
          <dl><dt>{en ? "Latest snapshot period end" : "최근 집계 기간 종료일"}</dt><dd>{end || "—"}</dd><dt>{en ? "Next review" : "다음 검토일"}</dt><dd>{due || "—"}</dd><dt>{en ? "Open decisions" : "미완료 결정"}</dt><dd>{(project.decisions || []).filter(record => record.status !== "reviewed").length}</dd></dl>
          <section className="project-next-work">{dueRecords.length > 0 && <p className="project-review-due"><strong>{en ? `${dueRecords.length} decisions due for review` : `오늘까지 검토할 결정 ${dueRecords.length}개`}</strong></p>}<h3>{en ? "Next actions" : "이 프로젝트의 다음 할 일"}</h3><p>{due ? (en ? `Review your open decisions, starting with ${due}.` : `${due} 검토 예정인 결정부터 결과를 확인하세요.`) : (en ? "Upload the next period and record a decision to check later." : "다음 기간 데이터를 올리고, 나중에 확인할 결정을 기록하세요.")}</p><div className="workflow-next-step__actions"><button className="btn" disabled={busy || switching || !ready} onClick={() => open(project.id, "/start")}>{en ? "Upload next CSV" : "다음 CSV 분석"}</button></div></section>
          {!!project.savedAnalyses?.length && <section className="saved-analysis-list"><h3>{en ? "Saved analysis setups" : "저장한 분석 설정"}</h3><p>{en ? "Load saved mappings, filters and supported tool inputs. Compare the file before applying." : "매핑·필터·지원하는 도구 입력값을 불러옵니다. 적용 전 새 파일과의 차이를 확인하세요."}</p>{project.savedAnalyses.map(item => <article key={item.id}><strong>{item.name}</strong><span>{toolIndexEntry(item.toolId, locale)?.name || item.toolId}</span><div className="workflow-next-step__actions"><button className="btn primary" disabled={busy || switching || !ready} onClick={() => restoreSetup(project, item, "newFile")}>{en ? "Continue with a new CSV" : "새 CSV로 이어서 분석"}</button><button className="btn" disabled={busy || switching || !ready} onClick={() => restoreSetup(project, item, true)}>{en ? "Keep current period" : "현재 기간으로 불러오기"}</button><button className="btn" disabled={busy || switching || !ready} onClick={() => restoreSetup(project, item, false)}>{en ? "Use saved period" : "저장한 기간으로 불러오기"}</button><button className="btn" disabled={busy || switching || !ready} onClick={() => run(async () => {
              // 같은 화면의 프로젝트 삭제·백업 복원은 확인을 받는데 여기만 안 받았다.
              // 되돌릴 방법이 없으므로 같은 급으로 묻는다.
              if (!window.confirm(en ? `Delete the saved setup "${item.name}"? This cannot be undone.` : `저장한 분석 설정 ‘${item.name}’을 삭제할까요? 되돌릴 수 없습니다.`)) return;
              await updateProject(project.id, current => ({ savedAnalyses: (current.savedAnalyses || []).filter(saved => saved.id !== item.id) }));
              await useAppStore.getState().refreshProjects();
            })}>{en ? "Remove setup" : "설정 삭제"}</button></div></article>)}</section>}
          <div className="project-actions"><button className="btn primary" disabled={busy || switching || !ready} onClick={() => open(project.id)}>{en ? "Open review" : "리뷰 열기"}</button><button className="btn" disabled={busy || switching || !ready} onClick={() => exportOne(project.id)}>{en ? "Export backup" : "백업 내보내기"}</button><button className="btn ghost" disabled={busy || switching || !ready} onClick={() => run(async () => { if (window.confirm(en ? "Delete this project and its stored files and records?" : "프로젝트와 저장된 파일·기록을 삭제할까요?")) await useAppStore.getState().deleteProject(project.id); })}>{en ? "Delete" : "삭제"}</button></div>
        </article>;
      })}
    </div>
    <section><h2>{en ? "Reports and branding" : "보고서·브랜딩"}</h2><button className="btn" onClick={() => hasPaidAccess(entitlement) ? setBatch(!batch) : upgrade("batch_report")}>{en ? "Batch reports" : "일괄 보고서"}</button><p>{en ? "Reports contain the last explicitly saved review for each project, with its period and save date. Missing reports are not estimated." : "프로젝트마다 명시적으로 저장한 마지막 리뷰를 기간·저장일과 함께 모읍니다. 보고서가 없으면 추정해서 채우지 않습니다."}</p>
      {/* 접기를 걷어내면서 현재 프로젝트 값 채우기를 onToggle이 아니라 마운트에 건다. */}
      <ProjectBrandingForm key={`${activeId}:${Boolean(active)}`} en={en} initial={active?.branding} disabled={!active || busy || switching || !ready} onLogo={loadLogo} onSave={branding => run(async () => { if (!hasPaidAccess(entitlement)) return upgrade("branding"); await updateProject(activeId, { branding }, () => hasPaidAccess(useAppStore.getState().entitlement), useAppStore.getState().entitlement); await useAppStore.getState().refreshProjects(); setMessage(en ? "Branding saved on this device." : "이 기기에 브랜딩을 저장했습니다."); })} />
    </section>
    {batch && hasPaidAccess(entitlement) && <section className="project-batch"><h2>{en ? "Saved weekly reports" : "저장된 주간 보고서"}</h2><button className="btn no-print" onClick={() => { if (requirePaidExport({ locale, format: "print" })) window.print(); }}>{en ? "Print / save PDF" : "인쇄 / PDF 저장"}</button>{projects.map(project => <article key={project.id}><h3>{project.name || (en ? "Existing records" : "기존 기록")}</h3>{project.branding?.logo && <Image unoptimized src={project.branding.logo} alt={project.branding.company || ""} width={120} height={60} />}<p>{project.branding?.company}</p><p>{project.report?.generatedAt || "—"}</p>{project.report?.text ? <WeeklyReportDocument text={project.report.text} /> : <p>{en ? "No saved report." : "저장된 보고서가 없습니다."}</p>}<p>{project.branding?.footer}</p></article>)}</section>}
    <ProjectStorageSummary locale={locale} refreshKey={projects} />
  </div>;
}
