"use client";
import ModalDialog from "../ds/ModalDialog";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { decisionClosureLabel } from "@/lib/decisionClosure";
import { confirmReviewExit } from "@/lib/project/reviewDraftGuard";
import { PROJECT_REVIEW_TOOL_EVENT } from "@/lib/decisionReviewUi";
import Link from "next/link";
import { useAppStore } from "@/store/useDataStore";
import { accountRequest, refreshAccount } from "@/lib/account/accountClient";
import { archiveMemo } from "@/lib/account/archiveContract";
import { hasPaidAccess } from "@/lib/subscription/entitlement";
import { assessDecisionOutcome, decisionGuardrailList, getDecisionReviewBucket } from "@/lib/decisionReview";
import { trackProductEvent } from "@/lib/analytics";

// 계정에만 있는 결정을 이 기기의 검토 목록으로 가져온다. 예전 보관함이 하던 일이라
// 목록을 합치면서 같이 옮겼다 — 화면만 치우고 능력을 조용히 잃으면 안 된다.
const ReviewSaveDialog = lazy(() => import("@/components/ReviewSaveDialog"));
const DecisionReviewEditor = lazy(() => import("@/components/WeeklyReview"));

/**
 * 지난 결정 — 이 기기와 계정에 있는 결정을 **한 목록**으로 본다.
 *
 * 예전에는 "지난 결정 전체 보기"(이 기기)와 "계정에 저장한 결정"(계정)이 따로 있었다.
 * 실제로 범위가 다르긴 하지만 한 기기에서 보면 거의 같아 보였고, UI가 그 차이를
 * 말하지 않아 "뭐가 다르냐"가 반복됐다. 지금은 한 목록에 두고 배지로만 가른다.
 *
 * 목록은 접기가 아니라 버튼이다 — 접기는 열기 전까지 몇 건인지·무엇인지 안 보인다.
 * 없으면 없다고만 말한다.
 */
const COPY = {
  ko: {
    title: "저장한 마케팅 프로젝트",
    empty: "아직 저장한 결정이 없습니다.",
    loading: "결정을 불러오는 중…",
    signIn: "이 기기에 저장한 결정입니다. 로그인하면 계정에 보관한 결정도 함께 보입니다.",
    proNote: "이용권이 없어도 기록은 계속 읽고 내보낼 수 있습니다. 계정 보관과 새 저장에는 Pro가 필요합니다.",
    viewPro: "Pro 이용권 보기",
    onDevice: "이 기기",
    onAccount: "계정 보관됨",
    accountOnly: "계정에만 있음",
    continueReview: "검토 이어하기",
    opening: "가져오는 중…",
    noDate: "검토일 미정",
    close: "닫기",
    conclusion: "결론",
    learning: "배운 점",
    goal: "목표",
    guardrails: "지키기",
    actual: "실제 결과",
    outcomeImproved: "개선",
    outcomeDeclined: "악화",
    outcomeUnchanged: "변화 없음",
    outcomePending: "검토 전",
    bucket: { overdue: "기한 지남", today: "오늘 검토", upcoming: "검토 예정", unscheduled: "검토일 없음", reviewed: "검토 완료" },
  },
  en: {
    title: "Saved marketing projects",
    empty: "No saved decisions yet.",
    loading: "Loading decisions…",
    signIn: "These are the decisions on this device. Sign in to see the ones kept in your account too.",
    proNote: "You can keep reading and exporting your records without a pass. Keeping them in your account and new saves require Pro.",
    viewPro: "View Pro plans",
    onDevice: "This device",
    onAccount: "In your account",
    accountOnly: "Account only",
    continueReview: "Continue review",
    opening: "Opening…",
    noDate: "No review date",
    close: "Close",
    conclusion: "Conclusion",
    learning: "Learning",
    goal: "Goal",
    guardrails: "Guardrails",
    actual: "Actual",
    outcomeImproved: "Improved",
    outcomeDeclined: "Declined",
    outcomeUnchanged: "Unchanged",
    outcomePending: "Not reviewed",
    bucket: { overdue: "Overdue", today: "Review today", upcoming: "Upcoming", unscheduled: "No date", reviewed: "Reviewed" },
  },
};

// 기한 지난 것이 먼저다. 사용자가 이 화면에 오는 이유가 그것이다.
const MEMO_LABELS = {
  toolId: ["분석 도구", "Analysis tool"], action: ["결정", "Action"], conclusion: ["결론", "Conclusion"],
  hypothesis: ["가설", "Hypothesis"], metric: ["지표", "Metric"], reviewDate: ["검토일", "Review date"],
  learning: ["배운 점", "Learning"], actual: ["실제 결과", "Actual outcome"], status: ["검토 상태", "Review status"],
  actionKind: ["행동 종류", "Action type"], actionTarget: ["대상", "Target"], actionAmount: ["변경량", "Change"],
  goalMetric: ["목표 지표", "Goal metric"], goalDirection: ["목표 방향", "Goal direction"],
  guardrailMetric: ["유지할 지표", "Guardrail metric"], guardrailOp: ["기준 방향", "Threshold direction"],
  guardrailValue: ["기준값", "Threshold"], guardrails: ["추가 조건", "Additional guardrails"],
  baseline: ["기준 결과", "Baseline"], baselineDate: ["기준일", "Baseline date"], target: ["목표값", "Target value"],
  targetDirection: ["개선 방향", "Improvement direction"],
};
const BUCKET_ORDER = { overdue: 0, today: 1, unscheduled: 2, upcoming: 3, reviewed: 4 };

// 스냅샷은 모듈에 굳힌다 — 매번 새로 읽으면 값이 같아도 참조가 갈려 무한 렌더가 된다.
let historyHashSnapshot = false;
const readHistoryHash = () => historyHashSnapshot;
const serverHistoryHash = () => false;
function subscribeHistoryHash(onChange) {
  const sync = () => {
    const next = window.location.hash === "#wr-history";
    if (next !== historyHashSnapshot) { historyHashSnapshot = next; onChange(); }
  };
  sync();
  window.addEventListener("hashchange", sync);
  return () => window.removeEventListener("hashchange", sync);
}

export default function DecisionHistoryList({ locale = "ko", anchorId = "wr-history", records = null, isSample = false }) {
  const t = COPY[locale === "en" ? "en" : "ko"];
  const en = locale === "en";
  // 범위는 호출부가 정한다. 스토어를 직접 읽으면 샘플 화면에서도 실제 프로젝트의
  // 결정이 딸려 나온다 — 화면마다 스코프가 다른데 컴포넌트가 그걸 모른다.
  const storeRecords = useAppStore((state) => state.decisionRecords);
  const localRecords = records ?? storeRecords;
  const entitlement = useAppStore((state) => state.entitlement);
  const [session, setSession] = useState(null);
  const [memos, setMemos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [pendingCopy, setPendingCopy] = useState(null);
  const [message, setMessage] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const activeProjectId = useAppStore(state => state.activeProjectId);
  const changeOpen = id => { if (id === openId || confirmReviewExit(activeProjectId, locale)) { setOpenId(id); if (!isSample) window.history.replaceState(null, "", id ? `#decision-${encodeURIComponent(id)}` : "#wr-history"); } };
  const [toolFilter, setToolFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  useEffect(() => {
    const openTool = event => { if (!isSample && confirmReviewExit(activeProjectId, locale)) { const tool = String(event.detail?.toolId || ""); setToolFilter(tool); setStatusFilter("all"); setEditorOpen(false); setOpenId(localRecords.find(record => !tool || record.toolId === tool)?.id || ""); } };
    window.addEventListener(PROJECT_REVIEW_TOOL_EVENT, openTool);
    return () => window.removeEventListener(PROJECT_REVIEW_TOOL_EVENT, openTool);
  }, [isSample, activeProjectId, locale, localRecords]);
  useEffect(() => {
    const openDecision = () => {
      if (isSample || !window.location.hash.startsWith("#decision-")) return;
      let id; try { id = decodeURIComponent(window.location.hash.slice(10)); } catch { return; }
      if (id !== openId && localRecords.some(record => record.id === id)) {
        if (!confirmReviewExit(activeProjectId, locale)) { window.history.replaceState(null, "", openId ? `#decision-${encodeURIComponent(openId)}` : "#wr-history"); return; }
        setToolFilter(""); setStatusFilter("all"); setEditorOpen(false); setOpenId(id);
      }
    };
    openDecision(); window.addEventListener("hashchange", openDecision);
    return () => window.removeEventListener("hashchange", openDecision);
  }, [localRecords, activeProjectId, isSample, locale, openId]);
  useEffect(() => {
    if (openId && window.location.hash === `#decision-${encodeURIComponent(openId)}`) document.getElementById(`decision-${openId}`)?.focus();
  }, [openId]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const loadVersion = useRef(0);
  const accountOwner = useRef(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (isSample) { setLoading(false); return; }
      const version = ++loadVersion.current;
      try {
        const next = await refreshAccount();
        if (!active || version !== loadVersion.current) return;
        if (accountOwner.current !== next?.account?.id) setMemos([]);
        accountOwner.current = next?.account?.id || null;
        setSession(next);
        if (!next?.account) { setMemos([]); setLoading(false); setLoadFailed(false); return; }
        const result = await accountRequest("memos");
        if (active && version === loadVersion.current) { setMemos(result.memos || []); setLoading(false); setLoadFailed(false); }
      } catch { if (active && version === loadVersion.current) { setLoadFailed(true); setLoading(false); } }
    };
    load();
    window.addEventListener("gop-account-changed", load);
    return () => { active = false; window.removeEventListener("gop-account-changed", load); };
  }, [isSample, reload]);

  // 한 목록으로 합친다. 같은 id면 같은 결정이고, 배지로만 출처를 가른다.
  const rows = useMemo(() => {
    const visibleMemos = isSample ? [] : memos;
    const accountIds = new Set(visibleMemos.map((memo) => memo.id));
    const localIds = new Set(localRecords.map((record) => record.id));
    const merged = [
      ...localRecords.map((record) => {
        const remote = visibleMemos.find(memo => memo.id === record.id);
        const conflict = remote && JSON.stringify(archiveMemo(record)) !== JSON.stringify(archiveMemo(remote));
        return { ...record, onDevice: true, onAccount: accountIds.has(record.id), remote: conflict ? remote : null };
      }),
      ...visibleMemos.filter((memo) => !localIds.has(memo.id)).map((memo) => ({ ...memo, onDevice: false, onAccount: true })),
    ];
    return merged
      .map((row) => ({ ...row, bucket: getDecisionReviewBucket(row) }))
      .sort((left, right) => (BUCKET_ORDER[left.bucket] ?? 9) - (BUCKET_ORDER[right.bucket] ?? 9)
        || String(right.reviewDate || "").localeCompare(String(left.reviewDate || "")));
  }, [localRecords, memos, isSample]);

  // 인박스 "열람"은 목록이 그려진 것이 아니라 사용자가 보러 온 것이다(`#wr-history`).
  // 렌더만으로 쏘면 결과 화면을 지나가기만 해도 퍼널이 부풀어 오른다.
  const opened = useSyncExternalStore(subscribeHistoryHash, readHistoryHash, serverHistoryHash);
  const viewedKey = opened && rows.length ? `${anchorId}:${rows.length}` : "";
  useEffect(() => {
    if (!viewedKey) return;
    trackProductEvent("decision_inbox_viewed", { locale, source: "weekly_review", count: rows.length });
  }, [viewedKey, locale, rows.length]);

  const saveToAccount = async (row) => {
    setBusyId(row.id);
    try {
      await accountRequest("memos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memo: archiveMemo(row), consent: "decision-memo-v1", reminder: false, locale }) });
      // A committed write is success; background refresh must not undo it.
      ++loadVersion.current;
      setMemos(current => [archiveMemo(row), ...current.filter(memo => memo.id !== row.id)]);
      setLoading(false);
      setLoadFailed(false);
      trackProductEvent("decision_archived", { locale, source: "decision_history" });
      setMessage(en ? "Saved to your account." : "계정에 보관했습니다.");
    } catch { setMessage(en ? "Could not save to your account. Your local record is unchanged." : "계정에 보관하지 못했습니다. 이 기기의 기록은 그대로입니다."); }
    finally { setBusyId(""); }
  };

  const visibleRows = rows.filter(row => (!toolFilter || row.toolId === toolFilter) && (statusFilter === "all" || statusFilter === "due" && ["overdue", "today", "unscheduled"].includes(row.bucket) || row.bucket === statusFilter));
  const isPro = hasPaidAccess(entitlement || session?.entitlement);

  return (
    <section id={anchorId} className="wr-history-list" aria-labelledby={`${anchorId}-title`}>
      <h2 id={`${anchorId}-title`}>{t.title}</h2>
      {!isSample && <button type="button" className="btn" aria-haspopup="dialog" onClick={() => { if (confirmReviewExit(activeProjectId, locale)) { setToolFilter(""); setOpenId(""); window.history.replaceState(null, "", "#wr-history"); setEditorOpen(true); } }}>{en ? "Review / export device records" : "기기 기록 검토·내보내기"}</button>}
      {!editorOpen && <label className="wr-field">{en ? "Review timing" : "검토 시점"}<select value={statusFilter} onChange={event => { if (confirmReviewExit(activeProjectId, locale)) { setStatusFilter(event.target.value); setOpenId(""); window.history.replaceState(null, "", "#wr-history"); } }}><option value="all">{en ? "All decisions" : "전체 결정"}</option><option value="due">{en ? "Review now" : "지금 검토"}</option><option value="upcoming">{en ? "Awaiting results" : "결과 대기"}</option><option value="reviewed">{en ? "Reviewed / closed" : "검토 완료·종료"}</option></select></label>}
      {!isSample && toolFilter && <button className="btn" onClick={() => setToolFilter("")}>{en ? "Show decisions from all tools" : "모든 도구의 결정 보기"}</button>}
      {!isSample && editorOpen && <ModalDialog open onClose={() => { if (confirmReviewExit(activeProjectId, locale)) setEditorOpen(false); }} ariaLabel={en ? "Review device records" : "기기 기록 검토"} overlayClassName="tutorial-overlay" panelClassName="decision-editor-panel"><header className="decision-editor-header"><h2>{en ? "Review device records" : "기기 기록 검토"}</h2><button className="btn" onClick={() => { if (confirmReviewExit(activeProjectId, locale)) setEditorOpen(false); }}>{t.close}</button></header><Suspense fallback={<p role="status">{t.loading}</p>}><DecisionReviewEditor toolFilter={toolFilter} locale={locale} embedded /></Suspense></ModalDialog>}
      {!session?.account && <p>{t.signIn}</p>}
      {session?.account && !isPro && <p>{t.proNote} <Link href={en ? "/en/subscription" : "/subscription"}>{t.viewPro}</Link></p>}
      {!editorOpen && rows.length > 0 && !visibleRows.length && <p role="status">{en ? "No decisions match these filters." : "이 조건에 맞는 결정이 없습니다."}</p>}
      {message && <p role="status">{message}</p>}
      {!isSample && loadFailed && <p role="alert">{en ? "Could not load account decisions. Previously loaded and device records remain available." : "계정의 결정을 불러오지 못했습니다. 이전에 불러온 기록과 기기 기록은 계속 볼 수 있습니다."} <button className="btn" onClick={() => setReload(value => value + 1)}>{en ? "Retry loading" : "다시 불러오기"}</button></p>}
      {loading && !rows.length ? <p role="status">{t.loading}</p> : rows.length === 0 ? (!loadFailed || isSample) && <p className="wr-history-list__empty">{t.empty}</p> : (
        !editorOpen && <ul className="wr-history-list__items">
          {visibleRows.map((row) => {
            const outcome = assessDecisionOutcome(row);
            const open = openId === row.id;
            return (
              <li key={row.id}>
                <button type="button" className="wr-history-list__row" aria-haspopup="dialog" onClick={() => changeOpen(row.id)}>
                  <span className="wr-history-list__date">{row.reviewDate || t.noDate}</span>
                  <span className="wr-history-list__action">{row.action}</span>
                  <span className="wr-history-list__badges">
                    <span className="wr-history-list__badge">{decisionClosureLabel(row.closureReason, locale) || t.bucket[row.bucket] || row.bucket}</span>
                    {row.onAccount && <span className="wr-history-list__badge">{row.onDevice ? t.onAccount : t.accountOnly}</span>}
                  </span>
                </button>
                {open && (
                  <ModalDialog open onClose={() => changeOpen("")} ariaLabel={row.action} overlayClassName="tutorial-overlay" panelClassName="decision-editor-panel">
                  <div className="wr-history-list__detail" id={`decision-${row.id}`} tabIndex={-1}>
                    <header className="decision-editor-header"><h2>{en ? "Review decision" : "결정 검토"}</h2><button type="button" className="btn ghost" onClick={() => changeOpen("")}>{t.close}</button></header>
                    {row.onDevice && !isSample ? <Suspense fallback={<p role="status">{t.loading}</p>}><DecisionReviewEditor key={row.id} locale={locale} embedded compact decisionId={row.id} /></Suspense> : <>
                    {row.conclusion && <p><strong>{t.conclusion}</strong> {row.conclusion}</p>}
                    {row.metric && <p><strong>{t.goal}</strong> {row.metric}{row.baseline ? ` · ${row.baseline}` : ""}</p>}
                    {decisionGuardrailList(row).length > 0 && <p><strong>{t.guardrails}</strong> {decisionGuardrailList(row).map((item) => `${item.metric} ${item.op === "lte" ? "≤" : "≥"} ${item.value}`).join(" · ")}</p>}
                    {row.actual && <p><strong>{t.actual}</strong> {row.actual} · {outcome.state === "improved" ? t.outcomeImproved : outcome.state === "declined" ? t.outcomeDeclined : outcome.state === "unchanged" ? t.outcomeUnchanged : t.outcomePending}</p>}
                    {row.learning && <p><strong>{t.learning}</strong> {row.learning}</p>}
                    </>}
                    {row.remote && <section className="wr-notice">
                      <strong>{en ? "Account and device copies differ" : "계정과 기기의 내용이 다릅니다"}</strong>
                      <p>{en ? "The record above is from this device. Keep the account copy as a separate record to preserve device-only review history, or update the account memo from this device." : "위 기록은 이 기기의 내용입니다. 계정 내용은 별도 기록으로 보관해 기기에만 있는 검토 이력을 유지하거나, 기기 내용으로 계정 메모를 갱신할 수 있습니다."}</p>
                      <dl>{Object.entries(archiveMemo(row.remote)).filter(([key, value]) => value !== archiveMemo(row)[key]).map(([key, value]) => <div key={key}><dt>{MEMO_LABELS[key]?.[en ? 1 : 0] || (en ? "Record" : "기록")}</dt><dd>{value || "—"}</dd></div>)}</dl>
                      <button className="btn" onClick={() => setPendingCopy({ ...row.remote, id: crypto.randomUUID() })}>{en ? "Keep account copy as a separate record" : "계정 내용을 별도 기록으로 보관"}</button>
                      <button className="btn" disabled={busyId === row.id || !isPro} onClick={() => saveToAccount(row)}>{en ? "Update account with device copy" : "기기 내용으로 계정 갱신"}</button>
                    </section>}
                    <div className="wr-history-list__actions">
                      {row.onDevice && !row.onAccount && session?.account && <button type="button" className="btn" disabled={busyId === row.id || !isPro} onClick={() => saveToAccount(row)}>{en ? "Keep in my account" : "계정에 보관"}</button>}
                      {!row.onDevice && <button type="button" className="btn" onClick={() => setPendingCopy(row)}>{t.continueReview}</button>}
                    </div>
                  </div>
                  </ModalDialog>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {pendingCopy && <Suspense fallback={<p role="status">{t.opening}</p>}>
        <ReviewSaveDialog locale={locale} record={pendingCopy} onClose={() => setPendingCopy(null)} />
      </Suspense>}
    </section>
  );
}
