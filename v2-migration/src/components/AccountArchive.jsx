"use client";
import { lazy, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { archiveMemo, trialRemainingBucket } from "@/lib/account/archiveContract";
import { accountRequest, refreshAccount } from "@/lib/account/accountClient";
import { useAppStore } from "@/store/useDataStore";
import { serializeDecisionReviewCsv, serializeDecisionReviewIcs } from "@/lib/decisionReview";
import { downloadCsv, downloadCalendar } from "@/utils/download";
import { trackProductEvent, trackProductEventOnce } from "@/lib/analytics";
import AccountDecisionLibrary from "./AccountDecisionLibrary";
const loginMessages = new WeakSet();
const ReviewSaveDialog = lazy(() => import("./ReviewSaveDialog"));

export default function AccountArchive({ locale = "ko", record = null, profile = false, compact = false, anchorId, onSession, hideIdentity = false }) {
  const en = locale === "en";
  const [session, setSession] = useState(null);
  const [memos, setMemos] = useState([]);
  const [memosLoading, setMemosLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reminder, setReminder] = useState("");
  const localRecords = useAppStore(state => state.decisionRecords);
  const entitlement = useAppStore(state => state.entitlement);
  const [selectedId, setSelectedId] = useState("");
  const [pendingCopy, setPendingCopy] = useState(null);
  useEffect(() => {
    if (!session?.enabled || !anchorId || window.location.hash !== `#${anchorId}`) return;
    const frame = requestAnimationFrame(() => document.getElementById(anchorId)?.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [session?.enabled, anchorId]);
  useEffect(() => {
    let active = true;
    let version = 0;
    const refresh = async () => {
      const currentVersion = ++version;
      try {
        const next = await refreshAccount();
        if (!active || currentVersion !== version) return;
        setMemos([]);
        setMemosLoading(true);
        setSession(next);
        onSession?.(next);
        if (next.account) {
          const bucket = trialRemainingBucket(next.account.trialStartedAt);
          trackProductEventOnce("archive_gate_viewed", `archive:${locale}:${bucket}`, { locale, trial_remaining_bucket: bucket, state: next.entitlement ? "active" : "free" });
          if (bucket === "expired" && !next.entitlement) trackProductEventOnce("trial_expired", `trial-expired:${locale}`, { locale, trial_remaining_bucket: bucket });
        }
        if (next.account && !record && !profile) { const result = await accountRequest("memos"); if (active && currentVersion === version) { setMemos(result.memos); setMemosLoading(false); } }
      } catch (error) { if (active && currentVersion === version) { setSession(null); onSession?.(null); setMessage(error.message === "ACCOUNT_RESTRICTED" ? (en ? "This account is outside the current pilot. Saved records have not been deleted. Anonymous analysis remains available." : "현재 검증 대상이 아닌 계정입니다. 저장한 기록이 삭제된 것은 아닙니다. 익명 분석은 계속 이용할 수 있습니다.") : (en ? "Account storage is unavailable. Your local records remain here." : "계정 보관함에 연결하지 못했습니다. 로컬 기록은 그대로 유지됩니다.")); } }
    };
    refresh();
    const onMessage = event => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "gop-account-failed") setMessage(event.data.code === "ACCOUNT_RESTRICTED" ? (en ? "Account features are in a restricted pilot. Anonymous analysis remains available." : "계정 기능은 현재 제한 검증 중입니다. 익명 분석은 계속 이용할 수 있습니다.") : (en ? "Sign-in did not complete. Retry from this window; open email links in this same browser." : "로그인을 완료하지 못했습니다. 이 창에서 다시 시도하고 이메일 링크도 같은 브라우저에서 열어 주세요."));
      if (event.data?.type === "gop-account-ready") { if (!loginMessages.has(event)) { loginMessages.add(event); trackProductEvent("login_completed", { locale }); } refresh(); }
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("focus", refresh);
    window.addEventListener("gop-account-changed", refresh);
    return () => { active = false; window.removeEventListener("message", onMessage); window.removeEventListener("focus", refresh); window.removeEventListener("gop-account-changed", refresh); };
  }, [en, locale, record, profile, onSession]);
  if (!session?.enabled) return message ? <p role="status">{message}</p> : profile ? <p role="status">{!session ? (en ? "Checking account…" : "계정을 확인하고 있습니다…") : (en ? "Account sign-in is currently unavailable. Anonymous analysis remains available." : "현재 계정 로그인을 이용할 수 없습니다. 익명 분석은 계속 이용할 수 있습니다.")}</p> : null;
  // 호출부가 오류 코드별 문장을 줄 수 있다. 로그인처럼 실패 사유가 갈리는 곳에서
  // 공통 문장만 띄우면 사용자도 운영자도 무엇을 고쳐야 하는지 알 수 없다.
  const run = async (action, codeMessages) => {
    setBusy(true); setMessage("");
    try { await action(); }
    catch (error) {
      if (codeMessages?.[error.message]) { setMessage(codeMessages[error.message]); setBusy(false); return; }
      setMessage(error.message === "NO_PURCHASE" ? (en ? "No active purchased pass was found in this browser. Restore your purchased pass first." : "이 브라우저에서 연결할 구매 이용권을 찾지 못했습니다. 구매한 이용권을 먼저 복원해 주세요.") : error.message === "PRO_REQUIRED" ? (en ? "Active Pro access is required to save or update memos. Existing memos can still be read and exported." : "메모 저장·수정에는 유효한 Pro 이용권이 필요합니다. 기존 메모는 계속 읽고 내보낼 수 있습니다.") : (en ? "Could not complete this action. Your local records remain unchanged." : "처리하지 못했습니다. 로컬 기록은 그대로 유지됩니다."));
    } finally { setBusy(false); }
  };
  const selected = record || localRecords.find(item => item.id === selectedId);
  let preview = null;
  try { if (selected) preview = archiveMemo(selected); } catch { /* Older invalid drafts remain local and cannot be submitted. */ }
  const save = () => run(async () => {
    const wantsReminder = reminder === selected.id;
    const result = await accountRequest("memos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memo: archiveMemo(selected), consent: "decision-memo-v1", reminder: wantsReminder, locale, ...(wantsReminder && !session.account.serviceReminders ? { serviceRemindersConsent: "service-reminders-v1" } : {}) }) });
    const next = await refreshAccount();
    setSession(next);
    onSession?.(next);
    if (!record) setMemos((await accountRequest("memos")).memos);
    // 체험 시작은 프로젝트 생성 관문(`ProjectCreateGate`)만 한다. 여기서 다시
    // 세면 같은 이벤트가 두 곳에서 나가 퍼널이 부풀고, 트리거가 두 벌로 읽힌다.
    setMessage(en ? "Decision memo saved to your account." : "결정 메모를 계정에 저장했습니다.");
  });
  if (!record && !profile) return <AccountDecisionLibrary locale={locale} anchorId={anchorId} signedIn={Boolean(session.account)} memos={memos} loading={memosLoading} records={localRecords} busy={busy} message={message} onCopy={setPendingCopy}
    onExport={() => downloadCsv(serializeDecisionReviewCsv(memos), "account-decisions")}
    onCalendar={memo => downloadCalendar(serializeDecisionReviewIcs(memo, locale), "decision-review")}
    onDelete={memo => run(async () => { await accountRequest(`memos?id=${encodeURIComponent(memo.id)}`, { method: "DELETE" }); setMemos(items => items.filter(item => item.id !== memo.id)); setMessage(en ? "Account copy deleted. Local records were kept." : "계정의 사본을 삭제했습니다. 로컬 기록은 유지됩니다."); })}
    accountControls={<AccountArchive locale={locale} profile />}
    renderSave={memo => <AccountArchive key={memo.id} locale={locale} record={memo} />}>
    {pendingCopy && <Suspense fallback={<p role="status">{en ? "Opening save…" : "저장 창을 여는 중…"}</p>}><ReviewSaveDialog locale={locale} record={pendingCopy} onClose={() => setPendingCopy(null)} /></Suspense>}
  </AccountDecisionLibrary>;
  return <section id={anchorId} className="account-archive block" aria-label={profile ? (en ? "My account" : "마이페이지") : (en ? "Account decision archive" : "계정 결정 보관함")}>
    {pendingCopy && <Suspense fallback={<p role="status">{en ? "Opening save…" : "저장 창을 여는 중…"}</p>}><ReviewSaveDialog locale={locale} record={pendingCopy} onClose={() => setPendingCopy(null)} /></Suspense>}
    {!compact && !hideIdentity && <h3>{profile ? (en ? "My account" : "마이페이지") : (en ? "Keep this decision across devices" : "다른 기기에서도 이 결정 이어보기")}</h3>}
    {!record && !profile && <p>{en ? "Account memos from all projects. Copy a memo to the current project to review it here; source CSVs are not synced." : "모든 프로젝트에서 계정에 보관한 메모입니다. 현재 프로젝트로 복사해 검토할 수 있으며 CSV 원본은 동기화하지 않습니다."}</p>}
    {!profile && <p>{en ? "Analysis needs no signup. Sign in to save decision memos. One 14-day Pro trial per Google account starts when you create your first project; it does not renew automatically." : "분석은 가입 없이. 결정 메모 보관은 로그인으로. Google 계정당 1회, 첫 프로젝트를 만든 날부터 14일간 Pro를 체험하며 자동 결제되지 않습니다."}</p>}
    {!profile && <p>{en ? "Source CSVs are never sent to our server. Only the decision memo you choose is stored in your account. Memos may contain campaign names and figures you wrote." : "CSV 원본은 서버에 보내지 않습니다. 저장하기로 선택한 결정 메모만 계정에 보관됩니다. 메모에는 작성한 캠페인명·수치가 포함될 수 있습니다."}</p>}
    {!profile && !record && !localRecords.length && <p>{en ? "First analyze your CSV and record a decision in this project. Then sign in and save that selected memo here to start your trial." : "먼저 이 프로젝트에서 CSV를 분석하고 결정을 기록하세요. 그다음 로그인해 해당 메모를 여기에 저장하면 체험이 시작됩니다."} <Link href={en ? "/en/weekly-review#wr-upload" : "/weekly-review#wr-upload"}>{en ? "Prepare review data" : "리뷰 데이터 준비하기"}</Link></p>}
    {!session.account && session.signupRestricted && <p role="status">{en ? "Account features are currently limited to invited accounts. You can analyze data without signing in; saving reviews and starting a trial require an invited account. Your current draft stays here." : "현재 계정 기능은 초대된 계정만 이용할 수 있습니다. 로그인 없이 분석할 수 있으며, 리뷰 저장·체험 시작에는 초대 계정이 필요합니다. 작성 중인 내용은 유지됩니다."}</p>}
    {!session.account ? <button className={profile ? "btn primary account-profile-login" : "btn"} disabled={busy} onClick={() => {
      const popup = window.open("about:blank", "gop-account-login", "popup,width=520,height=700");
      if (!popup) { setMessage(en ? "Allow popups to sign in while keeping this analysis open." : "분석을 열어둔 채 로그인하려면 팝업을 허용해 주세요."); return; }
      run(async () => { try { const result = await accountRequest("login", { method: "POST" }); popup.location.replace(result.url); trackProductEvent("login_started", { locale }); } catch (error) { popup.close(); throw error; } });
    }}>{en ? "Continue with Google" : "Google로 계속"}</button> : <>
      {!hideIdentity && <div className="account-identity">
        <p className="account-identity__email">{session.account.email}</p>
        <p className="account-identity__plan">{session.entitlement ? <><span>{en ? "Pro until" : "Pro 만료"}</span><time dateTime={new Date(session.entitlement.expiresAt).toISOString()}>{new Date(session.entitlement.expiresAt).toLocaleDateString(en ? "en-US" : "ko-KR")}</time></> : session.account.trialStartedAt ? (en ? "Trial ended" : "체험 종료") : (en ? "Trial starts with your first project" : "첫 프로젝트 생성 시 체험 시작")}</p>
      </div>}
      {!compact && !preview && session.mailEnabled && <label className="account-reminder"><input type="checkbox" checked={session.account.serviceReminders === true} disabled={busy} onChange={event => { const enabled = event.target.checked; run(async () => { await accountRequest(`preferences?reminders=${enabled ? "on" : "off"}`, { method: "POST" }); setSession(await refreshAccount()); }); }} /><span className="account-reminder__copy"><span className="account-reminder__title">{en ? "Email reminders" : "이메일 알림 받기"}</span><span>{en ? "Get reminders for selected review dates and Pro expiry." : "선택한 검토일과 Pro 만료일을 알려드려요."}</span><span className="account-reminder__note">{en ? "Optional · No marketing emails" : "선택 사항 · 마케팅 메일 아님"}</span></span></label>}
      {!compact && entitlement?.payment && !entitlement?.account && <button className="btn" disabled={busy} onClick={() => run(async () => { await accountRequest("claim-pass", { method: "POST" }); setSession(await refreshAccount()); setMessage(en ? "Purchased pass linked to this account." : "구매한 이용권을 이 계정에 연결했습니다."); })}>{en ? "Link the purchased pass on this device" : "이 기기의 구매 이용권 연결"}</button>}
      {!record && !profile && <label>{en ? "Choose a local decision to save" : "계정에 보관할 로컬 결정 선택"}<select value={selectedId} onChange={event => { setSelectedId(event.target.value); setConsent(false); }}><option value="">{en ? "Choose a decision" : "결정 선택"}</option>{localRecords.map(item => <option key={item.id} value={item.id}>{item.action}</option>)}</select></label>}
      {preview && <><details><summary>{en ? "Review the memo being sent" : "계정에 보낼 메모 확인"}</summary><dl>{Object.entries(preview).filter(([, value]) => value).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></details><label><input type="checkbox" checked={consent === selected.id} onChange={event => setConsent(event.target.checked ? selected.id : "")} />{en ? "Store this selected memo in my account." : "선택한 메모를 계정에 보관합니다."}</label>{session.mailEnabled && preview.reviewDate && <label><input type="checkbox" checked={reminder === selected.id} onChange={event => setReminder(event.target.checked ? selected.id : "")} />{session.account.serviceReminders ? (en ? "Email me on this review date while Pro is active (optional)." : "Pro 이용기간 중 이 검토일에 이메일로 알려 주세요 (선택).") : (en ? "Enable reminders for this review date and Pro expiry while Pro is active (optional; no marketing emails). Change this in My account." : "Pro 이용기간 중 이 검토일·이용기간 종료 안내 수신에 동의합니다 (선택·마케팅 메일 제외). 마이페이지에서 해제할 수 있습니다.")}</label>}<button className="btn primary" disabled={busy || consent !== selected.id} onClick={save}>{en ? "Save decision to account" : "결정 메모 계정에 저장"}</button></>}
      {!hideIdentity && !session.entitlement && session.account.trialStartedAt && <Link className="btn" href={en ? "/en/subscription" : "/subscription"}>{en ? "View Pro" : "Pro 이용권 보기"}</Link>}
      {!record && !profile && <><button className="btn" disabled={!memos.length} onClick={() => downloadCsv(serializeDecisionReviewCsv(memos), "account-decisions")}>{en ? "Export existing memos · free" : "기존 메모 내보내기 · 무료"}</button>{memos.map(memo => <details key={memo.id}><summary>{memo.action} · {memo.reviewDate}</summary><p>{memo.conclusion}</p><p>{memo.learning}</p><button className="btn" disabled={busy || localRecords.some(item => item.id === memo.id)} onClick={() => setPendingCopy(memo)}>{en ? "Copy to this device for review" : "이 기기의 검토 목록으로 복사"}</button><button className="btn" disabled={!memo.reviewDate} onClick={() => downloadCalendar(serializeDecisionReviewIcs(memo, locale), "decision-review")}>{en ? "Add review to calendar" : "검토일 캘린더에 추가"}</button><button className="btn" disabled={busy} onClick={() => run(async () => { await accountRequest(`memos?id=${encodeURIComponent(memo.id)}`, { method: "DELETE" }); setMemos(items => items.filter(item => item.id !== memo.id)); setMessage(en ? "Account copy deleted. Local records were kept." : "계정의 사본을 삭제했습니다. 로컬 기록은 유지됩니다."); })}>{en ? "Delete account copy" : "계정 사본 삭제"}</button></details>)}</>}
      {!compact && <button className="btn" disabled={busy} onClick={() => run(async () => { await accountRequest("session", { method: "DELETE" }); setSession(await refreshAccount()); setMemos([]); })}>{en ? "Sign out" : "로그아웃"}</button>}
    </>}
    {/* 아이디는 계정에 등록된 이메일 주소다(Google로 만든 계정은 그 Google 이메일).
        비밀번호 로그인은 서버에서 지정한 계정에만 열린다. */}
    {/* 로그인은 접어 둘 것이 아니다. 여기까지 온 사람은 로그인하러 온 것이므로 바로 쓰게 둔다. */}
    {!session.account && session.passwordLoginEnabled && <section className="account-password-login" aria-labelledby="account-password-title">
      <h4 id="account-password-title">{en ? "Sign in with an id and password" : "아이디·비밀번호로 로그인"}</h4>
      <p>{en ? "Your id is the email address registered on the account." : "아이디는 계정에 등록된 이메일 주소입니다."}</p>
      <form onSubmit={event => { event.preventDefault(); run(async () => { await accountRequest("password-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }); setPassword(""); trackProductEvent("login_completed", { locale }); setSession(await refreshAccount()); }, {
        INVALID_LOGIN: en ? "That id and password did not match an account enabled for password sign-in. Repeated attempts are blocked for a while." : "아이디·비밀번호가 맞지 않거나 이 로그인이 열려 있지 않은 계정입니다. 여러 번 실패하면 한동안 잠깁니다.",
        ACCOUNTS_UNAVAILABLE: en ? "Password sign-in is not enabled on the server right now." : "서버에서 비밀번호 로그인이 켜져 있지 않습니다.",
        RATE_LIMITED: en ? "Too many attempts. Wait a minute and try again." : "시도가 너무 잦습니다. 1분 뒤에 다시 시도해 주세요.",
        ACCOUNT_RESTRICTED: en ? "This account is outside the current invited list." : "이 계정은 현재 허용 목록 밖입니다.",
      }); }}>
        <label>{en ? "Id (email)" : "아이디(이메일)"}<input type="email" required maxLength={254} autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} /></label>
        <label>{en ? "Password" : "비밀번호"}<input type="password" required maxLength={200} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></label>
        <button className="btn" disabled={busy}>{en ? "Sign in" : "로그인"}</button>
      </form>
    </section>}
    {!session.account && session.mailEnabled && <section className="account-link-login" aria-labelledby="account-link-title">
      <h4 id="account-link-title">{en ? "Sign in by email link" : "이메일 링크로 로그인"}</h4>
      <p>{en ? "For an existing account when Google is unavailable here. The link works once, in this browser, for 10 minutes. No new account or trial is created." : "기존 계정인데 여기서 Google 로그인이 안 될 때 씁니다. 링크는 이 브라우저에서 10분간 한 번만 쓸 수 있고, 새 계정이나 체험을 만들지 않습니다."}</p>
      <form onSubmit={event => { event.preventDefault(); run(async () => { await accountRequest("email-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, locale }) }); setMessage(en ? "If this email identifies an existing account, check your inbox for a link." : "기존 계정에 등록된 이메일이라면 받은편지함에서 링크를 확인해 주세요."); }); }}>
        <label>{en ? "Registered email" : "등록된 이메일"}<input type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></label>
        <button className="btn" disabled={busy}>{en ? "Request sign-in link" : "로그인 링크 요청"}</button>
      </form>
    </section>}
    <p role="status">{message}</p><Link href={en ? "/en/privacy" : "/privacy"}>{en ? "Privacy policy" : "개인정보처리방침"}</Link>
  </section>;
}
