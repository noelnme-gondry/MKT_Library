export const ROUTE_SEO = {
  "guide-index": {
    ko: {
      title: "퍼포먼스 마케팅 실무 가이드 | UAC·Meta·MMP·리텐션",
      description: "MMP 연동, 이벤트 택소노미, Google UAC·Meta 운영, 소재 제작, 코호트와 리텐션 분석을 단계별 체크리스트로 정리한 무료 실무 가이드입니다.",
    },
    en: {
      title: "Performance Marketing Playbooks | Tracking, Campaigns & Measurement",
      description: "Step-by-step playbooks for MMP tracking, event taxonomy, Google and Meta campaign operations, creative, cohorts, and retention analysis.",
    },
  },
  "start-gate": {
    ko: {
      title: "무료 마케팅 CSV 분석 | 가능한 분석 자동 추천",
      description: "캠페인 CSV 또는 Google Sheets를 가져오면 데이터 구조를 브라우저에서 진단하고 대시보드, PVM, 예산 배분, MMM 등 가능한 분석을 추천합니다.",
    },
    en: {
      title: "Free Marketing CSV Analyzer | Find the Right Analysis",
      description: "Import a campaign CSV or Google Sheet to profile its structure in your browser and find the dashboard, PVM, budget, MMM, or experiment analysis it supports.",
    },
  },
};

export function getRouteSeo(routeId, locale = "ko") {
  return ROUTE_SEO[routeId]?.[locale] || null;
}
