export function operationsGuide(locale = "ko") {
  const en = locale === "en", tr = (ko, english) => en ? english : ko;
  return {
    when: tr("캠페인 이력 하나로 최근 효율·예산 조정·신규 소재를 함께 점검합니다.", "Review recent efficiency, budget shifts and new creatives from one campaign history."),
    grain: tr("1행 = 날짜 × 캠페인 × 소재 실적. 같은 비용을 중복 집계하지 마세요.", "One row = date × campaign × creative. Do not duplicate spend across breakdowns."),
    needs: [
      { col: "date", label: tr("날짜", "Date"), why: tr("최근·이전 기간 비교와 긴 이력의 기준", "Define recent, prior and historical periods"), required: true },
      { col: "campaign_id 또는 campaign_name 또는 channel", label: tr("캠페인 또는 채널", "Campaign or channel"), why: tr("예산 이동과 효율 비교의 단위", "The unit of allocation and efficiency comparison"), required: true },
      { col: "cost", label: tr("광고비", "Spend"), why: tr("단가와 예산 조정 기준", "Calculate unit costs and budget plans"), required: true },
      { col: "installs 또는 actions", label: tr("설치 또는 가입", "Installs or actions"), why: tr("단가의 분모와 예상 성과", "The unit-cost denominator and forecast outcome"), required: true },
      { col: "creative_id", label: tr("소재 ID", "Creative ID"), why: tr("첫 관측과 소재별 구성·효율 분해", "First observations and creative decomposition"), required: false },
      { col: "impressions·clicks", label: tr("노출·클릭", "Impressions and clicks"), why: tr("노출 단가·클릭률·설치율 변화 기여", "Inspect CPM and conversion-stage contributions"), required: false },
    ],
    prep: [tr("긴 일별 이력을 올리고 최근 7·14·28일을 선택하세요. 결측·성과 0·낮은 적합도는 예산 예측을 보류합니다.", "Upload a daily history and select the recent 7, 14 or 28 days. Missing data, zero outcomes or low fit withhold budget forecasts."),
      tr("국가·플랫폼·채널을 같은 기준으로 유지하고 실제 집행 통화를 선언하세요.", "Keep country, platform and channel definitions consistent and declare the source currency."),
      tr("예시는 98일·4개 캠페인의 가상 리포트입니다. 새 소재와 캠페인 악화가 함께 관측됩니다.", "The fictional sample spans 98 days and four campaigns with new creatives and deteriorating campaign efficiency.")],
    example: "date,channel,campaign_name,creative_id,cost,installs,impressions,clicks\n2026-09-01,Meta,Acquisition,Video A,200000,160,60000,1200\n2026-09-01,Meta,Retargeting,Image B,100000,40,35000,600",
  };
}
