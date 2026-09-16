// QA 회귀 픽스처 (2026-09-16 분석 정확성 감사) — 손으로 정답을 계산할 수 있는
// 최소 데이터. 여러 도구가 같은 CSV를 읽을 때 같은 숫자를 내는지 검증하는 데 쓴다.
// 수학 엔진은 건드리지 않는다(§11) — 픽스처는 오라클일 뿐이다.

// 한 행, 손계산 정답: CPM 100 · CTR 10% · CPC 1 · CPI 5 · CVR 20% · ROAS 300%
export const BASIC_ROW = Object.freeze({
  cost: 100, impressions: 1000, clicks: 100, installs: 20, actions: 10,
  revenue_d7: 300, pu_d7: 5,
});
export const BASIC_EXPECTED = Object.freeze({
  cpm: 100, ctr: 0.1, cpc: 1, cpi: 5, cvr: 0.2, roas: 3, arpu: 15, cpp: 20,
});

// 비대칭 가중 픽스처 — 단순평균 CPA(=50)와 가중 CPA(=50)가 우연히 같아지지
// 않도록 결과 수를 다르게 둔다. 정답: 1,000 / 30 = 33.333…
export const ASYMMETRIC_ROWS = Object.freeze([
  Object.freeze({ cost: 100, installs: 20 }),
  Object.freeze({ cost: 900, installs: 10 }),
]);
export const ASYMMETRIC_WEIGHTED_CPI = 1000 / 30;
export const ASYMMETRIC_NAIVE_MEAN_CPI = (100 / 20 + 900 / 10) / 2; // 47.5 — 틀린 값

// 지저분한 숫자 표기. canonical(normalizeNumericValue) 기준 기대값.
// null = "읽을 수 없음"이 정답(0으로 뭉개거나 다른 숫자로 읽으면 거짓 숫자다).
export const DIRTY_NUMBERS = Object.freeze([
  Object.freeze({ input: "1,000", expected: 1000 }),
  Object.freeze({ input: " 1,000 ", expected: 1000 }),
  Object.freeze({ input: "1 000", expected: 1000 }),
  Object.freeze({ input: "₩1,000", expected: 1000 }),
  Object.freeze({ input: "$1,000.25", expected: 1000.25 }),
  Object.freeze({ input: "(100)", expected: -100 }),
  Object.freeze({ input: "-100", expected: -100 }),
  Object.freeze({ input: "1e3", expected: 1000 }),
  // 유럽식 소수 구분자. 1000.25가 정답이지만 판별 근거가 없으므로 거부가 정답.
  Object.freeze({ input: "1.000,25", expected: null }),
  Object.freeze({ input: "abc", expected: null }),
  Object.freeze({ input: "", expected: null }),
]);

// 14일 효율 CSV. revenue_d7은 평평하고 revenue_d30은 증가 — 코호트 선택이
// 결과를 바꾸는지 확인하는 데 쓴다. Actions는 Installs와 달라 분모 기준 전환도 검증한다.
export function buildEfficiencyCsv({ days = 14 } = {}) {
  const raw = [];
  for (let i = 0; i < days; i += 1) {
    raw.push({
      Date: `2026-07-${String(i + 1).padStart(2, "0")}`,
      Channel: i % 2 === 0 ? "Meta" : "Google",
      Cost: "1000", Impressions: "10000", Clicks: "500",
      Installs: "100", Actions: "25",
      RevenueD7: "1000", RevenueD30: String(1000 + i * 500),
    });
  }
  const mapping = {
    Date: "date", Channel: "channel", Cost: "cost", Impressions: "impressions",
    Clicks: "clicks", Installs: "installs", Actions: "actions",
    RevenueD7: "revenue_d7", RevenueD30: "revenue_d30",
  };
  return { raw, headers: Object.keys(mapping), mapping, fileName: "qa-efficiency.csv" };
}

// A/B 저전환 픽스처 — 정규근사와 정확검정의 판정이 갈리는 구간(§8.11).
// z p=0.0218(유의) vs Fisher p=0.0563(비유의).
export const AB_LOW_CONVERSION = Object.freeze({ nA: 50, xA: 0, nB: 50, xB: 5 });
// 근사가 믿을 만한 구간 — 두 경로가 같은 판정을 내야 한다.
export const AB_LARGE_SAMPLE = Object.freeze({ nA: 1000, xA: 100, nB: 1000, xB: 120 });
