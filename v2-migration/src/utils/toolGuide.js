// ── Per-tool CSV upload guidance (design-system baseline §1.4) ──────────────
// Powers <CsvGuide>: the always-visible 1-line summary + the "왜 이 데이터가
//필요한가요?" modal. Non-technical marketers should understand WHEN to use the
// tool and WHY each column is needed BEFORE uploading.
//
// TOOL_GUIDE[routeId] = {
//   when:  string   — 이 도구가 답하는 상황/질문 (평어 1~2줄)
//   grain: string   — CSV 1행이 무엇인지
//   needs: [{ col, label, why, required }]
//   prep:  string[] — 준비 팁·흔한 실수·주의
//   example?: string — 예시 CSV(헤더+1~2행)
// }

export const TOOL_GUIDE = {
  "5-2": {
    when: "운영한 캠페인 데이터를 올려 스코어카드·페이싱·이상탐지·LTV·코호트·퍼널을 한눈에 봅니다.",
    grain: "1행 = 하루 × (채널/캠페인/소재 등) 단위 실적",
    needs: [
      { col: "date", label: "날짜", why: "시계열·페이싱·이상탐지의 축", required: true },
      { col: "cost", label: "비용", why: "CPI/CPA 등 KPI 계산의 분자", required: true },
      { col: "installs 또는 actions", label: "설치 또는 가입", why: "KPI 계산의 분모(전환) — 둘 중 하나 이상", required: true },
      { col: "channel·campaign·platform·country", label: "차원", why: "채널·OS·국가별 쪼개보기", required: false },
      { col: "impressions·clicks", label: "노출·클릭", why: "퍼널(CTR/CVR/CPC) 계산", required: false },
      { col: "revenue_d7·ret_d7·pu_d7", label: "매출·리텐션·결제(Dn)", why: "LTV·ROAS 성숙도·코호트", required: false },
    ],
    prep: [
      "숫자 컬럼에 천단위 콤마 있어도 됨(자동 처리).",
      "revenue_d7 같은 코호트 지표는 '설치 후 7일' 누적 값 — 캘린더 일별과 섞지 말 것.",
      "컬럼이 많을수록 더 많은 탭이 열립니다(옵션 컬럼 = 기능 잠금 해제).",
    ],
    example: "date,channel,cost,impressions,clicks,installs,revenue_d7\n2024-01-01,Google UAC,850000,420000,9800,720,5400000\n2024-01-01,Meta AAP,610000,510000,7200,540,3900000\n2024-01-02,Google UAC,880000,430000,10100,735,5600000",
  },
  "5-3": {
    when: "채널·캠페인별 반응 곡선을 추정해 '한 푼 더 쓰면 어디가 이득인지' 예산 재배분을 시뮬레이션합니다.",
    grain: "1행 = 하루 × 채널(또는 캠페인) 실적",
    needs: [
      { col: "date", label: "날짜", why: "곡선 적합에 필요한 시점", required: true },
      { col: "cost", label: "광고비", why: "반응 곡선의 X축(지출)", required: true },
      { col: "channel 또는 campaign_name", label: "채널/캠페인", why: "배분 단위", required: true },
      { col: "installs 또는 actions", label: "전환", why: "반응 곡선의 Y축(성과)", required: true },
      { col: "revenue_d7", label: "매출", why: "ROAS 기준 배분·분배 후 예상 매출", required: false },
    ],
    prep: [
      "곡선 추정에 지출 변동이 있어야 함 — 매일 같은 금액이면 곡선이 안 나옴.",
      "국가·채널이 섞이면 국가 1개로 강제됩니다(타국가 혼입 방지).",
    ],
    example: "date,channel,cost,installs,revenue_d7\n2024-01-01,Google UAC,850000,720,5400000\n2024-01-01,Meta AAP,610000,540,3900000\n2024-01-02,TikTok,430000,510,2600000",
  },
  "5-22": {
    when: "채널·캠페인이 '이미 포화(더 써도 효율 하락)인지, 아직 여유인지'를 한계 vs 평균 효율로 진단합니다.",
    grain: "1행 = 하루 × 채널(또는 캠페인) 실적",
    needs: [
      { col: "date", label: "날짜", why: "최근 지출점·곡선 적합", required: true },
      { col: "cost", label: "광고비", why: "포화 곡선의 X축", required: true },
      { col: "channel 또는 campaign_name", label: "채널/캠페인", why: "진단 단위", required: true },
      { col: "installs 또는 actions", label: "전환", why: "효율(CPA) 계산", required: true },
      { col: "revenue_d7", label: "매출", why: "ROAS 기준 포화도(옵션)", required: false },
    ],
    prep: ["5-2·5-3와 같은 효율 CSV를 공유합니다 — 한 번 올리면 형제 도구가 이어받습니다."],
    example: "date,channel,cost,installs,revenue_d7\n2024-01-01,Google UAC,850000,720,5400000\n2024-01-02,Google UAC,880000,735,5600000\n2024-01-03,Google UAC,920000,742,5700000",
  },
  "5-21": {
    when: "성과가 변한 원인을 물량(Volume)·효율(Efficiency)·믹스(Mix)로 무잔차 분해합니다(왜 CPA가 올랐나?).",
    grain: "1행 = 하루 × 채널 × 캠페인 × 소재(가장 잘게)",
    needs: [
      { col: "date", label: "날짜", why: "기간 비교(전 vs 후)", required: true },
      { col: "spend(=cost)", label: "광고비", why: "물량·효율 분해의 기준", required: true },
      { col: "channel", label: "채널", why: "분해 단위", required: true },
      { col: "installs 또는 actions", label: "전환", why: "효율(CPA) 계산", required: true },
      { col: "campaign_name·creative_id", label: "캠페인·소재", why: "드릴다운(채널→캠페인→소재)", required: false },
    ],
    prep: ["가장 잘게(소재·일별) 넣을수록 분해 항등식이 정확합니다.", "효율 CSV 공유(5-2/5-3/5-22)."],
    example: "date,channel,campaign_name,creative_id,spend,installs\n2024-01-01,Meta AAP,Prospecting,cr_101,320000,240\n2024-01-01,Meta AAP,Retargeting,cr_102,180000,160\n2024-01-02,Meta AAP,Prospecting,cr_101,340000,255",
  },
  "5-6": {
    when: "소재별 성과·피로도·속성 효과(어떤 후킹·포맷이 잘 되나)를 분석하고 교체 시점을 알려줍니다.",
    grain: "1행 = 하루 × 소재(creative)",
    needs: [
      { col: "creative_id", label: "소재 ID", why: "소재 단위 집계의 키", required: true },
      { col: "date", label: "날짜", why: "피로도(시간에 따른 성과 하락)", required: true },
      { col: "impressions·clicks·installs", label: "노출·클릭·설치", why: "CTR/CVR·승률 계산", required: true },
      { col: "spend", label: "광고비", why: "CPA·효율", required: true },
      { col: "message_angle·format·hook_type…", label: "소재 속성", why: "속성별 효과(WLS)·조합 매트릭스", required: false },
    ],
    prep: [
      "속성 컬럼(메시지·포맷·훅)을 넣으면 '어떤 특징이 효과적인가' 분해와 조합표가 열립니다.",
      "조합표는 조합당 소재 5개 이상 있어야 '검증'으로 뜹니다.",
    ],
    example: "creative_id,date,channel,impressions,clicks,installs,spend,message_angle,format\ncr_001,2024-02-01,Meta AAP,52000,1600,210,610000,사회적증거,UGC\ncr_002,2024-02-01,TikTok,48000,1900,180,540000,할인혜택,플레이어블",
  },
  "5-4": {
    when: "A/B 테스트를 설계(표본 수 계산)하고, 결과 CSV로 어느 안이 통계적으로 이겼는지 판정합니다.",
    grain: "1행 = 그룹(arm) 단위 집계",
    needs: [
      { col: "numerator", label: "전환수(분자)", why: "그룹 전환 건수", required: true },
      { col: "denominator", label: "그룹 인원·모수(분모)", why: "그룹 크기(전환율 = 분자/분모)", required: true },
      { col: "is_control", label: "대조군 여부", why: "Control vs Test 구분", required: true },
      { col: "arm_id", label: "변형 그룹", why: "3개 이상 변형 대량검정(Variant A/B/C…)", required: false },
    ],
    prep: [
      "그룹당 1행으로 집계해서 올립니다(유저 1명씩 아님).",
      "홀드아웃 증분(광고 자체의 값어치)은 별도 '증분 분석' 도구를 쓰세요.",
    ],
    example: "arm_id,is_control,numerator,denominator\nControl,1,400,8000\nVariant A,0,496,8000",
  },
  "5-18": {
    when: "주간 채널별 지출과 성과로 MMM(마케팅 믹스 모델)·회귀·미래 예측을 돌려 기여도와 최적 예산을 봅니다.",
    grain: "1행 = 한 주(week)",
    needs: [
      { col: "week", label: "주차", why: "시계열 축(adstock·계절)", required: true },
      { col: "가입/재활성(reg/react)", label: "성과 지표(종속)", why: "설명하려는 결과", required: true },
      { col: "채널별 spend (google/meta/…)", label: "채널 지출", why: "각 채널 기여 분해의 입력", required: true },
    ],
    prep: [
      "업로드 후 컬럼을 '역할'로 드래그합니다(주차·성과·채널 spend).",
      "채널당 지출 변동과 최소 6개월+ 기간이 있어야 안정적으로 추정됩니다.",
    ],
    example: "week,signups,google_spend,meta_spend,tiktok_spend\n2024-01-01,3800,32000000,22000000,8000000\n2024-01-08,4100,35000000,24000000,9500000\n2024-01-15,3950,31000000,21000000,7800000",
  },
  "5-20": {
    when: "어떤 초기 행동(매칭·메시지 등)을 몇 번/며칠 안에 하면 정착(전환)하는지 'Aha-moment'를 찾습니다.",
    grain: "1행 = 유저 1명",
    needs: [
      { col: "user_id", label: "유저 ID", why: "유저 단위 식별", required: true },
      { col: "converted(0/1)", label: "전환 여부(타겟)", why: "정착/전환한 유저 표시", required: true },
      { col: "행동 컬럼(횟수)", label: "선행 행동", why: "각 후보 행동의 예측력(F1/Lift)", required: true },
    ],
    prep: [
      "행동 컬럼은 '초기 N일 안의 횟수'(예: 7일 내 메시지 수)로 넣습니다.",
      "전환 컬럼은 0/1 — 1이 정착/목표 달성.",
    ],
    example: "user_id,converted,matches_first_7d,messages_sent_7d,profile_completed\nu10001,1,8,32,1\nu10002,0,1,4,0\nu10003,1,12,45,1",
  },
  // 5-23 증분 분석 — 방법별 데이터가 달라 서브키로 분리("5-23:<method>").
  "5-23:suppression": {
    when: "같은 기간, 무작위로 광고를 차단한 홀드아웃 그룹 vs 노출 그룹을 비교해 광고가 만든 순증분을 봅니다. 3방법 중 가장 신뢰 높음.",
    grain: "1행 = 그룹(지역·일자별로 쪼개도 됨)",
    needs: [
      { col: "holdout_group", label: "노출/홀드아웃 구분", why: "exposed(광고 봄) vs holdout(광고 차단) 그룹 구분", required: true },
      { col: "numerator", label: "전환수", why: "그룹 전환 건수", required: true },
      { col: "denominator", label: "그룹 인원", why: "그룹 크기(전환율=전환수/인원)", required: true },
      { col: "date", label: "날짜", why: "넣으면 날짜별 전환율 추이 차트(노출 vs 홀드아웃)", required: false },
      { col: "spend", label: "광고비", why: "노출그룹 비용 → iROAS·증분 CPA", required: false },
      { col: "revenue_d7", label: "매출", why: "노출그룹 매출 → iROAS", required: false },
    ],
    prep: [
      "무작위 분할(randomized)이어야 인과로 해석됩니다.",
      "노출/미노출은 지역(Geo)·유저(Ghost ads)·오디언스 홀드아웃으로 나눈 결과를 집계해 올립니다.",
      "date를 넣고 날짜별 여러 행으로 올리면 전환율 추이 시계열도 함께 나옵니다.",
    ],
    example: "date,holdout_group,numerator,denominator,spend,revenue_d7\n2024-05-01,exposed,516,8600,1548000,16512000\n2024-05-01,holdout,378,8600,0,12096000\n2024-05-02,exposed,529,8700,1566000,16928000",
  },
  "5-23:on": {
    when: "안 하던 광고/캠페인을 켠 시점(cutoff) 전후를 비교해, 켜서 얻은 상승분을 봅니다.",
    grain: "1행 = 하루(날짜)",
    needs: [
      { col: "date", label: "날짜", why: "전후 비교의 시간 축", required: true },
      { col: "conversions 등 성과 지표", label: "성과 지표", why: "켠 뒤 얼마나 올랐는지 측정", required: true },
      { col: "group", label: "그룹(treatment/control)", why: "대조군 넣으면 DiD로 계절·추세 제거", required: false },
    ],
    prep: [
      "켠 날짜(cutoff)는 화면에서 선택합니다.",
      "대조군(변하지 않은 그룹)을 넣으면 계절·추세를 걷어내 더 정확(DiD). 무작위 아니면 인과 단정 X.",
    ],
    example: "date,group,conversions\n2024-04-01,treatment,100\n2024-04-01,control,90\n2024-05-20,treatment,155\n2024-05-20,control,92",
  },
  "5-23:off": {
    when: "켜뒀던 광고/캠페인을 끈 시점(cutoff) 전후를 비교해, 끄면서 잃은 하락분을 봅니다.",
    grain: "1행 = 하루(날짜)",
    needs: [
      { col: "date", label: "날짜", why: "전후 비교의 시간 축", required: true },
      { col: "conversions 등 성과 지표", label: "성과 지표", why: "끈 뒤 얼마나 떨어졌는지 측정", required: true },
      { col: "group", label: "그룹(treatment/control)", why: "대조군 넣으면 DiD로 계절·추세 제거", required: false },
    ],
    prep: [
      "끈 날짜(cutoff)는 화면에서 선택합니다.",
      "대조군을 넣으면 계절·추세를 걷어내 더 정확(DiD). 무작위 아니면 인과 단정 X.",
    ],
    example: "date,group,conversions\n2024-04-01,treatment,200\n2024-04-01,control,180\n2024-05-20,treatment,120\n2024-05-20,control,182",
  },
};

export function getToolGuide(toolId) {
  return TOOL_GUIDE[toolId] || null;
}
