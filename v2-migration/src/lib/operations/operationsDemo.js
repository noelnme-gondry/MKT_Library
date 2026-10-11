// 실제 운영 자료가 아닌, 모든 진입점이 공유하는 결정적 가상 리포트.
// 합계는 캠페인×일에서 생성하고 소재별로 나눈다. 정수 성과·클릭을 보존한다.
export const OPERATIONS_TOOL_ID = "5-31";
export const OPERATIONS_PATH = "/tools/operations-planner";

export function buildOperationsDemo(locale = "ko") {
  const en = locale === "en";
  const campaigns = [
    { name: en ? "Meta · New customers" : "Meta · 신규 고객", channel: "Meta", base: 800, slope: 0.0014, spend: 240000, step: 24000 },
    { name: en ? "Meta · Retargeting" : "Meta · 리타기팅", channel: "Meta", base: 2000, slope: 0.005, spend: 180000, step: 18000 },
    { name: en ? "Google · App discovery" : "Google · 앱 탐색", channel: "Google", base: 1100, slope: 0.0025, spend: 220000, step: 22000 },
    { name: en ? "TikTok · Product demo" : "TikTok · 제품 시연", channel: "TikTok", base: 1600, slope: 0.003, spend: 120000, step: 12000 },
  ];
  const raw = [];
  for (let day = 0; day < 98; day++) {
    const date = new Date(Date.UTC(2026, 6, 1 + day)).toISOString().slice(0, 10);
    campaigns.forEach((campaign, index) => {
      const cost = campaign.spend + ((day + index * 3) % 11 - 5) * campaign.step;
      // 최근 리타기팅은 클릭→설치율 하락, TikTok은 노출 단가 상승.
      const worsening = day >= 91 ? (index === 1 ? 1.28 : index === 3 ? 1.12 : 1) : 1;
      const installs = Math.round(cost / ((campaign.base + cost * campaign.slope) * worsening));
      const actions = Math.round(installs * 0.62);
      const clicks = Math.round(installs * (index === 1 ? 8 * worsening : 8));
      const impressions = Math.round(clicks / (index === 3 ? 0.014 : 0.022));
      const isNew = day >= 91 && (index === 0 || index === 2);
      const parts = isNew ? [{ share: 0.7, outcomes: 0.58, fresh: false }, { share: 0.3, outcomes: 0.42, fresh: true }] : [{ share: 1, outcomes: 1, fresh: false }];
      const newInstalls = isNew ? Math.round(installs * 0.42) : 0;
      const newActions = isNew ? Math.round(actions * 0.42) : 0;
      const newClicks = isNew ? Math.round(clicks * 0.42) : 0;
      const newImpressions = isNew ? Math.round(impressions * 0.3) : 0;
      parts.forEach(part => raw.push({ Date: date, Country: "KR", Platform: "iOS", Channel: campaign.channel,
        "Campaign ID": `campaign-${index}`, "Campaign name": campaign.name,
        "Creative ID": part.fresh ? (index === 0 ? (en ? "Customer review video" : "고객 후기 영상") : (en ? "Feature comparison" : "기능 비교 이미지")) : (en ? `Established creative ${index + 1}` : `기존 소재 ${index + 1}`),
        Cost: cost * part.share, Installs: part.fresh ? newInstalls : installs - newInstalls,
        Actions: part.fresh ? newActions : actions - newActions, Clicks: part.fresh ? newClicks : clicks - newClicks,
        Impressions: part.fresh ? newImpressions : impressions - newImpressions }));
    });
  }
  const mapping = { Date: "date", Country: "country", Platform: "platform", Channel: "channel", "Campaign ID": "campaign_id",
    "Campaign name": "campaign_name", "Creative ID": "creative_id", Cost: "cost", Installs: "installs", Actions: "actions", Clicks: "clicks", Impressions: "impressions" };
  return { raw, headers: Object.keys(mapping), mapping, currency: "KRW", importSource: "demo", fileName: "demo_operations_98days.csv" };
}
