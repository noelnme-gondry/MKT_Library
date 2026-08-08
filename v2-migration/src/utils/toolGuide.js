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
  "start-gate": {
    when: "캠페인 성과 CSV를 올리면 현재 컬럼으로 바로 쓸 수 있는 분석과 가장 먼저 볼 질문을 추천합니다.",
    grain: "1행 = 하루 × 채널(또는 캠페인) 성과 — 가능한 경우 채널별로 나눠 주세요",
    needs: [
      { col: "date", label: "날짜", why: "기간 비교와 추세를 확인하는 기준", required: true },
      { col: "cost", label: "광고비", why: "효율과 예산 분석의 기준", required: true },
      { col: "installs 또는 actions", label: "설치 또는 가입", why: "성과·효율 계산의 기준", required: true },
      { col: "channel", label: "채널", why: "채널별로 어디를 먼저 볼지 추천", required: false },
      { col: "impressions·clicks·revenue_d7", label: "노출·클릭·매출", why: "퍼널·ROAS·가치 분석까지 확장", required: false },
    ],
    prep: [
      "첫 줄에 컬럼 이름(헤더)을 넣고, 날짜는 한 가지 형식으로 통일해 주세요.",
      "비용과 성과가 같은 기간·같은 단위인지 먼저 확인해 주세요.",
      "컬럼이 더 많아도 괜찮습니다. 업로드 뒤 가능한 분석을 데이터 기준으로 추천합니다.",
    ],
    example: "date,channel,cost,installs\n2024-01-01,Google UAC,850000,720\n2024-01-01,Meta AAP,610000,540\n2024-01-02,Google UAC,880000,735",
  },
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
    when: "일별 또는 주별 채널 지출과 성과로 MMM(마케팅 믹스 모델)·회귀·미래 예측을 돌려 기여도와 예산 가설을 봅니다.",
    grain: "1행 = 하루 또는 한 주(일별은 자동 주간 집계)",
    needs: [
      { col: "date 또는 week", label: "날짜·주차", why: "시계열 축(adstock·계절); 일별은 주 단위로 자동 정리", required: true },
      { col: "traffic / registrations / reactivations / purchasers / revenue", label: "목표 지표(Y)", why: "총유입·가입·재유입·구매자·매출 중 하나 이상", required: true },
      { col: "채널별 spend (google/meta/…)", label: "채널 지출", why: "각 채널 기여 분해의 입력", required: true },
      { col: "country", label: "타깃 국가", why: "국가 prior 사용 시 모든 행에 같은 단일 값", required: false },
    ],
    prep: [
      "업로드 후 컬럼을 '역할'로 드래그합니다(날짜/주차·목표 Y·채널 spend). 매핑한 Y는 상단에서 즉시 전환할 수 있습니다.",
      "일별 행은 주간으로 자동 합산합니다. 휴일·이벤트 더미는 그 주에 한 번이라도 발생했는지(0/1)로 집계합니다.",
      "이 앱의 보수적 식별 기준은 최소 52주이며, 가능하면 104주 이상을 권장합니다. 52주 미만이면 예산 추천을 보류합니다.",
    ],
    example: "country,date,traffic,registrations,reactivations,purchasers,revenue,google_spend,meta_spend\nKR,2024-01-01,1200,310,85,42,8400000,4200000,3100000\nKR,2024-01-02,1260,325,88,45,8950000,4400000,3000000\nKR,2024-01-03,1180,302,82,39,8100000,3900000,3200000",
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

  // ── Content Analytics (콘텐츠 도메인 — 엔진 재사용) ──
  "9-1": {
    when: "콘텐츠 여러 편의 제작 속성(제목 숫자·길이·이모지·썸네일 톤 등)과 성과(CTR·조회수)를 올려, 어떤 요소가 성과와 유의하게 연관되는지 다변량 회귀로 가려냅니다.",
    grain: "1행 = 콘텐츠 1편",
    needs: [
      { col: "성과 지표(CTR·조회수 등)", label: "성과(종속변수)", why: "설명할 대상 — 숫자 1개", required: true },
      { col: "제작 속성 컬럼(0/1 또는 숫자)", label: "콘텐츠 요소(설명변수)", why: "각 요소의 기여도(계수·유의성) 추정", required: true },
      { col: "post_id·title 등", label: "콘텐츠 식별자", why: "행 식별(분석엔 미사용, 있으면 표기)", required: false },
    ],
    prep: [
      "속성은 있음/없음이면 0/1, 길이·개수면 숫자로 넣습니다.",
      "결과는 인과가 아니라 '연관'입니다 — 잘 쓰는 사람이 여러 요소를 함께 쓰는 교락이 있습니다.",
      "확정은 A/B 테스트(콘텐츠 요소 하나만 바꿔)로 검증하세요.",
    ],
    example: "post_id,title_has_number,title_len,has_emoji,thumbnail_bright,ctr\np1001,1,42,0,1,3.9\np1002,0,58,1,0,2.1",
  },
  "9-2": {
    when: "어떤 콘텐츠를 소비한 독자가 구독·회원가입·재방문으로 이어지는지 'Aha-Content'(킬러 콘텐츠)를 F1·Lift로 찾습니다.",
    grain: "1행 = 독자 1명",
    needs: [
      { col: "reader_id", label: "독자 ID", why: "독자 단위 식별", required: true },
      { col: "subscribed(0/1)", label: "전환 여부(타겟)", why: "구독/가입/재방문한 독자 표시", required: true },
      { col: "콘텐츠 소비 컬럼(횟수)", label: "소비한 콘텐츠", why: "각 콘텐츠의 전환 예측력(F1/Lift)", required: true },
    ],
    prep: [
      "소비 컬럼은 '첫 방문 N일 안에 그 콘텐츠를 본 횟수'로 넣습니다(예: 7일 내 조회수).",
      "전환 컬럼은 0/1 — 1이 구독/가입/재방문.",
      "결과는 연관이지 인과가 아닙니다 — 관심 많은 독자가 원래 많이 읽고 구독도 합니다.",
    ],
    example: "reader_id,subscribed,ga4guide_d7,casestudy_d7,pricing_d7\nr10001,1,3,4,1\nr10002,0,0,1,0\nr10003,1,2,5,0",
  },
  "9-3": {
    when: "트래픽(방문·PV)이 변한 원인을 유입경로·카테고리·콘텐츠 단위로 무잔차 분해합니다(왜 방문당 비용이 올랐나? 어느 유입경로가 끌어올렸나?).",
    grain: "1행 = 하루 × 유입경로 × 카테고리 × 콘텐츠(가장 잘게)",
    needs: [
      { col: "date", label: "날짜", why: "기간 비교(전 vs 후)", required: true },
      { col: "traffic_source(=channel)", label: "유입경로", why: "분해 단위(organic·social·search·newsletter…)", required: true },
      { col: "spend(=cost)", label: "제작·배포 비용", why: "방문당 비용 계산의 분자", required: true },
      { col: "traffic(=installs/actions)", label: "트래픽(방문·PV)", why: "방문당 비용의 분모 — 결과 지표 1개", required: true },
      { col: "category·content_id", label: "카테고리·콘텐츠", why: "드릴다운(유입경로→카테고리→콘텐츠)", required: false },
      { col: "impressions·clicks", label: "노출·클릭", why: "콘텐츠별 CTR 비교(§4)", required: false },
    ],
    prep: [
      "가장 잘게(콘텐츠·일별) 넣을수록 분해 항등식이 정확합니다.",
      "결과 지표는 트래픽(방문·PV) 1개만 매핑합니다 — 지표 토글은 자동으로 숨겨집니다.",
      "결과는 인과가 아니라 '연관'입니다 — 분해는 산술적으로만 정확합니다.",
    ],
    example: "date,traffic_source,category,content_id,cost,traffic\n2024-01-08,organic,튜토리얼,tut_101,96000,820\n2024-01-08,social,사례연구,case_201,168000,410\n2024-01-15,social,사례연구,case_201,246000,650",
  },
  "9-6": {
    when: "콘텐츠별 반응·신선도(시간이 지나며 반응이 식는지)·속성 효과(어떤 후킹·형식이 잘 되나)를 분석하고 새로 발행/교체할 시점을 알려줍니다.",
    grain: "1행 = 하루 × 콘텐츠(content)",
    needs: [
      { col: "creative_id", label: "콘텐츠 ID", why: "콘텐츠 단위 집계의 키", required: true },
      { col: "date", label: "날짜", why: "신선도(시간에 따른 반응 하락) 감지", required: true },
      { col: "impressions·clicks·installs", label: "노출·클릭·전환", why: "CTR/CVR·승률 계산", required: true },
      { col: "spend", label: "제작·배포 비용", why: "전환당비용·효율", required: true },
      { col: "message_angle·format·hook_type…", label: "콘텐츠 속성", why: "속성별 효과(WLS)·조합 매트릭스", required: false },
    ],
    prep: [
      "속성 컬럼(앵글·형식·후킹)을 넣으면 '어떤 특징이 효과적인가' 분해와 조합표가 열립니다.",
      "조합표는 조합당 콘텐츠 5개 이상 있어야 '검증'으로 뜹니다.",
      "결과는 인과가 아니라 '연관'입니다 — 확정은 실험(5-4)으로 검증하세요.",
    ],
    example: "creative_id,date,channel,impressions,clicks,installs,spend,message_angle,format\npost_001,2024-02-01,블로그,52000,1600,210,540000,정보성가이드,글\npost_002,2024-02-01,유튜브,48000,1900,180,480000,사례연구,영상",
  },
  "9-7": {
    when: "콘텐츠 운영 성과를 한 화면에서 요약합니다 — 일별 트래픽 추이·유입경로별 비중·방문당 비용을 시각화(시각화)하고, 최근 성과를 직전 기간과 비교(스코어카드)하고, 트래픽·반응률이 튀는 날을 자동으로 잡아냅니다(이상탐지).",
    grain: "1행 = 하루 × 유입경로(× 카테고리·콘텐츠)",
    needs: [
      { col: "date", label: "날짜", why: "일별 추이·기간 비교·이상탐지의 축", required: true },
      { col: "cost(=제작·배포 비용)", label: "비용", why: "방문당 비용·비중 계산", required: true },
      { col: "visits(=installs)", label: "방문·트래픽", why: "핵심 성과 지표(방문·세션·PV)", required: true },
      { col: "traffic_source(=channel)", label: "유입경로", why: "유입경로별 비중·방문당 비용 비교", required: false },
      { col: "impressions·clicks", label: "노출·클릭", why: "반응률(CTR)·노출 대비 클릭 분석", required: false },
      { col: "subscribers(=actions)", label: "구독·전환", why: "구독당 비용·전환 지표", required: false },
    ],
    prep: [
      "매출·결제·ROAS 컬럼은 없어도 됩니다 — 콘텐츠 대시보드는 트래픽·반응률 중심입니다(그 지표는 표시하지 않습니다).",
      "방문(트래픽)을 핵심 성과로, 노출·클릭·구독을 보조로 매핑하면 3탭 전부 채워집니다.",
      "최소 2주치 이상이면 스코어카드(WoW)·이상탐지가 의미 있게 동작합니다.",
    ],
    example: "date,traffic_source,content_cost,impressions,clicks,visits,subscribers\n2024-01-08,자연 검색,126000,58000,2600,1740,104\n2024-01-08,소셜,216000,74000,2200,1020,31\n2024-01-15,뉴스레터,99000,41000,2870,1980,218",
  },
  "5-25": {
    when: "MMM을 실행하기 전에 채널별 지출이 너무 함께 움직여 채널 기여도를 분리하기 어려운지 VIF로 빠르게 점검합니다.",
    grain: "1행 = 하루 × 채널(또는 캠페인) 지출",
    needs: [
      { col: "date", label: "날짜", why: "같은 날짜의 채널 지출을 비교하는 기준", required: true },
      { col: "channel 또는 campaign_name", label: "채널/캠페인", why: "공선성 진단 대상", required: true },
      { col: "cost", label: "광고비", why: "채널별 지출 움직임", required: true },
    ],
    prep: ["최소 2개 채널과 채널 수보다 3개 이상 많은 날짜가 필요합니다.", "VIF가 높으면 통계 옵션보다 채널을 따로 움직인 기간을 만드는 것이 우선입니다."],
    example: "date,channel,cost\n2026-07-01,Search,850000\n2026-07-01,Social,610000\n2026-07-02,Search,720000\n2026-07-02,Social,780000",
  },
  "5-26": {
    when: "Apple Search Ads 검색어 리포트에서 Exact 승격 후보를 찾고, 예산 대비 소진과 목표 CPA에 맞춰 CPT 증액·감액 우선순위를 정합니다.",
    grain: "1행 = 하루 × 검색어 × 광고그룹(가능하면)",
    needs: [
      { col: "date", label: "날짜", why: "활성 일수와 예산 대비 소진 계산", required: true },
      { col: "search_term", label: "검색어", why: "Exact 승격·제외 검토 단위", required: true },
      { col: "cost", label: "소진", why: "CPA·소진률 계산", required: true },
      { col: "clicks", label: "탭", why: "실제 CPT 계산", required: true },
      { col: "installs 또는 actions", label: "설치/전환", why: "목표 CPA 달성 판정", required: true },
      { col: "match_type·daily_budget·target_cpa·current_cpt", label: "매치·예산·목표·입찰", why: "Exact·소진률·CPT 권장값 정확도", required: false },
    ],
    prep: ["목표 CPA가 없으면 임의의 증액·감액은 추천하지 않습니다.", "일일 예산은 캠페인/광고그룹 단위라면 해당 단위로 내보내세요. 검색어 행마다 중복된 예산을 합산하지 않습니다."],
    example: "date,campaign_name,adgroup_name,search_term,match_type,cost,clicks,installs,daily_budget,target_cpa,current_cpt\n2026-08-01,Generic,Discovery,가계부,Search Match,4000,250,42,12000,140,18\n2026-08-01,Generic,Broad,무료 가계부,Broad,15000,610,58,12000,140,22",
  },
};

// EN 번역본 — EN_READY_TOOL_IDS(routeMap.js)에 맞춰 번역된 id만 추가.
// 없는 id는 getToolGuide가 KR로 폴백(콘텐츠 자체가 없느니 KR이라도 보여주는 게 나음).
export const TOOL_GUIDE_EN = {
  "start-gate": {
    when: "Upload campaign-performance CSV data to see which analyses your current columns support and what to check first.",
    grain: "1 row = 1 day × channel (or campaign) performance — split channels when possible",
    needs: [
      { col: "date", label: "Date", why: "Reference point for period comparisons and trends", required: true },
      { col: "cost", label: "Ad spend", why: "Basis for efficiency and budget analysis", required: true },
      { col: "installs or actions", label: "Installs or signups", why: "Basis for performance and efficiency calculations", required: true },
      { col: "channel", label: "Channel", why: "Lets us recommend where to look first", required: false },
      { col: "impressions · clicks · revenue_d7", label: "Impressions, clicks, revenue", why: "Unlocks funnel, ROAS, and value analysis", required: false },
    ],
    prep: [
      "Use the first row for column names and keep dates in one format.",
      "Check that spend and outcomes cover the same period and unit.",
      "Extra columns are welcome. After upload, we recommend analyses based on the data you have.",
    ],
    example: "date,channel,cost,installs\n2024-01-01,Google UAC,850000,720\n2024-01-01,Meta AAP,610000,540\n2024-01-02,Google UAC,880000,735",
  },
  "5-2": {
    when: "Upload your campaign data to see scorecards, pacing, anomaly detection, LTV, cohorts, and funnels at a glance.",
    grain: "1 row = 1 day × (channel/campaign/creative etc.) performance",
    needs: [
      { col: "date", label: "Date", why: "Axis for time series, pacing, anomaly detection", required: true },
      { col: "cost", label: "Cost", why: "Numerator for CPI/CPA and other KPIs", required: true },
      { col: "installs or actions", label: "Installs or signups", why: "Denominator (conversion) for KPIs — at least one required", required: true },
      { col: "channel · campaign · platform · country", label: "Dimensions", why: "Break down by channel/OS/country", required: false },
      { col: "impressions · clicks", label: "Impressions · clicks", why: "Funnel calculations (CTR/CVR/CPC)", required: false },
      { col: "revenue_d7 · ret_d7 · pu_d7", label: "Revenue · retention · payers (Dn)", why: "LTV, ROAS maturity, cohorts", required: false },
    ],
    prep: [
      "Thousand separators in number columns are fine (handled automatically).",
      "Cohort metrics like revenue_d7 are cumulative '7 days since install' values — don't mix with calendar-daily numbers.",
      "More columns unlock more tabs (optional columns = more features).",
    ],
    example: "date,channel,cost,impressions,clicks,installs,revenue_d7\n2024-01-01,Google UAC,850000,420000,9800,720,5400000\n2024-01-01,Meta AAP,610000,510000,7200,540,3900000\n2024-01-02,Google UAC,880000,430000,10100,735,5600000",
  },
  "5-21": {
    when: "Decompose a performance change into volume, efficiency, and mix effects with zero residual (why did CPA go up?).",
    grain: "1 row = 1 day × channel × campaign × creative (finest grain)",
    needs: [
      { col: "date", label: "Date", why: "Period comparison (before vs. after)", required: true },
      { col: "spend(=cost)", label: "Ad spend", why: "Basis for the volume/efficiency decomposition", required: true },
      { col: "channel", label: "Channel", why: "Decomposition unit", required: true },
      { col: "installs or actions", label: "Conversions", why: "Efficiency (CPA) calculation", required: true },
      { col: "campaign_name · creative_id", label: "Campaign · creative", why: "Drill-down (channel → campaign → creative)", required: false },
    ],
    prep: ["The finer the grain (creative/daily), the more accurate the decomposition identity.", "Shares the efficiency CSV (5-2/5-3/5-22)."],
    example: "date,channel,campaign_name,creative_id,spend,installs\n2024-01-01,Meta AAP,Prospecting,cr_101,320000,240\n2024-01-01,Meta AAP,Retargeting,cr_102,180000,160\n2024-01-02,Meta AAP,Prospecting,cr_101,340000,255",
  },
  "5-22": {
    when: "Diagnose whether a channel/campaign is already saturated (more spend = worse efficiency) or still has room, via marginal vs. average efficiency.",
    grain: "1 row = 1 day × channel (or campaign) performance",
    needs: [
      { col: "date", label: "Date", why: "Recent spend point, curve fitting", required: true },
      { col: "cost", label: "Ad spend", why: "X-axis of the saturation curve", required: true },
      { col: "channel or campaign_name", label: "Channel/campaign", why: "Diagnosis unit", required: true },
      { col: "installs or actions", label: "Conversions", why: "Efficiency (CPA) calculation", required: true },
      { col: "revenue_d7", label: "Revenue", why: "ROAS-based saturation (optional)", required: false },
    ],
    prep: ["Shares the same efficiency CSV as 5-2/5-3 — upload once and sibling tools pick it up."],
    example: "date,channel,cost,installs,revenue_d7\n2024-01-01,Google UAC,850000,720,5400000\n2024-01-02,Google UAC,880000,735,5600000\n2024-01-03,Google UAC,920000,742,5700000",
  },
  "5-4": {
    when: "Design an A/B test (sample size calculation), and judge which variant statistically won from a results CSV.",
    grain: "1 row = 1 group (arm) aggregate",
    needs: [
      { col: "numerator", label: "Conversions (numerator)", why: "Conversion count for the group", required: true },
      { col: "denominator", label: "Group size / base (denominator)", why: "Group size (conversion rate = numerator/denominator)", required: true },
      { col: "is_control", label: "Is control", why: "Control vs. test distinction", required: true },
      { col: "arm_id", label: "Variant group", why: "Multi-variant testing (Variant A/B/C…)", required: false },
    ],
    prep: [
      "Upload one aggregated row per group (not one row per user).",
      "For holdout incrementality (the ad's own value), use the separate 'Incrementality' tool instead.",
    ],
    example: "arm_id,is_control,numerator,denominator\nControl,1,400,8000\nVariant A,0,496,8000",
  },
  "5-20": {
    when: "Find the 'aha-moment' — which early action, done how many times within how many days, predicts a user sticking around (converting).",
    grain: "1 row = 1 user",
    needs: [
      { col: "user_id", label: "User ID", why: "User-level identifier", required: true },
      { col: "converted(0/1)", label: "Converted (target)", why: "Marks users who stuck / converted", required: true },
      { col: "action columns (counts)", label: "Early actions", why: "Predictive power of each candidate action (F1/lift)", required: true },
    ],
    prep: [
      "Action columns should be counts 'within the first N days' (e.g. messages sent within 7 days).",
      "The conversion column is 0/1 — 1 means stuck/goal achieved.",
    ],
    example: "user_id,converted,matches_first_7d,messages_sent_7d,profile_completed\nu10001,1,8,32,1\nu10002,0,1,4,0\nu10003,1,12,45,1",
  },
  "5-23:suppression": {
    when: "Compare an exposed group vs. a randomized holdout group (ads suppressed) over the same period to see the true incremental lift from ads. The most reliable of the 3 methods.",
    grain: "1 row = 1 group (can also be split by region/date)",
    needs: [
      { col: "holdout_group", label: "Exposed/holdout", why: "Distinguishes exposed (saw ads) vs. holdout (ads suppressed) group", required: true },
      { col: "numerator", label: "Conversions", why: "Conversion count for the group", required: true },
      { col: "denominator", label: "Group size", why: "Group size (conversion rate = numerator/size)", required: true },
      { col: "date", label: "Date", why: "Adding this gives a daily conversion-rate trend chart (exposed vs. holdout)", required: false },
      { col: "spend", label: "Ad spend", why: "Exposed group's cost → iROAS, incremental CPA", required: false },
      { col: "revenue_d7", label: "Revenue", why: "Exposed group's revenue → iROAS", required: false },
    ],
    prep: [
      "Must be a randomized split to be interpreted causally.",
      "Upload results aggregated by geo holdout, user (ghost ads), or audience holdout.",
      "Add date with multiple rows per day to also get a conversion-rate time series.",
    ],
    example: "date,holdout_group,numerator,denominator,spend,revenue_d7\n2024-05-01,exposed,516,8600,1548000,16512000\n2024-05-01,holdout,378,8600,0,12096000\n2024-05-02,exposed,529,8700,1566000,16928000",
  },
  "5-23:on": {
    when: "Compare before vs. after the moment you turned on an ad/campaign that wasn't running, to see the lift from turning it on.",
    grain: "1 row = 1 day",
    needs: [
      { col: "date", label: "Date", why: "Time axis for the before/after comparison", required: true },
      { col: "conversions or other metric", label: "Performance metric", why: "Measures how much it rose after turning on", required: true },
      { col: "group", label: "Group (treatment/control)", why: "Adding a control group removes seasonality/trend via DiD", required: false },
    ],
    prep: [
      "You pick the turn-on date (cutoff) on screen.",
      "Adding a control group (one that didn't change) removes seasonality/trend for more accuracy (DiD). Don't claim causation without randomization.",
    ],
    example: "date,group,conversions\n2024-04-01,treatment,100\n2024-04-01,control,90\n2024-05-20,treatment,155\n2024-05-20,control,92",
  },
  "5-23:off": {
    when: "Compare before vs. after the moment you turned off an ad/campaign that was running, to see what was lost.",
    grain: "1 row = 1 day",
    needs: [
      { col: "date", label: "Date", why: "Time axis for the before/after comparison", required: true },
      { col: "conversions or other metric", label: "Performance metric", why: "Measures how much it dropped after turning off", required: true },
      { col: "group", label: "Group (treatment/control)", why: "Adding a control group removes seasonality/trend via DiD", required: false },
    ],
    prep: [
      "You pick the turn-off date (cutoff) on screen.",
      "Adding a control group removes seasonality/trend for more accuracy (DiD). Don't claim causation without randomization.",
    ],
    example: "date,group,conversions\n2024-04-01,treatment,200\n2024-04-01,control,180\n2024-05-20,treatment,120\n2024-05-20,control,182",
  },
  "5-3": {
    when: "Estimate a response curve per channel/campaign to simulate where the next dollar of budget pays off best.",
    grain: "1 row = 1 day × channel (or campaign) performance",
    needs: [
      { col: "date", label: "Date", why: "Time point needed to fit the curve", required: true },
      { col: "cost", label: "Ad spend", why: "X-axis of the response curve", required: true },
      { col: "channel or campaign_name", label: "Channel/campaign", why: "Allocation unit", required: true },
      { col: "installs or actions", label: "Conversions", why: "Y-axis of the response curve", required: true },
      { col: "revenue_d7", label: "Revenue", why: "ROAS-based allocation & post-reallocation revenue estimate", required: false },
    ],
    prep: [
      "Spend needs to vary across days for the curve to fit — a flat daily budget produces no curve.",
      "Mixed countries get forced to a single country automatically (prevents cross-country contamination).",
    ],
    example: "date,channel,cost,installs,revenue_d7\n2024-01-01,Google UAC,850000,720,5400000\n2024-01-01,Meta AAP,610000,540,3900000\n2024-01-02,TikTok,430000,510,2600000",
  },
  "5-18": {
    when: "Run MMM (marketing mix modeling), regression, and forecasting on daily or weekly channel spend + outcomes to see contribution and budget hypotheses.",
    grain: "1 row = 1 day or 1 week (daily rows are aggregated to weeks automatically)",
    needs: [
      { col: "date or week", label: "Date · week", why: "Time axis (adstock · seasonality); daily data is normalized to weeks", required: true },
      { col: "traffic / registrations / reactivations / purchasers / revenue", label: "Target outcomes (Y)", why: "Map at least one of the five supported targets", required: true },
      { col: "per-channel spend (google/meta/…)", label: "Channel spend", why: "Input for each channel's contribution breakdown", required: true },
      { col: "country", label: "Target market", why: "One identical value on every row when using market priors", required: false },
    ],
    prep: [
      "After upload, drag columns into their role (date/week · target Y · channel spend). Switch among mapped targets from the sticky controls.",
      "Daily rows are summed into weeks automatically. Holiday/event dummies become a weekly occurred/not-occurred flag (0/1).",
      "This app's conservative identification gate requires at least 52 weeks and recommends 104+ where possible. Budget recommendations are paused below 52 weeks.",
    ],
    example: "country,date,traffic,registrations,reactivations,purchasers,revenue,google_spend,meta_spend\nKR,2024-01-01,1200,310,85,42,8400000,4200000,3100000\nKR,2024-01-02,1260,325,88,45,8950000,4400000,3000000\nKR,2024-01-03,1180,302,82,39,8100000,3900000,3200000",
  },
  "9-1": {
    when: "Upload production attributes (title number/length, emoji, thumbnail tone, etc.) and performance (CTR, views) across multiple pieces of content to find which elements are significantly associated with performance via multivariate regression.",
    grain: "1 row = 1 piece of content",
    needs: [
      { col: "Performance metric (CTR, views, etc.)", label: "Performance (dependent variable)", why: "The outcome being explained — a single number", required: true },
      { col: "Production attribute columns (0/1 or numeric)", label: "Content elements (independent variables)", why: "Estimates each element's contribution (coefficient, significance)", required: true },
      { col: "post_id, title, etc.", label: "Content identifier", why: "Row identification (not used in analysis, include if available)", required: false },
    ],
    prep: [
      "Enter yes/no attributes as 0/1, and length/count attributes as numbers.",
      "The result shows 'association', not causation — there's confounding since skilled creators tend to use several elements together.",
      "Confirm with an A/B test (change only one content element) before acting on it.",
    ],
    example: "post_id,title_has_number,title_len,has_emoji,thumbnail_bright,ctr\np1001,1,42,0,1,3.9\np1002,0,58,1,0,2.1",
  },
  "9-2": {
    when: "Find the 'Aha-Content' (killer content) that leads readers who consumed it to subscribe, sign up, or return, using F1 and Lift.",
    grain: "1 row = 1 reader",
    needs: [
      { col: "reader_id", label: "Reader ID", why: "Identifies each reader", required: true },
      { col: "subscribed(0/1)", label: "Conversion (target)", why: "Marks readers who subscribed/signed up/returned", required: true },
      { col: "Content consumption columns (count)", label: "Content consumed", why: "Each piece's predictive power for conversion (F1/Lift)", required: true },
    ],
    prep: [
      "Enter consumption columns as 'number of views of that content within N days of first visit' (e.g., views within 7 days).",
      "Conversion column is 0/1 — 1 means subscribed/signed up/returned.",
      "The result is association, not causation — highly interested readers naturally read more and also subscribe more.",
    ],
    example: "reader_id,subscribed,ga4guide_d7,casestudy_d7,pricing_d7\nr10001,1,3,4,1\nr10002,0,0,1,0\nr10003,1,2,5,0",
  },
  "9-3": {
    when: "Decompose changes in traffic (visits, PV) into traffic source, category, and content — with zero residual (why did cost per visit go up? which traffic source drove it?).",
    grain: "1 row = 1 day × traffic source × category × content (finest)",
    needs: [
      { col: "date", label: "Date", why: "Period comparison (before vs. after)", required: true },
      { col: "traffic_source(=channel)", label: "Traffic source", why: "Decomposition unit (organic, social, search, newsletter, ...)", required: true },
      { col: "spend(=cost)", label: "Production/distribution cost", why: "Numerator for cost-per-visit", required: true },
      { col: "traffic(=installs/actions)", label: "Traffic (visits, PV)", why: "Denominator for cost-per-visit — a single outcome metric", required: true },
      { col: "category · content_id", label: "Category, content", why: "Drill-down (traffic source → category → content)", required: false },
      { col: "impressions · clicks", label: "Impressions, clicks", why: "Per-content CTR comparison (§4)", required: false },
    ],
    prep: [
      "The finer the grain (per-content, per-day), the more accurate the decomposition identity.",
      "Map only one outcome metric — traffic (visits/PV) — the metric toggle is hidden automatically.",
      "The result is 'association', not causation — only the arithmetic decomposition itself is exact.",
    ],
    example: "date,traffic_source,category,content_id,cost,traffic\n2024-01-08,organic,tutorial,tut_101,96000,820\n2024-01-08,social,case study,case_201,168000,410\n2024-01-15,social,case study,case_201,246000,650",
  },
  "9-6": {
    when: "Analyze per-content response, freshness (does response cool off over time), and attribute effects (which hooks/formats perform well), and flag when to publish new content or swap it out.",
    grain: "1 row = 1 day × content (creative)",
    needs: [
      { col: "creative_id", label: "Content ID", why: "Key for per-content aggregation", required: true },
      { col: "date", label: "Date", why: "Detects freshness (response decay over time)", required: true },
      { col: "impressions · clicks · installs", label: "Impressions, clicks, conversions", why: "Computes CTR/CVR and win rate", required: true },
      { col: "spend", label: "Production/distribution cost", why: "Cost per conversion, efficiency", required: true },
      { col: "message_angle · format · hook_type ...", label: "Content attributes", why: "Per-attribute effect (WLS), combination matrix", required: false },
    ],
    prep: [
      "Adding attribute columns (angle, format, hook) unlocks the 'which trait works' breakdown and combination table.",
      "The combination table only shows as 'verified' when each combination has 5+ pieces of content.",
      "The result is association, not causation — confirm with an experiment (5-4) before acting on it.",
    ],
    example: "creative_id,date,channel,impressions,clicks,installs,spend,message_angle,format\npost_001,2024-02-01,Blog,52000,1600,210,540000,Informational guide,Article\npost_002,2024-02-01,YouTube,48000,1900,180,480000,Case study,Video",
  },
  "9-7": {
    when: "Summarize content operation performance on one screen — visualize daily traffic trend and traffic-source share, cost-per-visit (Visualize), compare recent performance to the prior period (Scorecard), and automatically flag days where traffic or response rate spikes (Anomaly Detection).",
    grain: "1 row = 1 day × traffic source (× category · content)",
    needs: [
      { col: "date", label: "Date", why: "Axis for daily trend, period comparison, anomaly detection", required: true },
      { col: "cost(=production/distribution cost)", label: "Cost", why: "Cost per visit, share calculation", required: true },
      { col: "visits(=installs)", label: "Visits, traffic", why: "Core performance metric (visits, sessions, PV)", required: true },
      { col: "traffic_source(=channel)", label: "Traffic source", why: "Per-source share, cost-per-visit comparison", required: false },
      { col: "impressions · clicks", label: "Impressions, clicks", why: "Response rate (CTR), clicks-per-impression analysis", required: false },
      { col: "subscribers(=actions)", label: "Subscriptions, conversions", why: "Cost per subscription, conversion metric", required: false },
    ],
    prep: [
      "Revenue/payment/ROAS columns aren't needed — the content dashboard centers on traffic and response rate (those metrics aren't shown).",
      "Map visits (traffic) as the core metric and impressions/clicks/subscriptions as supporting ones to fill all 3 tabs.",
      "With 2+ weeks of data, the scorecard (WoW) and anomaly detection work meaningfully.",
    ],
    example: "date,traffic_source,content_cost,impressions,clicks,visits,subscribers\n2024-01-08,Organic search,126000,58000,2600,1740,104\n2024-01-08,Social,216000,74000,2200,1020,31\n2024-01-15,Newsletter,99000,41000,2870,1980,218",
  },
  "5-25": {
    when: "Before MMM, quickly check VIF to see whether channel spend moved too tightly together to separate contribution.",
    grain: "1 row = 1 day × channel (or campaign) spend",
    needs: [
      { col: "date", label: "Date", why: "Reference for comparing same-date channel spend", required: true },
      { col: "channel or campaign_name", label: "Channel/campaign", why: "Collinearity diagnosis unit", required: true },
      { col: "cost", label: "Ad spend", why: "Channel-spend movement", required: true },
    ],
    prep: ["Use at least two channels and at least three more dates than channels.", "If VIF is high, create independent channel variation before changing statistical settings."],
    example: "date,channel,cost\n2026-07-01,Search,850000\n2026-07-01,Social,610000\n2026-07-02,Search,720000\n2026-07-02,Social,780000",
  },
  "5-26": {
    when: "Find Exact-promotion candidates in an Apple Search Ads search-term report, then prioritize CPT increases or decreases using pacing and target CPA.",
    grain: "1 row = 1 day × search term × ad group (when available)",
    needs: [
      { col: "date", label: "Date", why: "Active-day and pacing calculation", required: true },
      { col: "search_term", label: "Search term", why: "Exact-promotion and negative-review unit", required: true },
      { col: "cost", label: "Spend", why: "CPA and pacing calculation", required: true },
      { col: "clicks", label: "Taps", why: "Actual CPT calculation", required: true },
      { col: "installs or actions", label: "Installs/conversions", why: "Target CPA check", required: true },
      { col: "match_type · daily_budget · target_cpa · current_cpt", label: "Match · budget · target · bid", why: "Exact, pacing, and CPT-recommendation precision", required: false },
    ],
    prep: ["Without a target CPA, the tool will not invent a bid increase/decrease.", "If daily budget is at campaign/ad-group level, export that dimension. The tool does not sum a repeated daily budget across search-term rows."],
    example: "date,campaign_name,adgroup_name,search_term,match_type,cost,clicks,installs,daily_budget,target_cpa,current_cpt\n2026-08-01,Generic,Discovery,budget planner,Search Match,4000,250,42,12000,140,18\n2026-08-01,Generic,Broad,free budget app,Broad,15000,610,58,12000,140,22",
  },
};

export function getToolGuide(toolId, locale = "ko") {
  if (locale === "en" && TOOL_GUIDE_EN[toolId]) return TOOL_GUIDE_EN[toolId];
  return TOOL_GUIDE[toolId] || null;
}
