"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/store/useDataStore";
import { accountRequest, refreshAccount } from "@/lib/account/accountClient";
import { archiveMemo } from "@/lib/account/archiveContract";
import { hasPaidAccess } from "@/lib/subscription/entitlement";
import { assessDecisionOutcome, decisionGuardrailList, getDecisionReviewBucket } from "@/lib/decisionReview";
import { trackProductEvent } from "@/lib/analytics";

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
    title: "지난 결정",
    empty: "아직 저장한 결정이 없습니다.",
    loading: "결정을 불러오는 중…",
    signIn: "로그인하면 저장한 결정을 볼 수 있습니다.",
    proOnly: "저장한 결정 보기는 Pro 기능입니다. 프로젝트를 만들면 14일 체험이 시작됩니다.",
    viewPro: "Pro 이용권 보기",
    onDevice: "이 기기",
    onAccount: "계정 보관됨",
    accountOnly: "계정에만 있음",
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
    title: "Past decisions",
    empty: "No saved decisions yet.",
    loading: "Loading decisions…",
    signIn: "Sign in to see your saved decisions.",
    proOnly: "Viewing saved decisions is a Pro feature. Creating a project starts your 14-day trial.",
    viewPro: "View Pro plans",
    onDevice: "This device",
    onAccount: "In your account",
    accountOnly: "Account only",
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
const BUCKET_ORDER = { overdue: 0, today: 1, unscheduled: 2, upcoming: 3, reviewed: 4 };

export default function DecisionHistoryList({ locale = "ko", anchorId = "wr-history", records = null }) {
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
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const next = await refreshAccount();
        if (!active) return;
        setSession(next);
        if (!next?.account) { setMemos([]); setLoading(false); return; }
        const result = await accountRequest("memos");
        if (active) { setMemos(result.memos || []); setLoading(false); }
      } catch { if (active) { setMemos([]); setLoading(false); } }
    };
    load();
    window.addEventListener("gop-account-changed", load);
    return () => { active = false; window.removeEventListener("gop-account-changed", load); };
  }, []);

  // 한 목록으로 합친다. 같은 id면 같은 결정이고, 배지로만 출처를 가른다.
  const rows = useMemo(() => {
    const accountIds = new Set(memos.map((memo) => memo.id));
    const localIds = new Set(localRecords.map((record) => record.id));
    const merged = [
      ...localRecords.map((record) => ({ ...record, onDevice: true, onAccount: accountIds.has(record.id) })),
      ...memos.filter((memo) => !localIds.has(memo.id)).map((memo) => ({ ...memo, onDevice: false, onAccount: true })),
    ];
    return merged
      .map((row) => ({ ...row, bucket: getDecisionReviewBucket(row) }))
      .sort((left, right) => (BUCKET_ORDER[left.bucket] ?? 9) - (BUCKET_ORDER[right.bucket] ?? 9)
        || String(right.reviewDate || "").localeCompare(String(left.reviewDate || "")));
  }, [localRecords, memos]);

  const saveToAccount = async (row) => {
    setBusyId(row.id);
    try {
      await accountRequest("memos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memo: archiveMemo(row), consent: "decision-memo-v1", reminder: false, locale }) });
      const result = await accountRequest("memos");
      setMemos(result.memos || []);
      trackProductEvent("decision_archived", { locale, source: "decision_history" });
      setMessage("");
    } catch { setMessage(en ? "Could not save to your account. Your local record is unchanged." : "계정에 보관하지 못했습니다. 이 기기의 기록은 그대로입니다."); }
    finally { setBusyId(""); }
  };

  if (!session) return <section id={anchorId} className="wr-history-list"><h2>{t.title}</h2><p role="status">{t.loading}</p></section>;
  if (!session.account) {
    return <section id={anchorId} className="wr-history-list">
      <h2>{t.title}</h2>
      <p>{t.signIn}</p>
    </section>;
  }
  if (!hasPaidAccess(entitlement || session.entitlement)) {
    return <section id={anchorId} className="wr-history-list">
      <h2>{t.title}</h2>
      <p>{t.proOnly}</p>
      <Link className="btn" href={en ? "/en/subscription" : "/subscription"}>{t.viewPro}</Link>
    </section>;
  }

  return (
    <section id={anchorId} className="wr-history-list" aria-labelledby={`${anchorId}-title`}>
      <h2 id={`${anchorId}-title`}>{t.title}</h2>
      {message && <p role="status">{message}</p>}
      {loading ? <p role="status">{t.loading}</p> : rows.length === 0 ? <p className="wr-history-list__empty">{t.empty}</p> : (
        <ul className="wr-history-list__items">
          {rows.map((row) => {
            const outcome = assessDecisionOutcome(row);
            const open = openId === row.id;
            return (
              <li key={row.id}>
                <button type="button" className="wr-history-list__row" aria-expanded={open} onClick={() => setOpenId(open ? "" : row.id)}>
                  <span className="wr-history-list__date">{row.reviewDate || t.noDate}</span>
                  <span className="wr-history-list__action">{row.action}</span>
                  <span className="wr-history-list__badges">
                    <span className="wr-history-list__badge">{t.bucket[row.bucket] || row.bucket}</span>
                    {row.onAccount && <span className="wr-history-list__badge">☁ {row.onDevice ? t.onAccount : t.accountOnly}</span>}
                  </span>
                </button>
                {open && (
                  <div className="wr-history-list__detail">
                    {row.conclusion && <p><strong>{t.conclusion}</strong> {row.conclusion}</p>}
                    {row.metric && <p><strong>{t.goal}</strong> {row.metric}{row.baseline ? ` · ${row.baseline}` : ""}</p>}
                    {decisionGuardrailList(row).length > 0 && <p><strong>{t.guardrails}</strong> {decisionGuardrailList(row).map((item) => `${item.metric} ${item.op === "lte" ? "≤" : "≥"} ${item.value}`).join(" · ")}</p>}
                    {row.actual && <p><strong>{t.actual}</strong> {row.actual} · {outcome.state === "improved" ? t.outcomeImproved : outcome.state === "declined" ? t.outcomeDeclined : outcome.state === "unchanged" ? t.outcomeUnchanged : t.outcomePending}</p>}
                    {row.learning && <p><strong>{t.learning}</strong> {row.learning}</p>}
                    <div className="wr-history-list__actions">
                      {row.onDevice && !row.onAccount && <button type="button" className="btn" disabled={busyId === row.id} onClick={() => saveToAccount(row)}>{en ? "Keep in my account" : "계정에 보관"}</button>}
                      <button type="button" className="btn ghost" onClick={() => setOpenId("")}>{t.close}</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
