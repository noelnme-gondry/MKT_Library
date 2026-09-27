import Link from "next/link";
import { getAllPosts } from "@/lib/blog";
import { localizedHref } from "@/lib/localizedHref";

// Editorial selection only; titles, summaries and publication state come from
// the existing server-side content pipeline in each language.
const FEATURED_SLUGS = ["performance-marketing-analysis-order", "budget-scaling-limit", "ad-creative-specs-guide"];

export default function HomeReading({ locale = "ko" }) {
  const en = locale === "en";
  const posts = getAllPosts(locale);
  const selected = FEATURED_SLUGS.map((slug) => posts.find((post) => post.slug === slug)).filter(Boolean);
  if (!selected.length) return null;
  return <section className="library-reading home-reading-list" aria-labelledby="library-reading-title">
    <header><div><h2 id="library-reading-title">{en ? "Reading for better decisions" : "판단을 돕는 읽을거리"}</h2>
      <p>{en ? "Use the related analysis to explore what you read." : "글에서 이해한 내용을 관련 분석으로 확인하세요."}</p></div>
      <Link href={localizedHref("/blog", locale)}>{en ? "All articles" : "블로그 전체 보기"}</Link></header>
    <div className="home-reading-list__layout">
      <div className="home-reading-list__articles">
        {selected.map((post) => <Link key={post.slug} href={localizedHref(`/blog/${post.slug}`, locale)}><h3>{post.title}</h3>{post.description && <p>{post.description}</p>}</Link>)}
      </div>
      <aside className="home-guide-shelf">
        <h3>{en ? "Practical guides" : "실무 가이드"}</h3>
        <p>{en ? "Operating standards your team can share, from tracking setup to campaign operations." : "트래킹 셋업부터 캠페인 운영까지, 팀이 함께 확인하는 운영 기준입니다."}</p>
        <Link href={localizedHref("/guide", locale)}>{en ? "View the playbook" : "운영 플레이북 보기"}</Link>
      </aside>
    </div>
  </section>;
}
