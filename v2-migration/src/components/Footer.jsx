"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname() || "/";
  const isEn = pathname === "/en" || pathname.startsWith("/en/");
  const p = isEn ? "/en" : "";
  const copy = isEn
    ? { note: "Free, browser-only performance marketing analysis.", tools: "Analyze", learn: "Learn", legal: "Legal", dashboard: "Operations dashboard", variance: "Performance variance", fatigue: "Creative fatigue", budget: "Budget allocation", blog: "Blog", glossary: "Glossary", guide: "Operating guides", privacy: "Privacy", terms: "Terms" }
    : { note: "원본 데이터를 서버에 보내지 않는 무료 퍼포먼스 마케팅 분석 도구.", tools: "분석 도구", learn: "실무 자료", legal: "정책", dashboard: "운영 대시보드", variance: "성과 변동 분석", fatigue: "소재 피로도", budget: "예산 배분", blog: "블로그", glossary: "용어사전", guide: "운영 가이드", privacy: "개인정보처리방침", terms: "이용약관" };
  return <footer className="site-footer">
    <div className="site-footer__inner">
      <div className="site-footer__brand"><Link href={p || "/"}>Growth Opt Playbook</Link><p>{copy.note}</p></div>
      <nav className="site-footer__column" aria-label={copy.tools}><strong>{copy.tools}</strong><Link href={`${p}/dashboard`}>{copy.dashboard}</Link><Link href={`${p}/tools/campaign-variance`}>{copy.variance}</Link><Link href={`${p}/content/freshness`}>{copy.fatigue}</Link><Link href={`${p}/tools/budget-allocation`}>{copy.budget}</Link></nav>
      <nav className="site-footer__column" aria-label={copy.learn}><strong>{copy.learn}</strong><Link href={`${p}/blog`}>{copy.blog}</Link><Link href={`${p}/glossary`}>{copy.glossary}</Link><Link href={`${p}/guide`}>{copy.guide}</Link></nav>
      <nav className="site-footer__column" aria-label={copy.legal}><strong>{copy.legal}</strong><Link href="/privacy">{copy.privacy}</Link><Link href="/terms">{copy.terms}</Link></nav>
    </div>
  </footer>;
}
