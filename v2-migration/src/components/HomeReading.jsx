import Link from "next/link";
import Image from "next/image";
import { getAllPosts } from "@/lib/blog";
import { localizedHref } from "@/lib/localizedHref";
import { getRouteSeo } from "@/lib/routeSeo";
import { idToPath } from "@/lib/routeMap";

// Editorial selection only; titles, summaries and publication state come from
// the existing server-side content pipeline in each language.
const FEATURED_SLUGS = ["performance-marketing-analysis-order", "budget-scaling-limit", "ad-creative-specs-guide"];

export default function HomeReading({ locale = "ko" }) {
  const en = locale === "en";
  const posts = getAllPosts(locale);
  const selected = FEATURED_SLUGS.map((slug) => posts.find((post) => post.slug === slug)).filter(Boolean);
  const [featured, ...rest] = selected;
  const sop = getRouteSeo("4-1", locale);
  if (!featured) return null;
  return <section className="library-reading" aria-labelledby="library-reading-title">
    <header><div><h2 id="library-reading-title">{en ? "Understand the question before opening a file." : "분석 전에 읽으면 좋은 이야기."}</h2>
      <p>{en ? "Read the context, check your operating standards, then apply them." : "배경을 이해하고, 운영 기준을 확인하고, 내 데이터에 적용하세요."}</p></div>
      <Link href={localizedHref("/blog", locale)}>{en ? "All articles" : "블로그 전체 보기"}</Link></header>
    <div className="library-reading__grid">
      <Link className="library-featured-post" href={localizedHref(`/blog/${featured.slug}`, locale)}>
        <div className="library-featured-post__art" aria-hidden="true">
          <Image src="/images/editorial/analysis-perspective.webp" alt="" fill sizes="(max-width: 768px) 100vw, (max-width: 1100px) 50vw, 600px" />
        </div>
        <div><span className="library-reading__type">{en ? "Blog" : "블로그"}</span><h3>{featured.title}</h3><p>{featured.description}</p></div>
      </Link>
      <div className="library-reading__list">
        {rest.map((post) => <Link key={post.slug} href={localizedHref(`/blog/${post.slug}`, locale)}><span className="library-reading__type">{en ? "Blog" : "블로그"}</span><h3>{post.title}</h3><p>{post.description}</p></Link>)}
        {sop && <Link href={localizedHref(idToPath("4-1"), locale)}><span className="library-reading__type">{en ? "Practical guide · SOP" : "실무 가이드 · SOP"}</span><h3>{sop.title}</h3><p>{sop.description}</p></Link>}
      </div>
    </div>
  </section>;
}
