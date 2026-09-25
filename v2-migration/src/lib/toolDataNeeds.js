// 도구마다 "어떤 값이 들어 있어야 하나"를 한 문장으로. 결과 화면의 '다른 데이터가 필요한
// 분석' 목록이 읽는다. 컬럼 이름(전환수 (분자)·비용(Creative))이 아니라 파일에 무엇이
// 기록돼 있어야 하는지를 말한다 — 마케터는 컬럼 이름이 아니라 자기가 가진 데이터로 판단한다.
// 정확한 필드 계약은 여전히 TOOL_REQUIRED_FIELDS가 소유하고, 이 문장은 그 요약이다.
// 커버리지는 publishedToolIds()에서 파생한 테스트가 막는다(toolDataNeeds.test.js).

const NEEDS = {
  "5-2": { ko: "날짜별 광고비와 전환 수", en: "Ad spend and conversions by date" },
  "5-21": { ko: "캠페인별·날짜별 광고비와 전환 수", en: "Ad spend and conversions by campaign and date" },
  "5-22": { ko: "캠페인별·날짜별 광고비와 전환 수", en: "Ad spend and conversions by campaign and date" },
  "5-3": { ko: "채널별·날짜별 광고비와 전환 수", en: "Ad spend and conversions by channel and date" },
  "5-25": { ko: "채널별·날짜별 광고비", en: "Ad spend by channel and date" },
  "5-18-trend": { ko: "주 단위로 모은 성과와 채널별 광고비", en: "Weekly results and ad spend by channel" },
  "5-18-paid-organic": { ko: "주 단위 유료 유입과 오가닉 유입", en: "Weekly paid and organic acquisition" },
  "5-18-cannibal": { ko: "주 단위 유료 광고비와 오가닉 유입", en: "Weekly paid spend and organic acquisition" },
  "5-18-mmm": { ko: "12주 이상 쌓인 채널별 주간 광고비와 성과", en: "At least 12 weeks of weekly spend and results by channel" },
  "5-18-forecast": { ko: "12주 이상 쌓인 주간 성과 기록", en: "At least 12 weeks of weekly results" },
  "9-6": { ko: "소재별·날짜별 광고비와 노출·클릭", en: "Spend, impressions and clicks by creative and date" },
  "9-1": { ko: "콘텐츠마다 붙은 요소(제목 길이·썸네일 등)와 성과", en: "Each piece of content with its elements (title length, thumbnail…) and results" },
  "5-20": { ko: "사용자별 행동 횟수와 전환 여부", en: "Action counts per user and whether each converted" },
  "5-26": { ko: "검색어별 광고비·탭·설치", en: "Spend, taps and installs by search term" },
  "5-27": { ko: "스토어 유입 경로별 페이지 조회와 설치", en: "Store page views and installs by traffic source" },
  "5-4": { ko: "실험군·대조군별 방문자 수와 전환 수", en: "Visitors and conversions for each test group and the control" },
  "5-23": { ko: "광고를 켠 그룹과 끈 그룹(또는 기간)의 성과", en: "Results for a group (or period) with ads on and one with ads off" },
  "5-24": { ko: "캠페인 전후 28일 이상의 날짜별 브랜드 검색량", en: "Daily brand search volume covering at least 28 days around the campaign" },
  "5-28": { ko: "사용자별 시작일과 이탈(종료)일", en: "Start date and churn (end) date for each user" },
  "5-29": { ko: "두 기간의 사용자 구분값(연령·국가 등)별 인원과 성과", en: "Users and results by segment (age, country…) for two periods" },
};

export function toolDataNeed(toolId, locale = "ko") {
  const entry = NEEDS[toolId];
  return entry ? (locale === "en" ? entry.en : entry.ko) : "";
}

export const TOOL_DATA_NEED_IDS = Object.freeze(Object.keys(NEEDS));
