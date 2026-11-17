"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppStore } from "@/store/useDataStore";
import { hasPaidAccess } from "@/lib/subscription/entitlement";
import { refreshAccount } from "@/lib/account/accountClient";
import { isDemoData } from "@/lib/dataOrigin";
import { updateProject } from "@/lib/project/repository";
import { useReviewDraftGuard } from "@/lib/project/reviewDraftGuard";
import { ALERT_WINDOWS, MAX_ALERT_RULES, bindAlertRule, checkAlert, evaluateAlert, sourceHeader, sameAlertSeries } from "@/lib/performance-alerts/rules";
import { saveAlertRule } from "@/lib/performance-alerts/storage";
import { CommaNumberInput } from "@/components/tools/marketingResponseModel";
import ProjectCreateGate from "@/components/ProjectCreateGate";
import AlertTrend, { alertNumber } from "./AlertTrend";

const INITIAL = { name: "", metric: "cpr", basis: "installs", days: 7, comparison: "previous", percent: 20, direction: "up", target: 10000, channel: "", valueHeader: "" };
const ISSUES = {
  ko: { columns: "저장한 컬럼·역할 매핑과 다릅니다. 같은 계열의 CSV를 올리거나 조건을 다시 설정하세요.", currency: "저장한 통화와 다릅니다.", dates: "명확한 일별 날짜가 필요합니다. 주·월 합계나 모호한 날짜는 사용할 수 없습니다.", numbers: "선택한 컬럼에 빈 값·무효 숫자·음수가 있습니다.", scope: "선택한 채널의 데이터가 없습니다.", coverage: "직전·최근 기간의 모든 날짜가 필요합니다. 빠진 날짜를 0으로 채우지 않습니다.", denominator: "성과 합계 또는 비교 기준이 0이라 상대 변화를 계산할 수 없습니다.", unconfirmed: "일치하는 실제 CSV의 매핑을 확인하고 분석하세요." },
  en: { columns: "Source columns or role mappings differ. Upload the same data series or reconfigure this rule.", currency: "The saved currency differs.", dates: "Unambiguous daily dates are required. Weekly/monthly totals are unsupported.", numbers: "The selected column contains missing, invalid or negative values.", scope: "There are no rows for the selected channel.", coverage: "Every date in both windows is required. Missing days are not filled with zero.", denominator: "Outcomes or the reference are zero; relative change is unavailable.", unconfirmed: "Confirm mappings and analyze a matching real CSV." },
};
export function AlertVerdict({ rule, locale = "ko" }) {
  const en = locale === "en", result = evaluateAlert(rule);
  return <div className="performance-alerts__verdict" data-alert-status={result.status}><strong>{result.status === "triggered" ? (en ? "Condition met" : "조건 충족") : result.status === "clear" ? (en ? "Condition not met" : "조건 미충족") : (en ? "Cannot check" : "확인 불가")}</strong><span>{result.status === "unavailable" ? ISSUES[en ? "en" : "ko"][result.issue] : `${alertNumber(rule, result.value)} · ${result.change >= 0 ? "+" : ""}${result.change.toFixed(1)}% ${en ? "vs reference" : "기준 대비"}`}</span></div>;
}
export default function PerformanceAlerts({ locale = "ko", manage = false }) {
  const en = locale === "en", t = (ko, eng) => en ? eng : ko;
  const projectId = useAppStore(state => state.activeProjectId);
  const projects = useAppStore(state => state.projects);
  const data = useAppStore(state => state.csvGroups.efficiency);
  const ready = useAppStore(state => state.activeDataGroup === "efficiency" && state.isGroupAnalyzed("5-31"));
  const storage = useAppStore(state => state.decisionPersistenceEnabled);
  const switching = useAppStore(state => state.projectSwitching || !state.projectsReady);
  const entitlement = useAppStore(state => state.entitlement);
  const project = projects.find(item => item.id === projectId), rules = project?.performanceAlerts || [];
  const namedProject = Boolean(project?.name?.trim());
  const [draft, setDraft] = useState(INITIAL), [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState(null), [preview, setPreview] = useState(null);
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [gate, setGate] = useState(false);
  const [message, setMessage] = useState(""), [projectName, setProjectName] = useState("");
  useReviewDraftGuard(dirty);
  const channelHeader = sourceHeader(data, "channel");
  const channels = useMemo(() => ready && channelHeader ? [...new Set(data.raw.map(row => String(row[channelHeader] ?? "").trim()).filter(Boolean))].sort() : [], [data.raw, channelHeader, ready]);
  const change = (key, value) => { setDraft(current => ({ ...current, [key]: value })); setPreview(null); setDirty(true); setMessage(""); };
  const effectiveDraft = { ...draft, name: draft.name.trim() || t("새 성과 알림", "New performance alert"), valueHeader: draft.valueHeader || sourceHeader(data, "cost") };
  const previewRule = preview?.raw === data.raw ? preview.rule : null;
  const chartRule = previewRule || rules.find(rule => rule.id === selected);
  const canPreview = ready && Boolean(data.raw?.length);
  const makeRule = () => {
    const bound = bindAlertRule(effectiveDraft, data, editingId || crypto.randomUUID());
    const existing = rules.find(rule => rule.id === editingId);
    const sameSeries = sameAlertSeries(existing, bound);
    return { ...bound, enabled: existing ? existing.enabled : true, history: sameSeries ? existing.history : [] };
  };
  const showPreview = () => {
    try { setPreview({ raw: data.raw, rule: checkAlert(makeRule(), data) }); setMessage(""); }
    catch { setMessage(t("날짜·지표·성과 컬럼의 매핑과 원본 통화를 먼저 확인하세요.", "Confirm date, metric and outcome mappings and the source currency first.")); }
  };
  const save = async event => {
    event?.preventDefault();
    if (busy || switching || !canPreview) return;
    setBusy(true); setMessage("");
    try {
      if (isDemoData(data)) throw new Error("DEMO");
      const account = await refreshAccount();
      if (!account?.account || !hasPaidAccess(useAppStore.getState().entitlement)) { setGate(true); return; }
      if (!useAppStore.getState().decisionPersistenceEnabled) throw new Error("STORAGE_REQUIRED");
      const rule = checkAlert(makeRule(), data);
      const sourceRaw = data.raw;
      const saved = await saveAlertRule({ projectId: project?.id, projectName, rule, sourceData: data, entitlement: useAppStore.getState().entitlement,
        shouldSave: () => { const live = useAppStore.getState(); return live.activeProjectId === projectId && live.csvGroups.efficiency?.raw === sourceRaw && live.csvGroups.efficiency?.mapping === data.mapping && live.csvGroups.efficiency?.currency === data.currency && !live.projectSwitching && live.decisionPersistenceEnabled && hasPaidAccess(live.entitlement); } });
      await useAppStore.getState().refreshProjects();
      if (!project && useAppStore.getState().activeProjectId === projectId) useAppStore.setState({ activeProjectId: saved.id });
      setEditingId(rule.id); setSelected(rule.id); setPreview(null); setDirty(false);
      setMessage(t(`‘${saved.name}’에 저장했습니다. 다음 실제 CSV를 분석할 때 확인합니다.`, `Saved in “${saved.name}”. Checked when the next real CSV is analyzed.`));
      useAppStore.getState().persistWorkspaceGroup("efficiency", saved.id);
    } catch (error) { setMessage(error.message === "DEMO" ? t("예시 조건은 미리보기만 가능합니다. 실제 CSV로 조건을 저장하세요.", "Samples support preview only. Save conditions with a real CSV.") : error.message === "STORAGE_REQUIRED" ? t("프로젝트 기기 저장을 켜야 조건을 저장할 수 있습니다.", "Enable project device storage to save conditions.") : t("저장하지 못했습니다. 프로젝트 이름·컬럼·통화·저장 공간과 조건 20개 한도를 확인하세요. 초안은 유지됩니다.", "Could not save. Check the project name, columns, currency, storage and 20-rule limit. Your draft is retained.")); }
    finally { setBusy(false); }
  };
  const mutate = async (id, remove) => {
    if (busy || switching) return;
    setBusy(true); setMessage("");
    try {
      const saved = await updateProject(projectId, current => ({ performanceAlerts: remove ? current.performanceAlerts.filter(rule => rule.id !== id) : current.performanceAlerts.map(rule => rule.id === id ? { ...rule, enabled: !rule.enabled } : rule) }), () => useAppStore.getState().activeProjectId === projectId && useAppStore.getState().decisionPersistenceEnabled && !useAppStore.getState().projectSwitching && (remove || hasPaidAccess(useAppStore.getState().entitlement)), useAppStore.getState().entitlement);
      if (!saved) throw new Error("PROJECT_CHANGED");
      await useAppStore.getState().refreshProjects();
      if (remove && editingId === id) { setEditingId(null); setDraft(INITIAL); setDirty(false); }
    } catch { setMessage(t("변경하지 못했습니다. 이용권과 기기 저장 상태를 확인하세요.", "Could not update. Check Pro access and device storage.")); }
    finally { setBusy(false); }
  };
  return <section className="performance-alerts no-print" id="performance-alerts" aria-labelledby="performance-alerts-title">
    <header className="performance-alerts__heading"><div><h2 id="performance-alerts-title">{t("다음 CSV에서도 지켜볼 조건", "Conditions to watch on the next CSV")}</h2><p>{t("한 번 정해 두면, 새 CSV를 분석할 때 프로젝트의 활성 조건을 함께 확인합니다.", "Set conditions once; enabled project rules are checked when a new CSV is analyzed.")}</p></div><span>{rules.length} / {MAX_ALERT_RULES}</span></header>
    {manage && !canPreview && <p><Link href={`${en ? "/en" : ""}/tools/operations-planner#performance-alerts`}>{t("운영 플래너에서 CSV를 분석하고 조건 만들기", "Analyze a CSV in Operations Planner to create conditions")}</Link></p>}
    {canPreview && <form onSubmit={save}>
      <div className="performance-alerts__heading"><label>{t("조건 이름", "Condition name")}<input value={draft.name} placeholder={t("예: Meta 단가 상승", "e.g. Meta cost increase")} maxLength={120} onChange={event => change("name", event.target.value)} /></label><button className="btn ghost" type="button" onClick={() => { setEditingId(null); setDraft(INITIAL); setPreview(null); setSelected(null); setDirty(false); }}>{t("새 조건", "New condition")}</button></div>
      <div className="performance-alerts__sentence">
        {en && "For "}
        <label><span className="sr-only">{t("알림 채널", "Alert channel")}</span><select value={draft.channel} onChange={event => change("channel", event.target.value)}><option value="">{t("전체 채널", "All channels")}</option>{[...new Set([...channels, ...(draft.channel ? [draft.channel] : [])])].map(channel => <option key={channel}>{channel}</option>)}</select></label>{t("의", ", compare")}
        <label><span className="sr-only">{t("관측 기간", "Observation window")}</span><select value={draft.days} onChange={event => change("days", Number(event.target.value))}>{ALERT_WINDOWS.map(days => <option key={days} value={days}>{t(`최근 ${days}일`, `Latest ${days} days`)}</option>)}</select></label>
        <label><span className="sr-only">{t("알림 지표", "Alert metric")}</span><select value={draft.metric} onChange={event => change("metric", event.target.value)}><option value="cpr">CPR</option><option value="sum">{t("컬럼 합계", "Column total")}</option><option value="mean">{t("컬럼 행 평균", "Column row average")}</option></select></label>
        {draft.metric === "cpr" ? <label><span className="sr-only">{t("성과 기준", "Outcome basis")}</span><select value={draft.basis} onChange={event => change("basis", event.target.value)}><option value="installs">{t("설치 기준", "Per install")}</option><option value="actions">{t("가입 기준", "Per action")}</option></select></label> : <label><span className="sr-only">{t("참조 컬럼", "Reference column")}</span><select value={effectiveDraft.valueHeader} onChange={event => change("valueHeader", event.target.value)}><option value="">{t("컬럼 선택", "Select column")}</option>{(data.headers || []).map(header => <option key={header}>{header}</option>)}</select></label>}{t("이", "with")}
        <label><span className="sr-only">{t("비교 기준", "Comparison reference")}</span><select value={draft.comparison} onChange={event => change("comparison", event.target.value)}><option value="previous">{t(`직전 ${draft.days}일`, `Prior ${draft.days} days`)}</option><option value="target">{t("목표값", "Target")}</option></select></label>
        {draft.comparison === "target" && <label><span className="sr-only">{t("목표값", "Target value")}</span><CommaNumberInput value={draft.target} allowDecimals ariaLabel={t("목표값", "Target value")} onCommit={value => change("target", value)} /></label>}{t("보다", ". If it is")}
        <label><span className="sr-only">{t("변화 임계율", "Change threshold percent")}</span><input type="number" min="0" max={draft.direction === "down" ? 100 : 10000} step="any" value={draft.percent} onChange={event => change("percent", Number(event.target.value))} required /></label>% {t("이상", "or more")}
        <label><span className="sr-only">{t("변화 방향", "Change direction")}</span><select value={draft.direction} onChange={event => change("direction", event.target.value)}><option value="up">{t("높으면", "higher")}</option><option value="down">{t("낮으면", "lower")}</option></select></label>, {t("새 CSV 분석 후 화면에서 알려주세요.", "show me after analyzing a new CSV.")}
      </div>
      <p className="performance-alerts__note">{t("효율 CSV 전체 행 기준 · 화면 필터와 별개 · 마지막 관측일 기준 · 같은 프로젝트에는 같은 데이터 계열을 올려주세요.", "All efficiency CSV rows · Independent of view filters · Anchored to the latest observed date · Upload the same data series within a project.")}</p>
      {!namedProject && <label>{t("새 프로젝트 이름", "New project name")}<input value={projectName} maxLength={120} onChange={event => setProjectName(event.target.value)} /></label>}
      <div className="performance-alerts__actions"><button className="btn" type="button" disabled={!canPreview || busy} onClick={showPreview}>{t("현재 CSV로 미리보기", "Preview with current CSV")}</button><button className="btn primary" disabled={!canPreview || isDemoData(data) || busy || switching || (!editingId && rules.length >= MAX_ALERT_RULES)}>{busy ? t("저장 중…", "Saving…") : editingId ? t("이 조건 변경 저장", "Save changes to this condition") : namedProject ? t("조건 추가 저장", "Save another condition") : t("프로젝트 만들고 조건 저장", "Create project and save condition")}</button>{isDemoData(data) && <span>{t("가상 예시 · 저장은 실제 CSV에서", "Fictional sample · Save with a real CSV")}</span>}</div>
    </form>}
    {!manage && !canPreview && <p>{t("효율 CSV를 분석하면 채널·지표·기간을 문장으로 선택해 조건을 만들 수 있습니다.", "Analyze an efficiency CSV to choose a channel, metric and period in a sentence.")}</p>}
    <p className="performance-alerts__note">{t("로그인·유효 Pro·기기 저장을 켠 프로젝트에서 저장할 수 있습니다. 이 기기의 브라우저(IndexedDB)에 프로젝트별로 저장되며, 다른 기기·브라우저와 자동 동기화되지 않습니다.", "Saving requires sign-in, active Pro and a project with device storage enabled. Stored per project in this browser’s IndexedDB; not automatically synced across devices or browsers.")}{!storage && <> <Link href={`${en ? "/en" : ""}/projects#project-management`}>{t("기기 저장 설정", "Device storage settings")}</Link></>}</p>
    {message && <p role="status">{message}</p>}
    {chartRule && <><AlertVerdict rule={chartRule} locale={locale} /><AlertTrend rule={chartRule} locale={locale} isDemo={Boolean(previewRule && isDemoData(data))} /></>}
    <div className="performance-alerts__saved" aria-label={t("저장한 알림 조건", "Saved alert conditions")}><h3>{t("저장한 조건", "Saved conditions")} · {project?.name || t("프로젝트 필요", "Project required")}</h3>
      {!rules.length && <p>{t("아직 저장한 조건이 없습니다. 조건을 여러 개 추가할 수 있습니다.", "No conditions saved yet. You can add multiple conditions.")}</p>}
      {rules.map(rule => <article key={rule.id} className="performance-alerts__row"><div><h4>{rule.name}</h4><span>{rule.channel || t("전체 채널", "All channels")} · {rule.metric === "cpr" ? `CPR / ${rule.basis === "installs" ? t("설치", "installs") : t("가입", "actions")}` : `${rule.valueHeader} / ${rule.metric === "sum" ? t("합계", "total") : t("행 평균", "row average")}`} · {rule.days}{t("일", " days")} · {rule.comparison === "target" ? alertNumber(rule, rule.target) : t("직전 기간 대비", "vs prior period")} · {rule.percent}% {rule.direction === "up" ? t("상승", "higher") : t("하락", "lower")}</span><AlertVerdict rule={rule} locale={locale} />{!rule.enabled && <strong>{t("일시 중지됨", "Paused")}</strong>}{rule.checkedAt && <small>{t("마지막 확인", "Last check")}: {new Date(rule.checkedAt).toLocaleString(en ? "en-GB" : "ko-KR")}</small>}</div><div className="performance-alerts__actions"><button type="button" className="btn ghost" onClick={() => { setSelected(rule.id); setPreview(null); }}>{t("차트 보기", "View chart")}</button><button type="button" className="btn ghost" disabled={!canPreview || busy} onClick={() => { setDraft(rule); setEditingId(rule.id); setSelected(rule.id); setPreview(null); setDirty(false); }}>{t("조건 수정", "Edit condition")}</button><button type="button" className="btn ghost" aria-pressed={rule.enabled} disabled={busy || !hasPaidAccess(entitlement)} onClick={() => mutate(rule.id, false)}>{rule.enabled ? t("일시 중지", "Pause") : t("다시 켜기", "Enable")}</button><button type="button" className="btn ghost" disabled={busy} onClick={() => { if (window.confirm(t(`‘${rule.name}’ 조건과 일별 이력을 삭제할까요?`, `Delete “${rule.name}” and its daily history?`))) mutate(rule.id, true); }}>{t("삭제", "Delete")}</button></div></article>)}
    </div>
    <ProjectCreateGate open={gate} locale={locale} onClose={() => setGate(false)} onReady={() => { setGate(false); save(); }} />
  </section>;
}
