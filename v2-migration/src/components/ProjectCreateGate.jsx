"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ModalDialog from "@/components/ds/ModalDialog";
import { accountRequest, refreshAccount } from "@/lib/account/accountClient";
import { trackProductEvent } from "@/lib/analytics";
import { useAppStore } from "@/store/useDataStore";
import { hasPaidAccess } from "@/lib/subscription/entitlement";

/**
 * 프로젝트 생성 관문.
 *
 * 프로젝트 기능은 로그인·Pro 전용이고, **여기가 14일 체험을 켜는 유일한 자리**다.
 * 예전에는 "첫 계정 메모 저장"이 트리거였는데, 그러면 리뷰를 저장하러 온 사람이
 * 처음 듣는 다른 저장을 먼저 해야 했다(둘 다 UI에서 "저장"이라 불렸다).
 *
 * 카피도 같은 이유로 한 문장이다. "Pro가 필요합니다"와 "무료로 드립니다"를 따로
 * 띄우면 유료 장벽을 먼저 세우고 무료를 변명처럼 붙이는 꼴이 된다.
 *
 * 로그인은 팝업이라 이 모달이 살아 있는 채로 끝난다(`gop-account-ready` 수신).
 * 리다이렉트였다면 돌아온 뒤 "무엇을 하려던 중이었나"를 복원해야 했다.
 */
const COPY = {
  ko: {
    title: "프로젝트는 Pro 기능입니다",
    body: "Pro 이용권이 있는 계정으로 로그인하세요. 처음이시라면 14일 무료 체험이 바로 시작되며, 자동 결제되지 않습니다.",
    login: "Google로 로그인하고 시작",
    cancel: "취소",
    popupBlocked: "로그인 창을 열지 못했습니다. 팝업을 허용하고 다시 시도해 주세요.",
    failed: "로그인을 완료하지 못했습니다. 이 창에서 다시 시도해 주세요.",
    restricted: "계정 기능은 현재 초대된 계정만 이용할 수 있습니다. 분석은 로그인 없이 계속 이용할 수 있습니다.",
    unavailable: "지금은 계정 로그인을 이용할 수 없습니다. 분석은 로그인 없이 계속 이용할 수 있습니다.",
    trialEnded: "이 계정의 14일 체험은 이미 사용했습니다. 프로젝트를 만들려면 Pro 이용권이 필요합니다.",
    viewPro: "Pro 이용권 보기",
    starting: "준비하고 있습니다…",
    trialOn: "14일 체험을 시작했습니다.",
  },
  en: {
    title: "Projects are a Pro feature",
    body: "Sign in with an account that has Pro. If this is your first time, a 14-day free trial starts right away, with no automatic payment.",
    login: "Sign in with Google and start",
    cancel: "Cancel",
    popupBlocked: "The sign-in window did not open. Allow popups and try again.",
    failed: "Sign-in did not complete. Retry from this window.",
    restricted: "Account features are limited to invited accounts right now. Analysis stays available without signing in.",
    unavailable: "Account sign-in is unavailable right now. Analysis stays available without signing in.",
    trialEnded: "This account has already used its 14-day trial. Creating a project requires Pro.",
    viewPro: "View Pro plans",
    starting: "Getting things ready…",
    trialOn: "Your 14-day trial has started.",
  },
};

export default function ProjectCreateGate({ locale = "ko", open, onClose, onReady }) {
  const t = COPY[locale === "en" ? "en" : "ko"];
  const en = locale === "en";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [trialEnded, setTrialEnded] = useState(false);
  const setEntitlement = useAppStore((state) => state.setEntitlement);
  // onReady는 호출부가 매 렌더 새로 만들 수 있으므로 effect 의존성에서 뺀다.
  // ref 대입은 렌더가 아니라 effect에서 한다(렌더 중 ref 접근은 lint가 막는다).
  const onReadyRef = useRef(onReady);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  // 로그인 성공 → 체험 시작 → 호출부에 통과를 알린다. 이 셋은 한 흐름이라
  // 중간에서 끊기면 사용자가 로그인만 하고 아무 일도 안 일어난 화면을 본다.
  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    const admit = async () => {
      setBusy(true);
      setMessage("");
      try {
        const result = await accountRequest("trial", { method: "POST" });
        if (!active) return;
        if (result.entitlement) setEntitlement(result.entitlement);
        if (result.trialStarted) {
          trackProductEvent("trial_started", { locale, source: "project_create" });
          setMessage(t.trialOn);
        }
        if (!hasPaidAccess(result.entitlement)) { setTrialEnded(true); return; }
        onReadyRef.current?.(result);
      } catch (error) {
        if (!active) return;
        setMessage(error?.message === "ACCOUNT_RESTRICTED" ? t.restricted : error?.message === "LOGIN_REQUIRED" ? "" : t.unavailable);
      } finally { if (active) setBusy(false); }
    };
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "gop-account-ready") { trackProductEvent("login_completed", { locale }); admit(); }
      if (event.data?.type === "gop-account-failed") setMessage(event.data.code === "ACCOUNT_RESTRICTED" ? t.restricted : t.failed);
    };
    window.addEventListener("message", onMessage);
    // 이미 로그인된 채로 열렸으면 바로 통과시킨다 — 로그인 버튼을 또 누르게 하지 않는다.
    refreshAccount().then((session) => { if (active && session?.account) admit(); }).catch(() => {});
    return () => { active = false; window.removeEventListener("message", onMessage); };
  }, [open, locale, setEntitlement, t.restricted, t.failed, t.unavailable, t.trialOn]);

  if (!open) return null;
  return (
    // `overlayClassName`이 없으면 Radix 오버레이에 클래스가 안 붙어 위치·배경·z-index가
    // 통째로 없어진다 — 모달이 body 끝에 그냥 쌓여 화면에서는 "아무 일도 안 일어난" 것으로
    // 보인다. jsdom은 레이아웃을 재지 않아 스모크가 이걸 통과시킨다(§7).
    <ModalDialog open onClose={() => { if (!busy) onClose?.(); }} ariaLabelledBy="project-gate-title" overlayClassName="review-save-overlay" panelClassName="project-gate" closeOnBackdrop={!busy} closeOnEscape={!busy}>
      <h2 id="project-gate-title">{trialEnded ? t.trialEnded : t.title}</h2>
      {!trialEnded && <p>{t.body}</p>}
      {message && <p role="status">{message}</p>}
      {busy && <p role="status">{t.starting}</p>}
      <div className="project-gate__actions">
        {trialEnded
          ? <Link className="btn primary" href={en ? "/en/subscription" : "/subscription"}>{t.viewPro}</Link>
          : <button type="button" className="btn primary" disabled={busy} onClick={() => {
            const popup = window.open("about:blank", "gop-account-login", "popup,width=520,height=700");
            if (!popup) { setMessage(t.popupBlocked); return; }
            setBusy(true);
            accountRequest("login", { method: "POST" })
              .then((result) => { popup.location.replace(result.url); trackProductEvent("login_started", { locale, source: "project_create" }); })
              .catch(() => { popup.close(); setMessage(t.unavailable); })
              .finally(() => setBusy(false));
          }}>{t.login}</button>}
        <button type="button" className="btn" disabled={busy} onClick={() => onClose?.()}>{t.cancel}</button>
      </div>
    </ModalDialog>
  );
}
