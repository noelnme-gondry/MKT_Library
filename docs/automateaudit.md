# 사이트 전수 감사 (Automate Audit)

> **목적**: 사이트 전체를 반복 가능한 방식으로 감사한다. 이 문서는 ① 감사 프로토콜(어떻게 볼 것인가) ② 재실행 가능한 스윕 명령 ③ 실행 결과 로그를 한 파일에 담는다.
> **대상**: `v2-migration/` (운영 앱 SSOT) + `content/` 콘텐츠 + 공개 라우트 전체.
> **원칙**: 발견 항목은 **파일:줄 또는 실측 수치**를 근거로 남긴다. 근거 없는 인상 비평은 기록하지 않는다(§8 정직성).

---

## 0. 이 문서의 사용법

| 상황 | 할 일 |
|---|---|
| 자동 감사(현재 매시간) | 원격 `main`과 감사 브랜치를 먼저 동기화 → §3 스윕 전부 실행 → §5에 새 실행 로그 추가 → §6 백로그 갱신 |
| 기능 추가 후 | 해당 렌즈만 부분 실행 |
| 발견 항목 수정 완료 | §6 표의 상태를 `해결`로 바꾸고 근거 PR 번호 기재 |

**중요**: 이 문서는 감사 기록이자 판정 근거다. 현재 감사 트래킹 PR에서는 검증 가능한 저위험 수정만 별도 커밋으로 함께 반영하고, 수학·수익화·대규모 구조 변경은 별도 PR로 분리한다.

---

## 1. 감사 단위 — 표면 × 상태

도구 단위로 보면 이미 여러 번 감사했다(`full-tool-improvement-30-pass-audit.md` 등). 전수 조사는 단위를 바꾼다.

**단위 = 표면(surface) × 상태(state)**

버그와 이탈은 해피패스가 아니라 나머지 상태에 산다. 도구 1개의 실제 조합:

```
상태 5  (미업로드 · 데모 · 매핑 중 · 분석 완료 · 계산불가/컬럼부족)
× 테마 2 (다크 · 라이트)
× 로케일 2 (KR · EN)
× 뷰포트 2 (데스크톱 · 모바일)
= 40 조합
```

전부 보는 건 낭비다. **의도적 샘플링**:

- 전 도구 전수: `미업로드` · `계산불가` · `모바일 KR` (여기가 가장 자주 썩는다)
- 대표 3개 도구만 풀 매트릭스: 5-2(대시보드) · 5-18(가장 복잡) · 5-20(Aha)
- 콘텐츠 표면: 목록/상세 × KR/EN 4조합 + 검색 착지 시나리오

---

## 2. 렌즈 (L1~L7)

각 렌즈는 **판정 기준을 먼저 문장으로 고정**한다. "좀 아쉽다" 같은 판정은 재현이 안 되므로 금지.

### L1. 정보구조 · 유저 플로우
- 3대 진입(검색→글/용어 · 직접→홈 · 인앱→사이드바)별로 "첫 화면에서 다음 클릭이 자명한가"
- 막다른 길: 결과 화면에서 나가는 링크 0개인 표면
- 뒤로가기·새로고침 시 상태 유실(무주소 상태 화면 재발 여부)
- 첫 방문자가 도구를 고를 수 있는가(라벨만 보고)

### L2. 디자인 · UI 일관성
- 같은 의미의 요소가 표면마다 다른 모양인가(버튼 위계·카드·표·칩·빈 상태)
- `globals.css` 토큰 밖 하드코딩 색/여백 — **`getCssVar` 폴백은 정상 패턴, 순수 하드코딩만 드리프트로 집계**
- 다크/라이트 양쪽 대비(차트 범례·보조 텍스트는 상습 함정 §7)
- 모바일: 표 가로 스크롤 · sticky 겹침 · 터치 타깃
- 화면당 "가장 큰 것"이 실제로 가장 중요한 것인가

### L3. 카피 · 이해 가능성
- 표면당 설명 없는 전문용어 개수
- 결론이 평어 문장인가, 숫자만 던지는가
- 라벨이 질문 형태인가(`v2-migration/claude-ux.md` 원칙)
- KR/EN 의미 등가성 — 반쪽 번역 표면(§2.11)

### L4. 신뢰 · 정직성 (제품 생명선)
- 화면의 모든 숫자가 "어디서 나왔나" 추적 가능한가
- 관측 데이터에 인과 단정 카피가 있는가
- 추정 불가 상황에서 0/빈칸 대신 정직한 메시지가 뜨는가
- 프라이버시 주장과 실제 동작 일치(클라이언트 처리 · persist 대상 · GA4 전송 메타데이터)

### L5. 재사용 · 리텐션 루프
- 분석 종료 화면에 "다음 주에 다시 올 이유"가 명시되는가
- 재방문 마찰: 매번 CSV 재업로드 vs 저장 금지 원칙(§2.2)의 충돌을 어떻게 푸는가
- 결정 인박스·주간 검토 루프가 **끝까지 연결**되는가(진입점 → 기록 → 재방문 → 검토)
- 수익화 요소가 재방문 비용을 얼마나 올리는가

### L6. 시장 가치 · 포지셔닝
- 대안 대비 위치: 엑셀 · GA4 · 대행사 리포트 · Supermetrics류 · 무료 계산기
- "왜 이걸 쓰는가" 한 문장이 첫 화면에 있는가
- 검색 수요 대비 커버리지(GSC 쿼리 ↔ 발행 콘텐츠 매칭)
- 가치 포착 구조가 제품 신뢰와 상충하지 않는가

### L7. SEO · AAO · GEO ★신규
검색엔진과 AI 답변 양쪽에서 **인용 가능한 상태**인가. 기준은 `aao-geo-operating-model.md`를 따르며, 전용 스키마·`llms.txt` 같은 조작적 기법은 목표로 삼지 않는다.

**L7-a 기술 SEO**
- canonical · hreflang(ko/en/x-default) 전 공개 라우트 배선
- sitemap/RSS가 공개 범위 SSOT(`isRoutePublished` + `getAllPosts/getAllTerms`)에서 파생되는가, 초안·내부 라우트 제외되는가
- robots 허용 범위 · sitemap 고지
- 실제 배포 메타 제목/설명 **로케일별 운영 임계**: KR 제목 ≤40자·설명 ≤80자 / EN 제목 ≤60자·설명 ≤160자
- OG/Twitter 카드가 글별로 생성되는가

**L7-b 구조화 데이터**
- BlogPosting · DefinedTerm · BreadcrumbList · FAQPage · SoftwareApplication · HowTo 적용 표면과 커버리지
- `author`가 조직인가 사람인가(E-E-A-T)
- `citation`이 본문 실제 인용과 일치하는가

**L7-c AAO/GEO (AI 답변 인용 가능성)**
- `answer`: 질문에 두 문장 안에 직접 답하는가, CTA·메타를 섞지 않았는가
- `conditions`: 답이 성립하는 데이터·기간·표본·플랫폼 조건이 **글별로 특정**되는가
- `reviewedAt`/`reviewer`: 실제 검토가 있었을 때만 노출되는가 (없으면 신뢰 신호 부재로 집계)
- `sources`: 외부 사실·플랫폼 정책 주장에 1차 출처가 붙는가
- 글 → 도구 → 분석의 양방향 연결이 레지스트리로 강제되는가

**L7-d 콘텐츠 자산 정합**
- KR/EN 짝 파일 완전성(고아 slug 0)
- 레지스트리 3종(`contentToolRegistry` · `blogSeo` · `localizedHref`) 정합
- 발행 글 ↔ 용어 상호 링크

### 횡단
성능(LCP·번들·차트 초기 렌더) · 접근성(h1 유일성·탭 시맨틱·포커스·alt) · 오류 복원력.

---

## 3. 재실행 가능한 스윕 (Automate)

아래 명령은 `v2-migration/`에서 실행한다. 수치가 바뀌면 §5에 새 실행 로그를 남긴다.

### S1. 콘텐츠 KR/EN 짝 정합 (L7-d)
```bash
for d in blog blog-en glossary glossary-en; do echo "$d: $(ls content/$d/*.md | grep -v '/_' | wc -l)"; done
comm -3 <(ls content/blog | grep -v '^_' | sed 's/.md//' | sort) \
        <(ls content/blog-en | grep -v '^_' | sed 's/.md//' | sort)
```
판정: 개수 일치 + comm 출력 0줄.

### S2. 실제 배포 메타 잘림 위험 (L7-a)
```bash
node --input-type=module - <<'NODE'
import { getBlogSeo, publishedBlogSeoSlugs } from './src/lib/blogSeo.js';
for (const [locale, titleLimit, descriptionLimit] of [['ko', 40, 80], ['en', 60, 160]]) {
  const titles = [], descriptions = [];
  for (const slug of publishedBlogSeoSlugs(locale)) {
    const seo = getBlogSeo(locale, slug, {});
    if ([...seo.title].length > titleLimit) titles.push(`${slug}:${[...seo.title].length}`);
    if ([...seo.description].length > descriptionLimit) descriptions.push(`${slug}:${[...seo.description].length}`);
  }
  console.log(locale, `title>${titleLimit}:`, titles.length, titles.join(' '));
  console.log(locale, `desc>${descriptionLimit}:`, descriptions.length, descriptions.join(' '));
}
NODE
```
판정: 초과 0건. 원고 frontmatter가 아니라 목록·상세·metadata·JSON-LD가 실제 소비하는 `blogSeo.js` 출력값을 잰다.

### S3. AAO/GEO 편집 정보 커버리지 (L7-c)
```bash
node -e "
const fs=require('fs');const s=fs.readFileSync('src/lib/blogEditorial.js','utf8');
const posts=fs.readdirSync('content/blog').filter(f=>f.endsWith('.md')&&!f.startsWith('_')).map(f=>f.replace('.md',''));
function keys(name){const i=s.indexOf('const '+name);if(i<0)return[];const j=s.indexOf('\n};',i);
 return [...s.slice(i,j).matchAll(/\"([a-z0-9-]+)\":/g)].map(m=>m[1]);}
for(const n of ['KO_ANSWERS','EN_ANSWERS','CONDITION_GROUP_BY_SLUG'])
 console.log(n,'커버',keys(n).length,'/ 누락',posts.filter(p=>!keys(n).includes(p)).length);
let rv=0,src=0;
for(const p of posts){const t=fs.readFileSync('content/blog/'+p+'.md','utf8');
 if(/reviewedAt:/.test(t.split('---')[1]||''))rv++; if(/https:\/\//.test(t))src++;}
console.log('reviewedAt 보유:',rv,'/',posts.length,'| 외부 출처 인용 글:',src);"
```
판정: answers/conditions 누락 0 · reviewedAt·출처는 목표치 대비 비율로 추적.

### S4. 디자인 토큰 드리프트 (L2)
```bash
node -e "
const fs=require('fs'),path=require('path');
function walk(d,o=[]){for(const f of fs.readdirSync(d)){const p=path.join(d,f);
 fs.statSync(p).isDirectory()?walk(p,o):(/\.(jsx|js)\$/.test(f)&&!/\.test\./.test(f)&&o.push(p));}return o;}
let fb=0,drift=0;const by={};
for(const p of walk('src/components'))
 fs.readFileSync(p,'utf8').split('\n').forEach(l=>{const m=l.match(/#[0-9a-fA-F]{6}\b/g);if(!m)return;
  if(/getCssVar|var\(--/.test(l)){fb+=m.length;return;} drift+=m.length; by[p]=(by[p]||0)+m.length;});
console.log('토큰 폴백(정상):',fb,'| 실제 드리프트:',drift);
console.log(Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([f,n])=>'  '+n+'  '+f).join('\n'));"
```
판정: 드리프트 감소 추세. **`getCssVar(...) || "#hex"` 폴백은 위반 아님**(오탐 주의).

### S5. 정직성 어휘 (L4)
```bash
grep -rnoE "때문에|덕분에|증가시켰|감소시켰|효과가 있었" src/components --include=*.jsx
```
판정: 히트마다 문맥 확인. 코드 주석·"허위 인과 방지" 설명은 위반 아님.

### S6. 문서 드리프트 (횡단)
```bash
for f in $(grep -oE 'src/[a-zA-Z/.\[]+\.(jsx|js)' ARCHITECTURE.md | sort -u); do
  [ -f "$f" ] || echo "MISS $f"; done
echo "routeMap slug: $(grep -c 'slug:' src/lib/routeMap.js)"
```
판정: MISS 0 · ARCHITECTURE 기재 라우트 수와 실제 일치.

### S7. 배포 게이트
```bash
npm run test:all && npm run lint && npx next build
```

---

## 4. 발견 항목 기록 스키마

```
ID · 표면 · 렌즈 · 증상(1문장) · 증거등급 · 근거(파일:줄/수치) · 심각도 · 난이도 · 제안
```

**증거등급**: `측정`(스윕·테스트 수치) · `관찰`(코드 직접 확인) · `추론`(판단, 실데이터 없음)
**심각도**: `P0` 거짓 숫자·프라이버시 위반·화면 깨짐 / `P1` 이탈·재방문 차단 / `P2` 이해비용·일관성 / `P3` 다듬기

---

## 5. 실행 로그

### 2026-08-01 · 1차 (코드·콘텐츠 정적 감사)

**범위**: S1~S6 전 스윕 + S7 테스트 스위트 + 라우트/컴포넌트 코드 확인.
**미수행**: 라이브 브라우저 확인, GA4/GSC 실데이터, 성능 측정(LCP·번들), 실사용자 테스트, `next build`. → **L5·L6 판정은 `추론` 등급**이며 측정으로 승격하려면 GA4/GSC 접근이 필요하다.

**기준 커밋**: `main` #567(Operator Desk 시각 시스템 전면 개편) 반영 후. 수치를 재현하려면 같은 시점 이후에서 §3을 실행한다.

**S7 결과**: `npm run test:all` → **164 파일 중 1 실패 / 1,117 테스트 중 3 실패 · 1,113 통과 · 1 스킵**, 총 227초. 실패 3건은 모두 `attributedForecastLiveMath.test.js`의 **타임아웃**(46.8s·84.9s·7.2s vs 제한 30s·30s·5s)이며 단정 실패가 아니다.
→ **후속 확인 결과 이 실패는 감사 실행 환경(느린 컨테이너) 고유 현상이다.** GitHub Actions(`ubuntu-latest`)의 `main` 최근 8회 실행이 전부 success이며 같은 명령(`npm run test:all`)을 돈다. **배포 게이트는 초록이다.** F12는 "게이트 실패"가 아니라 "실행 환경 민감도" 관찰로만 남긴다.

#### 5.1 통과 항목 (기록해야 신뢰가 쌓인다)

| 렌즈 | 확인 내용 | 근거 |
|---|---|---|
| L7-d | KR/EN 짝 완전 — blog 32/32, glossary 25/25, 고아 slug 0 | S1 |
| L7-c | `answer` KR 32/32 · EN 32/32, 조건 그룹 매핑 32/32 누락 0 | S3 |
| L7-a | hreflang ko/en/x-default 배선, blog 상세는 EN 짝 존재 시에만 en 방출 | `src/app/blog/[slug]/page.js:22-23`, `src/lib/routeMap.js:138-146` |
| L7-a | sitemap이 EN 블로그 목록·상세 포함 | `src/app/sitemap.js:112-117` |
| L7-a | robots 전체 허용 + sitemap/host 고지 | `src/app/robots.js` |
| L7-b | JSON-LD 6종 이상 운용(BlogPosting·DefinedTerm·FAQPage·BreadcrumbList·SoftwareApplication·HowTo) | 코드 전수 grep |
| L4 | 인과 단정 어휘 스윕 클린 — 히트 2건 모두 코드 주석·"허위 그랜저-인과 방지" 설명 | S5, `marketingResponseModel.jsx:1918` |
| L4 | 결정 저장이 **opt-in + sanitize + 마이그레이션 방어**. 원본 CSV·매핑·필터는 persist 불가 | `src/store/useDataStore.js:332-357` |
| L5 | 결정 검토함 진입점 3곳(Header·Footer·DecisionReview) KR/EN 양쪽 | `Header.jsx:201`, `Footer.jsx:22`, `ds/DecisionReview.jsx:356` |
| L1 | 랜딩이 도구명이 아니라 **업무 질문 3개**로 진입 + 진단 라우트 별도 제공 | `LandingPage.jsx:11-40` |
| L2 | `getCssVar` 폴백 패턴 66건 — 토큰 우선 규약이 실제로 지켜지는 영역 존재 | S4 |

#### 5.2 발견 항목

| ID | 렌즈 | 증상 | 등급 | 근거 | 심각도 | 난이도 |
|---|---|---|---|---|---|---|
| F1 | L7-c | 발행 글 **32편 전부 `reviewedAt`/`reviewer` 없음** → 검토 책임 신호가 화면·구조화 데이터 어디에도 안 뜬다. AI 답변·검색 모두 신선도/책임 근거를 못 읽는다 | 측정 | S3 (0/32) | **P1** | S |
| F2 | L7-c | **외부 1차 출처를 인용한 글 3/32** → `BlogPosting.citation`이 대부분 비어 AI 답변이 인용할 근거가 약하다. 플랫폼 정책·수치 주장 글에 출처가 없다 | 측정 | S3 | **P1** | M |
| F3 | L7-c | 적용 조건이 **7개 그룹 문구를 32편이 공유**(platform 9편·measurement 9편·causal 6편 등) → 글별 특정 조건이 아니라 범용 문구. AAO가 요구하는 "조건 명확성"에 미달 | 측정 | `blogEditorial.js` CONDITION_GROUP_BY_SLUG | P2 | M |
| F4 | L7-a | 초기 S2가 실제 메타 SSOT가 아닌 원고 frontmatter를 재서 설명 초과를 잘못 보고했다. 실제 배포값 재측정 결과 수정 전 **EN 제목 17/32 초과, 설명 0/32 초과**였고 제목을 60자 이하로 압축했다 | 측정 | 교정 S2 + `blogSeo.test.js` | **P1 → 해결** | S |
| F5 | L7-a | 초기 KR 설명 5건 초과는 같은 측정 대상 오류. 실제 배포 설명은 수정 전부터 0건 초과였다 | 측정 | 교정 S2 | **오탐 → 종료** | — |
| F6 | L7-b | FAQ 보유 글 **8/32** → FAQPage 구조화 데이터 커버리지 25%. 질문형 검색 대응 표면이 좁다 | 측정 | frontmatter grep | P2 | M |
| F7 | L7-b | `BlogPosting.author`가 발행 조직(publisher) — **Person 저자 없음**. 실무 경험 기반 콘텐츠인데 사람 저자 신호가 없다 | 관찰 | `blog/[slug]/page.js:111` | P2 | S |
| F8 | L2 | 토큰 없이 하드코딩된 색 **317건**(MarketingResponse.jsx 104 · marketingResponseModel 33 · AhaMoment 21 …) → 다크/라이트 전환 시 깨질 후보. §7의 상습 함정 영역. #567 시각 시스템 개편 후에도 323→317로 거의 그대로 = 개편이 도구 내부까지 닿지 않았다 | 측정 | S4 | **P1** | L |
| F9 | 횡단 | `MarketingResponse.jsx` 5,957줄 + `marketingResponseModel.jsx` 4,892줄 = **단일 도구 10,849줄**. F8 드리프트의 42%가 여기 집중 | 측정 | `wc -l` | P2 | L |
| F10 | 횡단 | **문서 드리프트**: `ARCHITECTURE.md`·`CLAUDE.md §12.26`이 실존하지 않는 `AdInterstitial.jsx`·`AdFreeInit.jsx`를 라이브로 기술. 라우트도 고정 수치와 누락된 5-18/9-x 진입점이 있었다 | 측정 | S6 | **P1 → 해결** | S |
| F11 | L6 | 수익 요소(AdSense)가 **`/blog`·`/en/blog` 레이아웃에만** 로드 → 제품 가치의 핵심인 도구 페이지는 수익화 0. 트래픽 가치와 제품 가치가 분리돼 있다 | 관찰 | `src/app/blog/layout.js:13` | P2 | — |
| F12 | 횡단 | **골든 3건이 느린 환경에서 타임아웃**(`attributedForecastLiveMath.test.js`, 46.8s·84.9s·7.2s vs 30s·30s·5s). **CI·main은 초록이므로 결함이 아니다.** 다만 개별 테스트가 45~85초 걸리는 구조라 감사·로컬 환경에 따라 결과가 갈리고, 전체 227초는 반복 감사에 부담이다 | 측정 | S7 + main CI 8회 연속 success | P3 | M |

#### 5.3 F10 상세 (하네스 정합)

`CLAUDE.md §12.26`은 "분석하기 → 전면 광고 → 카운트다운" 흐름을 현재 동작으로 기술하지만 해당 컴포넌트가 코드베이스에 없다. 하네스 문서가 현실과 어긋나면 이후 모든 작업이 잘못된 전제 위에서 시작된다. **§15 자가 업데이트 대상**.

### 2026-08-02 · Codex 재판정 및 즉시 조치

| 분류 | 항목 | 판정·조치 |
|---|---|---|
| 즉시 수정 | F10 | `ARCHITECTURE.md`의 삭제 컴포넌트·고정 sitemap 수치를 제거하고 5-18 세부 진입점과 9-3·9-6·9-7을 추가했다. `CLAUDE.md §12.26`은 전면광고 폐기 및 `requestAd` no-op 호환 상태로 정정했다 |
| 즉시 수정 | F4/F5 | 스윕을 실제 메타 SSOT 기준으로 교체했다. EN 제목 17건을 60자 이하로 압축하고 KR/EN 제목·설명 길이 회귀 테스트를 추가했다. 설명 초과 주장은 오탐으로 종료했다 |
| 운영 판단 필요 | F1/F7 | 코드 인프라는 이미 있다. 실제 검토 없이 reviewer/date 또는 Person 저자를 일괄 기입하면 거짓 신뢰 신호가 되므로 자동 수정하지 않는다. 검토 책임자 표기명과 검토 절차 확정 후 원고 단위로 적용한다 |
| 순차 실행 | F2/F3/F6 | 외부 정책·수치 주장이 많은 글부터 1차 출처·글별 조건·FAQ를 묶어 원고 단위로 검토한다. 링크 수를 채우기 위한 비권위 출처 추가는 금지한다 |
| 자동 일괄수정 금지 | F8/F9 | 차트의 의미 색상 팔레트와 UI 토큰 드리프트를 분류한 뒤 표면 단위로 수정한다. 317개 hex를 기계적으로 토큰 치환하거나 대형 컴포넌트 분할을 함께 하지 않는다 |
| 사용자 판단 필요 | F11 | 도구 페이지 광고 도입은 수익·이탈·정책 데이터 없이는 결정하지 않는다 |
| 조치 없음 | F12 | CI가 동일 게이트를 안정적으로 통과하므로 제품 결함으로 취급하지 않는다 |

**검증**: `npm run test:all` 166파일·1,126개 통과(1개 스킵), `npm run lint` 통과, `npm run build` 220개 정적 페이지 생성 완료. 교정 S2는 KR/EN 제목·설명 초과를 모두 0건으로 확인했다.

---

## 6. 우선순위 백로그

우선순위 = (영향 × 심각도) ÷ 난이도. 상위만 실행 후보로 두고 나머지는 보류 registry로 남긴다(전부 고치려다 아무것도 안 끝나는 게 감사 문서의 사망 원인).

| 순위 | 항목 | 이유 | 상태 |
|---|---|---|---|
| 1 | **F10** 문서 드리프트 정정 | 다른 모든 작업의 전제. 난이도 S | **해결 — PR #568** |
| 2 | **F4/F5** 실제 메타 기준 교정 + EN 제목 17건 압축 | 잘못된 측정을 고치고 실제 제목 잘림 위험만 제거 | **해결 — PR #568** |
| 3 | **F1** 검토일·검토자 운영 시작 | 실제 검토 없이 기입 금지. 책임자 표기명·절차가 필요 | **사용자 판단** |
| 4 | **F2** 출처 인용 정책 — 플랫폼 정책·수치 주장 글 우선 | AI 답변 인용 가능성 직결 | 순차 실행 |
| 5 | **F8** 토큰 드리프트 — MarketingResponse부터 | 테마 깨짐 예방, 난이도 L이라 분할 필요 | 미착수 |
| 6 | **F3** 글별 조건 특정화 | F2와 원고 단위로 묶어 수정 | 순차 실행 |
| 7 | **F6** FAQ 확대 | 질문 의도가 명확한 글부터 원고 단위로 반영 | 순차 실행 |
| — | **F7** Person 저자 | 실제 저자·검토 책임자 표기 정책 필요 | 사용자 판단 |
| — | **F11** 수익 구조 | 데이터(수익·이탈) 없이 결정 불가 → GA/AdSense 실적 확인 후 판단 | 판단 보류 |
| — | **F9** 대형 컴포넌트 분할 | 기능 변경 없는 리스크. F8 작업과 묶을 때만 | 보류 |
| — | **F12** 골든 타임아웃 | CI·main 초록 확인 → 결함 아님. 반복 감사 편의를 위한 시간 예산 조정은 선택 사항 | 조치 불필요 |

---

## 7. 측정으로 승격해야 할 것 (현재 `추론` 등급)

정적 감사로는 답할 수 없고 실데이터가 필요한 질문:

| 질문 | 필요한 데이터 | 렌즈 |
|---|---|---|
| 사람들이 실제로 어디서 이탈하는가 | GA4 퍼널 이벤트 | L1·L5 |
| 재방문율과 결정 검토함 사용률 | GA4 재방문·이벤트 | L5 |
| 어떤 검색어로 들어와서 도구까지 가는가 | GSC 쿼리 + `ContentActionPanel` 전환 | L6·L7 |
| AI 답변에서 인용·언급되는가 | GSC 생성형 AI 성과 + 고정 질의 세트 수동 확인(`aao-geo-query-set.md`) | L7-c |
| 광고 수익 대비 이탈 비용 | AdSense + GA4 | L6 |

이 다섯 개를 채우기 전에는 리텐션·시장가치 항목에 대해 "이렇게 하면 좋아진다"고 단정하지 않는다.

---

## 8. 이번 감사에서 하지 않은 것

- 수학 엔진 수정 (§2.1 — 골든 불변, 렌더층만)
- 기존 감사 문서 재탕 — 중복 발견은 여기 기록하지 않고 원 문서를 참조
- 증거 없는 리텐션 처방
- 새 도구 추가 제안

---

*근거 수치는 2026-08-01 기준. 재실행 시 §3 스윕을 돌리고 §5에 새 로그를 추가한다.*
