const field = (label, labelEn, type, aliases = []) => ({ label, labelEn, type, aliases: [label, labelEn, ...aliases], group: type === "number" ? "단일 지표" : "디멘션" });
// Exact instants are strings: the legacy date normalizer intentionally discards
// time-of-day, which would destroy ordered events and experimental histories.
export const ADVANCED_FIELDS = {
  transaction_id: field("거래 ID", "Transaction ID", "string", ["transaction id", "거래번호", "거래ID"]),
  order_id: field("주문 ID", "Order ID", "string", ["order id", "주문번호", "주문ID"]),
  customer_id: field("고객 ID", "Customer ID", "string", ["customer id", "고객번호", "고객ID"]),
  recorded_at: field("거래 기록 시각", "Transaction timestamp", "string", ["recorded at", "transaction_date", "거래일", "기록시각"]),
  net_revenue: field("할인·환불 후 순매출", "Net revenue after discounts/refunds", "number", ["net revenue", "순매출"]),
  variable_cost: field("변동비", "Variable cost", "number", ["variable cost", "변동원가"]),
  acquisition_cost: field("고객 최초 획득비", "Initial customer acquisition cost", "number", ["acquisition cost", "획득비"]),
  currency_code: field("통화 코드", "Currency code", "string", ["currency code", "currency", "통화"]),
  event_id: field("이벤트 ID", "Event ID", "string", ["event id", "이벤트ID"]),
  user_id: field("사용자 ID", "User ID", "string", ["user id", "사용자ID"]),
  event_time: field("이벤트 시각 (시간대 포함)", "Event time (with timezone)", "string", ["event time", "event_timestamp", "이벤트시각"]),
  event_name: field("이벤트명", "Event name", "string", ["event name", "이벤트이름"]),
  unit_id: field("배정 단위 ID", "Assignment unit ID", "string", ["unit id", "배정단위"]),
  treatment: field("처치 여부 (0/1)", "Treatment (0/1)", "string", ["treatment arm", "처치여부"]),
  baseline: field("사전 지표", "Baseline outcome", "number", ["pre outcome", "사전지표"]),
  outcome: field("결과 지표", "Outcome", "number", ["outcome value", "결과지표"]),
  segment: field("사전 세그먼트", "Pre-treatment segment", "string", ["segment name", "세그먼트"]),
  sample_role: field("학습/평가 역할", "Train/evaluation role", "string", ["sample role", "표본역할"]),
  region: field("지역", "Region", "string", ["region name", "geo", "지역명"]),
  deal_id: field("딜 ID", "Deal ID", "string", ["deal id", "딜번호"]),
  stage: field("딜 단계", "Deal stage", "string", ["deal stage", "단계"]),
  amount: field("딜 금액", "Deal amount", "number", ["deal amount", "딜금액"]),
  respondent_id: field("응답자 ID", "Respondent ID", "string", ["respondent id", "응답자ID"]),
  task_id: field("선택 문항 ID", "Choice task ID", "string", ["task id", "문항ID"]),
  alternative_id: field("선택 대안 ID", "Alternative ID", "string", ["alternative id", "대안ID"]),
  chosen: field("선택 여부 (0/1)", "Chosen (0/1)", "number", ["choice", "선택여부"]),
  price: field("제시 가격", "Presented price", "number", ["offered price", "가격"]),
  attribute_1: field("수치 속성 1", "Numeric attribute 1", "number", ["attribute 1", "속성1"]),
  attribute_2: field("수치 속성 2", "Numeric attribute 2", "number", ["attribute 2", "속성2"]),
  attribute_3: field("수치 속성 3", "Numeric attribute 3", "number", ["attribute 3", "속성3"]),
  product_id: field("상품 ID", "Product ID", "string", ["product id", "sku", "상품번호"]),
  quantity: field("구매/반품 수량", "Purchase/return quantity", "number", ["qty", "수량"]),
  period: field("동일 관측 기간", "Common observation period", "string", ["period label", "관측기간"]),
  frequency: field("정확한 노출 빈도", "Exact exposure frequency", "number", ["exact frequency", "빈도"]),
  audience_count: field("빈도별 도달 수", "Audience count by frequency", "number", ["audience count", "도달수"]),
  invalid_clicks: field("무효 클릭", "Invalid clicks", "number", ["invalid clicks", "무효클릭"]),
  conversions: field("전환 수", "Conversions", "number", ["conversion count", "전환건수"]),
};

// Semantic mapping describes the same raw input contract; exact instants remain
// strings so projection cannot truncate event order. Tool engines validate signs.
export function advancedSemanticField(key, value) {
  const identifier = key.endsWith("_id");
  const time = ["event_time", "recorded_at"].includes(key);
  const currency = ["net_revenue", "variable_cost", "acquisition_cost", "amount", "price"].includes(key);
  return {
    family: identifier ? "IDENTIFIER" : time ? "TIME" : value.type === "number" ? "FEATURE" : "DIMENSION",
    valueType: value.type, unitFamily: identifier ? "identifier" : time ? "timestamp" : currency ? "currency" : value.type === "number" ? "number" : "category",
    aggregation: "none", allowedSigns: "any", requiresConfirmation: ["baseline", "outcome", "treatment", "segment", "sample_role"].includes(key),
  };
}
