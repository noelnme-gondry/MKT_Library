/* ============================================================
 * topicClusters — 발행 글을 6개 주제 허브로 묶는 SSOT
 *
 * 왜 필요했나: 43편의 인바운드 내부링크 **중앙값이 1회**였고 10편은 0회였다.
 * 내부 링크는 검색엔진이 "이 사이트에서 뭐가 중요한가"를 읽는 신호인데,
 * 글끼리 서로 안 가리키면 285개 URL에 권위가 얇게 발라져 어느 것도 경쟁력이
 * 없어진다. 색인은 되는데 순위가 안 나오는 상태의 전형적인 모양이다.
 *
 * 구조: 클러스터마다 **필라 1편 + 멤버 N편**.
 *  - 필라 화면 → 멤버 전체 링크 (멤버가 최소 1개의 인바운드를 보장받는다)
 *  - 멤버 화면 → 필라 링크 + 형제 글 몇 개 (필라로 신호가 모인다)
 *
 * 목록을 손으로 나열하는 대신 **역인덱스를 파생**한다. 커버리지는
 * `topicClusters.test.js`가 `getAllPosts`에서 파생해 강제하므로, 새 글을
 * 여기 등록하지 않으면 테스트가 잡는다(§7 — 손으로 센 목록은 가드가 아니다).
 * ============================================================ */

export const TOPIC_CLUSTERS = [
  {
    id: "causal",
    pillar: "incrementality-measurement",
    ko: { title: "인과와 증분", blurb: "광고가 실제로 만든 몫을 가려내는 글 모음이에요." },
    en: { title: "Causality and incrementality", blurb: "Separating what advertising actually caused from what it merely got credit for." },
    members: [
      "ab-testing",
      "brand-campaign-lift",
      "cannibalization-organic-paid",
      "correlation-vs-causation",
      "marketing-mix-modeling",
      "multicollinearity-mmm-guide",
      "offline-ad-online-impact",
      "uplift-holdout-guide",
    ],
  },
  {
    id: "budget",
    pillar: "budget-marginal-efficiency",
    ko: { title: "예산과 효율", blurb: "얼마를 어디에 쓸지 정하는 기준을 다룬 글이에요." },
    en: { title: "Budget and efficiency", blurb: "Deciding how much to spend and where." },
    members: [
      "budget-scaling-limit",
      "cpi-cpa-cpm-difference",
      "ltv-cac-ratio",
      "performance-marketing-metrics",
      "roas-improvement",
    ],
  },
  {
    id: "creative",
    pillar: "ad-creative-testing",
    ko: { title: "소재와 크리에이티브", blurb: "무엇을 만들지, 언제 갈지 정하는 글이에요." },
    en: { title: "Creative", blurb: "What to make, and when to rotate it." },
    members: [
      "ad-creative-specs-guide",
      "ad-performance-diagnosis",
      "content-element-analysis",
      "creative-attribute-regression",
      "hook-3-seconds-framework",
    ],
  },
  {
    id: "measurement",
    pillar: "attribution-data-mismatch",
    ko: { title: "측정 인프라", blurb: "숫자를 믿을 수 있게 만드는 배관 작업이에요." },
    en: { title: "Measurement plumbing", blurb: "The work that makes the numbers trustworthy in the first place." },
    members: [
      "event-taxonomy-guide",
      "ga4-data-traps",
      "ios-att-skan-guide",
      "postback-integration-guide",
      "skan-conversion-value-schema",
      "skan-vs-mmp-attribution",
      "skan4-migration-guide",
    ],
  },
  {
    id: "channels",
    pillar: "ad-machine-learning",
    ko: { title: "매체 운영", blurb: "자동입찰 시대에 채널별로 실제 남은 레버를 다뤄요." },
    en: { title: "Channel operations", blurb: "The levers that still belong to you in an automated-bidding world." },
    members: [
      "apple-search-ads-guide",
      "asa-keyword-expansion",
      "aso-basics-guide",
      "audience-broad-vs-narrow",
      "google-uac-optimization",
      "meta-advantage-plus-guide",
      "retargeting-reengagement-guide",
      "store-conversion-drop-diagnosis",
      "store-listing-experiment",
    ],
  },
  {
    id: "diagnosis",
    pillar: "performance-marketing-analysis-order",
    ko: { title: "진단과 그로스", blurb: "숫자가 흔들릴 때 어디부터 볼지 정하는 글이에요." },
    en: { title: "Diagnosis and growth", blurb: "Where to look first when the numbers move." },
    members: [
      "aha-event-ad-optimization",
      "aha-moment-retention",
      "ai-era-marketer",
      "campaign-anomaly-detection",
      "cohort-analysis-guide",
      "funnel-dropoff-analysis",
      "performance-marketer-skills",
    ],
  },
];

// 역인덱스 — 두 곳에 나열하지 말고 파생시킨다(§7).
const CLUSTER_BY_SLUG = TOPIC_CLUSTERS.reduce((acc, cluster) => {
  acc[cluster.pillar] = cluster;
  for (const slug of cluster.members) acc[slug] = cluster;
  return acc;
}, {});

export function clusterForPost(slug) {
  return CLUSTER_BY_SLUG[slug] || null;
}

export function isPillar(slug) {
  return TOPIC_CLUSTERS.some((cluster) => cluster.pillar === slug);
}

/** 클러스터에 등록된 전체 슬러그(필라 포함). 커버리지 가드가 이걸 쓴다. */
export function allClusteredSlugs() {
  return TOPIC_CLUSTERS.flatMap((cluster) => [cluster.pillar, ...cluster.members]);
}

/**
 * 한 글이 화면에 그릴 링크를 만든다.
 *  - 필라: 멤버 전체(멤버의 인바운드를 보장)
 *  - 멤버: 필라 + 형제 일부(신호를 필라로 모으고 옆으로도 흘린다)
 * 형제 선택은 **결정론적**이어야 한다 — 빌드마다 링크가 바뀌면 크롤러가
 * 구조를 못 읽는다. 등록 순서에서 자기 다음부터 순환으로 고른다.
 */
export function clusterLinksFor(slug, { siblingLimit = 4 } = {}) {
  const cluster = clusterForPost(slug);
  if (!cluster) return null;
  if (cluster.pillar === slug) {
    return { cluster, role: "pillar", pillar: null, siblings: cluster.members };
  }
  const index = cluster.members.indexOf(slug);
  const rotated = [...cluster.members.slice(index + 1), ...cluster.members.slice(0, index)];
  return { cluster, role: "member", pillar: cluster.pillar, siblings: rotated.slice(0, siblingLimit) };
}
