import Link from "next/link";
import { SUBSCRIPTION } from "@/lib/subscription/entitlement";
import { PRO_TRIAL_DAYS } from "@/lib/account/archiveContract";

export default function SubscriptionPlanComparison({ locale = "ko", paid = false, trialEndsAt = null, now }) {
  const en = locale === "en";
  // 남은 일수는 두 가지를 동시에 지켜야 한다.
  //   ① 서버 응답이 화면의 분 단위 시계 스냅샷보다 조금 늦게 와서 "정책 길이 +1ms"가
  //      되면 `Math.ceil`이 하루를 더 올린다 → 오차 허용치를 먼저 뺀다.
  //   ② 상한은 "활성일 수 있는 체험 중 가장 긴 것"이다. 길이가 전 계정 공통이
  //      된 지금은 그것이 곧 PRO_TRIAL_DAYS다. 길이가 다시 갈리면 여기 상한도
  //      가장 긴 쪽으로 올려야 한다 — 낮은 쪽으로 clamp하면 긴 체험자의 남은
  //      기간이 줄어 보인다(실제로 14→7 때 그 회귀가 났다).
  // 예전에는 clamp가 곧 정책 길이여서 ①이 ②에 가려 보이지 않았다.
  const CLOCK_SKEW_MS = 60000;
  const trialDays = Math.min(PRO_TRIAL_DAYS, Math.max(0, Math.ceil((trialEndsAt - now - CLOCK_SKEW_MS) / 86400000)));
  // 비교표는 두 플랜이 같은 행을 같은 순서로 가져야 성립한다. 한쪽만 행을 적으면
  // 카드 높이가 어긋나 빈 구멍이 생기고, 적히지 않은 항목이 "없음"인지 "안 적음"인지 알 수 없다.
  const absent = en ? "Not included" : "미포함";
  const rows = en ? [
    ["Analysis tools", "All tools included", "All tools included"],
    ["Analysis results", "View on the website", "View on the website"],
    ["Reviews & decision records", absent, "Save and review next results"],
    ["Project creation", absent, "No project-count cap*"],
    ["Analysis downloads", absent, "Word, Excel, plus available CSV/PNG"],
    ["Multi-project reports", absent, "Batch weekly reports"],
    ["Batch report branding", absent, "Logo, company name and footer"],
    ["Your project backups", absent, "Export and restore"],
    ["Account decision memos", absent, "Save and update memos"],
    ["Saved column mappings", absent, "Reuse CSV / Sheets rules across devices"],
  ] : [
    ["분석 도구", "모든 도구 사용", "모든 도구 사용"],
    ["분석 결과", "사이트에서 확인", "사이트에서 확인"],
    ["리뷰·결정 기록", absent, "저장·다음 결과 검토"],
    ["프로젝트 생성", absent, "개수 제한 없음*"],
    ["분석 결과 다운로드", absent, "Word·Excel + 제공되는 CSV·PNG"],
    ["여러 프로젝트 보고서", absent, "주간 보고서 일괄 모으기"],
    ["일괄 보고서 브랜딩", absent, "로고·회사명·푸터 설정"],
    ["내 프로젝트 백업", absent, "내보내기·복원"],
    ["계정 결정 메모", absent, "새 메모 저장·수정"],
    ["내 컬럼 매핑", absent, "CSV·Sheets 규칙을 다른 기기에서도 재사용"],
  ];
  return <div id="plans" className="plan-comparison">
    <div className="plan-comparison-grid">
      {[false, true].map(pro => <article key={String(pro)} className={`plan-card${pro ? " plan-card--pro" : ""}`} aria-labelledby={`plan-${pro ? "pro" : "free"}-title`}>
        <div className="plan-card-status">{trialEndsAt && pro ? `${en ? "Pro trial" : "Pro 체험 중"} · ${trialDays}${en ? " days left" : "일 남음"}` : !trialEndsAt && pro === paid ? <><span aria-hidden="true">✓</span> {en ? "Your current plan" : "현재 이용 플랜"}</> : pro ? (en ? "For saved decisions and reports" : "기록과 보고서를 위한 플랜") : (en ? "Start with your first analysis" : "첫 분석부터 무료로")}</div>
        <div className="plan-card-header">
          <h2 id={`plan-${pro ? "pro" : "free"}-title`}>{pro ? "Pro" : (en ? "Free" : "무료")}</h2>
          <p>{pro ? (en ? "Bring your analysis to the meeting." : "분석을 회의에서 쓸 보고서로.") : (en ? "Find your next decision." : "데이터로 다음 행동을 찾으세요.")}</p>
          <div className="plan-price"><strong>{pro ? SUBSCRIPTION.monthlyKrw.toLocaleString(en ? "en-US" : "ko-KR") : "0"}</strong><span>{en ? "KRW" : "원"}</span></div>
          <p className="plan-billing">{pro ? (en ? "1 calendar month · no automatic renewal" : "1개월 이용권 · 자동 갱신 없음") : (en ? "Analysis without signup" : "가입 없이 분석·결과 확인")}</p>
        </div>
        <dl className="plan-features">{rows.map(([label, free, proValue]) => { const value = pro ? proValue : free; return <div key={label}><dt>{label}</dt><dd data-absent={value === absent ? "true" : undefined}>{value}</dd></div>; })}</dl>
        {/* 자격 단서는 헤더 위에 띠를 하나 더 쌓지 않고, 그것이 한정하는 행 바로 뒤에 둔다. */}
        {pro && <p className="plan-card-note">{trialEndsAt ? `${en ? "Trial ends" : "체험 종료일"}: ${new Date(trialEndsAt).toLocaleDateString(en ? "en-US" : "ko-KR")} · ` : ""}{en ? `Analysis downloads require an active purchase and are not included in the ${PRO_TRIAL_DAYS}-day trial.` : `분석자료 다운로드는 유효한 구매 이용권 전용이며 ${PRO_TRIAL_DAYS}일 체험에 포함되지 않습니다.`}</p>}
        <div className="plan-card-action">{pro ? <a className="btn primary" href="#purchase">{paid ? (en ? "Manage my Pro pass" : "내 Pro 이용권 확인") : (en ? "Choose Pro" : "Pro 이용권 선택")}</a> : <Link className="btn" href={en ? "/en/start" : "/start"}>{en ? "Start a free analysis" : "무료로 분석 시작"}</Link>}</div>
      </article>)}
    </div>
    <p className="plan-footnote">{en ? `Creating projects and saving or updating reviews and decisions requires active Pro. The ${PRO_TRIAL_DAYS}-day trial starts when you create your first project. After expiry, existing records remain readable, exportable and deletable; new saves and backup restores require Pro.` : `프로젝트 생성·리뷰와 결정 기록 저장·수정은 Pro 기능입니다. 첫 프로젝트를 만든 날부터 ${PRO_TRIAL_DAYS}일간 체험할 수 있습니다. 만료 후 기존 기록의 열람·내보내기·삭제는 유지되며, 새 저장과 백업 복원에는 Pro가 필요합니다.`}</p>
    <p className="plan-footnote">{en ? "* Browser storage limits apply to both plans. Your saved projects remain readable and exportable as backups after Pro expires; source data does not sync across devices." : "* 브라우저 저장 한도는 두 플랜에 동일하게 적용됩니다. Pro가 만료돼도 기존 프로젝트 읽기·백업은 가능하며, 원본 데이터는 기기 간 자동 동기화되지 않습니다."} <a href="#project-storage-heading">{en ? "See storage limits" : "저장 한도 보기"}</a></p>
  </div>;
}
