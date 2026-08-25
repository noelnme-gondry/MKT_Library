/* ============================================================
 * 구성 변화 분석(5-29) 정규화 검증용 합성 fixture.
 *
 * 실제 사례를 익명화한 합성 데이터다. 결정론(§8.3) — 난수 없음.
 * 같은 사실을 세 가지 CSV shape으로 적어 두고, 어댑터가 셋을 같은
 * SegmentPanelV1으로 정규화하는지 골든으로 고정한다.
 *
 * 사실관계(가입자 수):
 *            PRE 2026-07-01              POST 2026-08-01
 *   CPS      F 120  M 1280  (계 1400)    F 200  M 1300  (계 1500)
 *   BRAND    F 300  M  300  (계  600)    F 700  M  300  (계 1000)
 *
 * 전체 여성 비중은 PRE 420/2000=21.0% → POST 900/2500=36.0%.
 * 이 변화는 캠페인 간 이동(Mix)과 캠페인 내부 변화(Rate)가 섞여 있어
 * 분해 골든의 입력으로 쓰기 좋다.
 * ============================================================ */

// 헤더는 표준키가 아니라 실제 리포트에서 나올 법한 이름으로 쓴다 — 자기가 만든
// 표준키 헤더로만 검사하면 실사용 CSV의 실패는 영원히 안 보인다(§7).
export const LONG_GENDER_ROWS = [
  { 일자: "2026-07-01", 캠페인: "CPS", OS: "Android", 성별: "Female", 가입: "120", 광고비: "2,800,000" },
  { 일자: "2026-07-01", 캠페인: "CPS", OS: "Android", 성별: "Male", 가입: "1,280", 광고비: "2,800,000" },
  { 일자: "2026-07-01", 캠페인: "BRAND", OS: "Android", 성별: "Female", 가입: "300", 광고비: "1,200,000" },
  { 일자: "2026-07-01", 캠페인: "BRAND", OS: "Android", 성별: "Male", 가입: "300", 광고비: "1,200,000" },
  { 일자: "2026-08-01", 캠페인: "CPS", OS: "Android", 성별: "Female", 가입: "200", 광고비: "3,000,000" },
  { 일자: "2026-08-01", 캠페인: "CPS", OS: "Android", 성별: "Male", 가입: "1,300", 광고비: "3,000,000" },
  { 일자: "2026-08-01", 캠페인: "BRAND", OS: "Android", 성별: "Female", 가입: "700", 광고비: "2,500,000" },
  { 일자: "2026-08-01", 캠페인: "BRAND", OS: "Android", 성별: "Male", 가입: "300", 광고비: "2,500,000" },
];

export const WIDE_GENDER_ROWS = [
  { 일자: "2026-07-01", 캠페인: "CPS", OS: "Android", 전체가입: "1,400", 여성가입: "120", 남성가입: "1,280", 광고비: "2,800,000" },
  { 일자: "2026-07-01", 캠페인: "BRAND", OS: "Android", 전체가입: "600", 여성가입: "300", 남성가입: "300", 광고비: "1,200,000" },
  { 일자: "2026-08-01", 캠페인: "CPS", OS: "Android", 전체가입: "1,500", 여성가입: "200", 남성가입: "1,300", 광고비: "3,000,000" },
  { 일자: "2026-08-01", 캠페인: "BRAND", OS: "Android", 전체가입: "1,000", 여성가입: "700", 남성가입: "300", 광고비: "2,500,000" },
];

// 비율은 리포트에서 흔히 소수 4자리로 잘려 나온다. 복원 인원수가 원본과 미세하게
// 어긋나는 것이 정상이고, 그 사실을 결과에 남겨야 한다.
export const RATE_GENDER_ROWS = [
  { 일자: "2026-07-01", 캠페인: "CPS", OS: "Android", 전체가입: "1,400", 여성비중: "0.0857", 남성비중: "0.9143" },
  { 일자: "2026-07-01", 캠페인: "BRAND", OS: "Android", 전체가입: "600", 여성비중: "0.5000", 남성비중: "0.5000" },
  { 일자: "2026-08-01", 캠페인: "CPS", OS: "Android", 전체가입: "1,500", 여성비중: "0.1333", 남성비중: "0.8667" },
  { 일자: "2026-08-01", 캠페인: "BRAND", OS: "Android", 전체가입: "1,000", 여성비중: "0.7000", 남성비중: "0.3000" },
];

/* 성별×연령이 한 파일에 함께 있는 형태. 각 축은 다른 축을 합쳐(marginalize) 봐야 한다.
 * 연령 합계: PRE u29 1200 / 30p 800, POST u29 1560 / 30p 940. 성별 합계는 위와 동일. */
export const LONG_TWO_AXIS_ROWS = [
  { 일자: "2026-07-01", 캠페인: "CPS", OS: "Android", 성별: "Female", 연령대: "29세 이하", 가입: "70", 광고비: "2,800,000" },
  { 일자: "2026-07-01", 캠페인: "CPS", OS: "Android", 성별: "Female", 연령대: "30대 이상", 가입: "50", 광고비: "2,800,000" },
  { 일자: "2026-07-01", 캠페인: "CPS", OS: "Android", 성별: "Male", 연령대: "29세 이하", 가입: "800", 광고비: "2,800,000" },
  { 일자: "2026-07-01", 캠페인: "CPS", OS: "Android", 성별: "Male", 연령대: "30대 이상", 가입: "480", 광고비: "2,800,000" },
  { 일자: "2026-07-01", 캠페인: "BRAND", OS: "Android", 성별: "Female", 연령대: "29세 이하", 가입: "180", 광고비: "1,200,000" },
  { 일자: "2026-07-01", 캠페인: "BRAND", OS: "Android", 성별: "Female", 연령대: "30대 이상", 가입: "120", 광고비: "1,200,000" },
  { 일자: "2026-07-01", 캠페인: "BRAND", OS: "Android", 성별: "Male", 연령대: "29세 이하", 가입: "150", 광고비: "1,200,000" },
  { 일자: "2026-07-01", 캠페인: "BRAND", OS: "Android", 성별: "Male", 연령대: "30대 이상", 가입: "150", 광고비: "1,200,000" },
  { 일자: "2026-08-01", 캠페인: "CPS", OS: "Android", 성별: "Female", 연령대: "29세 이하", 가입: "130", 광고비: "3,000,000" },
  { 일자: "2026-08-01", 캠페인: "CPS", OS: "Android", 성별: "Female", 연령대: "30대 이상", 가입: "70", 광고비: "3,000,000" },
  { 일자: "2026-08-01", 캠페인: "CPS", OS: "Android", 성별: "Male", 연령대: "29세 이하", 가입: "780", 광고비: "3,000,000" },
  { 일자: "2026-08-01", 캠페인: "CPS", OS: "Android", 성별: "Male", 연령대: "30대 이상", 가입: "520", 광고비: "3,000,000" },
  { 일자: "2026-08-01", 캠페인: "BRAND", OS: "Android", 성별: "Female", 연령대: "29세 이하", 가입: "500", 광고비: "2,500,000" },
  { 일자: "2026-08-01", 캠페인: "BRAND", OS: "Android", 성별: "Female", 연령대: "30대 이상", 가입: "200", 광고비: "2,500,000" },
  { 일자: "2026-08-01", 캠페인: "BRAND", OS: "Android", 성별: "Male", 연령대: "29세 이하", 가입: "150", 광고비: "2,500,000" },
  { 일자: "2026-08-01", 캠페인: "BRAND", OS: "Android", 성별: "Male", 연령대: "30대 이상", 가입: "150", 광고비: "2,500,000" },
];

// 한 사용자가 여러 태그를 가질 수 있는 비배타 축. 멤버 합이 모수를 넘는다.
export const NON_EXCLUSIVE_TAG_ROWS = [
  { 일자: "2026-07-01", 캠페인: "CPS", 전체가입: "1,400", 관심_여행: "900", 관심_게임: "800" },
  { 일자: "2026-08-01", 캠페인: "CPS", 전체가입: "1,500", 관심_여행: "1,100", 관심_게임: "700" },
];

export const BASE_ROLES = {
  time: "일자",
  entity: ["캠페인"],
  scope: ["OS"],
  population: null,
  measures: { spend: "광고비" },
};

export const GENDER_LONG_DIMENSION = {
  id: "gender",
  label: "성별",
  sourceShape: "long_count",
  isExclusive: true,
  isExhaustive: true,
  categoryColumn: "성별",
  countColumn: "가입",
  members: [
    { id: "female", label: "Female", matchValues: ["Female", "여성"] },
    { id: "male", label: "Male", matchValues: ["Male", "남성"] },
  ],
};

export const GENDER_WIDE_DIMENSION = {
  id: "gender",
  label: "성별",
  sourceShape: "wide_count",
  isExclusive: true,
  isExhaustive: true,
  denominatorColumn: "전체가입",
  members: [
    { id: "female", label: "Female", sourceColumn: "여성가입" },
    { id: "male", label: "Male", sourceColumn: "남성가입" },
  ],
};

export const GENDER_RATE_DIMENSION = {
  id: "gender",
  label: "성별",
  sourceShape: "rate",
  rateUnit: "ratio",
  isExclusive: true,
  isExhaustive: true,
  denominatorColumn: "전체가입",
  members: [
    { id: "female", label: "Female", sourceColumn: "여성비중" },
    { id: "male", label: "Male", sourceColumn: "남성비중" },
  ],
};

export const AGE_LONG_DIMENSION = {
  id: "age",
  label: "연령대",
  sourceShape: "long_count",
  isExclusive: true,
  isExhaustive: true,
  categoryColumn: "연령대",
  countColumn: "가입",
  members: [
    { id: "u29", label: "29세 이하", matchValues: ["29세 이하"] },
    { id: "o30", label: "30대 이상", matchValues: ["30대 이상"] },
  ],
};

export const TAG_DIMENSION = {
  id: "interest",
  label: "관심사",
  sourceShape: "wide_count",
  isExclusive: false,
  isExhaustive: false,
  denominatorColumn: "전체가입",
  members: [
    { id: "travel", label: "여행", sourceColumn: "관심_여행" },
    { id: "game", label: "게임", sourceColumn: "관심_게임" },
  ],
};
