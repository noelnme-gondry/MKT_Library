// ── Content Analytics 도메인 라벨팩(어댑터) ─────────────────────────────────
// 퍼포먼스 마케팅 엔진(regMath·ahaMath …)을 콘텐츠 마케터 언어로 리라벨하기 위한
// SSOT. 엔진·수학은 절대 불변(§2.1) — 여기서는 UI 카피/라벨만 도메인별로 스왑한다.
//
// 설계 원칙:
//  - "복제 금지, 라벨팩 파라미터화"(사용자 확정): 같은 컴포넌트가 domain prop으로
//    카피만 바꿔 렌더. performance 팩은 기존 하드코딩 문자열과 byte-동일해야
//    기존 도구(5-20 등) 출력이 안 변한다(스모크·골든 안전).
//  - 통계적 정직성(§8): 관측 데이터 리매핑은 인과 아님 → "연관/때문 금지" 문안 유지.

/* AhaMomentFinder(5-20 / 9-2) 공용 카피팩.
   performance = 기존 문자열 그대로(출력 불변). content = 콘텐츠 도메인 번역. */
export const AHA_COPY = {
  performance: {
    demoGroup: "aha",
    guideToolId: "5-20",
    // 빈 상태·매핑
    missingTarget: "타겟(target, 0/1) 1개",
    missingFeature: "선행 행동(feature) 1개 이상",
    // 히어로(§0)
    heroQ: "어떤 초기 행동이 유저를 정착시키나?",
    heroSub:
      '가입 직후 유저가 하는 행동 중, "정착(타겟 달성)"으로 이어지는 신호가 가장 강한 것을 찾았어요.',
    statAll: "전체 유저",
    statTarget: "정착(타겟 달성) 유저",
    statRate: "평균 정착률",
    leadPhrase: (winHtml, actionHtml, k, liftHtml) =>
      `가입 후 <strong>${winHtml}</strong> 안에 <strong>${actionHtml}</strong>를 <strong>${k}번 이상</strong> 한 유저는, 정착할 확률이 평균의 <strong>${liftHtml}</strong>예요.`,
    causationTitle: "연관(association)이지 인과 아님",
    causationBody:
      '원래 열심히 쓰는(engaged) 유저는 모든 행동을 많이 하는 경향(공통 원인)이 있어, 특정 행동이 정착을 "유발"한다고 단정할 수 없습니다. 이 도구는 가설(용의자)을 좁혀줄 뿐입니다.',
    // 칸반(§1)
    kanbanTitle: "후보 행동을 신호 세기별로",
    kanbanHeadStrong: (total, nS) =>
      `후보 ${total}개 중 ${nS}개가 강한 Aha 신호예요 — 초록 칸 행동부터 온보딩·실험에 써보세요.`,
    // 드릴다운(§2)
    drillTitle: "선택한 행동 자세히",
    drillHeadline: (winHtml, actionHtml, k, support, pPct, rPct) =>
      `가입 후 <strong>${winHtml}</strong> 안에 <strong>${actionHtml}</strong>를 <strong>${k}번 이상</strong> 한 유저 <strong>${support}명</strong> 중 <strong>${pPct}%</strong>가 정착했고, 전체 정착자의 <strong>${rPct}%</strong>가 이 행동을 거쳤어요.`,
    metricQAll: "전체 유저는 이 행동을 얼마나 하나?",
    metricQPrecision: "이 조건을 채우면 정착할까?",
    metricAPrecision: (p) => `${p}% 정착`,
    metricQRecall: "정착자를 얼마나 잡아내나?",
    // 상세 설명 .md 문서
    docTitle: "핵심 가치(Aha-moment) 발굴 — 상세 설명",
    docSummary:
      '유저가 우리 서비스에 "정착"(타겟 달성)하기 직전에 공통적으로 하는 **초기 행동**이 무엇인지 찾습니다. "가입 후 N일 안에 특정 행동을 K번 이상 한 유저는 정착 확률이 높더라" 같은 규칙을 데이터에서 자동으로 뒤져 찾아줍니다.',
    docWhy:
      'Aha-moment를 알면 온보딩·푸시·추천을 그 행동으로 유도해 정착률을 끌어올릴 수 있습니다. 예: "7일 안에 친구 3명 초대"가 Aha면, 신규 유저에게 초대를 3명까지 강하게 유도하는 온보딩을 설계합니다.',
    docDataLine: (cache) =>
      `- 전체 유저 ${cache.n.toLocaleString()}명 · 타겟 달성 ${Math.round(cache.baseRate * cache.n).toLocaleString()}명 · 평균 정착률(base rate) ${(cache.baseRate * 100).toFixed(1)}%`,
    docLimit:
      "이 결과는 전부 **연관(association)**이지 **인과(causation)**가 아닙니다. 원래 열심히 쓰는(engaged) 유저는 모든 행동을 많이 하는 경향이 있어(공통 원인), 특정 행동이 정착을 \"유발\"한다고 단정할 수 없습니다. 이 도구의 역할은 **가설(용의자)을 좁혀주는 것**이고, 확정은 반드시 **홀드아웃 실험(5-4 실험 분석)**으로 하세요 — 강한 신호 칸의 행동부터 실험 1순위로 검토하면 됩니다.",
    docFileStem: "aha_moment",
  },
  content: {
    demoGroup: "content_aha",
    guideToolId: "9-2",
    missingTarget: "전환 여부(subscribed, 0/1) 1개",
    missingFeature: "소비한 콘텐츠(feature) 1개 이상",
    heroQ: "어떤 콘텐츠가 독자를 구독시키나?",
    heroSub:
      '독자가 초기에 소비한 콘텐츠 중, "구독 전환"으로 이어지는 신호가 가장 강한 것을 찾았어요.',
    statAll: "전체 독자",
    statTarget: "구독 전환 독자",
    statRate: "평균 전환율",
    leadPhrase: (winHtml, actionHtml, k, liftHtml) =>
      `첫 방문 후 <strong>${winHtml}</strong> 안에 <strong>${actionHtml}</strong>를 <strong>${k}번 이상</strong> 본 독자는, 구독할 확률이 평균의 <strong>${liftHtml}</strong>예요.`,
    causationTitle: "연관(association)이지 인과 아님",
    causationBody:
      '관심 많은 독자는 원래 여러 콘텐츠를 많이 소비하는 경향(공통 원인)이 있어, 특정 콘텐츠가 구독을 "유발"한다고 단정할 수 없습니다. 이 도구는 가설(킬러 콘텐츠 후보)을 좁혀줄 뿐입니다.',
    kanbanTitle: "후보 콘텐츠를 신호 세기별로",
    kanbanHeadStrong: (total, nS) =>
      `후보 ${total}개 중 ${nS}개가 강한 전환 신호예요 — 초록 칸 콘텐츠부터 추천·이메일·큐레이션 입구에 써보세요.`,
    drillTitle: "선택한 콘텐츠 자세히",
    drillHeadline: (winHtml, actionHtml, k, support, pPct, rPct) =>
      `첫 방문 후 <strong>${winHtml}</strong> 안에 <strong>${actionHtml}</strong>를 <strong>${k}번 이상</strong> 본 독자 <strong>${support}명</strong> 중 <strong>${pPct}%</strong>가 구독했고, 전체 구독자의 <strong>${rPct}%</strong>가 이 콘텐츠를 거쳤어요.`,
    metricQAll: "전체 독자는 이 콘텐츠를 얼마나 보나?",
    metricQPrecision: "이 콘텐츠를 보면 구독할까?",
    metricAPrecision: (p) => `${p}% 구독`,
    metricQRecall: "구독자를 얼마나 잡아내나?",
    docTitle: "킬러 콘텐츠·충성 독자 발굴 — 상세 설명",
    docSummary:
      '독자가 우리 채널에 "구독 전환"(회원가입·정기 구독·재방문)하기 직전에 공통적으로 소비하는 **콘텐츠**가 무엇인지 찾습니다. "첫 방문 후 N일 안에 특정 콘텐츠를 K번 이상 본 독자는 구독 확률이 높더라" 같은 규칙을 데이터에서 자동으로 뒤져 찾아줍니다.',
    docWhy:
      'Aha-Content(킬러 콘텐츠)를 알면 추천·이메일·큐레이션을 그 콘텐츠로 유도해 구독 전환율을 끌어올릴 수 있습니다. 예: "[GA4 세팅 가이드]"가 킬러 콘텐츠면, 신규 독자에게 그 글을 강하게 노출하는 온보딩 큐레이션을 설계합니다.',
    docDataLine: (cache) =>
      `- 전체 독자 ${cache.n.toLocaleString()}명 · 구독 전환 ${Math.round(cache.baseRate * cache.n).toLocaleString()}명 · 평균 전환율(base rate) ${(cache.baseRate * 100).toFixed(1)}%`,
    docLimit:
      "이 결과는 전부 **연관(association)**이지 **인과(causation)**가 아닙니다. 관심 많은 독자는 원래 여러 콘텐츠를 많이 소비하는 경향이 있어(공통 원인), 특정 콘텐츠가 구독을 \"유발\"한다고 단정할 수 없습니다. 이 도구의 역할은 **가설(킬러 콘텐츠 후보)을 좁혀주는 것**이고, 확정은 반드시 **A/B 테스트·홀드아웃 실험(5-4)**으로 하세요 — 강한 신호 칸의 콘텐츠부터 실험 1순위로 검토하면 됩니다.",
    docFileStem: "killer_content",
  },
};

export function resolveAhaCopy(domain) {
  return AHA_COPY[domain] || AHA_COPY.performance;
}

/* CampaignPvm(5-21 / 9-3) 공용 카피팩 — PVM Bridge 분해기.
   performance = 기존 하드코딩 문자열과 byte-동일(5-21 출력 불변, 스모크·골든 안전).
   content = 콘텐츠 도메인 번역(채널→유입경로·캠페인→카테고리·소재→콘텐츠,
   분해 지표=트래픽당 비용). 엔진(pvmMath·pvmExport)은 절대 불변 — 라벨만 스왑.
   metricLabel: performance=null → pvmMetricLabel이 기존 CPI/CPA 반환(불변).
   content="방문당 비용" → 오버라이드(콘텐츠는 결과 지표 1개만 매핑, CPA/CPI 토글 숨김). */
export const PVM_COPY = {
  performance: {
    uploaderToolId: "5-21",
    metricLabel: null,
    // 계층 라벨(채널/캠페인/소재)
    levelChannel: "채널",
    levelCampaign: "캠페인",
    levelCreative: "소재",
    // TOC(§2~§4) + 섹션 h2 텍스트
    tocChannels: "§2 채널별 결과",
    tocCampaigns: "§3 채널·캠페인별 결과",
    tocCreatives: "§4 소재별 결과",
    secChannels: "채널별 결과",
    secCampaigns: "채널·캠페인별 결과",
    secCreatives: "소재별 결과",
    // 페이지 타이틀·chip
    title: "캠페인 성과 변동",
    chipMain: "도구 · 캠페인 성과 변동 탐지",
    // 빈 상태(no-data)
    noDataSummary:
      "5-6(소재 분석)과 동일한 소재 daily CSV를 사용합니다 — 이미 5-6에 업로드했다면 자동으로 이어받습니다.",
    noDataCalloutBody: "캠페인 효율 데이터(최소 2주치)를 업로드하여 변동 원인을 분석하세요.",
    // 요약(summary)
    summaryLead: (ml) =>
      `Price-Volume-Mix(PVM) Bridge 분해로 전체 ${ml} 변화를 채널·캠페인·소재 단위로 정확히 나눕니다(잔차 없음).`,
    summaryLimitBody:
      "이 분해는 산술적으로 정확하지만 인과관계를 증명하지 않습니다(association). 채널×캠페인×소재 최소 단위에서 한 번 분해 후 합산하므로 §2(채널)·§3(캠페인)·§4(소재)는 항상 정확히 중첩됩니다(Σ 일치).",
    // §0 인과 경고
    causationCallout:
      "association(연관)일 뿐 인과를 증명하지 않습니다. 채널·캠페인·소재 모두 최소 단위(채널×캠페인×소재)에서 한 번 분해 후 합산해 §2~§4(모드A)는 항상 정확히 중첩됩니다.",
    // §2 Mix·Rate 설명
    explainerMix: "예산 비중이 평균보다 비싼/싼 채널로 옮겨가며 생긴 변화.",
    explainerRate: (ml) => `채널 자체 ${ml}가 변해서 생긴 변화.`,
    // 표 헤더 — 결과 비중
    shareHeader: "결과 비중 (P1→P2)",
    shareHeaderTitle:
      "전체 결과(전환) 건수 중 이 항목이 차지하는 비중 — 비용 비중이 아닙니다.",
    // §3/§4 lock(필드명은 엔진 계약이라 유지, 단계 표현만 도메인화)
    lockCampaign: "🔒 campaign_id 컬럼을 매핑하면 캠페인 단계를 볼 수 있습니다",
    lockCreative: "🔒 creative_id 컬럼을 매핑하면 소재 단계를 볼 수 있습니다",
    // §4 신규(New)
    newBadgeTitle: "신규 소재(이전 기간 0건 → 현재 1건 이상)",
    showNewLabel: "🆕 신규 소재만 보기(이전 기간 0건 → 현재 1건 이상)",
    creativeLinkTitle: "소재 링크 열기",
    insufficientFallback: "채널·비용·결과(설치/액션)·날짜 컬럼을 매핑하고 최소 2주치 데이터를 업로드하세요.",
    emptyCreativeRows: "표시할 소재가 없습니다",
  },
  content: {
    uploaderToolId: "9-3",
    metricLabel: "방문당 비용",
    levelChannel: "유입경로",
    levelCampaign: "카테고리",
    levelCreative: "콘텐츠",
    tocChannels: "§2 유입경로별 결과",
    tocCampaigns: "§3 유입경로·카테고리별 결과",
    tocCreatives: "§4 콘텐츠별 결과",
    secChannels: "유입경로별 결과",
    secCampaigns: "유입경로·카테고리별 결과",
    secCreatives: "콘텐츠별 결과",
    title: "콘텐츠 트래픽 변동",
    chipMain: "도구 · 콘텐츠 트래픽 변동 탐지",
    noDataSummary:
      "유입경로·날짜·제작/배포 비용·트래픽(PV·방문)이 담긴 콘텐츠 성과 CSV를 사용합니다(최소 2주치). 카테고리·콘텐츠 컬럼이 있으면 더 깊게 쪼갭니다.",
    noDataCalloutBody:
      "콘텐츠 트래픽 데이터(최소 2주치)를 업로드하여 어느 유입경로·카테고리·콘텐츠가 트래픽 변동을 일으켰는지 분석하세요.",
    summaryLead: (ml) =>
      `Price-Volume-Mix(PVM) Bridge 분해로 전체 ${ml} 변화를 유입경로·카테고리·콘텐츠 단위로 정확히 나눕니다(잔차 없음).`,
    summaryLimitBody:
      "이 분해는 산술적으로 정확하지만 인과관계를 증명하지 않습니다(association). 유입경로×카테고리×콘텐츠 최소 단위에서 한 번 분해 후 합산하므로 §2(유입경로)·§3(카테고리)·§4(콘텐츠)는 항상 정확히 중첩됩니다(Σ 일치).",
    causationCallout:
      "association(연관)일 뿐 인과를 증명하지 않습니다. 유입경로·카테고리·콘텐츠 모두 최소 단위(유입경로×카테고리×콘텐츠)에서 한 번 분해 후 합산해 §2~§4는 항상 정확히 중첩됩니다.",
    explainerMix: "발행·노출 비중이 평균보다 비싼/싼 유입경로로 옮겨가며 생긴 변화.",
    explainerRate: (ml) => `유입경로 자체 ${ml}가 변해서 생긴 변화.`,
    shareHeader: "트래픽 비중 (P1→P2)",
    shareHeaderTitle:
      "전체 트래픽(방문·PV) 중 이 항목이 차지하는 비중 — 비용 비중이 아닙니다.",
    lockCampaign: "🔒 campaign_id 컬럼을 매핑하면 카테고리 단계를 볼 수 있습니다",
    lockCreative: "🔒 creative_id 컬럼을 매핑하면 콘텐츠 단계를 볼 수 있습니다",
    newBadgeTitle: "신규 콘텐츠(이전 기간 0건 → 현재 1건 이상)",
    showNewLabel: "🆕 신규 콘텐츠만 보기(이전 기간 0건 → 현재 1건 이상)",
    creativeLinkTitle: "콘텐츠 링크 열기",
    insufficientFallback: "유입경로·비용·트래픽(방문/PV)·날짜 컬럼을 매핑하고 최소 2주치 데이터를 업로드하세요.",
    emptyCreativeRows: "표시할 콘텐츠가 없습니다",
  },
};

export function resolvePvmCopy(domain) {
  return PVM_COPY[domain] || PVM_COPY.performance;
}

/* ContentElementAnalyzer(9-1) 라벨팩 — 다변량 회귀(regMath) 요소 중요도 도메인 카피.
   단일 도메인(콘텐츠)이라 팩 1개지만, 미래 다른 도메인 확장 대비 구조는 동일. */
export const ELEMENT_COPY = {
  demoGroup: "content_attr",
  guideToolId: "9-1",
  heroQ: "어떤 제작 요소가 성과를 끌어올리나?",
  heroSub:
    "콘텐츠 여러 편의 제작 속성과 성과(CTR·조회수)를 함께 놓고, 성과와 유의하게 연관된 요소를 다변량 회귀로 가려냈어요.",
  outcomeLabel: "성과 지표 (CTR·조회수 등)",
  featureLabel: "콘텐츠 요소 (제작 속성)",
  // 통계적 정직성(§8): 관측 속성 회귀는 교락 심함 → "연관", "확률 85%" 같은 미산출 금지.
  causationBody:
    '이 결과는 <strong>연관(association)</strong>이지 <strong>인과</strong>가 아닙니다. 잘 만드는 사람이 여러 좋은 요소를 함께 쓰는 경향(교락)이 있어, 한 요소만 따로 바꿨을 때의 효과는 다를 수 있어요. 확정은 요소 하나만 바꾼 <strong>A/B 테스트</strong>로 검증하세요.',
};
