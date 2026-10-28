/* ============================================================
 * 분석 찾기 카드의 쉬운 말(product-ssot §1.1c 4단계).
 *
 * 카드는 결론 예시(예시 데이터로 실제 계산한 문장)가 없으면 "보고서에 담기는 것"을
 * 보여 준다. 그 원문(toolSearchContent.outputs)은 검색 페이지용이라 Qini·HC3·OOS 같은
 * 방법 이름이 들어 있다 — 검색에는 필요하지만 처음 보는 사람에게는 암호다.
 * 여기서는 같은 결과를 쉬운 말로 다시 쓴다. 새 결과를 만들지 않는다: 항목 수와 순서는
 * 원문과 같고, 원문은 검색어로 남는다(toolIndex.searchText). 분석 찾기 카드·업로드 뒤 목록·도구 하단 목록이 모두 이 문구를 쓴다.
 *
 * question은 원문 질문이 방법 용어로 시작할 때만 둔다.
 * 커버리지: 결론 예시가 없는 카드는 모두 방법 약어 없이 읽혀야 한다(finderPlainCopy.test.js).
 * ============================================================ */

const t = (ko, en) => ({ ko, en });

export const FINDER_PLAIN_COPY = {
  "5-18-mmm": {
    outputs: [
      t("채널마다 성과를 만든 몫", "Each channel's share of the results"),
      t("광고 없이도 나왔을 기본 성과의 몫", "The share that would have come without ads"),
      t("채널마다 더 쓰면 얻는 추가 성과", "Extra results from more spend, by channel"),
    ],
  },
  "5-18-forecast": {
    outputs: [
      t("다음 기간 예상 성과와 오차 범위", "Next-period forecast with its range"),
      t("학습에 쓰지 않은 기간으로 맞춰 본 정확도", "Accuracy checked on weeks the model never saw"),
      t("예산 시나리오별 비교", "Comparison across budget scenarios"),
    ],
  },
  "5-18-cannibal": {
    outputs: [
      t("광고가 오가닉을 깎아 먹는지 보는 네 가지 신호", "Four signs that ads are taking from organic"),
      t("의심이 큰 채널 순서", "Channels ranked by suspicion"),
      t("광고를 잠시 꺼서 확인해 볼 후보", "Candidates for a short ad pause test"),
    ],
  },
  "5-42": {
    outputs: [
      t("몇 번씩 노출됐는지 분포", "How many times people saw the ads"),
      t("플랫폼을 합친 도달의 최소·최대 범위", "Lowest and highest possible combined reach"),
      t("같은 사람 중복을 뺄 수 있는 조건", "When overlap between platforms can be removed"),
    ],
  },
  "5-36": {
    outputs: [
      t("실험 지역과, 비슷하게 맞춘 비교 지역의 차이", "Gap between the test region and a matched comparison"),
      t("다른 지역에 가짜로 적용해 본 비교", "Fake-launch checks on other regions"),
      t("이 규모로 잡아낼 수 있는 가장 작은 효과", "Smallest effect this setup can detect"),
    ],
  },
  "5-34": {
    question: t("실험 전 기록을 쓰면 A/B 결과를 더 정확히 볼 수 있나요?", "Can pre-test data make an A/B result more precise?"),
    outputs: [
      t("실험 전 차이를 걸러 낸 효과", "The effect after removing pre-test differences"),
      t("효과의 오차 범위(95%)", "Error range for the effect (95%)"),
      t("줄어든 오차와 그룹 배정 점검", "How much noise dropped, and a group-split check"),
    ],
  },
  "5-30": {
    outputs: [
      t("다른 광고와 겹쳐 기록된 설치 비율(매체·캠페인별)", "Share of installs also touched by other ads, by media and campaign"),
      t("함께 기록된 채널과 경로", "Channels and paths recorded together"),
      t("클릭부터 설치까지 걸린 시간", "Time from click to install"),
    ],
  },
  "5-43": {
    outputs: [
      t("무효 클릭을 뺀 실제 클릭 효율", "Efficiency on valid clicks only"),
      t("무효 클릭 비율", "Share of invalid clicks"),
      t("평소보다 튀는 날짜", "Days that stand out from the past"),
    ],
  },
  "5-33": {
    outputs: [
      t("단계마다 넘어간 사용자 수", "Users who reached each step"),
      t("1일·7일·30일 뒤 다시 온 비율", "Share returning after 1, 7 and 30 days"),
      t("계산에 쓴 인원과 오차 범위", "Users counted and the error range"),
    ],
  },
  "5-32": {
    outputs: [
      t("최근 구매·구매 횟수·금액으로 나눈 고객과 순매출", "Customers grouped by recency, frequency and spend, with net revenue"),
      t("가입 후 같은 기간이 지난 고객끼리 비교", "Customers compared over the same time since joining"),
      t("획득비를 회수한 고객", "Customers who paid back their acquisition cost"),
    ],
  },
  "5-35": {
    outputs: [
      t("고객별 예상 구매 횟수·금액", "Expected purchases and spend per customer"),
      t("고객별로 남길 이익", "Profit each customer is likely to leave"),
      t("지난 기간으로 맞춰 본 예측 오차", "Forecast error checked on a held-back period"),
    ],
  },
  "5-37": {
    outputs: [
      t("고객군별로 연락했을 때 달라진 반응", "How each segment responded when contacted"),
      t("연락 대상을 고르는 방식이 무작위보다 얼마나 나은지", "How much better the targeting is than random"),
      t("그 방식으로 연락하면 더 남는 가치", "Extra value from contacting by that rule"),
    ],
  },
  "5-40": {
    outputs: [
      t("프로모션으로 늘어난 순매출", "Net revenue added by the promotion"),
      t("변동비를 뺀 이익(공헌이익)의 차이", "Difference in profit after variable costs"),
      t("두 차이의 오차 범위(95%)", "Error range for both differences (95%)"),
    ],
  },
  "5-41": {
    outputs: [
      t("두 상품이 함께 담긴 주문 비율", "Share of orders containing both products"),
      t("A를 산 주문에서 B도 산 비율과 오차 범위", "How often B is bought when A is, with its range"),
      t("우연보다 얼마나 자주 함께 팔리는지", "How much more often they sell together than by chance"),
    ],
  },
  "5-39": {
    outputs: [
      t("가격과 속성이 선택에 미친 영향", "How price and each attribute shift choice"),
      t("일부 응답자를 빼 두고 맞춰 본 정확도", "Accuracy checked on held-back respondents"),
      t("속성 하나의 가치를 금액으로 환산", "Each attribute's value in money"),
    ],
  },
  "5-38": {
    outputs: [
      t("단계마다 머물러 있는 딜 금액", "Deal value sitting in each stage"),
      t("같은 기간 안에 처음 수주한 비율", "Share first won within the same period"),
      t("뒤로 간 딜·다시 열린 딜·아직 결론 안 난 딜", "Deals that moved back, reopened or are still open"),
    ],
  },
};

const pick = (pair, locale) => (locale === "en" ? pair.en : pair.ko);

/** 카드에 보여 줄 쉬운 말. 없으면 null(원문을 쓴다). */
export function finderPlainCopy(toolId, locale = "ko") {
  const entry = FINDER_PLAIN_COPY[toolId];
  if (!entry) return null;
  return {
    question: entry.question ? pick(entry.question, locale) : null,
    outputs: entry.outputs.map((pair) => pick(pair, locale)),
  };
}
