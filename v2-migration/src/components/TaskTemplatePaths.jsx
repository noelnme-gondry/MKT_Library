import Link from "next/link";
import { TEMPLATE_PAGES } from "@/lib/templateCatalog";
import { idToSlug } from "@/lib/routeMap";
import SampleReportDownloads from "./SampleReportDownloads";
import { PUBLISHED_BLOG_TOOL_MAP } from "@/lib/contentToolRegistry";

const TASKS = [
  { article: "performance-marketing-analysis-order", ko: ["주간 성과 보고 준비", "두 기간의 성과와 다음 검토할 결정을 한 흐름으로 정리합니다."], en: ["Prepare a weekly review", "Connect a period comparison to a decision and its next review."] },
  { article: "ad-performance-diagnosis", ko: ["CPA가 오른 이유 확인", "비용·전환 변화와 구성 영향을 나눠 확인합니다. 원인을 단정하지 않습니다."], en: ["Investigate a CPA increase", "Separate spend, conversion and composition changes without asserting causation."] },
  { article: "budget-scaling-limit", ko: ["예산 증액 근거 점검", "평균과 한계를 구분하고, 데이터가 부족하면 판단을 보류합니다."], en: ["Assess the case for scaling", "Distinguish average from marginal performance and hold when evidence is insufficient."] },
];

export default function TaskTemplatePaths({ locale = "ko" }) {
  const en = locale === "en";
  const prefix = en ? "/en" : "";
  return <section className="task-template-paths" aria-labelledby="task-template-title">
    <h2 id="task-template-title">{en ? "Start with the work you need to deliver" : "이번에 정리할 업무부터 고르세요"}</h2>
    <p>{en ? "Follow a worked example, check its input requirements, then analyze your own data. Analysis and sample files are free; report downloads require a purchased pass." : "실습 사례를 보고 입력 조건을 확인한 뒤, 내 데이터로 분석하세요. 분석·예시 파일은 무료이며 보고서 다운로드는 구매 이용권이 필요합니다."}</p>
    <ol>{TASKS.map(task => {
      const [title, detail] = task[en ? "en" : "ko"];
      const toolId = PUBLISHED_BLOG_TOOL_MAP[task.article];
      const template = TEMPLATE_PAGES.find(item => item.toolId === toolId);
      return <li key={task.article}><h3>{title}</h3><p>{detail}</p><nav aria-label={title}>
        <Link href={`${prefix}/blog/${task.article}`}>{en ? "1. Worked example" : "1. 실습 사례"}</Link>
        <Link href={`${prefix}/templates/${template.slug}`}>{en ? "2. Prepare data" : "2. 데이터 준비"}</Link>
        <Link href={`${prefix}${idToSlug[toolId]}`}>{en ? "3. Analyze" : "3. 분석하기"}</Link>
      </nav></li>;
    })}</ol>
    <SampleReportDownloads locale={locale} />
  </section>;
}
