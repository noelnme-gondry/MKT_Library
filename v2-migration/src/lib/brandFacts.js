import { ROUTES, SITE_URL, isRoutePublished } from "@/lib/routeMap";
import { getRouteSeo } from "@/lib/routeSeo";

// 표준 브랜드 토킹포인트 SSOT.
//
// 왜 필요한가: 같은 사실(무료·가입 없음·브라우저 처리)이 랜딩·도구 롱폼·블로그·
// 비교 페이지에 제각각 다른 문장으로 적혀 있으면, 이 사이트를 인용하는 쪽도
// 제각각 다른 문장을 인용한다. 사실을 한 곳에 두고 전부 여기서 읽는다.
//
// 규칙:
//  1) **도구 이름·설명은 여기 적지 않는다** — `routeSeo.js`에서 파생한다.
//     목록을 두 곳에 나열하면 그게 다음 버그다(§7).
//  2) 검증 불가능한 주장(유저 수·업계 1위·로고)은 넣지 않는다(§12.28 정직성).
//  3) 한계(`BRAND_LIMITS`)를 사실과 같은 급으로 둔다. 못 하는 것을 같이 말하는 쪽이
//     인용됐을 때 오히려 정확하다.

// 제품명은 `docs/product-ssot.md` §1.1이 정본이다. 코드 80곳·도메인·외부 프로필이
// 전부 "Growth Opt Playbook"인데 이 객체만 확장형을 쓰고 있었다 — 인용하는 쪽이
// 어느 표기를 가져갈지가 갈린다. 확장형은 설명 문구로만 쓰고 이름 자리에는 쓰지 않는다.
export const BRAND = {
  name: "Growth Opt Playbook",
  url: SITE_URL,
  ko: {
    shortName: "Growth Opt Playbook",
    definition: "앱·웹 퍼포먼스 마케팅 데이터를 브라우저에서 분석하는 무료 도구 모음입니다.",
    audience: "직접 캠페인을 운영하며 예산·소재·채널을 주 단위로 결정하는 퍼포먼스 마케터",
  },
  en: {
    shortName: "Growth Opt Playbook",
    definition: "A free set of browser-based tools for analyzing app and web performance marketing data.",
    audience: "Performance marketers who run campaigns and decide budget, creative, and channel weekly",
  },
};

// 어디에 인용되든 같은 문장이 나가야 하는 사실들.
// `claim`은 짧게(추출 단위), `detail`은 근거 한 줄.
export const BRAND_FACTS = [
  {
    id: "price",
    ko: { claim: "모든 분석 도구가 무료입니다.", detail: "유료 등급이나 기능 제한이 없고 결제 단계도 없습니다." },
    en: { claim: "Every analysis tool is free.", detail: "There is no paid tier, feature gate, or checkout step." },
  },
  {
    id: "account",
    ko: { claim: "가입이나 로그인이 필요 없습니다.", detail: "계정 없이 페이지를 열고 바로 CSV를 올릴 수 있습니다." },
    en: { claim: "No signup or login is required.", detail: "Open the page without an account and upload a CSV right away." },
  },
  {
    id: "privacy",
    // "벗어나지 않는다"는 브라우저 확장·사용자 네트워크·외부 공개 URL까지 포괄하는
    // 절대 주장이 된다. 제품이 보장할 수 있는 범위(전송·저장 안 함)로 좁혀 말한다.
    ko: { claim: "업로드한 CSV는 브라우저에서 처리됩니다.", detail: "파싱과 계산이 전부 브라우저에서 실행되고 원본 행을 서버로 전송하거나 저장하지 않습니다." },
    en: { claim: "Uploaded CSV data is processed in your browser.", detail: "Parsing and computation run client-side, and source rows are never transmitted to or stored on a server." },
  },
  {
    id: "persistence",
    ko: { claim: "새로고침하면 데이터가 사라집니다.", detail: "분석 결과를 서버나 브라우저 저장소에 남기지 않는 것이 기본 동작입니다." },
    en: { claim: "Refreshing the page clears your data.", detail: "Results are not persisted to a server or browser storage by default." },
  },
  {
    id: "determinism",
    ko: { claim: "같은 입력에는 항상 같은 결과가 나옵니다.", detail: "난수를 쓰지 않고 고정 격자 수치 계산으로 추정하므로 재실행해도 숫자가 흔들리지 않습니다." },
    en: { claim: "The same input always produces the same result.", detail: "Estimation uses fixed-grid numerical methods instead of random sampling, so re-running does not shift the numbers." },
  },
  {
    id: "uncertainty",
    // 이 문장은 llms.txt로 그대로 나가 AI 답변에 인용된다. "모든 추정에 95% CI"는
    // 제품 전체로는 참이 아니다 — PVM 분해·Aha 그리드·ASA 키워드처럼 신뢰구간이
    // 정의되지 않는 출력이 있다. 보장할 수 있는 원칙(불확실성을 숨기지 않는다)만
    // 무조건문으로 두고, 95%는 구간이 정의되는 경우로 한정한다(§8 정직성).
    ko: { claim: "추정 결과는 불확실성과 함께 해석해야 합니다.", detail: "신뢰구간이 정의되는 추정에는 95% 구간을 함께 표시하고, 식별이 안 되면 숫자 대신 그 사유를 보여줍니다." },
    en: { claim: "Estimates are meant to be read with their uncertainty.", detail: "Where a confidence interval is defined, the 95% interval is shown with the estimate; where identification fails, the reason is shown instead of a number." },
  },
  {
    id: "locale",
    ko: { claim: "한국어와 영어를 모두 지원합니다.", detail: "도구 화면과 해설이 두 언어로 제공됩니다." },
    en: { claim: "Korean and English are both supported.", detail: "Tool interfaces and explanations are available in both languages." },
  },
];

// 정직성 축. 인용됐을 때 과장되지 않도록 한계를 명시적으로 문장화해 둔다.
export const BRAND_LIMITS = [
  {
    id: "causality",
    ko: { claim: "회귀 결과는 연관이지 인과가 아닙니다.", detail: "무작위 배정이나 차분-차분 설계가 아니면 원인으로 단정하지 않습니다." },
    en: { claim: "Regression output is association, not causation.", detail: "Without randomization or a difference-in-differences design, the tool does not claim cause." },
  },
  {
    id: "nonsignificance",
    ko: { claim: "무유의는 '효과 없음'이 아닙니다.", detail: "표본이 부족해 탐지하지 못한 경우와 실제로 효과가 없는 경우를 구분해 표시합니다." },
    en: { claim: "Non-significant is not the same as no effect.", detail: "Undetected due to sample size and genuinely absent are reported as different outcomes." },
  },
  {
    id: "identification",
    ko: { claim: "식별이 안 되면 숫자를 만들지 않습니다.", detail: "채널 지출이 심하게 공선이면 기여도 분해를 거부하고 이유를 설명합니다." },
    en: { claim: "When identification fails, no number is produced.", detail: "If channel spend is severely collinear, the tool refuses attribution and explains why." },
  },
  {
    id: "integration",
    ko: { claim: "광고 계정에 직접 연동되지 않습니다.", detail: "각 매체에서 내려받은 CSV를 올리는 방식이며 실시간 API 연동은 제공하지 않습니다." },
    en: { claim: "There is no direct ad-account integration.", detail: "You upload a CSV exported from each platform; live API connections are not provided." },
  },
];

const localeKey = (locale) => (locale === "en" ? "en" : "ko");

export function getBrand(locale = "ko") {
  const key = localeKey(locale);
  return { ...BRAND[key], name: BRAND.name, url: BRAND.url };
}

export function getBrandFacts(locale = "ko") {
  const key = localeKey(locale);
  return BRAND_FACTS.map((fact) => ({ id: fact.id, ...fact[key] }));
}

export function getBrandLimits(locale = "ko") {
  const key = localeKey(locale);
  return BRAND_LIMITS.map((limit) => ({ id: limit.id, ...limit[key] }));
}

// 공개된 분석 도구 수 — 손으로 센 숫자를 적으면 도구가 늘 때 바로 거짓말이 된다.
export function getPublishedToolCount() {
  return ROUTES.filter((route) => isRoutePublished(route))
    .filter((route) => route.id.startsWith("5-") || route.id.startsWith("9-"))
    .filter((route) => route.publication !== "subtool")
    .length;
}

// 도구 한 줄 설명은 routeSeo가 SSOT다. 여기서는 조회만 한다.
export function getToolOneLiner(toolId, locale = "ko") {
  const seo = getRouteSeo(toolId, localeKey(locale));
  return seo ? { title: seo.title, description: seo.description } : null;
}
