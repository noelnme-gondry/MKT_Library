"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname() || "/";
  const isAnalysisPath = /^\/(?:en\/)?(?:dashboard|tools\/|content\/)/.test(pathname);
  if (isAnalysisPath) return null;
  const isEn = pathname === "/en" || pathname.startsWith("/en/");
  const isStandalone = ["/", "/en", "/privacy", "/terms", "/contact", "/en/privacy", "/en/terms", "/en/contact", "/templates", "/en/templates", "/diagnose", "/en/diagnose", "/calculator", "/en/calculator", "/weekly-report", "/en/weekly-report", "/weekly-review", "/en/weekly-review"].includes(pathname)
    || pathname.startsWith("/calculator/")
    || pathname.startsWith("/en/calculator/");
  const hasAppShell = !isStandalone;
  const p = isEn ? "/en" : "";
  const copy = isEn
    ? { note: "A browser-only weekly decision workspace for performance marketers.", tools: "Analyze", learn: "Learn", legal: "Legal", dashboard: "Operations dashboard", variance: "Performance variance", fatigue: "Creative fatigue", budget: "Budget allocation", review: "Decision inbox", report: "Weekly report", blog: "Blog", glossary: "Glossary", guide: "Operating guides", templates: "Templates", calculators: "Marketing metric calculators", diagnose: "Diagnose performance", privacy: "Privacy", terms: "Terms", contact: "Contact" }
    : { note: "원본 데이터를 서버에 보내지 않는 퍼포먼스 마케팅 주간 의사결정 워크스페이스.", tools: "분석 도구", learn: "실무 자료", legal: "정책", dashboard: "운영 대시보드", variance: "성과 변동 분석", fatigue: "소재 피로도", budget: "예산 배분", review: "결정 검토함", report: "주간 보고서", blog: "블로그", glossary: "용어사전", guide: "운영 가이드", templates: "템플릿·체크리스트", calculators: "마케팅 지표 계산기", diagnose: "성과 문제 진단", privacy: "개인정보처리방침", terms: "이용약관", contact: "문의하기" };
  return <footer className={`site-footer${hasAppShell ? " site-footer--app" : ""}`}>
    <div className="site-footer__inner">
      <div className="site-footer__brand"><Link href={p || "/"}>Growth Opt Playbook</Link><p>{copy.note}</p></div>
      <nav className="site-footer__column" aria-label={copy.tools}><strong>{copy.tools}</strong><Link href={`${p}/dashboard`}>{copy.dashboard}</Link><Link href={`${p}/tools/campaign-variance`}>{copy.variance}</Link><Link href={`${p}/content/freshness`}>{copy.fatigue}</Link><Link href={`${p}/tools/budget-allocation`}>{copy.budget}</Link><Link href={`${p}/calculator`}>{copy.calculators}</Link><Link href={`${p}/diagnose`}>{copy.diagnose}</Link></nav>
      <nav className="site-footer__column" aria-label={copy.learn}><strong>{copy.learn}</strong><Link href={`${p}/weekly-review`}>{copy.review}</Link><Link href={`${p}/weekly-report`}>{copy.report}</Link><Link href={`${p}/templates`}>{copy.templates}</Link><Link href={`${p}/blog`}>{copy.blog}</Link><Link href={`${p}/glossary`}>{copy.glossary}</Link><Link href={`${p}/guide`}>{copy.guide}</Link></nav>
      <nav className="site-footer__column" aria-label={copy.legal}><strong>{copy.legal}</strong><Link href={`${p}/privacy`}>{copy.privacy}</Link><Link href={`${p}/terms`}>{copy.terms}</Link><Link href={`${p}/contact`}>{copy.contact}</Link></nav>
    </div>
  </footer>;
}
