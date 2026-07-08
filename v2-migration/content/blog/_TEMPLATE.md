---
# ─────────────────────────────────────────────────────────────
# 블로그 글 작성 템플릿 (Frontmatter 스키마)
#
# 이 파일은 파일명이 언더스코어(_)로 시작하므로 로더가 자동으로 제외합니다.
# 새 글을 쓰려면 이 파일을 복사해 `my-post-slug.md` 처럼 저장하세요.
# 위치: v2-migration/content/blog/<slug>.md
#
# 각 필드 설명:
title: "예시 글 제목입니다"          # (필수) 글 제목. 40자 이내 권장 (검색 결과 잘림 방지)
description: "이 글이 무엇을 다루는지 한 줄 요약. 검색 meta description으로 쓰임" # (필수) 80자 이내 권장
date: "2026-07-09"                    # (필수) 발행일. ISO 형식 YYYY-MM-DD. 목록 정렬·pubDate에 사용
slug: "example-post"                  # (필수) URL 경로. kebab-case 영문 권장 → /blog/example-post
keywords: "퍼포먼스 마케팅, ROAS, 예산 배분"  # (필수) SEO 키워드. 쉼표로 구분한 문자열
tags: ["마케팅", "분석"]              # (선택) 태그 배열. 목록 카드에 배지로 표시
draft: true                           # (선택) true면 미발행(빌드/목록/사이트맵 제외). 발행하려면 false 또는 삭제
ogImage: "/blog-assets/example-post/og.png"  # (선택) SNS 공유 카드 이미지. public 기준 절대경로(권장 1200x630). 없으면 "" 또는 삭제
# ─────────────────────────────────────────────────────────────
---

## 첫 번째 소제목

여기부터 본문입니다. 일반 문단은 그냥 쓰면 됩니다. 이 템플릿은 `draft: true`라서
실제로는 발행되지 않습니다 (로더가 제외).

### 더 작은 소제목

- 목록 항목 1
- 목록 항목 2
- 목록 항목 3

**굵은 글씨**와 *기울임*, 그리고 `인라인 코드`를 쓸 수 있습니다.

> 인용문은 이렇게 표시됩니다.

```js
// 코드 블록 예시
const roas = revenue / cost;
```

[링크는 이렇게](https://growthoptplaybook.com) 씁니다.

### 이미지 넣기

1. 이미지 파일을 **`v2-migration/public/blog-assets/<이-글의-slug>/`** 에 넣습니다.
   예: `public/blog-assets/example-post/chart.png`
2. 본문에서 **public 기준 절대경로**로 참조합니다(맨 앞 `/`, `public` 은 안 씀):

![차트 설명(대체 텍스트·SEO에 중요)](/blog-assets/example-post/chart.png)

- 경로 규칙: `/blog-assets/<slug>/<파일명>` — `public/` 아래가 사이트 루트로 서빙됨.
- 대괄호 안 텍스트 = `alt`(스크린리더·검색엔진용) → 꼭 채우기.
- 이미지는 자동으로 가로 100%·둥근 모서리로 표시됨(`.blog-prose img`).
- SNS 공유 썸네일은 본문 이미지와 별개 → 위 frontmatter `ogImage`에 지정(1200x630 권장).

---

작성 팁:
- 제목(title)과 설명(description)은 검색 결과에 그대로 노출되니 신경 써서.
- keywords는 실제 검색어 위주로. 롱테일(구체적 검색어) 노려서.
- 첫 문단에 핵심 키워드를 자연스럽게 배치.
