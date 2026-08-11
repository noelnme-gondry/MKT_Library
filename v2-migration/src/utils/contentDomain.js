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
    tocChannels: "채널별 결과",
    tocCampaigns: "채널·캠페인별 결과",
    tocCreatives: "소재별 결과",
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
      "이 분해는 산술적으로 정확하지만 인과관계를 증명하지 않습니다(association). 채널×캠페인×소재 최소 단위에서 한 번 분해 후 합산하므로 채널·캠페인·소재 보기는 항상 정확히 중첩됩니다(Σ 일치).",
    // §0 인과 경고
    causationCallout:
      "association(연관)일 뿐 인과를 증명하지 않습니다. 채널·캠페인·소재 모두 최소 단위(채널×캠페인×소재)에서 한 번 분해 후 합산해 세 보기는 항상 정확히 중첩됩니다.",
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
    tocChannels: "유입경로별 결과",
    tocCampaigns: "유입경로·카테고리별 결과",
    tocCreatives: "콘텐츠별 결과",
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
      "이 분해는 산술적으로 정확하지만 인과관계를 증명하지 않습니다(association). 유입경로×카테고리×콘텐츠 최소 단위에서 한 번 분해 후 합산하므로 유입경로·카테고리·콘텐츠 보기는 항상 정확히 중첩됩니다(Σ 일치).",
    causationCallout:
      "association(연관)일 뿐 인과를 증명하지 않습니다. 유입경로·카테고리·콘텐츠 모두 최소 단위(유입경로×카테고리×콘텐츠)에서 한 번 분해 후 합산해 세 보기는 항상 정확히 중첩됩니다.",
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

/* CreativeAnalyzer(5-6 / 9-6) 공용 카피팩 — 소재 피로도 진단기.
   performance = 기존 하드코딩 문자열과 byte-동일(5-6 출력 불변, 스모크·골든 안전).
   content = 콘텐츠 도메인 번역(소재→콘텐츠·피로도→신선도 저하·교체→발행).
   엔진(creativeMath: CREATIVE_STATS·CREATIVE_FATIGUE)은 비율(CTR/CVR) 기반이라
   스케일 안전 — 절대 불변, 라벨만 스왑. CSV 필드명·매핑키(creative_id·hook_type…)
   도 엔진 계약이라 불변, 화면 라벨만 도메인화.
   entity = 인라인 단수 명사(칩·필터 카운트 등에서 `${entity} N개`로 재사용). */
export const CREATIVE_COPY = {
  performance: {
    uploaderToolId: "5-6",
    entity: "소재",
    // 빈 상태(no-data)
    noDataDesc: "소재 성과 데이터를 업로드하여 Fatigue와 Concept을 분석하세요.",
    // 히어로(§0)
    heroTitle: "어떤 소재가 이기고, 언제 갈아끼워야 하나?",
    heroSub:
      "소재(영상·이미지 등 광고 크리에이티브)별로 무엇이 잘 되는지, 왜 잘 되는지, 언제 새로 바꿔야 하는지를 한 곳에서 보여줍니다.",
    heroJourney: [
      ["🏆", "어떤 소재가 이기고 있나", "승률·교체 속도·생존 기간"],
      ["🔍", "어떤 특징이 효과적인가", "후킹 방식·포맷 등 속성별 효과"],
      ["🔋", "지금 지치는 소재가 있나", "피로도 진단·교체 시점 추천"],
      ["🧪", "다음엔 뭘 테스트할까", "조합별 성과 기반 후보 추천"],
    ],
    heroCausationBody:
      "노출량 가중 최소제곱법(WLS)과 다중 검정 보정(BH)을 통해 크리에이티브 속성(Hook, Format 등)의 효과를 추정합니다. 본 분해 결과는 매체 알고리즘에 따른 노출 편향(Selection Bias)이 포함되어 있으므로 인과적 효과가 아닌 상관 관계로 해석해야 하며, 최종 확정은 실험 도구(5-4)를 통해 검증하시는 것을 권장합니다.",
    // §2 운영 건강도
    healthTitle: "운영 건강도 (Win-rate · Velocity · 라이프사이클)",
    healthDescPre: "소재 운영이 잘 되고 있는지 보는 3가지 질문 — 새 소재가 얼마나 자주 ",
    healthDescS1: "이기는지(이긴 비율, Win-rate)",
    healthDescS2: "갈아끼우는지(교체 속도, Velocity)",
    healthDescS3: "오래 버티는지(생존 기간, 라이프사이클)",
    statCtrLabel: "클릭이 잘 되는 소재 비율 (CTR Win-rate)",
    statCtrTitle: "다른 소재들의 클릭률 중간값보다 잘 나온 소재 비율",
    statCvrLabel: "전환이 잘 되는 소재 비율 (CVR Win-rate)",
    statCvrTitle: "다른 소재들의 전환율 중간값보다 잘 나온 소재 비율",
    statSpendLabel: "잘 되는 소재에 쓴 비용 비중",
    statSpendHint: "CTR 승자 소재에 쓴 비용 비중",
    statVelLabel: "한 주에 새로 올리는 소재 수 (Velocity)",
    statVelTitle: "한 주에 새로 등장한 소재 개수의 평균",
    statLifeLabel: "소재 하나가 버티는 평균 기간",
    statFatLabel: "피로해진 소재 비율 (Fatigue)",
    statFatTitle: "성과가 떨어지며 지친 것으로 진단된 소재 비율",
    healthCalloutT1: "이 50%를 크게 밑돌면 소재 기획 적중률이 낮은 것 — 다음 테스트에서 컨셉을 더 다양하게 시도해야 합니다.",
    healthCalloutS2: "한 주에 새로 올리는 소재 수",
    healthCalloutT2: "가 너무 적으면 지치는 소재를 못 따라잡습니다 (벤치마크: 활성 소재의 20~30% / 주).",
    healthCalloutS3: "잘 되는 소재에 쓴 비용 비중",
    healthCalloutT3: "이 낮으면 좋은 소재에 예산이 안 실리고 있다는 신호입니다.",
    // §3 성과표
    metricsTitle: "소재별 성과표",
    metricsDesc: "노출·클릭·설치 같은 원자료와, 클릭률·전환율·설치당비용 같은 계산된 효율 지표를 함께 봅니다. 약어 위에 마우스를 올리면 설명이 나옵니다.",
    filterActiveLabel: "조합별 성과표(Concept Matrix) 필터 적용 중:",
    colCreativeId: "Creative ID",
    // §4 속성별 효과
    decomposeDescPre: "후킹 방식·메시지 콘셉트·포맷 같은 소재 속성이 ",
    decomposeBiasSource: "매체 알고리즘",
    decomposeUnavailBody: "소재 속성 컬럼(hook_type·format 등) 매핑 또는 데이터 행 수(30행 이상)가 부족합니다.",
    // §5 피로도 진단
    fatigueTitle: "소재 피로도 진단 (Fatigue 검출)",
    fatigueDesc: (total, count) => `분석 소재 ${total}개 · 피로해진 소재 ${count}개`,
    fatiguedBadge: "피로",
    fatigueEmpty: "지친 소재가 감지되지 않았습니다 (양호)",
    // §6 임박 경고
    fatigueAlertTitle: "피로도 임박 경고 (Ad Fatigue Alert)",
    fatigueAlertDesc: (total, alertNow) => `분석 소재 ${total}개 · 지금 바로 경고 ${alertNow}개`,
    fatigueAlertEmpty: (minDays) => `분석 가능한 소재가 없습니다 (운영 기간 ${minDays}일 미만)`,
    // §7 교체 일정
    plannerTitle: "교체 일정 추천 (Auto-Planner)",
    plannerDesc: "한 주에 새로 만들 수 있는 소재 개수를 입력하면, 피로도가 급한 소재부터 교체할 주차를 자동으로 배정해 드립니다.",
    plannerVelocityLabel: "주당 신규 소재 공급량",
    plannerStatUrgentLabel: "긴급 교체 필요",
    plannerStatUrgentTitle: "즉시 경고 또는 임박 위험으로 분류된 소재 수",
    plannerStatWeeksTitle: "현재 공급 속도로 긴급 소재를 전부 교체하는 데 걸리는 기간",
    plannerStatRecLabel: "추천 주당 교체 속도",
    plannerStatRecTitle: "긴급 물량을 1주 내 소화하려면 필요한 주당 신규 소재 수",
    plannerUndersupplyBody: (u, v, r) =>
      `긴급 교체가 필요한 소재가 ${u}개인데 현재 주당 공급량(${v})으로는 1주 내 전부 소화할 수 없습니다. 주당 ${r}개 이상으로 늘리거나 긴급도가 낮은 소재의 교체를 늦추세요.`,
    plannerOkBody: (v) => `현재 공급량(주당 ${v}개)으로 긴급 교체 물량을 충분히 소화 가능합니다.`,
    plannerGanttTitle: (weeks) => `교체 타임라인 (Gantt) — 향후 ${weeks}주`,
    plannerFootnote: "교체 순서는 [지금 바로 경고 우선 → 위험 도달 예상이 빠른 순 → 피로도 점수 높은 순]으로 정해지며, 입력한 주당 개수만큼씩 주차에 나눠 배치됩니다.",
    plannerEmpty: "교체가 필요한 소재가 없습니다.",
    // §8 조합표
    matrixDesc1: "소재 속성 두 가지를 교차해서, 어떤 조합이 이미 검증됐고 어떤 조합을 더 시도해봐야 하는지 한눈에 봅니다. 셀을 클릭하면 소재 성과표가 그 조합으로 필터링됩니다.",
  },
  content: {
    uploaderToolId: "9-6",
    entity: "콘텐츠",
    noDataDesc: "콘텐츠 성과 데이터를 업로드하여 신선도 저하와 반응 감쇠를 분석하세요.",
    heroTitle: "어떤 콘텐츠가 반응이 좋고, 언제 새로 발행해야 하나?",
    heroSub:
      "콘텐츠(글·영상·포스트 등)별로 무엇이 잘 되는지, 왜 잘 되는지, 언제 새로 발행해야 하는지를 한 곳에서 보여줍니다.",
    heroJourney: [
      ["🏆", "어떤 콘텐츠가 반응이 좋나", "승률·발행 페이스·생존 기간"],
      ["🔍", "어떤 특징이 효과적인가", "후킹 유형·형식 등 속성별 효과"],
      ["🔋", "지금 신선도가 떨어지는 콘텐츠가 있나", "신선도 저하 진단·재발행 시점 추천"],
      ["🧪", "다음엔 뭘 테스트할까", "조합별 성과 기반 후보 추천"],
    ],
    heroCausationBody:
      "노출량 가중 최소제곱법(WLS)과 다중 검정 보정(BH)을 통해 콘텐츠 속성(후킹 유형·형식 등)의 효과를 추정합니다. 본 분해 결과는 노출·추천 알고리즘에 따른 노출 편향(Selection Bias)이 포함되어 있으므로 인과적 효과가 아닌 상관 관계로 해석해야 하며, 최종 확정은 실험 도구(5-4)를 통해 검증하시는 것을 권장합니다.",
    healthTitle: "콘텐츠 운영 건강도 (Win-rate · 발행 페이스 · 라이프사이클)",
    healthDescPre: "콘텐츠 운영이 잘 되고 있는지 보는 3가지 질문 — 새 콘텐츠가 얼마나 자주 ",
    healthDescS1: "반응이 좋은지(이긴 비율, Win-rate)",
    healthDescS2: "새로 발행하는지(발행 페이스, Velocity)",
    healthDescS3: "오래 버티는지(생존 기간, 라이프사이클)",
    statCtrLabel: "클릭이 잘 되는 콘텐츠 비율 (CTR Win-rate)",
    statCtrTitle: "다른 콘텐츠들의 클릭률 중간값보다 잘 나온 콘텐츠 비율",
    statCvrLabel: "전환이 잘 되는 콘텐츠 비율 (CVR Win-rate)",
    statCvrTitle: "다른 콘텐츠들의 전환율 중간값보다 잘 나온 콘텐츠 비율",
    statSpendLabel: "잘 되는 콘텐츠에 쓴 비용 비중",
    statSpendHint: "CTR 상위 콘텐츠에 쓴 비용 비중",
    statVelLabel: "한 주에 새로 발행하는 콘텐츠 수 (발행 페이스)",
    statVelTitle: "한 주에 새로 발행된 콘텐츠 개수의 평균",
    statLifeLabel: "콘텐츠 하나가 버티는 평균 기간",
    statFatLabel: "신선도가 떨어진 콘텐츠 비율 (Freshness)",
    statFatTitle: "반응이 떨어지며 노후한 것으로 진단된 콘텐츠 비율",
    healthCalloutT1: "이 50%를 크게 밑돌면 콘텐츠 기획 적중률이 낮은 것 — 다음 테스트에서 컨셉을 더 다양하게 시도해야 합니다.",
    healthCalloutS2: "한 주에 새로 발행하는 콘텐츠 수",
    healthCalloutT2: "가 너무 적으면 신선도가 떨어지는 콘텐츠를 못 따라잡습니다 (벤치마크: 활성 콘텐츠의 20~30% / 주).",
    healthCalloutS3: "잘 되는 콘텐츠에 쓴 비용 비중",
    healthCalloutT3: "이 낮으면 좋은 콘텐츠에 예산이 안 실리고 있다는 신호입니다.",
    metricsTitle: "콘텐츠별 성과표",
    metricsDesc: "노출·클릭·전환 같은 원자료와, 클릭률·전환율·전환당비용 같은 계산된 효율 지표를 함께 봅니다. 약어 위에 마우스를 올리면 설명이 나옵니다.",
    filterActiveLabel: "조합별 성과표(Concept Matrix) 필터 적용 중:",
    colCreativeId: "콘텐츠 ID",
    decomposeDescPre: "후킹 유형·메시지 앵글·형식 같은 콘텐츠 속성이 ",
    decomposeBiasSource: "노출·추천 알고리즘",
    decomposeUnavailBody: "콘텐츠 속성 컬럼(hook_type·format 등) 매핑 또는 데이터 행 수(30행 이상)가 부족합니다.",
    fatigueTitle: "콘텐츠 신선도 저하 진단 (반응 감쇠 검출)",
    fatigueDesc: (total, count) => `분석 콘텐츠 ${total}개 · 신선도 저하 콘텐츠 ${count}개`,
    fatiguedBadge: "저하",
    fatigueEmpty: "신선도가 떨어진 콘텐츠가 감지되지 않았습니다 (양호)",
    fatigueAlertTitle: "신선도 저하 임박 경고 (Content Fatigue Alert)",
    fatigueAlertDesc: (total, alertNow) => `분석 콘텐츠 ${total}개 · 지금 바로 경고 ${alertNow}개`,
    fatigueAlertEmpty: (minDays) => `분석 가능한 콘텐츠가 없습니다 (발행 기간 ${minDays}일 미만)`,
    plannerTitle: "발행 일정 추천 (Auto-Planner)",
    plannerDesc: "한 주에 새로 만들 수 있는 콘텐츠 개수를 입력하면, 신선도 저하가 급한 콘텐츠부터 새로 발행할 주차를 자동으로 배정해 드립니다.",
    plannerVelocityLabel: "주당 신규 콘텐츠 발행량",
    plannerStatUrgentLabel: "긴급 재발행 필요",
    plannerStatUrgentTitle: "즉시 경고 또는 임박 위험으로 분류된 콘텐츠 수",
    plannerStatWeeksTitle: "현재 발행 속도로 긴급 콘텐츠를 전부 교체하는 데 걸리는 기간",
    plannerStatRecLabel: "추천 주당 발행 속도",
    plannerStatRecTitle: "긴급 물량을 1주 내 소화하려면 필요한 주당 신규 콘텐츠 수",
    plannerUndersupplyBody: (u, v, r) =>
      `긴급 재발행이 필요한 콘텐츠가 ${u}개인데 현재 주당 발행량(${v})으로는 1주 내 전부 소화할 수 없습니다. 주당 ${r}개 이상으로 늘리거나 긴급도가 낮은 콘텐츠의 재발행을 늦추세요.`,
    plannerOkBody: (v) => `현재 발행량(주당 ${v}개)으로 긴급 재발행 물량을 충분히 소화 가능합니다.`,
    plannerGanttTitle: (weeks) => `발행 타임라인 (Gantt) — 향후 ${weeks}주`,
    plannerFootnote: "발행 순서는 [지금 바로 경고 우선 → 위험 도달 예상이 빠른 순 → 신선도 저하 점수 높은 순]으로 정해지며, 입력한 주당 개수만큼씩 주차에 나눠 배치됩니다.",
    plannerEmpty: "새로 발행이 필요한 콘텐츠가 없습니다.",
    matrixDesc1: "콘텐츠 속성 두 가지를 교차해서, 어떤 조합이 이미 검증됐고 어떤 조합을 더 시도해봐야 하는지 한눈에 봅니다. 셀을 클릭하면 콘텐츠 성과표가 그 조합으로 필터링됩니다.",
  },
};

export function resolveCreativeCopy(domain) {
  return CREATIVE_COPY[domain] || CREATIVE_COPY.performance;
}

/* Dashboard(5-2 / 9-7) 공용 카피팩 — 운영 대시보드 3탭(viz·scorecard·anomaly).
   performance = 기존 하드코딩 문자열과 byte-동일(5-2 출력 불변, 스모크·골든 안전).
   content = 콘텐츠 도메인 번역(채널→유입경로·설치→방문·가입→구독·CPI/CPA→방문/구독당
   비용·CTR→반응률). 엔진(dashboardAggregator·anomalyMath)은 절대 불변 — 라벨만 스왑.
   정직성(§8): 콘텐츠 데이터엔 매출·ROAS·ARPU·결제·리텐션이 없으므로 그 지표는 날조하지
   않고 content에서 아예 노출하지 않는다(VizTab 카드/차트·BudgetHealthCard 도메인 게이트).
   effBasis(installs/actions) 의존 문구는 함수로 두 분기 모두 정확히 반환. */
export const DASH_COPY = {
  performance: {
    guideToolId: "5-2",
    // Dashboard.jsx
    pageTitle: "운영 대시보드",
    noDataIntro:
      "일일 캠페인 리포트 CSV를 업로드하여 성과를 요약하고 주요 지표를 시각화합니다.",
    uploadDesc: "운영 대시보드를 생성하기 위해 마케팅 성과 CSV 파일을 업로드해주세요.",
    // DashboardTabs — 그룹 라벨(모니터링). content는 단일 그룹.
    monGroupLabel: "모니터링",
    // VizTab
    acqLabel: (b) => (b === "actions" ? "CPA" : "CPI"),
    trendOutcome: (b) => (b === "actions" ? "가입수" : "설치수"),
    tsTitle: (b) => `일별 비용·${b === "actions" ? "가입" : "설치"} 추이`,
    tsSub: (b) => `시계열 라인 · 좌축 비용 / 우축 ${b === "actions" ? "가입" : "설치"}`,
    donutTitle: "채널별 비용 비중",
    donutSub: "도넛 · 합산 cost 기준",
    cpiTitle: (acq) => `채널별 ${acq} 비교`,
    cpiSub: (b) => `가로 막대 · cost / ${b === "actions" ? "actions(가입)" : "installs"}`,
    kpiCostLabel: "총 비용",
    kpiCostDelta: "합산 cost",
    kpiCtrLabel: "CTR",
    kpiCtrDelta: "clicks / impressions",
    kpiOutcomeLabel: (b) => (b === "actions" ? "총 가입 수" : "총 설치 수"),
    kpiOutcomeDelta: (b) => (b === "actions" ? "합산 actions" : "합산 installs"),
    acqDelta: (b) => `cost / ${b === "actions" ? "actions(가입)" : "installs"}`,
    chartsDesc:
      "업로드된 데이터를 기반으로 시계열·채널 비중·CPI 비교·퍼널·코호트 매출 차트가 렌더링됩니다. ⚙ 차트 편집에서 표시·순서 조정.",
    // ScorecardTab — 카드 라벨(값·계산 불변, 라벨만).
    scLabels: {
      cost: "비용", inst: "설치", cpi: "CPI", act: "액션", cpa: "CPA",
      cvr: "CVR", ctr: "CTR", roas: "ROAS",
    },
    scFootnote: (w) =>
      `WoW = 최근 ${w}일 vs 직전 ${w}일. 색은 지표 성격 반영(CPI/CPA↓·설치/ROAS↑ = 초록). 비용은 중립(규모). 카드 클릭 시 일별 상세.`,
    // AnomalyTab — 지표 라벨.
    anLabels: {
      cost: "비용", impressions: "노출", clicks: "클릭", installs: "설치",
      actions: "액션", cpm: "CPM", ctr: "CTR", cpi: "CPI", cvr: "CVR",
      cpa: "CPA", roas: "ROAS",
    },
    // content에서만 사용(performance는 항상 false).
    isContent: false,
  },
  content: {
    guideToolId: "9-7",
    pageTitle: "콘텐츠 운영 대시보드",
    noDataIntro:
      "콘텐츠 성과 CSV(유입경로·노출·클릭·방문 등)를 업로드하여 트래픽을 요약하고 주요 지표를 시각화합니다.",
    uploadDesc:
      "콘텐츠 운영 대시보드를 생성하기 위해 콘텐츠 성과 CSV 파일을 업로드해주세요.",
    monGroupLabel: "모니터링",
    acqLabel: (b) => (b === "actions" ? "구독당 비용" : "방문당 비용"),
    trendOutcome: (b) => (b === "actions" ? "구독수" : "방문수"),
    tsTitle: (b) => `일별 비용·${b === "actions" ? "구독" : "방문"} 추이`,
    tsSub: (b) =>
      `시계열 라인 · 좌축 비용 / 우축 ${b === "actions" ? "구독" : "방문"}`,
    donutTitle: "유입경로별 비용 비중",
    donutSub: "도넛 · 합산 비용 기준",
    cpiTitle: (acq) => `유입경로별 ${acq} 비교`,
    cpiSub: (b) => `가로 막대 · 비용 / ${b === "actions" ? "구독" : "방문"}`,
    kpiCostLabel: "총 비용",
    kpiCostDelta: "합산 비용",
    kpiCtrLabel: "반응률 (CTR)",
    kpiCtrDelta: "clicks / impressions",
    kpiOutcomeLabel: (b) => (b === "actions" ? "총 구독 수" : "총 방문 수"),
    kpiOutcomeDelta: (b) => (b === "actions" ? "합산 구독수" : "합산 방문수"),
    acqDelta: (b) => `비용 / ${b === "actions" ? "구독" : "방문"}`,
    chartsDesc:
      "업로드된 데이터를 기반으로 일별 트래픽 추이·유입경로 비중·방문당 비용 차트가 렌더링됩니다. ⚙ 차트 편집에서 표시·순서 조정.",
    scLabels: {
      cost: "비용", inst: "방문", cpi: "방문당 비용", act: "구독",
      cpa: "구독당 비용", cvr: "방문 전환율 (CVR)", ctr: "반응률 (CTR)", roas: "ROAS",
    },
    scFootnote: (w) =>
      `WoW = 최근 ${w}일 vs 직전 ${w}일. 색은 지표 성격 반영(방문당 비용↓·방문↑ = 초록). 비용은 중립(규모). 카드 클릭 시 일별 상세.`,
    anLabels: {
      cost: "비용", impressions: "노출", clicks: "클릭", installs: "방문",
      actions: "구독", cpm: "CPM", ctr: "반응률", cpi: "방문당 비용",
      cvr: "방문 전환율", cpa: "구독당 비용", roas: "ROAS",
    },
    isContent: true,
  },
};

export function resolveDashCopy(domain) {
  return DASH_COPY[domain] || DASH_COPY.performance;
}
