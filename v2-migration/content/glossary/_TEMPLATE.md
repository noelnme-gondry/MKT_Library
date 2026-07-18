---
# ─────────────────────────────────────────────────────────────
# 용어사전 항목 템플릿 (Frontmatter 스키마)
#
# 파일명이 언더스코어(_)로 시작해 로더가 자동 제외합니다.
# 새 항목: 이 파일을 복사해 `my-term-slug.md`로 저장.
# 위치: v2-migration/content/glossary/<slug>.md
#
term: "예시 용어"                      # (필수) 화면 표시용 용어명(한글 또는 원어 그대로)
shortDef: "이 용어를 한 문장으로 정의"    # (필수) 목록/카드/메타 설명에 쓰이는 한 줄 정의
description: "검색 meta description. shortDef보다 조금 길어도 됨(80자 이내 권장)"
date: "2026-07-18"                    # (필수) ISO 형식
slug: "example-term"                  # (필수) URL 경로 → /glossary/example-term
keywords: "용어 뜻, 용어 정의, 관련 검색어"  # (필수)
category: "기초 지표"                  # (필수, 없으면 "기타"로 폴백) 필터 UI용.
                                        # 기존 카테고리: 기초 지표 / 측정·분석 방법론 / 예산·최적화 / 트래킹·기술
                                        # (새 카테고리를 만들면 EN 파일에도 영문명 맞춰 추가)
relatedPosts: ["marketing-mix-modeling"]  # (선택) 이 용어를 깊게 다루는 기존 블로그 글 slug
draft: true                           # (선택) true면 미발행
#
# EN 버전: content/glossary-en/<같은 slug>.md 로 같이 작성(카테고리 영문명 매핑:
# 기초 지표=Basic Metrics, 측정·분석 방법론=Measurement & Methodology,
# 예산·최적화=Budget & Optimization, 트래킹·기술=Tracking & Tech).
# 본문 내부 링크는 /glossary/·/blog/ 그대로 쓰면 됨(로더가 /en/ 접두 자동 변환).
# ─────────────────────────────────────────────────────────────
---

## 한 줄로

**{{ shortDef 내용을 본문에서 한 번 더 풀어서 }}**

## 왜 중요한가

실무에서 이 용어가 왜 등장하는지, 어떤 문제와 연결되는지 2~3문단.

## 예시

가능하면 구체적인 예시나 비유.

## 더 깊게 보려면

[관련 글 링크](/blog/example-slug)에서 자세히 다룹니다.
