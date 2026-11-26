"use client";

import Link from "next/link";
import { useBlogCtaView } from "@/components/blog/BlogConversionEntry";
import { trackProductEvent } from "@/lib/analytics";

const prompts = {
  budget: {
    ko: ["예산을 늘린 매체에서 전환도 그만큼 늘었나요?", "CSV를 열면 증액분과 추가 전환을 함께 볼 수 있습니다. 집행 이력이 충분하면 같은 총예산을 다시 나눠 본 결과까지 비교해 보세요."],
    en: ["Did higher spend buy enough additional conversions?", "Compare the extra spend with the extra conversions. With enough spend history, you can also test a different split of the same budget."],
  },
  creative: {
    ko: ["소재를 바꾼 주에 캠페인 성과가 달라졌나요?", "소재 이름을 포함한 리포트에서 새로 등장한 소재와 사라진 소재를 확인하세요. 노출·클릭도 있으면 CTR과 CPA가 함께 악화된 소재를 찾을 수 있습니다."],
    en: ["What changed the week your creatives changed?", "Include creative names to see which ads appeared or disappeared. Add impressions and clicks to check for falling CTR alongside rising CPA."],
  },
  mix: {
    ko: ["단가가 오른 건가요, 비싼 매체의 비중이 커진 건가요?", "전주와 이번 주의 집행액과 전환 수를 넣으면 매체 구성이 달라진 영향과 같은 그룹 안에서 단가가 달라진 영향을 나눠 볼 수 있습니다."],
    en: ["Did each conversion cost more, or did the channel mix change?", "Compare spend and conversions over two weeks to separate the shift in result share from changes in cost per result within each group."],
  },
  weekly: {
    ko: ["내 캠페인에서는 어디서 비용이 늘었을까요?", "광고 리포트 한 장으로 지난주와 이번 주의 지출, 전환 수, 전환당 비용을 함께 비교해 보세요."],
    en: ["Where did your campaign lose efficiency?", "Compare spend, conversions and cost per acquisition across two weeks with your campaign CSV."],
  },
};

export default function BlogDiagnosisLink({ locale, slug, toolId }) {
  const anchor = useBlogCtaView(slug, locale, "article_diagnosis", "campaign-diagnosis");
  const en = locale === "en";
  const topic = ({ "5-31": "budget", "5-3": "budget", "5-22": "budget", "9-6": "creative", "5-21": "mix" })[toolId] || "weekly";
  const [question, detail] = prompts[topic][locale];
  return <aside className="article-diagnosis-link">
    <strong>{question}</strong>
    <p>{detail}</p>
    <Link ref={anchor} href={en ? "/en/tools/operations-planner?from=blog" : "/tools/operations-planner?from=blog"} onClick={() => trackProductEvent("blog_tool_cta_clicked", {content_slug: slug, content_type: "blog", locale, placement: "article_diagnosis", tool_id: "campaign-diagnosis"})}>{en ? "Open campaign diagnosis" : "캠페인 효율 진단 열기"} →</Link>
  </aside>;
}
