import Link from "next/link";
import { MARKETING_ANALYSIS_TASKS, marketingAnalysisCopy } from "@/lib/marketingAnalysisHub";
import { COMPARE_SLUGS, getComparePage } from "@/lib/compareContent";
import { SITE_URL } from "@/lib/routeMap";
import MarketingAnalysisPreview from "@/components/MarketingAnalysisPreview";
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
    <div className="analysis-hub-intro"><span className="compare-page__eyebrow">{locale === "en" ? "Free tools · No sign-up · Browser processing" : "무료 분석 · 가입 없이 · 브라우저에서 처리"}</span>
    <h1>{copy.title}</h1>
    <p className="compare-page__lead">{copy.intro}</p>
    </div>
    <MarketingAnalysisPreview locale={locale} examples={Object.fromEntries(MARKETING_ANALYSIS_TASKS.filter(task => !task.calculator).map(task => [task.slug, blogExamples[task.slug]]))} />
    <section className="analysis-hub-start"><h2>{copy.start}</h2><p>{copy.startText}</p><Link className="btn" href={`${prefix}/start`}>{copy.startAction}</Link></section>
    <h2>{copy.methods}</h2><p>{copy.methodsLead}</p>
    <ul className="analysis-method-index">{COMPARE_SLUGS.map((slug, index) => {
      const page = getComparePage(slug, locale);
      return <li key={slug}><span aria-hidden="true">0{index + 1}</span><div><Link href={`${prefix}/compare/${slug}`}>{page.title}</Link><p>{page.question}</p></div><span aria-hidden="true">↗</span></li>;
    })}</ul>
    <h2>{copy.workflow}</h2><p>{copy.workflowText}</p>
    <ol className="analysis-learning-path">
      <li><span>{locale === "en" ? "Define" : "목표를 정하고"}</span><Link href={`${prefix}/blog/performance-marketing-analysis-order`}>{copy.workflowLink} →</Link></li>
      <li><span>{locale === "en" ? "Work through a case" : "숫자를 읽고"}</span><Link href={`${prefix}/blog/marketing-analysis-example`}>{locale === "en" ? "Marketing analysis: a CSV walkthrough" : "마케팅 분석 실무 예제"} →</Link></li>
      <li><span>{locale === "en" ? "Decide and revisit" : "다음 행동을 남깁니다"}</span><Link href={`${prefix}/blog/weekly-marketing-report-template`}>{locale === "en" ? "Weekly reporting and review" : "주간 보고서와 재검토 순서"} →</Link></li>
    </ol>
    <h2>{locale === "en" ? "Questions about marketing analysis" : "마케팅 분석을 시작할 때 자주 묻는 질문"}</h2>
    {copy.faq.map(item => <section key={item.q} className="analysis-hub-faq"><h3>{item.q}</h3><p>{item.a}</p></section>)}
  </article>;
}
