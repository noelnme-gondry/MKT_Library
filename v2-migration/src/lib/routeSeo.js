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
  "5-18": {
    ko: {
      title: "광고 카니발라이제이션 진단 | 유료·오가닉 잠식 분석",
      description: "유료 광고가 원래 들어올 오가닉 성과를 잠식하는지 네 가지 신호로 점검하고, 홀드아웃 검증과 예산 재배분이 필요한 채널을 좁힙니다.",
    },
    en: {
      title: "Ad Cannibalization Diagnosis | Paid vs. Organic Overlap",
      description: "Check four signals that paid ads may be displacing organic outcomes, then narrow the channels that need holdout validation or a budget review.",
    },
  },
  "5-3": {
    ko: {
      title: "마케팅 예산 배분 | 채널별 증액·감액 시뮬레이터",
      description: "채널별 한계 CPA·ROAS와 지출 여력을 바탕으로 다음 예산을 어디에 늘리고 줄일지 시뮬레이션하는 무료 마케팅 예산 배분 도구입니다.",
    },
    en: {
      title: "Marketing Budget Allocation | Scale-up and Pull-back Simulator",
      description: "Use marginal CPA, ROAS, and channel headroom to simulate where the next marketing budget should increase or decrease.",
    },
  },
};

export function getRouteSeo(routeId, locale = "ko") {
  return ROUTE_SEO[routeId]?.[locale] || null;
}
