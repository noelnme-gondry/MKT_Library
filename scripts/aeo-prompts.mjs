#!/usr/bin/env node
// AEO 측정용 프롬프트 체크리스트 생성기.
//
// "AI에 이렇게 물었을 때 우리가 나와야 한다"는 목록을 손으로 관리하면, 도구가
// 늘거나 문구가 바뀔 때 목록만 옛말이 된다. 그래서 이미 존재하는 SSOT에서 파생한다:
//   - `lib/toolSearchContent.js` 의 question/answer  (도구별 예상 프롬프트)
//   - `lib/compareContent.js`     의 question/answer  (방법 비교 페이지)
//   - `lib/routeMap.js`·`lib/routeSeo.js`             (목표 URL과 페이지 이름)
//
// 실행: node scripts/aeo-prompts.mjs
// 출력: docs/aeo-prompt-checklist.md (덮어씀)
//
// 위 네 모듈은 `@/` 별칭 import가 없어 plain node ESM으로 불러올 수 있다. 다만 앱
// 코드는 확장자 없는 상대 import를 쓰므로(번들러가 붙여주는 전제) 해석 훅을 먼저
// 등록한다. 누가 `@/` 별칭 import를 추가하면 이 스크립트가 즉시 깨진다 — 그때는
// 앱 코드가 아니라 여기 훅을 늘릴 것.

import { mkdirSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

register("./extensionless-resolve-hook.mjs", import.meta.url);

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LIB = path.join(ROOT, "v2-migration", "src", "lib");
const load = (name) => import(path.join(LIB, name));

const { TOOL_SEARCH_CONTENT_IDS, getToolSearchContent } = await load("toolSearchContent.js");
const { COMPARE_SLUGS, getComparePage } = await load("compareContent.js");
const { ROUTES, SITE_URL, idToPath, hasEnVersion, isRoutePublished } = await load("routeMap.js");
const { getRouteSeo } = await load("routeSeo.js");

// 목표 URL이 실재하지 않으면 매달 "안 나오는 게 당연한" 항목을 세게 된다.
// 조용히 죽은 링크를 뱉느니 여기서 멈춘다.
const publishedIds = new Set(ROUTES.filter((route) => isRoutePublished(route)).map((route) => route.id));
for (const id of TOOL_SEARCH_CONTENT_IDS) {
  if (!publishedIds.has(id)) throw new Error(`발행되지 않은 도구가 목록에 있다: ${id}`);
}

const absolute = (routePath, locale) => `${SITE_URL}${locale === "en" ? "/en" : ""}${routePath}`;

// 한 로케일의 측정 대상 행. 도구 → 비교 페이지 순.
function rows(locale) {
  const toolRows = TOOL_SEARCH_CONTENT_IDS
    // EN 페이지가 없는 도구를 EN 목록에 넣으면 "안 나오는 게 정상"인 항목을 매달 세게 된다.
    .filter((id) => locale !== "en" || hasEnVersion(id))
    .map((id) => {
      const content = getToolSearchContent(id, locale);
      const seo = getRouteSeo(id, locale);
      return {
        kind: locale === "en" ? "Tool" : "도구",
        name: seo?.title || id,
        question: content?.question,
        answer: content?.answer,
        url: absolute(idToPath(id), locale),
      };
    })
    .filter((row) => row.question);

  const compareRows = COMPARE_SLUGS.map((slug) => {
    const page = getComparePage(slug, locale);
    return {
      kind: locale === "en" ? "Comparison" : "비교",
      name: page.title,
      question: page.question,
      answer: page.answer,
      url: absolute(`/compare/${slug}`, locale),
    };
  });

  return [...toolRows, ...compareRows];
}

const cell = (value) => String(value ?? "").replace(/\|/g, "\\|");

function table(locale) {
  const header = locale === "en"
    ? ["#", "Type", "Prompt to test", "Answer we publish", "Target page", "Mentioned", "Cited", "Sentiment"]
    : ["#", "종류", "테스트할 프롬프트", "우리가 공개한 답", "목표 페이지", "언급", "인용", "감성"];
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows(locale).map((row, index) => `| ${index + 1} | ${cell(row.kind)} | ${cell(row.question)} | ${cell(row.answer)} | ${row.url} | ☐ | ☐ | |`),
  ];
  return lines.join("\n");
}

const koRows = rows("ko");
const enRows = rows("en");

const doc = `# AEO 프롬프트 체크리스트

> **이 파일은 생성물이다.** 직접 고치지 말고 \`node scripts/aeo-prompts.mjs\`로 다시 만든다.
> 원본은 \`lib/toolSearchContent.js\`의 \`question\`/\`answer\`와 \`lib/compareContent.js\`다.
> 문구를 바꾸려면 그 SSOT를 고친 뒤 이 스크립트를 다시 돌린다.

대상 프롬프트 ${koRows.length}개(KO) · ${enRows.length}개(EN).

## 측정 방법

같은 목록을 매달 같은 방식으로 돌려야 추이가 의미를 갖는다.

1. **새 대화**에서 프롬프트를 그대로 붙여넣는다. 이전 대화 맥락이 남으면 결과가 오염된다.
2. 대상: ChatGPT · Claude · Perplexity · Google AI 개요. 도구마다 결과가 다르므로 열을 나눠 기록한다.
3. 세 가지를 각각 표시한다.
   - **언급**: 답변 안에 우리 사이트나 도구 이름이 등장했는가
   - **인용**: 답변이 우리 도메인(\`growthoptplaybook.com\`)을 출처로 달았는가
   - **감성**: 우리를 어떻게 묘사했는가 (긍정 / 중립 / 부정 / 부정확)
4. **인용 ≠ 언급**이다. 인용 없이 언급될 수 있고, 그 반대도 있다. 둘을 한 칸에 합치지 말 것.
5. "부정확"이 나오면 그 프롬프트의 목표 페이지 문구를 먼저 고친다. 감성보다 사실 오류가 급하다.

## 기록 형식

체크 표시는 이 파일에 하지 말고 월별 사본을 떠서 쓴다(이 파일은 재생성 시 덮어써진다).

\`\`\`
mkdir -p docs/aeo-runs && cp docs/aeo-prompt-checklist.md docs/aeo-runs/$(date +%Y-%m).md
\`\`\`

## 한국어 프롬프트

${table("ko")}

## English prompts

${table("en")}

## 읽는 법

- **언급률** = 언급된 프롬프트 수 ÷ 전체 프롬프트 수. 브랜드가 그 주제의 답변에 얼마나 등장하는가.
- **인용률** = 우리 도메인이 출처로 달린 프롬프트 수 ÷ 전체. 인용률이 오르면 언급률이 따라 오르는 경향이 있다.
- 두 수치 모두 절대값보다 **같은 목록의 월별 변화**가 정보다. 목록이 바뀌면 그 달에 표시해 둘 것.
- 인용의 상당 부분은 자사 도메인 밖(커뮤니티·리뷰·소셜)에서 온다. 이 목록이 개선되지 않는다고 페이지만 더 만들지 말 것.
`;

mkdirSync(path.join(ROOT, "docs"), { recursive: true });
const outPath = path.join(ROOT, "docs", "aeo-prompt-checklist.md");
writeFileSync(outPath, doc);
console.log(`생성: ${path.relative(ROOT, outPath)} — KO ${koRows.length}행 · EN ${enRows.length}행`);
