import { withOpenGraphBase } from "./openGraph";
// SITE_URL의 SSOT는 routeMap.js다(AGENTS.md §1). 여기서 다시 선언하면 도메인이
// 바뀔 때 canonical·OG·sitemap이 서로 다른 호스트를 가리키게 된다.
import { SITE_URL } from "./routeMap";

const COPY = {
  ko: {
    title: "퍼포먼스 마케팅·마케팅 분석 도구 | Growth Opt Playbook",
    description: "퍼포먼스 마케팅을 위한 무료 마케팅 분석 도구. 광고 CSV 한 장으로 전주 대비 비용·전환·CPA를 비교하고 매체별 증액과 소재 변경의 결과를 확인하세요.",
    socialDescription: "성과 원인부터 다음 행동과 실제 결과 검토까지 잇는 무료 퍼포먼스 마케팅 워크스페이스",
  },
  en: {
    title: "Performance Marketing Analysis Tools | Growth Opt Playbook",
    description: "Free performance marketing analysis tools. Upload a campaign CSV to compare weekly spend, conversions and CPA and review budget and creative changes.",
    socialDescription: "A free performance marketing workspace connecting analysis, decisions, and outcome reviews.",
  },
};

export function buildRootMetadata(locale = "ko") {
  const language = locale === "en" ? "en" : "ko";
  const copy = COPY[language];
  const url = language === "en" ? `${SITE_URL}/en` : `${SITE_URL}/`;
  return {
    title: { default: copy.title, template: "%s | Growth Opt Playbook" },
    description: copy.description,
    authors: [{ name: "Growth Opt Playbook" }],
    robots: { index: true, follow: true },
    metadataBase: new URL(SITE_URL),
    openGraph: withOpenGraphBase({
      type: "website",
      url,
      title: copy.title,
      description: copy.socialDescription,
      images: [{ url: `${SITE_URL}/og-card.png`, width: 1200, height: 630 }],
    }, language),
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.socialDescription,
      images: [`${SITE_URL}/og-card.png`],
    },
  };
}

export const SITE_METADATA_URL = SITE_URL;
