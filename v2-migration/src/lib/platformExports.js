import { STANDARD_FIELDS, TOOL_OPTIONAL_FIELDS, TOOL_REQUIRED_FIELDS } from "@/utils/csvConstants";

// 광고·스토어 플랫폼에서 내려받은 파일을 손대지 않고 올리는 경로의 SSOT(2026-09-30).
// 템플릿 상세 페이지가 이 목록을 보여 주고, `platformExports.test.js`가 같은 헤더를 실제 업로드
// 판정(기존 매핑 계약 + 의미 매퍼 V2 + 분석 자격)에 통과시킨다 — 화면에 적힌 열 이름은 전부
// 테스트가 돌린 이름이다.
//
// 정직성(§8): 우리가 확인한 것은 "이 이름의 헤더를 우리 매퍼가 알아본다"이지 "플랫폼이 지금 이
// 이름으로 내보낸다"가 아니다. 플랫폼의 메뉴 경로·열 이름은 계정·언어·열 설정·개편에 따라 바뀌므로
// 여기 적지 않고(검증할 수 없다), 화면도 그 한계를 함께 말한다.
//
// columns: 헤더 → 표준 필드 키(`STANDARD_FIELDS`). 표준 필드로 읽지 않는 열은 ignored에 사유와 함께.
export const PLATFORM_EXPORTS = [
  {
    id: "meta-ads-ko",
    platform: { ko: "Meta 광고 관리자 (한글 화면)", en: "Meta Ads Manager (Korean UI)" },
    report: { ko: "일 단위로 나눈 캠페인 보고서", en: "Campaign report broken down by day" },
    tools: ["5-2", "5-3", "5-22"],
    columns: { "일": "date", "캠페인 이름": "campaign_name", "지출 금액 (KRW)": "cost", "노출": "impressions", "링크 클릭": "clicks", "앱 설치": "installs" },
    ignored: {
      "광고 세트 이름": { ko: "이 도구들은 캠페인 단위로 봅니다.", en: "These tools work at campaign level." },
      "구매 전환값": { ko: "어트리뷰션 기간 기준 값이라 설치 후 D7 매출과 시간 의미가 달라 매출로 읽지 않습니다.", en: "It follows the attribution window, not days since install, so it is not read as D7 revenue." },
    },
  },
  {
    id: "meta-ads-en",
    platform: { ko: "Meta 광고 관리자 (영문 화면)", en: "Meta Ads Manager (English UI)" },
    report: { ko: "일 단위로 나눈 캠페인 보고서", en: "Campaign report broken down by day" },
    tools: ["5-2", "5-3", "5-22"],
    columns: { "Day": "date", "Campaign name": "campaign_name", "Amount spent (USD)": "cost", "Impressions": "impressions", "Link clicks": "clicks", "App installs": "installs" },
    ignored: {
      "Ad set name": { ko: "이 도구들은 캠페인 단위로 봅니다.", en: "These tools work at campaign level." },
      "Purchases conversion value": { ko: "어트리뷰션 기간 기준 값이라 설치 후 D7 매출과 시간 의미가 달라 매출로 읽지 않습니다.", en: "It follows the attribution window, not days since install, so it is not read as D7 revenue." },
    },
  },
  {
    id: "app-store-connect",
    platform: { ko: "App Store Connect", en: "App Store Connect" },
    report: { ko: "소스 유형별 일 단위 지표", en: "Daily metrics by source type" },
    tools: ["5-27"],
    columns: { "Date": "date", "Source Type": "store_source", "Impressions": "impressions", "Product Page Views": "product_page_views", "Total Downloads": "installs" },
    ignored: {},
  },
  {
    id: "google-play-console",
    platform: { ko: "Google Play Console", en: "Google Play Console" },
    report: { ko: "트래픽 소스별 일 단위 스토어 실적", en: "Daily store performance by traffic source" },
    tools: ["5-27"],
    columns: { "Date": "date", "Traffic source": "store_source", "Store listing visitors": "product_page_views", "Store listing acquisitions": "installs" },
    ignored: {},
  },
];

export const platformExportHeaders = (entry) => [...Object.keys(entry.columns), ...Object.keys(entry.ignored)];

/** 도구가 읽는 표준 필드(필수 + 선택). 같은 파일이라도 도구마다 읽는 열이 다르다(5-22는 노출을 안 본다). */
export function toolReadsField(toolId, field) {
  const required = (TOOL_REQUIRED_FIELDS[toolId] || []).some((item) => item === field || item?.oneOf?.includes(field));
  return required || (TOOL_OPTIONAL_FIELDS[toolId] || []).some((item) => item.key === field);
}

/** 한 도구의 템플릿 페이지에 보여 줄 플랫폼 파일. 그 도구가 실제로 읽는 열만, 표시용 라벨까지 풀어 둔다. */
export function platformExportsForTool(toolId, locale = "ko") {
  const en = locale === "en";
  return PLATFORM_EXPORTS.filter((entry) => entry.tools.includes(toolId)).map((entry) => ({
    id: entry.id,
    platform: entry.platform[locale] || entry.platform.ko,
    report: entry.report[locale] || entry.report.ko,
    columns: Object.entries(entry.columns).filter(([, field]) => toolReadsField(toolId, field)).map(([header, field]) => ({
      header,
      field,
      label: (en ? STANDARD_FIELDS[field]?.labelEn : null) || STANDARD_FIELDS[field]?.label || field,
    })),
    ignored: Object.entries(entry.ignored).map(([header, reason]) => ({ header, reason: reason[locale] || reason.ko })),
  }));
}
