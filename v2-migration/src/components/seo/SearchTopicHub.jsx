import Link from "next/link";

const TOPICS = {
  ko: [
    { href: "/dashboard", title: "마케팅 대시보드", desc: "이번 주 CPA·ROAS·예산 속도를 한 번에 확인" },
    { href: "/tools/campaign-variance", title: "CPA 상승 원인 분석", desc: "채널·캠페인·소재가 실제로 움직인 금액 분해" },
    { href: "/content/freshness", title: "광고 소재 피로도", desc: "교체가 필요한 소재와 다음 제작 우선순위" },
    { href: "/tools/budget-allocation", title: "광고 예산 배분", desc: "다음 예산을 어디로 옮길지 시뮬레이션" },
  ],
  en: [
    { href: "/en/dashboard", title: "Marketing operations dashboard", desc: "Review weekly CPA, ROAS, and budget pacing" },
    { href: "/en/tools/campaign-variance", title: "Why did CPA change?", desc: "Decompose the amount moved by channel, campaign, and creative" },
    { href: "/en/content/freshness", title: "Creative fatigue analysis", desc: "Find creatives to replace and what to produce next" },
    { href: "/en/tools/budget-allocation", title: "Marketing budget allocation", desc: "Simulate where the next budget should move" },
  ],
};

export default function SearchTopicHub({ locale = "ko" }) {
  const isEn = locale === "en";
  return <section className="block" style={{ margin: "0 0 1.75rem", padding: "16px" }} aria-label={isEn ? "Popular marketing analysis tasks" : "자주 찾는 마케팅 분석"}>
    <h2 className="section-title" style={{ margin: "0 0 5px", fontSize: "18px" }}>{isEn ? "Start with a real marketing question" : "실무에서 바로 찾는 분석"}</h2>
    <p style={{ margin: "0 0 12px", color: "var(--text-muted)", fontSize: "13px", lineHeight: 1.6 }}>{isEn ? "Read the guide, then use the matching free tool with your own data." : "글과 용어를 읽은 뒤, 같은 주제를 내 데이터로 바로 확인할 수 있습니다."}</p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "8px" }}>
      {TOPICS[isEn ? "en" : "ko"].map((topic) => <Link key={topic.href} href={topic.href} style={{ textDecoration: "none", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "10px", background: "var(--surface-container-lowest)" }}>
        <strong style={{ color: "var(--text-primary)", display: "block", fontSize: "13px" }}>{topic.title}</strong>
        <span style={{ color: "var(--text-muted)", display: "block", marginTop: "3px", fontSize: "11.5px", lineHeight: 1.45 }}>{topic.desc}</span>
      </Link>)}
    </div>
  </section>;
}
