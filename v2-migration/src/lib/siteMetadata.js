import { withOpenGraphBase } from "./openGraph";

const SITE_URL = "https://growthoptplaybook.com";

const COPY = {
  ko: {
    title: "Growth Opt Playbook | 마케팅 의사결정 워크스페이스",
    description: "캠페인 CSV로 성과 원인을 찾고 다음 행동을 정한 뒤 실제 결과까지 검토하는 무료 퍼포먼스 마케팅 워크스페이스",
    socialDescription: "성과 원인부터 다음 행동과 실제 결과 검토까지 잇는 무료 퍼포먼스 마케팅 워크스페이스",
    keywords: "퍼포먼스 마케팅, 마케팅 데이터 분석, 마케팅 분석툴, 데이터 분석, 콘텐츠 마케팅, 구글 애널리틱스, GA4, SEO, 검색엔진최적화, ROAS, 그로스 해킹, CRM 마케팅, 데이터 드리븐, 마케팅 대시보드, 마케팅 예산 배분, MMM, 마케팅 믹스 모델링, 퍼포먼스 마케팅 SOP, CPA 분석, ROAS 분석, CTR 개선, 광고 소재 분석, 소재 피로도, 타겟팅 전략, 오디언스 분석, 광고 최적화, 캠페인 최적화, 자동입찰, 머신러닝 광고, 노코드 데이터 분석, CSV 분석 도구, 무료 마케팅 툴, A/B 테스트, 증분 측정, 인과추론 마케팅, 홀드아웃 테스트, 앱 마케팅",
  },
  en: {
    title: "Growth Opt Playbook | Marketing Decision Workspace",
    description: "Analyze campaign CSVs in your browser, identify performance drivers, choose the next action, and review the actual outcome.",
    socialDescription: "A free performance marketing workspace connecting analysis, decisions, and outcome reviews.",
    keywords: "performance marketing, marketing analytics, campaign analysis, ROAS, CPA, marketing mix modeling, budget allocation, incrementality, A/B testing, CSV analysis",
  },
};

export function buildRootMetadata(locale = "ko") {
  const language = locale === "en" ? "en" : "ko";
  const copy = COPY[language];
  const url = language === "en" ? `${SITE_URL}/en` : `${SITE_URL}/`;
  return {
    title: { default: copy.title, template: "%s | Growth Opt Playbook" },
    description: copy.description,
    keywords: copy.keywords,
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
    other: { "google-adsense-account": "ca-pub-3073450406371629" },
  };
}

export const SITE_METADATA_URL = SITE_URL;
