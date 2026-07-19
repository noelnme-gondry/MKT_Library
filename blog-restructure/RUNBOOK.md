# 블로그 재구성 주간 배포 런북 (자동화용)

매주 월요일 09:00 KST(00:00 UTC) Routine이 이 파일을 읽고 해당 주차 작업을 수행한다.
전략·배경은 `master-plan.md`, EN 패치 원문은 `en-mirror-patches.md` 참조.
**이 폴더(`blog-restructure/`)는 스테이징 전용 — main에 머지하지 않는다.** 주차 배포 브랜치에는
아래 명시된 대상 파일만 담는다.

## 공통 절차 (매 주차)

1. `git fetch origin main` → `origin/main`에서 단명 브랜치 생성: `blog/restructure-w<N>`
2. 스테이징 브랜치(`claude/blog-changes-plan-gwmifr`)에서 해당 주차 파일만 추출:
   `git show origin/claude/blog-changes-plan-gwmifr:blog-restructure/<src> > v2-migration/content/<dst>`
3. 해당 주차의 삭제·리다이렉트·글로서리 작업(아래 표) 수행
4. 검증: `cd v2-migration && npm run lint && npm run build` — 오류 0 확인
   (기존 next.config.mjs NFT 트레이싱 경고 1건은 무관·무시)
5. `git add <명시 파일만>` → 커밋 → push → PR(base main) → squash merge → 브랜치 삭제
6. 이 파일 하단 "진행 로그"에 완료 기록 추가(스테이징 브랜치에 커밋·푸시)
7. 사용자에게 보고: 배포 내용 + Railway 1~2분 + **GSC 색인 재요청은 수동**(사용자 몫) +
   301 주차면 배포 후 `curl -sI https://growthoptplaybook.com/blog/<구슬러그>` 301 확인 안내

## 불변 원칙

- 슬러그(URL)·발행일(date) 불변. draft 전환 금지. 일괄 머지 금지(해당 주차 파일만).
- EN 파일의 `/blog/...` 링크는 렌더 시 `/en/blog/...`로 자동 재작성됨(blog.js) —
  EN에 없는 슬러그로는 절대 링크하지 말 것(스테이징 EN 완성본은 이미 처리됨).
- 스테이징 EN 완성본 3편은 2026-07-19 기준 원문에 패치 적용한 것 — 배포 전
  `git log --oneline -3 -- v2-migration/content/blog-en/<파일>`로 그 이후 원문 변경이
  있으면 덮어쓰지 말고 en-mirror-patches.md를 최신 원문에 수동 재적용.

## 주차별 작업표

| 주차 | 머지 월요일 | KR 배포 (batch→content/blog) | 삭제 | 리다이렉트 추가(next.config.mjs) | EN·기타 |
|---|---|---|---|---|---|
| 1 | 2026-07-20 | batch1: ad-performance-drop | campaign-anomaly-detection.md | `/blog/campaign-anomaly-detection` → `/blog/ad-performance-drop` (permanent) | EN #1: `en/ad-performance-drop.md` → content/blog-en/ |
| 2 | 2026-07-27 | batch1: ctr-improvement, ltv-cac-ratio | — | — | — |
| 3 | 2026-08-03 | batch1: funnel-dropoff-analysis | cvr-optimization.md | `/blog/cvr-optimization` → `/blog/funnel-dropoff-analysis` (permanent) | 글로서리 W3(아래) |
| 4 | 2026-08-10 | batch1: cohort-analysis-guide, performance-marketing-metrics, google-uac-optimization | cpi-cpa-cpm-difference.md | `/blog/cpi-cpa-cpm-difference` → `/blog/performance-marketing-metrics` (permanent) | EN #2: `en/performance-marketing-metrics.md` → content/blog-en/ · 글로서리 W4(아래) |
| 5 | 2026-08-17 | batch1: marketing-mix-modeling, ios-att-skan-guide | — | — | EN #3: `en/marketing-mix-modeling.md` → content/blog-en/ |
| 6 | 2026-08-24 | batch1: apple-search-ads-guide, aso-basics-guide, performance-marketer-skills | — | — | EN #4: blog-en/performance-marketer-skills.md 무변경 확인만(제목·훅 KR과 동일 앵글인지) |
| 7 | 2026-08-31 | batch2: cpa-reduction, roas-improvement, ga4-data-traps | — | — | **사용자 알림: 1주차분 GSC CTR 중간점검**(게이트, master-plan §5 — 판단은 사용자) |
| 8 | 2026-09-07 | batch2: scaling-pitfalls, creative-fatigue, attribution-data-mismatch | — | — | — |
| 9 | 2026-09-14 | batch2: marketing-budget-allocation, campaign-saturation-signals, junior-metrics-guide | — | — | — |
| 10 | 2026-09-21 | batch2: audience-broad-vs-narrow, ab-testing, incrementality-measurement | — | — | — |
| 11 | 2026-09-28 | batch2: ad-machine-learning, correlation-vs-causation, cannibalization-organic-paid | — | — | — |
| 12 | 2026-10-05 | batch2: meta-advantage-plus-guide, retargeting-reengagement-guide, event-taxonomy-guide | — | — | — |
| 13 | 2026-10-12 | batch2: postback-integration-guide, aha-moment-retention, hook-3-seconds-framework | — | — | — |
| 14 | 2026-10-19 | batch2: ad-creative-specs-guide, ai-era-marketer | — | — | **사용자 알림: 전체 리뷰 게이트**(제목교체 8편 CTR·통합 3편 커버리지·EN 갭 vs 신규 소재·Adjust vs AppsFlyer 초안 발행 판단 — master-plan §5) · 완료 후 **Routine 삭제** |

리다이렉트는 기존 `redirects()` 배열에 항목 추가(EN 리다이렉트 불필요 — EN 짝 없음).

## 글로서리 참조 정리 (삭제 주차 동반 — 같은 PR에 포함)

**W3 (cvr-optimization 삭제와 동시):**
- `v2-migration/content/glossary/cvr.md`: `relatedPosts: ["cvr-optimization"]` → `["funnel-dropoff-analysis"]`,
  본문 인라인 링크 `[CVR 개선 글](/blog/cvr-optimization)` → `[퍼널 이탈 분석 글](/blog/funnel-dropoff-analysis)`(문구 자연스럽게 조정)
- `v2-migration/content/glossary-en/cvr.md`: `relatedPosts` 동일 교체(EN 짝 없는 슬러그는 렌더에서 자동 스킵되므로 안전),
  본문 인라인 `[Optimizing CVR](/blog/cvr-optimization)` → EN에 funnel 글이 없으므로 `[funnel](/en/glossary/funnel)` 용어로 대체(문장 자연스럽게 조정)

**W4 (cpi-cpa-cpm-difference 삭제와 동시):**
- KR+EN `glossary/cpc.md`·`cpa.md`·`cpi.md`·`cpm.md`: relatedPosts의 `"cpi-cpa-cpm-difference"` → `"performance-marketing-metrics"`
- KR `cpi.md`·`cpm.md` 본문 인라인 `(/blog/cpi-cpa-cpm-difference)` → `(/blog/performance-marketing-metrics)`(링크 문구 "지표 사슬 글" 등으로 조정)

## 참고 (2026-07-19 사전 검증 완료)

- 전 35편 슬러그·date 불변 확인 ✓ / batch 내 삭제슬러그 링크 0건 ✓
- 전량 적용 + 3편 삭제 + EN 3편 상태로 `npm run build` GREEN ✓
- EN #2의 cohort·funnel 링크는 EN 글 부재로 `/en/glossary/retention`·`/en/glossary/funnel`로 대체 적용됨
- EN #2의 FAQ 항목: KR batch1은 FAQ를 **frontmatter `faq:` 키**로 보유(본문 헤딩 아님 —
  blog.js:79가 배열 파싱·렌더). EN 현행 파일엔 `faq:` 키 자체가 없어(원래 FAQ 없는 구조)
  미적용 유지. 차후 EN에 `faq:` 키를 도입하면 en-mirror-patches.md #2의 영문 FAQ 항목을
  첫 항목으로 추가
- relatedPosts는 존재하지 않는 슬러그를 조용히 스킵(glossary/[slug]/page.js) — 크래시 없음
- sitemap·rss는 getAllPosts 파생이라 추가·삭제 자동 반영

## 진행 로그

(주차 완료 시 여기에 append: `- W<N> done <날짜> PR #<번호> — <비고>`)
