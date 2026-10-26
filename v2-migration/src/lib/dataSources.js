/* ============================================================
 * dataSources — "어떤 파일이 필요한가"를 사용자 말로 말하는 단일 출처.
 *
 * 사용자는 컬럼 이름(cost·installs)이 아니라 "Meta 광고 관리자에서 받은 파일"처럼
 * 출처로 데이터를 떠올린다(product-ssot §1.1c). 데이터 그룹(TOOL_GROUP)마다
 *   file    목록·카드에 쓰는 짧은 파일 이름
 *   family  출처 묶음(아래 6종) — 어디서 받는 파일인가
 *   prep    준비 안내 한두 문장(/data-guide의 "어디서 가져오나요?")
 * 를 둔다. 정확한 필드 계약은 여전히 TOOL_REQUIRED_FIELDS가 소유한다.
 *
 * 출처 묶음의 매체 이름은 "그런 파일을 내보내는 곳"의 예시다. 그 매체의 헤더를
 * 자동 인식한다는 약속이 아니다 — 인식 범위는 lib/platformExports.js가 소유한다.
 * 커버리지는 공개 도구의 그룹에서 파생한 dataSources.test.js가 막는다.
 * ============================================================ */

import { TOOL_GROUP } from "@/lib/toolGroups";

const t = (ko, en) => ({ ko, en });

export const DATA_SOURCE_FAMILIES = {
  ads: {
    name: t("광고 매체·MMP 리포트", "Ad platform and MMP reports"),
    where: t("Meta 광고 관리자, Google Ads, TikTok Ads, Apple Ads, AppsFlyer, Adjust 등", "Meta Ads Manager, Google Ads, TikTok Ads, Apple Ads, AppsFlyer, Adjust and similar"),
  },
  compiled: {
    name: t("직접 정리하는 집계표", "Tables you compile"),
    where: t("MMP·분석 도구의 성과와 매체별 지출을 같은 날짜·주차로 합친 표", "Outcomes from your MMP or analytics tool joined with spend on the same dates or weeks"),
  },
  store: {
    name: t("스토어 콘솔", "App store consoles"),
    where: t("App Store Connect, Google Play Console", "App Store Connect, Google Play Console"),
  },
  events: {
    name: t("제품 이벤트·사용자 기록", "Product events and user records"),
    where: t("GA4, Amplitude, Mixpanel, 앱·서비스 로그", "GA4, Amplitude, Mixpanel, app or service logs"),
  },
  commerce: {
    name: t("주문·고객·영업 기록", "Orders, customers and sales records"),
    where: t("쇼핑몰·결제 주문 내역, CRM·영업 관리 도구", "Store or payment order exports, CRM and sales tools"),
  },
  experiments: {
    name: t("실험·설문 결과", "Experiment and survey results"),
    where: t("실험 도구, 홀드아웃 기록, CRM 발송 결과, 설문 도구", "Experiment tools, holdout records, CRM send results, survey tools"),
  },
};

export const DATA_SOURCE_FAMILY_IDS = Object.freeze(Object.keys(DATA_SOURCE_FAMILIES));

// 그룹 → 파일. prep은 예전 analysisDataGuide의 SOURCES를 그대로 옮겼다(문장 변경 없음).
const GROUP_SOURCES = {
  efficiency: {
    family: "ads",
    file: t("광고 일별 성과 (캠페인 단위)", "Daily ad performance by campaign"),
    prep: t("광고 플랫폼·MMP의 일별 캠페인 성과. 소재도 볼 때는 소재 단위로 내보내세요.", "Daily campaign performance from ad platforms or your MMP. Export creative-level rows to examine creatives."),
  },
  creative: {
    family: "ads",
    file: t("광고 일별 성과 (소재 단위)", "Daily ad performance by creative"),
    prep: t("광고 플랫폼의 일별 소재 보고서. 같은 소재가 여러 날짜에 기록되어 있어야 변화도 볼 수 있습니다.", "Daily creative reports from an ad platform. Repeated dates per creative let you examine changes."),
  },
  asa_keyword: {
    family: "ads",
    file: t("Apple Ads 검색어 리포트", "Apple Ads search-term report"),
    prep: t("Apple Ads 검색어 보고서. 캠페인·광고그룹 예산과 목표 단가가 있으면 조정 판단에도 쓰입니다.", "Apple Ads search-term reports. Campaign or ad-group budgets and target costs also support adjustment decisions."),
  },
  multitouch: {
    family: "ads",
    file: t("AppsFlyer 설치 raw 리포트", "AppsFlyer raw install report"),
    prep: t("AppsFlyer 설치 raw 리포트. 최종 유입과 contributor 기록을 함께 내보내세요.", "AppsFlyer raw install reports containing both the attributed source and contributor records."),
  },
  collinearity: {
    family: "ads",
    file: t("채널별 일별 광고비", "Daily spend by channel"),
    prep: t("광고 플랫폼별 지출을 같은 날짜 기준으로 모은 표. 최소 두 채널이 필요합니다.", "Spend from at least two ad channels aligned to the same dates."),
  },
  traffic_quality: {
    family: "ads",
    file: t("채널별 일별 클릭·무효 클릭 리포트", "Daily clicks and invalid clicks by channel"),
  },
  reach_frequency: {
    family: "ads",
    file: t("매체별 도달·빈도 리포트", "Reach and frequency report by platform"),
  },
  response: {
    family: "compiled",
    file: t("주간 채널 집계 (성과 + 채널별 광고비)", "Weekly channel table (outcomes + spend by channel)"),
    prep: t("MMP·분석 도구의 전체 성과와 광고 플랫폼별 지출을 같은 날짜나 주차로 합친 표.", "A table joining total outcomes from your MMP or analytics tool with channel spend, on the same dates or weeks."),
  },
  brand_incrementality: {
    family: "compiled",
    file: t("브랜드 검색량 일별 기록 + 캠페인 기간", "Daily brand search with campaign dates"),
    prep: t("검색·직접 유입 등의 날짜별 성과와 브랜드 캠페인 집행 기록을 합친 표.", "Daily search or direct-traffic outcomes joined with the brand campaign's on/off record."),
  },
  segment_composition: {
    family: "compiled",
    file: t("두 기간의 세그먼트별 인원 집계", "Segment counts for two periods"),
    prep: t("두 기간의 국가·연령·플랜 등 구분값별 인원 집계. 전체 인원과 부분 집계를 중복해서 더하지 마세요.", "Population counts by country, age or plan for two periods. Do not add total rows to their component counts."),
  },
  geo_panel: {
    family: "compiled",
    file: t("지역별 일별 성과", "Daily results by region"),
  },
  content_attr: {
    family: "compiled",
    file: t("콘텐츠별 성과 + 요소 기록", "Content results with recorded elements"),
    prep: t("콘텐츠별 성과 보고서에 훅·자막·길이 등 직접 기록한 요소를 붙인 표.", "Content performance joined with recorded features such as hooks, captions and length."),
  },
  aso_store: {
    family: "store",
    file: t("스토어 유입 경로별 실적", "Store results by traffic source"),
    prep: t("App Store Connect·Google Play Console의 유입 경로별 스토어 실적.", "Store performance by traffic source from App Store Connect or Google Play Console."),
  },
  aha: {
    family: "events",
    file: t("사용자별 초기 행동 집계", "Early actions per user"),
    prep: t("제품 분석·이벤트 로그를 사용자별로 집계한 표. 초기 행동을 센 기간과 목표 달성을 확인한 기간을 구분하세요.", "Product-event logs aggregated by user. Separate the early-action window from the later outcome window."),
  },
  ordered_user_events: {
    family: "events",
    file: t("사용자 이벤트 로그", "User event log"),
  },
  subscription_survival: {
    family: "events",
    file: t("사용자별 시작·종료 기록", "Start and end records per user"),
    prep: t("핵심 액션의 시작·종료 기록을 관측 기간과 종료 여부로 정리한 표. 관측 종료까지 유지한 사례도 포함하세요.", "Action start/end records summarized as observed duration and exit status. Include cases still active at the observation cutoff."),
  },
  customer_ledger: {
    family: "commerce",
    file: t("구매·환불 거래 원장", "Purchase and refund ledger"),
  },
  basket_lines: {
    family: "commerce",
    file: t("주문별 상품 내역", "Order line items"),
  },
  promotion_units: {
    family: "commerce",
    file: t("프로모션 대상별 매출·비용", "Revenue and cost per promotion unit"),
  },
  b2b_stage_history: {
    family: "commerce",
    file: t("딜 단계 변경 이력", "Deal stage history"),
  },
  experiment: {
    family: "experiments",
    file: t("실험 그룹별 대상자·전환 집계", "Visitors and conversions per test group"),
    prep: t("실험 도구에서 집계한 그룹별 대상자 수와 전환 수. 실험 배정 기준을 함께 확인하세요.", "Group-level population and conversions from your experiment tool. Check how participants were assigned."),
  },
  incrementality: {
    family: "experiments",
    file: t("광고 노출·차단 또는 전후 성과 기록", "Exposed vs holdout, or before/after results"),
    prep: t("광고 노출·차단 실험 결과 또는 집행을 바꾼 전후의 성과 기록. 일반 캠페인 보고서만으로 실험군을 만들 수는 없습니다.", "Exposure/holdout experiment results or outcomes before and after a spend change. An ordinary campaign report does not establish experiment groups."),
  },
  cuped_units: {
    family: "experiments",
    file: t("실험 대상별 사전·사후 지표", "Pre- and post-period metrics per test unit"),
  },
  crm_uplift_units: {
    family: "experiments",
    file: t("CRM 발송 대상별 결과", "CRM outcomes per targeted unit"),
  },
  choice_sets: {
    family: "experiments",
    file: t("선택형 설문 응답", "Choice survey responses"),
  },
};

export const DATA_SOURCE_GROUP_IDS = Object.freeze(Object.keys(GROUP_SOURCES));

const pick = (pair, locale) => (pair ? (locale === "en" ? pair.en : pair.ko) : "");

/** 데이터 그룹의 사용자용 파일 정보. 모르는 그룹은 null(빈 표기를 만들지 않는다). */
export function dataSourceForGroup(group, locale = "ko") {
  const entry = GROUP_SOURCES[group];
  if (!entry) return null;
  const family = DATA_SOURCE_FAMILIES[entry.family];
  return {
    group,
    familyId: entry.family,
    family: pick(family.name, locale),
    where: pick(family.where, locale),
    file: pick(entry.file, locale),
    prep: pick(entry.prep, locale),
  };
}

/**
 * 도구가 읽는 파일. 그룹은 toolGroups가 소유한다(같은 파일 = 같은 그룹).
 * groupForRoute는 모르는 id를 효율 그룹으로 떨어뜨리므로 쓰지 않는다 — 등록되지 않은
 * 도구에 광고 파일 이름을 붙이는 것보다 표기가 없는 편이 정직하다.
 */
export function dataSourceForTool(toolId, locale = "ko") {
  return dataSourceForGroup(TOOL_GROUP[toolId], locale);
}
