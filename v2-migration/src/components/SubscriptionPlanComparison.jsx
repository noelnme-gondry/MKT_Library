import Link from "next/link";
import { SUBSCRIPTION } from "@/lib/subscription/entitlement";
import { PRO_TRIAL_DAYS } from "@/lib/account/archiveContract";

export default function SubscriptionPlanComparison({ locale = "ko", paid = false, trialEndsAt = null, now }) {
  const en = locale === "en";
  const trialDays = Math.min(PRO_TRIAL_DAYS, Math.max(0, Math.ceil((trialEndsAt - now) / 86400000)));
  const rows = en ? [
    ["Analysis tools", "All tools included", "All tools included"],
    ["Weekly reviews & decisions", "Analyze, record and revisit", "Analyze, record and revisit"],
    ["Projects", `${SUBSCRIPTION.freeProjects} project`, "No project-count cap*"],
    ["Analysis downloads", "View results on the website", "Word, Excel, plus available CSV/PNG"],
    ["Multi-project reports", "Not included", "Batch weekly reports"],
    ["Batch report branding", "Not included", "Logo, company name and footer"],
    ["Your project backups", "Export and restore", "Export and restore"],
    ["Account decision memos", "Read and export existing memos", "Save and update memos"],
  ] : [
    ["분석 도구", "모든 도구 사용", "모든 도구 사용"],
    ["주간 리뷰·결정 기록", "분석·기록·다음 결과 검토", "분석·기록·다음 결과 검토"],
    ["프로젝트", `${SUBSCRIPTION.freeProjects}개`, "개수 제한 없음*"],
    ["분석 결과 다운로드", "사이트에서 결과 확인", "Word·Excel + 제공되는 CSV·PNG"],
    ["여러 프로젝트 보고서", "제공하지 않음", "주간 보고서 일괄 모으기"],
    ["일괄 보고서 브랜딩", "제공하지 않음", "로고·회사명·푸터 설정"],
    ["내 프로젝트 백업", "내보내기·복원", "내보내기·복원"],
    ["계정 결정 메모", "기존 메모 읽기·내보내기", "새 메모 저장·수정"],
  ];
  return <div id="plans" className="plan-comparison">
    <div className="plan-comparison-grid">
      {[false, true].map(pro => <article key={String(pro)} className={`plan-card${pro ? " plan-card--pro" : ""}`} aria-labelledby={`plan-${pro ? "pro" : "free"}-title`}>
        <div className="plan-card-status">{trialEndsAt && pro ? `${en ? "Pro trial" : "Pro 체험 중"} · ${trialDays}${en ? " days left" : "일 남음"}` : !trialEndsAt && pro === paid ? <><span aria-hidden="true">✓</span> {en ? "Your current plan" : "현재 이용 플랜"}</> : pro ? (en ? "For reports and multiple projects" : "보고서·여러 프로젝트를 위한 플랜") : (en ? "Start with your first analysis" : "첫 분석부터 무료로")}</div>
        {pro && trialEndsAt && <p>{en ? "Trial ends" : "체험 종료일"}: {new Date(trialEndsAt).toLocaleDateString(en ? "en-US" : "ko-KR")}</p>}
        {pro && <p>{en ? "Analysis downloads require an active purchase and are not included in the 14-day trial." : "분석자료 다운로드는 유효한 구매 이용권 전용이며 14일 체험에 포함되지 않습니다."}</p>}
        <div className="plan-card-header">
          <h2 id={`plan-${pro ? "pro" : "free"}-title`}>{pro ? "Pro" : (en ? "Free" : "무료")}</h2>
          <p>{pro ? (en ? "Bring your analysis to the meeting." : "분석을 회의에서 쓸 보고서로.") : (en ? "Find your next decision." : "데이터로 다음 행동을 찾으세요.")}</p>
          <div className="plan-price"><strong>{pro ? SUBSCRIPTION.monthlyKrw.toLocaleString(en ? "en-US" : "ko-KR") : "0"}</strong><span>{en ? "KRW" : "원"}</span></div>
          <p className="plan-billing">{pro ? (en ? "1 calendar month · no automatic renewal" : "1개월 이용권 · 자동 갱신 없음") : (en ? "No signup or payment needed" : "가입·결제 없이 시작")}</p>
        </div>
        <dl className="plan-features">{rows.map(([label, free, premium]) => <div key={label}><dt>{label}</dt><dd>{pro ? premium : free}</dd></div>)}</dl>
        <div className="plan-card-action">{pro ? <a className="btn primary" href="#purchase">{paid ? (en ? "Manage my Pro pass" : "내 Pro 이용권 확인") : (en ? "Choose Pro" : "Pro 이용권 선택")}</a> : <Link className="btn" href={en ? "/en/start" : "/start"}>{en ? "Start a free analysis" : "무료로 분석 시작"}</Link>}</div>
      </article>)}
    </div>
    <p className="plan-footnote">{en ? "* Browser storage limits apply to both plans. Your saved projects remain readable and exportable as backups after Pro expires; source data does not sync across devices." : "* 브라우저 저장 한도는 두 플랜에 동일하게 적용됩니다. Pro가 만료돼도 기존 프로젝트 읽기·백업은 가능하며, 원본 데이터는 기기 간 자동 동기화되지 않습니다."} <a href="#project-storage-heading">{en ? "See storage limits" : "저장 한도 보기"}</a></p>
  </div>;
}
