// 실제 운영 자료가 아닌, 모든 진입점이 공유하는 결정적 가상 리포트.
// 합계는 캠페인×일에서 생성하고 소재별로 나눈다. 정수 성과·클릭을 보존한다.
import { seededNoise } from "@/utils/testFixtures";

export const OPERATIONS_TOOL_ID = "5-31";
export const OPERATIONS_PATH = "/tools/operations-planner";

export function buildOperationsDemo(locale = "ko") {
  const en = locale === "en";
  const campaigns = [
    { name: en ? "Meta · New customers" : "Meta · 신규 고객", channel: "Meta", base: 800, slope: 0.0014, spend: 240000 },
    { name: en ? "Meta · Retargeting" : "Meta · 리타겟팅", channel: "Meta", base: 2000, slope: 0.005, spend: 180000 },
    { name: en ? "Google · App discovery" : "Google · 앱 탐색", channel: "Google", base: 1100, slope: 0.0025, spend: 220000 },
    { name: en ? "TikTok · Product demo" : "TikTok · 제품 시연", channel: "TikTok", base: 1600, slope: 0.003, spend: 120000 },
  ];
  const noise = seededNoise(20261011);
  const weekdays = [0.98, 1.02, 1.01, 1.03, 1, 0.95, 0.93];
  const raw = [];
  for (let day = 0; day < 98; day++) {
    const date = new Date(Date.UTC(2026, 6, 1 + day)).toISOString().slice(0, 10);
    campaigns.forEach((campaign, index) => {
      // 요일·완만한 운영 변화·독립적인 일별 변동을 합친다. 고정 주기의 톱니를 반복하지 않는다.
      const cost = Math.round(campaign.spend * (weekdays[(day + 3) % 7] + 0.14 * Math.sin(day / 13 + index) + 0.8 * noise()));
      const recentShift = index === 1 ? 1 + 0.3 * Math.max(0, Math.min(1, (day - 87) / 7))
        : index === 3 ? 1 + 0.13 * Math.max(0, Math.min(1, (day - 89) / 7)) : 1;
      const dailyEfficiency = 1 + 0.045 * noise() + 0.012 * Math.sin(day / 5 + index);
      const installs = Math.round(cost / ((campaign.base + cost * campaign.slope) * recentShift * dailyEfficiency));
      const actions = Math.round(installs * (0.59 + 0.08 * noise()));
      // 리타겟팅은 설치 전환율, TikTok은 노출 단가 변화가 단계별 비교에 나타난다.
      const clicks = Math.round(installs * (index === 1 ? 8 * recentShift : 8) * (1 + 0.06 * noise()));
      const impressions = Math.round(clicks / ((index === 3 ? 0.014 * recentShift : 0.022) * (1 + 0.08 * noise())));
      const firstDay = index === 0 ? 91 : index === 2 ? 93 : Infinity;
      const isNew = day >= firstDay;
      const share = isNew ? 0.13 + (day - firstDay) * 0.025 + 0.025 * noise() : 0;
      // 후기 영상은 낮은 단가, 기능 비교 이미지는 높은 단가. 첫 관측일·지출·성과도 서로 다르다.
      const relativeRate = index === 0 ? 1.24 + 0.1 * noise() : 0.86 + 0.1 * noise();
      const resultShare = share * relativeRate / (1 - share + share * relativeRate);
      const newCost = Math.round(cost * share);
      const newInstalls = Math.round(installs * resultShare);
      const newActions = Math.round(newInstalls * (index === 0 ? 0.64 : 0.56));
      const newClicks = Math.round(clicks * share * (index === 0 ? 1.08 : 0.96));
      const newImpressions = Math.round(impressions * share * (1 + 0.06 * noise()));
      (isNew ? [false, true] : [false]).forEach(fresh => raw.push({ Date: date, Country: "KR", Platform: "iOS", Channel: campaign.channel,
        "Campaign ID": `campaign-${index}`, "Campaign name": campaign.name,
        "Creative ID": fresh ? (index === 0 ? (en ? "Customer review video" : "고객 후기 영상") : (en ? "Feature comparison" : "기능 비교 이미지")) : (en ? `Established creative ${index + 1}` : `기존 소재 ${index + 1}`),
        Cost: fresh ? newCost : cost - newCost, Installs: fresh ? newInstalls : installs - newInstalls,
        Actions: fresh ? newActions : actions - newActions, Clicks: fresh ? newClicks : clicks - newClicks,
        Impressions: fresh ? newImpressions : impressions - newImpressions }));
    });
  }
  const mapping = { Date: "date", Country: "country", Platform: "platform", Channel: "channel", "Campaign ID": "campaign_id",
    "Campaign name": "campaign_name", "Creative ID": "creative_id", Cost: "cost", Installs: "installs", Actions: "actions", Clicks: "clicks", Impressions: "impressions" };
  return { raw, headers: Object.keys(mapping), mapping, currency: "KRW", importSource: "demo", fileName: "demo_operations_98days.csv" };
}
