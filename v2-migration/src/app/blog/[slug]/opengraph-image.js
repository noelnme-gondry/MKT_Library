import { ImageResponse } from "next/og";
import { getAllPosts, getPostBySlug } from "@/lib/blog";

// 글별 SNS 공유 카드(OG 이미지) 동적 생성 — 1200×630 PNG. Next 파일 컨벤션이라
// 각 글 <head>의 og:image·twitter:image에 자동 주입. 향후 글도 자동 커버(수동 PNG 불필요).
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Growth Ops Playbook";

// 발행 글만 정적 생성(글 페이지 generateStaticParams와 동일 집합).
export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

// 한글 렌더용 폰트 데이터 — Google Fonts에서 필요한 글자(text 서브셋)만 fetch.
// satori는 woff2 미지원 → 서버 fetch(UA 없음)면 Google이 ttf/otf(truetype/opentype)로 응답.
// 실패 시 null 폴백(폰트 없이도 PNG는 생성 — 한글은 깨질 수 있으나 빌드는 안 죽음).
async function loadGoogleFont(family, text) {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url)).text();
    const m = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
    if (m) {
      const res = await fetch(m[1]);
      if (res.ok) return await res.arrayBuffer();
    }
  } catch {
    /* 네트워크 불가 등 — 폴백 */
  }
  return null;
}

export default async function Image({ params }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  const title = post?.title || "Growth Ops Playbook";
  const desc = post?.description || "";
  const brand = "Growth Ops Playbook";
  const domain = "growthoptplaybook.com";

  // 카드에 등장하는 모든 글자를 모아 서브셋 요청(용량 최소화).
  const text = `${title}${desc}${brand}${domain}블로그·마케팅 데이터 분석`;
  const fontData = await loadGoogleFont("Noto+Sans+KR:wght@700", text);
  const fonts = fontData
    ? [{ name: "NotoKR", data: fontData, weight: 700, style: "normal" }]
    : [];

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
          fontFamily: fonts.length ? "NotoKR" : "sans-serif",
        }}
      >
        {/* 상단: 브랜드 + 섹션 */}
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
          <div style={{ display: "flex", color: "#6b7280", fontSize: "22px" }}>· 블로그</div>
        </div>

        {/* 중앙: 제목 + 설명 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          <div
            style={{
              display: "flex",
              color: "#f5f6f8",
              fontSize: title.length > 26 ? "54px" : "64px",
              fontWeight: 700,
              lineHeight: 1.25,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </div>
          {desc ? (
            <div style={{ display: "flex", color: "#9ca3af", fontSize: "28px", lineHeight: 1.45 }}>
              {desc.length > 90 ? desc.slice(0, 90) + "…" : desc}
            </div>
          ) : null}
        </div>

        {/* 하단: 도메인 + 액센트 바 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", color: "#6b7280", fontSize: "24px" }}>{domain}</div>
          <div style={{ display: "flex", width: "120px", height: "6px", borderRadius: "3px", background: "#adc6ff" }} />
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
