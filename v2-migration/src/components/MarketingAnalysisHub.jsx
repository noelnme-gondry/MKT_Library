import Link from "next/link";
import { MARKETING_ANALYSIS_TASKS, marketingAnalysisCopy } from "@/lib/marketingAnalysisHub";
import { COMPARE_SLUGS, getComparePage } from "@/lib/compareContent";
import { SITE_URL } from "@/lib/routeMap";
import MarketingAnalysisPreview from "@/components/MarketingAnalysisPreview";
import HeroArtwork from "@/components/landing/HeroArtwork";
import blogExamples from "@/lib/blogExamples/data.json";

export default function MarketingAnalysisHub({ locale = "ko" }) {
  const copy = marketingAnalysisCopy(locale), prefix = locale === "en" ? "/en" : "";
  const faq = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: copy.faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
  const breadcrumb = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Growth Opt Playbook", item: `${SITE_URL}${prefix}/` },
    { "@type": "ListItem", position: 2, name: copy.title, item: `${SITE_URL}${prefix}/compare` },
  ] };
  return <article className="compare-page marketing-analysis-hub">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([faq, breadcrumb]) }} />
    <section className="analysis-hub-hero brand-hero" aria-labelledby="analysis-hub-title">
    <div className="brand-hero__stage">
    <div className="analysis-hub-intro">
    <div className="brand-hero__heading">
    <h1 id="analysis-hub-title">{copy.title}</h1>
    <HeroArtwork />
    </div>
    <p className="compare-page__lead">{copy.intro}</p>
    <div className="analysis-hub-entry">
      <Link className="btn primary" href="#analysis-examples">{locale === "en" ? "Explore the examples" : "예시로 분석해 보기"}</Link>
      <Link className="btn" href={`${prefix}/start`}>{locale === "en" ? "Analyze my data" : "내 데이터 분석하기"}</Link>
    </div>
    <p className="analysis-hub-assurance">{locale === "en" ? "Free analysis without signing up. CSVs stay in your browser." : "가입 없이 무료 분석. CSV는 브라우저에서 처리합니다."}</p>
    </div>
    </div>
    <MarketingAnalysisPreview locale={locale} examples={Object.fromEntries(MARKETING_ANALYSIS_TASKS.filter(task => !task.calculator).map(task => [task.slug, blogExamples[task.slug]]))} />
    </section>
    <section className="analysis-hub-start"><div><h2>{copy.start}</h2><p>{copy.startText}</p></div><Link className="btn" href={`${prefix}/start`}>{copy.startAction}</Link></section>
    <section className="analysis-hub-library" aria-labelledby="analysis-methods-title">
    <header><h2 id="analysis-methods-title">{copy.methods}</h2><p>{copy.methodsLead}</p></header>
    <ul className="analysis-method-index">{COMPARE_SLUGS.map(slug => {
      const page = getComparePage(slug, locale);
      return <li key={slug}><Link href={`${prefix}/compare/${slug}`}><h3>{page.question}</h3><span>{page.table.caption}</span></Link></li>;
    })}</ul>
    </section>
    <section className="analysis-hub-reading">
    <h2>{copy.workflow}</h2><p>{copy.workflowText}</p>
    <ol className="analysis-learning-path">
      <li><Link href={`${prefix}/blog/performance-marketing-analysis-order`}><strong>{copy.workflowLink}</strong><span>{locale === "en" ? "Set goals and align your conversion metrics." : "목표와 전환 지표의 기준부터 맞춥니다."}</span></Link></li>
      <li><Link href={`${prefix}/blog/marketing-analysis-example`}><strong>{locale === "en" ? "Marketing analysis: a CSV walkthrough" : "마케팅 분석 실무 예제"}</strong><span>{locale === "en" ? "Follow the numbers in one campaign CSV." : "캠페인 CSV 한 장으로 숫자를 따라 읽습니다."}</span></Link></li>
      <li><Link href={`${prefix}/blog/weekly-marketing-report-template`}><strong>{locale === "en" ? "Weekly reporting and review" : "주간 보고서와 재검토 순서"}</strong><span>{locale === "en" ? "Record a decision and the next review." : "분석 뒤의 결정과 다음 확인을 남깁니다."}</span></Link></li>
    </ol>
    </section>
    <h2>{locale === "en" ? "Questions about marketing analysis" : "마케팅 분석을 시작할 때 자주 묻는 질문"}</h2>
    {copy.faq.map(item => <section key={item.q} className="analysis-hub-faq"><h3>{item.q}</h3><p>{item.a}</p></section>)}
  </article>;
}
