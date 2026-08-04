# AAO/GEO 콘텐츠 운영 기준

## 목표

검색 결과와 AI 답변에서 인용 가능한, 짧고 조건이 명확하며 검토 가능한 퍼포먼스 마케팅 콘텐츠를 운영한다. 특정 생성형 엔진의 순위·인용을 보장하거나 조작하는 것을 목표로 하지 않는다.

## 발행 계약

발행 블로그 글은 KR/EN 쌍을 기준으로 다음 편집 정보를 가진다.

| 필드 | 역할 | 원칙 |
|---|---|---|
| `answer` | 글 첫 화면의 직접 답변 | 두 문장 안에서 질문에 답한다. CTA·메타 설명을 섞지 않는다. |
| `conditions` | 적용 범위·예외 | 인과·성과를 단정하지 않고 데이터·설정·표본의 의존성을 명시한다. |
| `reviewedAt` / `reviewer` | 검토 책임 | 실제로 사실·링크를 다시 확인했을 때만 날짜와 역할 또는 이름을 남긴다. |
| `sources` | 검증 근거 | 실제로 본문에서 인용한 1차 또는 권위 출처만 URL과 함께 쓴다. 없는 출처를 만들어 넣지 않는다. |
| `primaryTool` / `relatedGlossary` | 다음 행동 | 읽은 내용이 실제 분석·정의와 양방향으로 이어져야 한다. |

현재 발행 글의 공통 답변·조건은 `v2-migration/src/lib/blogEditorial.js`에 있으며, 개별 원고 frontmatter가 있으면 그것을 우선한다. `reviewedAt`과 `reviewer`는 명시값이 없으면 노출하지 않으며, 발행일을 검토일처럼 바꾸지 않는다. 본문에서 실제로 연결한 HTTPS 출처는 렌더 시 자동 수집되어 출처 목록과 `BlogPosting.citation`에 같은 값으로 반영된다. 원고 작성 템플릿은 `content/blog/_TEMPLATE.md`, `content/blog-en/_TEMPLATE.md`다.

## 검토 순서

1. 질문이 제목과 답변에서 같은 의도로 답해지는지 확인한다.
2. 답변이 성립하는 데이터 정의·기간·표본·플랫폼 조건을 `conditions`에 적는다.
3. 외부 사실이나 플랫폼 정책을 말할 때만 해당 공식 문서를 `sources`에 넣는다.
4. KR/EN의 의미·조건·연결 도구를 함께 갱신한다.
5. `npm run test:all`, `npm run lint`로 레지스트리와 렌더 계약을 확인한다.

## 월간 측정 루프

고정 질의 세트는 검색 의도별로 KR/EN 각각 관리한다: 정의형, 비교형, 진단형, 실행형. 매월 다음을 기록한다.

검색엔진 소유 확인·피드 제출·비교 일정은 [`search-ops-log.md`](./search-ops-log.md)에 기록한다. 공개 저장소에는 계정 정보나 상세 성과 수치를 남기지 않는다.

- Search Console의 Generative AI 성과 보고서와 일반 검색의 질문형 검색어 노출·클릭·CTR
- 블로그에서 `ContentActionPanel`을 거친 도구 진입과 분석 실행 비율
- 대표 생성형 검색 환경에서의 답변 정확성, 출처 표기, 브랜드·URL 언급 여부
- 잘못된 단정·오래된 플랫폼 정보·깨진 출처 링크

AI 답변의 순위나 인용은 변동성이 크므로 단일 수치로 성공을 단정하지 않는다. 검색 유입의 질, 도구 전환, 답변의 정확성을 함께 본다.

Google Search는 AEO/GEO를 별도 기술 요건으로 보지 않으며, 전용 스키마·`llms.txt`·인위적 콘텐츠 분할을 요구하지 않는다. 이 프로젝트도 일반 SEO 기반, 고유한 실무 근거, 읽기 쉬운 본문과 측정에 집중한다. 단, `/llms.txt`는 검색 순위 기법이 아니라 다른 에이전트가 공개 콘텐츠의 정식 경로를 찾도록 돕는 선택적 디렉터리로 제공한다. 내용은 공개 분석 라우트·블로그·계산기·용어 레지스트리와 가이드 인덱스에서 자동 생성하고, 수동 주장이나 비공개 경로를 넣지 않는다. 개별 SOP는 가이드 인덱스와 sitemap에서 탐색한다. 기준은 [Google의 생성형 AI 검색 최적화 가이드](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)와 [Article 구조화 데이터 가이드](https://developers.google.com/search/docs/appearance/structured-data/article)를 따른다.
