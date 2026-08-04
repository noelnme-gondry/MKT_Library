import { ImageResponse } from "next/og";
import { getAllPosts, getPostBySlug } from "@/lib/blog";

// EN 글별 SNS 공유 카드 — KR opengraph-image.js 미러. 영문이라 구글폰트 서브셋 fetch 불필요(system sans-serif).
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Growth Opt Playbook";

export function generateStaticParams() {
  return getAllPosts("en").map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }) {
  const { slug } = await params;
  const post = getPostBySlug(slug, "en");
  const title = post?.title || "Growth Opt Playbook";
  const desc = post?.description || "";
  const brand = "Growth Opt Playbook";
  const domain = "growthoptplaybook.com";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #121315 0%, #1a1d2e 100%)",
          padding: "70px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              background: "#adc6ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1a1a2e",
              fontSize: "28px",
              fontWeight: 700,
            }}
          >
            M
          </div>
          <div style={{ display: "flex", color: "#adc6ff", fontSize: "26px", fontWeight: 700 }}>{brand}</div>
          <div style={{ display: "flex", color: "#6b7280", fontSize: "22px" }}>· Blog</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          <div
            style={{
              display: "flex",
              color: "#f5f6f8",
              fontSize: title.length > 40 ? "50px" : "60px",
              fontWeight: 700,
              lineHeight: 1.25,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </div>
          {desc ? (
            <div style={{ display: "flex", color: "#9ca3af", fontSize: "28px", lineHeight: 1.45 }}>
              {desc.length > 120 ? desc.slice(0, 120) + "…" : desc}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", color: "#6b7280", fontSize: "24px" }}>{domain}</div>
          <div style={{ display: "flex", width: "120px", height: "6px", borderRadius: "3px", background: "#adc6ff" }} />
        </div>
      </div>
    ),
    size,
  );
}
