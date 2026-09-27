import { idToSlug } from "./routeMap";

const guide = (id, ko, en) => ({ id, ko, en });
const ios = guide("1-4", "iOS 측정 기준 확인하기", "Check iOS measurement requirements");
const nextSteps = {
  "ios-att-skan-guide": ios,
  "skan-vs-mmp-attribution": ios,
  "skan-conversion-value-schema": ios,
  "skan4-migration-guide": ios,
  "postback-integration-guide": guide("1-3", "연동 점검 항목 열기", "Open the integration checklist"),
  "attribution-data-mismatch": guide("1-3", "수집·전달 기준 확인하기", "Check collection and delivery rules"),
  "ga4-data-traps": guide("4-1", "지표 해석 기준 확인하기", "Check metric interpretation rules"),
  "event-taxonomy-guide": guide("1-2", "이벤트 설계·QA 확인하기", "Review event design and QA"),
  "ad-creative-specs-guide": guide("3-2", "매체별 소재 규격 확인하기", "Check creative specifications"),
  "ai-era-marketer": guide("4-1", "실무 분석 기준 살펴보기", "Explore practical analysis criteria"),
};

export function blogSelfCheckNext(slug, locale = "ko") {
  const next = nextSteps[slug];
  if (!next) return null;
  const en = locale === "en";
  return { href: `${en ? "/en" : ""}${idToSlug[next.id]}`, label: next[en ? "en" : "ko"] };
}
