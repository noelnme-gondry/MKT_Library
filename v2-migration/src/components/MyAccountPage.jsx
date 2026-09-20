"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AccountArchive from "@/components/AccountArchive";
import UserMappingSettings from "@/components/account/UserMappingSettings";
import { refreshAccount } from "@/lib/account/accountClient";
import { listProjects } from "@/lib/project/repository";
import { hasPaidAccess } from "@/lib/subscription/entitlement";

/**
 * 마이페이지 — 계정·구독·프로젝트 요약과 사용자 설정 한곳.
 *
 * 사용자 설정(컬럼 매핑)이 분석 흐름 안에 토글로 끼어 있으면, 분석하러 온 사람이
 * 매핑을 먼저 공부하게 된다(§9). 설정은 여기로 숨기고 흐름에서는 자동 적용한다.
 *
 * 날짜는 있는 값만 쓴다. 구매 이용권의 **시작일**은 서버가 내려주지 않으므로
 * 지어내지 않고 "—"로 둔다(§8 정직성).
 */
const COPY = {
  ko: {
    title: "마이페이지",
    deck: "계정과 이용권, 프로젝트를 한곳에서 확인합니다.",
    accountHead: "계정",
    email: "이메일",
    planHead: "이용권",
    plan: "구독 상태",
    planTrial: "Pro 체험 중",
    planPaid: "Pro 이용권 사용 중",
    planTrialEnded: "체험 종료",
    planNone: "이용권 없음",
    start: "이용 시작",
    end: "이용 종료",
    trialStart: "체험 시작",
    unknown: "—",
    projectHead: "프로젝트",
    projectCount: "프로젝트 개수",
    projectUnit: (count) => `${count}개`,
    openProjects: "프로젝트 열기",
    viewPro: "Pro 이용권 보기",
    signedOut: "로그인하면 계정과 이용권 정보를 볼 수 있습니다. 분석은 로그인 없이 계속 이용할 수 있습니다.",
    loading: "계정을 확인하고 있습니다…",
    projectsLocal: "프로젝트는 이 기기에 저장됩니다.",
    projectsFailed: "프로젝트 개수를 확인하지 못했습니다. 이 기기의 저장 공간을 확인하고 다시 열어 주세요.",
  },
  en: {
    title: "My account",
    deck: "Your account, your pass and your projects in one place.",
    accountHead: "Account",
    email: "Email",
    planHead: "Pass",
    plan: "Subscription",
    planTrial: "Pro trial active",
    planPaid: "Pro pass active",
    planTrialEnded: "Trial ended",
    planNone: "No active pass",
    start: "Starts",
    end: "Ends",
    trialStart: "Trial started",
    unknown: "—",
    projectHead: "Projects",
    projectCount: "Projects",
    projectUnit: (count) => `${count}`,
    openProjects: "Open projects",
    viewPro: "View Pro plans",
    signedOut: "Sign in to see your account and pass. Analysis stays available without signing in.",
    loading: "Checking your account…",
    projectsLocal: "Projects are stored on this device.",
    projectsFailed: "Could not read the project count. Check this device’s storage and reopen the page.",
  },
};

const formatDate = (value, locale) => {
  const time = typeof value === "number" ? value : Date.parse(value ?? "");
  return Number.isFinite(time) ? new Date(time).toLocaleDateString(locale === "en" ? "en-US" : "ko-KR") : null;
};

export default function MyAccountPage({ locale = "ko" }) {
  const t = COPY[locale === "en" ? "en" : "ko"];
  const en = locale === "en";
  const [session, setSession] = useState(null);
  const [projectCount, setProjectCount] = useState(null);
  const [projectsFailed, setProjectsFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () => {
      refreshAccount().then((next) => { if (active) setSession(next); }).catch(() => { if (active) setSession({ enabled: false }); });
      listProjects().then((list) => { if (active) { setProjectCount(list.length); setProjectsFailed(false); } }).catch(() => { if (active) { setProjectCount(null); setProjectsFailed(true); } });
    };
    load();
    // 로그인 팝업이 끝나면 여기 숫자도 같이 바뀌어야 한다.
    window.addEventListener("gop-account-changed", load);
    return () => { active = false; window.removeEventListener("gop-account-changed", load); };
  }, []);

  const entitlement = session?.entitlement || null;
  const active = hasPaidAccess(entitlement);
  const trialStartedAt = session?.account?.trialStartedAt || null;
  const planLabel = active
    ? (entitlement.trial ? t.planTrial : t.planPaid)
    : trialStartedAt ? t.planTrialEnded : t.planNone;
  // 체험이면 시작일을 알지만 구매 이용권은 서버가 시작일을 안 준다 — 지어내지 않는다.
  const startLabel = entitlement?.trial || !active ? formatDate(trialStartedAt, locale) : null;
  const endLabel = formatDate(entitlement?.expiresAt, locale);

  return (
    <article className="content account-page">
      <header className="account-page__head">
        <h1>{t.title}</h1>
        <p>{t.deck}</p>
      </header>

      <section className="account-page__card" aria-labelledby="account-page-identity">
        <h2 id="account-page-identity">{t.accountHead}</h2>
        {!session ? <p role="status">{t.loading}</p> : session.account ? (
          <dl className="account-page__facts">
            <div><dt>{t.email}</dt><dd>{session.account.email}</dd></div>
          </dl>
        ) : <p>{t.signedOut}</p>}
        {/* 로그인·로그아웃·알림·구매 연결은 이미 있는 컨트롤을 그대로 쓴다. */}
        <AccountArchive locale={locale} profile hideIdentity onSession={setSession} />
      </section>

      {session?.account && (
        <section className="account-page__card" aria-labelledby="account-page-plan">
          <h2 id="account-page-plan">{t.planHead}</h2>
          <dl className="account-page__facts">
            <div><dt>{t.plan}</dt><dd>{planLabel}</dd></div>
            {startLabel && <div><dt>{t.trialStart}</dt><dd>{startLabel}</dd></div>}
            <div><dt>{t.end}</dt><dd>{endLabel || t.unknown}</dd></div>
          </dl>
          {!active && <Link className="btn primary" href={en ? "/en/subscription" : "/subscription"}>{t.viewPro}</Link>}
        </section>
      )}

      <section className="account-page__card" aria-labelledby="account-page-projects">
        <h2 id="account-page-projects">{t.projectHead}</h2>
        <dl className="account-page__facts">
          <div><dt>{t.projectCount}</dt><dd>{projectCount === null ? t.unknown : t.projectUnit(projectCount)}</dd></div>
        </dl>
        <p className="account-page__hint">{t.projectsLocal}</p>
        {projectsFailed && <p role="alert">{t.projectsFailed}</p>}
        <Link className="btn" href={en ? "/en/weekly-review#project-management" : "/weekly-review#project-management"}>{t.openProjects}</Link>
      </section>

      <section className="account-page__card">
        <UserMappingSettings key={session?.account?.id || "signed-out"} locale={locale} accountId={session?.account?.id || null} />
      </section>
    </article>
  );
}
