// Public, bilingual walkthroughs that use the tool's own example data.
export const TOOL_BLOG_GUIDES = {
  "operations-planner-guide": {
    toolId: "5-31",
    ko: { title: "운영 플래너로 다음 주 캠페인 예산을 정하는 법", answer: "현재 지출과 조정 후 지출에서 예상되는 설치 수를 캠페인별로 비교합니다. 제안 금액 근처에 실제 집행 기록이 있는지까지 보면 어느 캠페인부터 시험할지 정할 수 있습니다.", action: "7일 예산 재배분 예시 열기", preview: "한 캠페인에 예산을 더 주면 다른 캠페인에서 포기하는 설치보다 더 많이 얻을 수 있을까요? 같은 총액으로 두 예산안의 예상 설치를 비교합니다." },
    en: { title: "How the Operations planner compares next week’s campaign budgets", answer: "Estimate both the installs gained by recipients and the installs lost by the campaigns funding them. Check how often each campaign has spent near the proposal before deciding what to test.", action: "Compare the seven-day campaign plans", preview: "Compare what extra spend could buy in one campaign with the installs you might give up in another, keeping the total budget fixed." },
  },
  "mmm-contribution-tool-guide": {
    toolId: "5-18-mmm",
    ko: { title: "MMM으로 채널별 기여도를 어디까지 설명할 수 있을까", answer: "MMM은 가입 추세와 계절성, 과거 광고비의 잔존 효과를 함께 추정합니다. 채널 기여도가 커도 지금 더 쓸 여력이 있는지는 최근 지출 근처의 반응곡선에서 확인해야 합니다.", action: "주별 가입과 Google 반응곡선 보기", preview: "가입이 늘어난 주에 광고비도 늘었다면 추세와 계절을 먼저 살펴보세요. 주별 기여도와 채널별 반응곡선에서 증액을 시험할 근거를 찾을 수 있습니다." },
    en: { title: "What MMM can tell you about channel contribution", answer: "MMM estimates baseline demand, seasonal movements and media carryover together. To judge a spending increase, inspect the response near today’s budget and the uncertainty around it.", action: "Explore weekly sign-ups and the Google response curve", preview: "Read the weekly breakdown alongside the channel response curve to see how much of a rise in sign-ups the model assigns to media, and what a spending test could tell you." },
  },
  "budget-allocation-tool-guide": {
    toolId: "5-3",
    ko: { title: "광고비를 줄이고도 설치 목표를 지킬 수 있을까? 예산 배분 도구 사용법", answer: "전체 설치 단가와 하루 설치 수를 함께 보면 예산을 줄이고도 필요한 물량을 확보할 수 있는지 판단할 수 있습니다. 각 시장의 증감은 같은 모델로 계산한 두 예산안을 기준으로 비교합니다.", action: "일예산을 바꾼 두 안 비교하기", preview: "설치 단가가 내려가도 총예산을 줄이면 목표 물량에 못 미칠 수 있습니다. 현재안과 변경안의 하루 설치 수를 함께 비교하세요." },
    en: { title: "How to compare budget allocations when efficiency and volume compete", answer: "Compare total daily installs with your volume floor, then examine the extra installs and spending in each market. Model both budgets on the same basis so forecast error does not count as a gain.", action: "Compare daily installs under both allocations", preview: "A lower cost per install can still leave you short of your volume target. Compare daily installs as well as unit cost before choosing a budget." },
  },
};

export function mapToolBlogGuides(select) {
  return Object.fromEntries(Object.entries(TOOL_BLOG_GUIDES).map(([slug, guide]) => [slug, select(guide)]));
}
