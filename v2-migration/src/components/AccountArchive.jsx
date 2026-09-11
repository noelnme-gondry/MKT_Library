"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { archiveMemo, trialRemainingBucket } from "@/lib/account/archiveContract";
import { accountRequest, refreshAccount } from "@/lib/account/accountClient";
import { useAppStore } from "@/store/useDataStore";
import { serializeDecisionReviewCsv, serializeDecisionReviewIcs } from "@/lib/decisionReview";
import { downloadCsv, downloadCalendar } from "@/utils/download";
import { trackProductEvent, trackProductEventOnce } from "@/lib/analytics";
const loginMessages = new WeakSet();

export default function AccountArchive({ locale = "ko", record = null, profile = false }) {
  const en = locale === "en";
  const [session, setSession] = useState(null);
  const [memos, setMemos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState("");
  const [email, setEmail] = useState("");
  const [reminder, setReminder] = useState(false);
  const localRecords = useAppStore(state => state.decisionRecords);
  const [selectedId, setSelectedId] = useState("");
  useEffect(() => {
    let active = true;
    let version = 0;
    const refresh = async () => {
      const currentVersion = ++version;
      try {
        const next = await refreshAccount();
        if (!active || currentVersion !== version) return;
        setMemos([]);
        setSession(next);
        if (next.account) {
          const bucket = trialRemainingBucket(next.account.trialStartedAt);
          trackProductEventOnce("archive_gate_viewed", `archive:${locale}:${bucket}`, { locale, trial_remaining_bucket: bucket, state: next.entitlement ? "active" : "free" });
          if (bucket === "expired" && !next.entitlement) trackProductEventOnce("trial_expired", `trial-expired:${locale}`, { locale, trial_remaining_bucket: bucket });
        }
        if (next.account && !record && !profile) { const result = await accountRequest("memos"); if (active && currentVersion === version) setMemos(result.memos); }
      } catch { if (active) setMessage(en ? "Account storage is unavailable. Your local records remain here." : "계정 보관함에 연결하지 못했습니다. 로컬 기록은 그대로 유지됩니다."); }
    };
    refresh();
    const onMessage = event => { if (event.origin === window.location.origin && event.data?.type === "gop-account-ready") { if (!loginMessages.has(event)) { loginMessages.add(event); trackProductEvent("login_completed", { locale }); } refresh(); } };
    window.addEventListener("message", onMessage);
    window.addEventListener("focus", refresh);
    window.addEventListener("gop-account-changed", refresh);
    return () => { active = false; window.removeEventListener("message", onMessage); window.removeEventListener("focus", refresh); window.removeEventListener("gop-account-changed", refresh); };
  }, [en, locale, record, profile]);
  if (!session?.enabled) return message ? <p role="status">{message}</p> : profile ? <p role="status">{!session ? (en ? "Checking account…" : "계정을 확인하고 있습니다…") : (en ? "Account sign-in is currently unavailable. Anonymous analysis remains available." : "현재 계정 로그인을 이용할 수 없습니다. 익명 분석은 계속 이용할 수 있습니다.")}</p> : null;
  const run = async action => {
    setBusy(true); setMessage("");
    try { await action(); }
    catch (error) {
      setMessage(error.message === "PRO_REQUIRED" ? (en ? "Your trial has ended. Existing memos can still be read and exported." : "체험이 종료됐습니다. 기존 메모는 계속 읽고 내보낼 수 있습니다.") : (en ? "Could not complete this action. Your local records remain unchanged." : "처리하지 못했습니다. 로컬 기록은 그대로 유지됩니다."));
    } finally { setBusy(false); }
  };
  const selected = record || localRecords.find(item => item.id === selectedId);
  let preview = null;
  try { if (selected) preview = archiveMemo(selected); } catch { /* Older invalid drafts remain local and cannot be submitted. */ }
  const save = () => run(async () => {
    const result = await accountRequest("memos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memo: archiveMemo(selected), consent: "decision-memo-v1", reminder, locale }) });
    setSession(await refreshAccount());
    if (!record) setMemos((await accountRequest("memos")).memos);
    if (result.trialStarted) trackProductEvent("trial_started", { locale, source: "first_memo" });
    setMessage(en ? "Decision memo saved to your account." : "결정 메모를 계정에 저장했습니다.");
  });
  return <section className="account-archive block" aria-label={profile ? (en ? "My account" : "마이페이지") : (en ? "Account decision archive" : "계정 결정 보관함")}>
    <h3>{profile ? (en ? "My account" : "마이페이지") : (en ? "Keep this decision across devices" : "다른 기기에서도 이 결정 이어보기")}</h3>
    {!record && !profile && <p>{en ? "Account memos from all projects. Copy a memo to the current project to review it here; source CSVs are not synced." : "모든 프로젝트에서 계정에 보관한 메모입니다. 현재 프로젝트로 복사해 검토할 수 있으며 CSV 원본은 동기화하지 않습니다."}</p>}
    {!profile && <p>{en ? "Analysis needs no signup. Sign in to save decision memos. One 14-day Pro trial per Google account starts with your first save; it does not renew automatically." : "분석은 가입 없이. 결정 메모 보관은 로그인으로. Google 계정당 1회, 첫 저장일부터 14일간 Pro를 체험하며 자동 결제되지 않습니다."}</p>}
    {!profile && <p>{en ? "Source CSVs are never sent to our server. Only the decision memo you choose is stored in your account. Memos may contain campaign names and figures you wrote." : "CSV 원본은 서버에 보내지 않습니다. 저장하기로 선택한 결정 메모만 계정에 보관됩니다. 메모에는 작성한 캠페인명·수치가 포함될 수 있습니다."}</p>}
    {!session.account ? <button className="btn" disabled={busy} onClick={() => {
      const popup = window.open("about:blank", "gop-account-login", "popup,width=520,height=700");
      if (!popup) { setMessage(en ? "Allow popups to sign in while keeping this analysis open." : "분석을 열어둔 채 로그인하려면 팝업을 허용해 주세요."); return; }
      run(async () => { try { const result = await accountRequest("login", { method: "POST" }); popup.location.replace(result.url); trackProductEvent("login_started", { locale }); } catch (error) { popup.close(); throw error; } });
    }}>{en ? "Continue with Google" : "Google로 계속"}</button> : <>
      <p>{session.account.email} · {session.entitlement ? `${en ? "Pro until" : "Pro 만료"} ${new Date(session.entitlement.expiresAt).toLocaleDateString(en ? "en-US" : "ko-KR")}` : session.account.trialStartedAt ? (en ? "Trial ended" : "체험 종료") : (en ? "Trial starts on first save" : "첫 저장 시 체험 시작")}</p>
      {session.mailEnabled && <label><input type="checkbox" checked={session.account.serviceReminders === true} disabled={busy} onChange={event => { const enabled = event.target.checked; run(async () => { await accountRequest(`preferences?reminders=${enabled ? "on" : "off"}`, { method: "POST" }); setSession(await refreshAccount()); }); }} />{en ? "Receive selected review reminders and a Pro expiry notice by email (optional; not marketing)." : "선택한 검토일·Pro 만료 안내를 이메일로 받습니다 (선택, 마케팅 아님)."}</label>}
      <button className="btn" disabled={busy} onClick={() => run(async () => { await accountRequest("claim-pass", { method: "POST" }); setSession(await refreshAccount()); setMessage(en ? "Purchased pass linked to this account." : "구매한 이용권을 이 계정에 연결했습니다."); })}>{en ? "Link the purchased pass on this device" : "이 기기의 구매 이용권 연결"}</button>
      {!record && !profile && <label>{en ? "Choose a local decision to save" : "계정에 보관할 로컬 결정 선택"}<select value={selectedId} onChange={event => { setSelectedId(event.target.value); setConsent(false); }}><option value="">{en ? "Choose a decision" : "결정 선택"}</option>{localRecords.map(item => <option key={item.id} value={item.id}>{item.action}</option>)}</select></label>}
      {preview && <><details><summary>{en ? "Review the memo being sent" : "계정에 보낼 메모 확인"}</summary><dl>{Object.entries(preview).filter(([, value]) => value).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></details><label><input type="checkbox" checked={consent === selected.id} onChange={event => setConsent(event.target.checked ? selected.id : "")} />{en ? "Store this selected memo in my account." : "선택한 메모를 계정에 보관합니다."}</label>{session.mailEnabled && session.account.serviceReminders && preview.reviewDate && <label><input type="checkbox" checked={reminder} onChange={event => setReminder(event.target.checked)} />{en ? "Email me on this review date while Pro is active (optional)." : "Pro 이용기간 중 이 검토일에 이메일로 알려 주세요 (선택)."}</label>}<button className="btn primary" disabled={busy || consent !== selected.id} onClick={save}>{en ? "Save decision to account" : "결정 메모 계정에 저장"}</button></>}
      {!session.entitlement && session.account.trialStartedAt && <Link className="btn" href={en ? "/en/subscription" : "/subscription"}>{en ? "View Pro" : "Pro 이용권 보기"}</Link>}
      {!record && !profile && <><button className="btn" disabled={!memos.length} onClick={() => downloadCsv(serializeDecisionReviewCsv(memos), "account-decisions")}>{en ? "Export existing memos · free" : "기존 메모 내보내기 · 무료"}</button>{memos.map(memo => <details key={memo.id}><summary>{memo.action} · {memo.reviewDate}</summary><p>{memo.conclusion}</p><p>{memo.learning}</p><button className="btn" disabled={busy || localRecords.some(item => item.id === memo.id)} onClick={() => { useAppStore.getState().importDecisionRecords([memo], memo.toolId); setSelectedId(memo.id); setConsent(""); setReminder(false); setMessage(en ? "Copied to this project's decision list without replacing existing records. Review it in Weekly Review. Original CSVs and comparison scopes were not synced." : "기존 기록을 덮어쓰지 않고 이 프로젝트의 결정 목록으로 복사했습니다. 주간 리뷰에서 검토하세요. CSV·비교 범위는 동기화하지 않았습니다."); }}>{en ? "Copy to this device for review" : "이 기기의 검토 목록으로 복사"}</button><button className="btn" disabled={!memo.reviewDate} onClick={() => downloadCalendar(serializeDecisionReviewIcs(memo, locale), "decision-review")}>{en ? "Add review to calendar" : "검토일 캘린더에 추가"}</button><button className="btn" disabled={busy} onClick={() => run(async () => { await accountRequest(`memos?id=${encodeURIComponent(memo.id)}`, { method: "DELETE" }); setMemos(items => items.filter(item => item.id !== memo.id)); setMessage(en ? "Account copy deleted. Local records were kept." : "계정의 사본을 삭제했습니다. 로컬 기록은 유지됩니다."); })}>{en ? "Delete account copy" : "계정 사본 삭제"}</button></details>)}</>}
      <button className="btn" disabled={busy} onClick={() => run(async () => { await accountRequest("session", { method: "DELETE" }); setSession(await refreshAccount()); setMemos([]); })}>{en ? "Sign out" : "로그아웃"}</button>
    </>}
    {!session.account && session.mailEnabled && <details><summary>{en ? "Existing account: cannot use Google here?" : "기존 계정인데 Google 로그인이 안 되나요?"}</summary><p>{en ? "Request a one-time link for your registered Google email. Open it in this browser within 10 minutes. This does not create a new account or trial." : "등록한 Google 이메일로 일회용 링크를 요청하세요. 10분 안에 이 브라우저에서 열어 주세요. 새 계정이나 체험을 만들지 않습니다."}</p><form onSubmit={event => { event.preventDefault(); run(async () => { await accountRequest("email-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, locale }) }); setMessage(en ? "If this email identifies an existing account, check your inbox for a link." : "기존 계정에 등록된 이메일이라면 받은편지함에서 링크를 확인해 주세요."); }); }}><label>{en ? "Registered email" : "등록된 이메일"}<input type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></label><button className="btn" disabled={busy}>{en ? "Request sign-in link" : "로그인 링크 요청"}</button></form></details>}
    <p role="status">{message}</p><Link href={en ? "/en/privacy" : "/privacy"}>{en ? "Privacy policy" : "개인정보처리방침"}</Link>
  </section>;
}
