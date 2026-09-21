"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { refreshAccount } from "@/lib/account/accountClient";
import { useAppStore } from "@/store/useDataStore";
import { hasPaidAccess } from "@/lib/subscription/entitlement";
import { PRO_TRIAL_DAYS } from "@/lib/account/archiveContract";

export default function SubscriptionTrialOffer({ locale = "ko", onNavigate }) {
  const en = locale === "en";
  const [session, setSession] = useState(null);
  const entitlement = useAppStore(state => state.entitlement);
  useEffect(() => {
    let active = true;
    const refresh = () => refreshAccount().then(value => { if (active) setSession(value); }).catch(() => { if (active) setSession(null); });
    refresh();
    window.addEventListener("gop-account-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("gop-account-changed", refresh); window.removeEventListener("focus", refresh); };
  }, []);
  if (!session?.enabled || (session.signupRestricted && !session.account) || session.account?.trialStartedAt || hasPaidAccess(entitlement)) return null;
  return <aside className="subscription-trial-offer">
    <div><strong>{en ? "Try Pro with your first project" : "첫 프로젝트로 Pro를 체험하세요"}</strong><p>{en ? `One ${PRO_TRIAL_DAYS}-day trial per Google account, starting when you create your first project\u2014not at sign-in. No automatic payment.` : `Google 계정당 1회, 로그인일이 아닌 첫 프로젝트를 만든 날부터 ${PRO_TRIAL_DAYS}일입니다. 자동 결제되지 않습니다.`}</p></div>
    <Link className="btn" href={en ? "/en/weekly-review#wr-upload" : "/weekly-review#wr-upload"} onClick={onNavigate}>{en ? "Create a project to try Pro" : "프로젝트 만들고 Pro 체험하기"}</Link>
    <p>{en ? "Analysis downloads are excluded from the trial and require an active purchased pass." : "분석자료 다운로드는 체험에 포함되지 않으며, 유효한 구매 이용권이 필요합니다."}</p>
  </aside>;
}
