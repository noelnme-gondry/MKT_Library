"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname() || "/";
  const isAnalysisPath = /^\/(?:en\/)?(?:dashboard|tools\/|content\/)/.test(pathname);
  const isEn = pathname === "/en" || pathname.startsWith("/en/");
  // 분석 화면은 전체 푸터를 숨겨 도구에 집중시킨다. 다만 사용자가 실제로 CSV를
  // 올리는 화면이 곧 신뢰 판단 지점이므로, 정책·문의 경로까지 없애면 안 된다
  // (개인정보처리방침이 이 앱의 "서버 미전송" 주장을 뒷받침하는 유일한 문서다).
  // → 내비게이션은 접고 법적 고지만 남긴 슬림 스트립으로 대체한다.
  if (isAnalysisPath) {
    const p0 = isEn ? "/en" : "";
    const legal = isEn
      ? { privacy: "Privacy", terms: "Terms", contact: "Contact", note: "Your uploaded data stays in this browser." }
      : { privacy: "개인정보처리방침", terms: "이용약관", contact: "문의하기", note: "업로드한 데이터는 이 브라우저 안에서만 처리됩니다." };
    return <footer className="site-footer site-footer--slim">
      <div className="site-footer__slim-inner">
        <span className="site-footer__slim-note">{legal.note}</span>
        <nav className="site-footer__slim-links" aria-label={isEn ? "Legal" : "정책"}>
          <Link href={`${p0}/privacy`}>{legal.privacy}</Link>
          <Link href={`${p0}/terms`}>{legal.terms}</Link>
          <Link href={`${p0}/contact`}>{legal.contact}</Link>
        </nav>
      </div>
    </footer>;
  }
  const isStandalone = ["/", "/en", "/privacy", "/terms", "/contact", "/en/privacy", "/en/terms", "/en/contact", "/templates", "/en/templates", "/manuals", "/en/manuals", "/calculator", "/en/calculator", "/weekly-report", "/en/weekly-report"].includes(pathname)
    || pathname.startsWith("/calculator/")
    || pathname.startsWith("/en/calculator/");
  const hasAppShell = !isStandalone;
  const p = isEn ? "/en" : "";
  const copy = isEn
    ? { note: "A browser-only weekly decision workspace for performance marketers.", tools: "Analyze", learn: "Learn", legal: "Legal", dashboard: "Operations dashboard", variance: "Performance variance", fatigue: "Creative fatigue", budget: "Budget allocation", review: "Decision inbox", report: "Weekly report", blog: "Blog", glossary: "Glossary", guide: "Operating guides", templates: "Templates", manuals: "Methodology manuals", compare: "Method comparisons", calculators: "Marketing metric calculators", diagnose: "Diagnose performance", privacy: "Privacy", terms: "Terms", contact: "Contact" }
    : { note: "원본 데이터를 서버에 보내지 않는 퍼포먼스 마케팅 주간 의사결정 워크스페이스.", tools: "분석 도구", learn: "실무 자료", legal: "정책", dashboard: "운영 대시보드", variance: "성과 변동 분석", fatigue: "소재 피로도", budget: "예산 배분", review: "결정 검토함", report: "주간 보고서", blog: "블로그", glossary: "용어사전", guide: "운영 가이드", templates: "템플릿·체크리스트", manuals: "방법론 매뉴얼", compare: "방법 비교", calculators: "마케팅 지표 계산기", diagnose: "성과 문제 진단", privacy: "개인정보처리방침", terms: "이용약관", contact: "문의하기" };
  return <footer className={`site-footer${hasAppShell ? " site-footer--app" : ""}`}>
    <div className="site-footer__inner">
      <div className="site-footer__brand"><Link href={p || "/"}>Growth Opt Playbook</Link><p>{copy.note}</p></div>
      <nav className="site-footer__column" aria-label={copy.tools}><strong>{copy.tools}</strong><Link href={`${p}/dashboard`}>{copy.dashboard}</Link><Link href={`${p}/tools/campaign-variance`}>{copy.variance}</Link><Link href={`${p}/content/freshness`}>{copy.fatigue}</Link><Link href={`${p}/tools/budget-allocation`}>{copy.budget}</Link><Link href={`${p}/calculator`}>{copy.calculators}</Link><Link href={`${p}/diagnose`}>{copy.diagnose}</Link></nav>
      <nav className="site-footer__column" aria-label={copy.learn}><strong>{copy.learn}</strong><Link href={`${p}/weekly-review`}>{copy.review}</Link><Link href={`${p}/weekly-report`}>{copy.report}</Link><Link href={`${p}/templates`}>{copy.templates}</Link><Link href={`${p}/compare`}>{copy.compare}</Link><Link href={`${p}/manuals`}>{copy.manuals}</Link><Link href={`${p}/blog`}>{copy.blog}</Link><Link href={`${p}/glossary`}>{copy.glossary}</Link><Link href={`${p}/guide`}>{copy.guide}</Link></nav>
      <nav className="site-footer__column" aria-label={copy.legal}><strong>{copy.legal}</strong><Link href={`${p}/privacy`}>{copy.privacy}</Link><Link href={`${p}/terms`}>{copy.terms}</Link><Link href={`${p}/contact`}>{copy.contact}</Link></nav>
    </div>
  </footer>;
}
