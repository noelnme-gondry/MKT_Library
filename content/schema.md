# 페이지 데이터 스키마

가이드 본문 콘텐츠를 JSON 데이터로 분리하기 위한 스펙. 각 페이지는 `content/pages/{id}.json` 1개 파일에 대응한다.

## 최상위 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | ✓ | 페이지 ID (예: `"1-1"`). 파일명과 일치해야 함 |
| `deck` | string | ✓ | 페이지 제목 아래 한 줄 설명 (HTML 허용) |
| `chips` | array | – | 메타 정보 칩 배열 |
| `summary` | string | – | 핵심 요약 블록 본문 (HTML 허용) |
| `toc` | array | – | 우측 목차 항목 배열 |
| `body` | array | ✓ | 본문 섹션 배열 |

## chips 항목

```json
{ "label": "담당 · Growth Eng.", "variant": "ok" }
```

`variant`: `"default"` (생략 가능) / `"ok"` / `"warning"`

## toc 항목

```json
{ "id": "s-prereq", "title": "사전 요구사항" }
```

`id`는 해당 섹션의 `id`와 일치해야 한다.

## body / section

```json
{
  "type": "section",
  "id": "s-prereq",
  "ix": "§1",
  "title": "사전 요구사항",
  "content": [ ...blocks... ]
}
```

## 블록 타입

### paragraph

```json
{ "type": "paragraph", "html": "초기화는 <strong>...</strong>" }
```

`text` 키로 plain text도 가능 (자동 escape).

### subheading

```json
{ "type": "subheading", "title": "2.1 iOS · Adjust SDK 초기화" }
```

`<h3 class="sub-title">`으로 렌더.

### list

```json
{
  "type": "list",
  "ordered": false,
  "items": [
    "첫 번째 항목 (HTML 허용)",
    "두 번째 <strong>강조</strong> 항목"
  ]
}
```

`ordered: true` 시 `<ol>`, 기본 `<ul>`.

### code

```json
{
  "type": "code",
  "lang": "swift",
  "label": "iOS · AppDelegate.swift",
  "code": "import Adjust\n\nfunc application(...)"
}
```

`lang` 지원: `swift` / `kotlin` / `json` / `bash` / `http`.

### table

```json
{
  "type": "table",
  "headers": [
    { "label": "ID" },
    { "label": "Scenario", "type": "string" }
  ],
  "rows": [
    ["QA-01", "신규 설치", { "pill": "tier-1", "text": "Blocker" }, "..."]
  ]
}
```

셀이 객체 `{ pill, text }` 형태면 pill 컴포넌트로 렌더.  
셀이 객체 `{ html: "..." }` 형태면 raw HTML 삽입.

### callout

```json
{
  "type": "callout",
  "variant": "warn",
  "title": "iOS에서 attribution이 organic으로만 잡힌다",
  "html": "1) ATT 프롬프트가 SDK 초기화 이후..."
}
```

`variant`: `"info"` / `"warn"` / `"danger"`

## 페이지 추가 방법

1. `content/pages/{id}.json` 생성
2. `index.html`의 `DATA_BASED_PAGES` Set에 페이지 ID 추가
3. 기존 `page_{id}()` 함수는 제거하거나 fallback으로 유지

## 마이그레이션 진행 현황

- [x] `1-1` (개발자 협업 가이드)
- [ ] `1-2` (인앱 이벤트 택소노미)
- [ ] `1-3` (포스트백 매뉴얼)
- [ ] `1-4` (ATT & SKAN)
- [ ] `2-1` ~ `2-4` (Execution)
- [ ] `3-1` ~ `3-3` (Creative)
- [ ] `4-1` ~ `4-4` (Analysis)
- [ ] CSV Analyzer 5-1, 5-2는 동적 인터랙션이 필요하므로 JSON화 대상이 아님

체크박스 표시된 페이지는 JSON으로 분리 완료. 미체크 페이지는 `page_{id}()` 함수 형태로 유지.
