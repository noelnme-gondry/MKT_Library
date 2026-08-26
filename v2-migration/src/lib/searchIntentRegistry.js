import { idToPath } from "@/lib/routeMap";

const node = (kind, id, role, koLabel, enLabel) => ({
  kind,
  id,
  role,
  ko: { label: koLabel },
  en: { label: enLabel },
});

// 검색어 변형마다 새 페이지를 만들지 않고, 한 주제 안에서 URL의 책임을 나눈다.
// primary는 검색 질문에 바로 답하는 단 하나의 URL이고 supports는 더 깊은 진단과
// 실행 경로다. 용어집·블로그 상세의 화면 링크와 커버리지 테스트가 이 목록에서 함께 파생된다.
export const SEARCH_INTENT_CLUSTERS = [
  {
    id: "cannibalization",
    primary: node("glossary", "cannibalization", "definition", "카니발라이제이션 뜻과 잠식률", "Cannibalization definition and rate"),
    supports: [
      node("blog", "cannibalization-organic-paid", "diagnosis", "유료·오가닉 잠식 측정 방법", "How to measure paid-organic cannibalization"),
      node("route", "5-18-cannibal", "analysis", "내 데이터로 잠식 진단", "Diagnose cannibalization with your data"),
    ],
  },
  {
    id: "uplift",
    primary: node("glossary", "uplift", "definition", "업리프트 뜻과 계산법", "Uplift definition and calculation"),
    supports: [
      node("blog", "uplift-holdout-guide", "method", "홀드아웃으로 업리프트 측정", "Measure uplift with a holdout"),
      node("route", "5-23", "analysis", "홀드아웃·전후 증분 분석", "Run a holdout or pre-post analysis"),
    ],
  },
  {
    id: "incrementality",
    primary: node("glossary", "incrementality", "definition", "인크리멘탈리티·인크리멘탈 뜻", "Incrementality definition"),
    supports: [
      node("blog", "incrementality-measurement", "method", "증분성 측정 방법 비교", "Compare incrementality methods"),
      node("route", "5-23", "analysis", "내 데이터로 증분 분석", "Analyze incrementality with your data"),
    ],
  },
  {
    id: "holdout",
    primary: node("glossary", "holdout-test", "definition", "홀드아웃·홀드 아웃 테스트 뜻", "Holdout test definition"),
    supports: [
      node("blog", "uplift-holdout-guide", "method", "홀드아웃 실험 설계와 판독", "Design and read a holdout experiment"),
      node("route", "5-23", "analysis", "홀드아웃 결과 계산", "Calculate holdout results"),
    ],
  },
  {
    id: "cvr",
    primary: node("glossary", "cvr", "definition", "CVR 뜻과 계산식", "CVR definition and formula"),
    supports: [
      node("blog", "funnel-dropoff-analysis", "diagnosis", "전환율 하락 구간 진단", "Diagnose conversion-rate drop-off"),
      node("route", "5-2", "analysis", "퍼널과 전환율 분석", "Analyze funnel conversion"),
    ],
  },
  {
    id: "multicollinearity",
    primary: node("glossary", "multicollinearity", "definition", "다중공선성 뜻과 VIF", "Multicollinearity and VIF definition"),
    supports: [
      node("blog", "multicollinearity-mmm-guide", "diagnosis", "MMM에서 높은 VIF 해석", "Interpret high VIF before MMM"),
      node("route", "5-25", "analysis", "채널 지출 다중공선성 점검", "Check channel-spend multicollinearity"),
    ],
  },
  {
    id: "deep-link",
    primary: node("glossary", "deep-link", "definition", "딥링크·디퍼드 딥링크 뜻", "Deep link and deferred deep link definition"),
    supports: [
      node("blog", "postback-integration-guide", "diagnosis", "포스트백·딥링크 연동 오류 진단", "Diagnose postback and deep-link integration"),
      node("route", "1-1", "guide", "MMP SDK·딥링크 연동 체크리스트", "MMP SDK and deep-link integration checklist"),
    ],
  },
  {
    id: "event-taxonomy",
    primary: node("blog", "event-taxonomy-guide", "diagnosis", "이벤트 택소노미·SDK 오류 진단", "Event taxonomy and SDK error diagnosis"),
    supports: [
      node("route", "1-2", "guide", "인앱 이벤트 택소노미 설계서", "In-app event taxonomy specification"),
      node("glossary", "funnel", "definition", "퍼널 뜻과 단계 정의", "Funnel definition and stages"),
    ],
  },
];

export function intentContentKey(ref) {
  return `${ref.kind}:${ref.id}`;
}

export function intentHref(ref, locale = "ko") {
  const prefix = locale === "en" ? "/en" : "";
  if (ref.kind === "blog") return `${prefix}/blog/${ref.id}`;
  if (ref.kind === "glossary") return `${prefix}/glossary/${ref.id}`;
  if (ref.kind === "route") return `${prefix}${idToPath(ref.id)}`;
  return null;
}

export function intentClustersFor(kind, id) {
  const key = `${kind}:${id}`;
  return SEARCH_INTENT_CLUSTERS.filter((cluster) =>
    [cluster.primary, ...cluster.supports].some((ref) => intentContentKey(ref) === key),
  );
}

export function intentLinksFor(kind, id, locale = "ko") {
  const key = `${kind}:${id}`;
  const language = locale === "en" ? "en" : "ko";
  const links = intentClustersFor(kind, id).flatMap((cluster) => {
    const currentIsPrimary = intentContentKey(cluster.primary) === key;
    const targets = currentIsPrimary ? cluster.supports : [cluster.primary, ...cluster.supports];
    return targets
      .filter((ref) => intentContentKey(ref) !== key)
      .map((ref) => ({
        clusterId: cluster.id,
        role: ref.role,
        href: intentHref(ref, language),
        label: ref[language].label,
      }));
  });
  return [...new Map(links.map((link) => [link.href, link])).values()];
}
