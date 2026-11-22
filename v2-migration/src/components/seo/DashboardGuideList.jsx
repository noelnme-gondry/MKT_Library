import Link from "next/link";
import { DASHBOARD_GUIDES } from "@/lib/dashboardBlogGuides";

export default function DashboardGuideList({ posts, locale }) {
  const guides = posts.filter((post) => DASHBOARD_GUIDES[post.slug]);
  if (!guides.length) return null;
  const en = locale === "en";
  return (
    <details className="block">
      <summary>{en ? "Operations dashboard guides" : "운영 대시보드 사용법"} ({guides.length})</summary>
      <ul>
        {guides.map((post) => (
          <li key={post.slug}>
            <Link href={`${en ? "/en" : ""}/blog/${post.slug}`}>{post.title}</Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
