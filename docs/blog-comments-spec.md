# 블로그 댓글 — 설계 스펙 (자체 구현 / Supabase)

상태: **플래닝만**. 이 문서는 구현 착수 전 결정과 함정을 고정하기 위한 것이고,
코드는 아직 한 줄도 없다. 실행은 별도 세션·별도 PR(§9 "설계 스펙 먼저, 구현은 핸드오프").

작성 근거: Gondry님 요청 — "모든 글에 댓글, 구글 로그인, 내 이메일만 운영자".
외부 위젯(Giscus·Disqus) 대신 **자체 구현**으로 방향 확정.

---

## 1. 왜 이게 단순한 기능이 아닌가 (착수 전 반드시 읽을 것)

이 앱은 §2.2에 따라 **서버가 없는 100% 클라이언트 사이드**다. 댓글은 그 전제를
처음으로 깨는 기능이므로, "테이블 하나 + 폼 하나"로 끝나지 않는다.

| 충돌 지점 | 내용 | 해소 방향 |
|---|---|---|
| §2.2 클라이언트 전용 | 사용자 입력이 처음으로 서버에 저장된다 | **분석 데이터(CSV)와 댓글을 계약상 완전히 분리**. 댓글은 공개 게시 텍스트이고 CSV는 여전히 서버에 안 간다. 이 구분이 화면 문구에 드러나야 한다 |
| `brandFacts.js` `account` | "가입이나 로그인이 필요 없습니다"가 `llms.txt`·랜딩·롱폼으로 그대로 나간다 | 사실 문장을 **도구 사용 범위로 한정**하도록 고쳐야 한다(예: detail에 "댓글을 쓸 때만 로그인이 필요합니다"). SSOT를 먼저 고치고 소비처는 파생(§2.12) |
| §2.3 service_role key | 댓글 CRUD를 서버 키로 하고 싶은 유혹이 생긴다 | **금지**. anon key + RLS만. 운영자 권한도 RLS 정책으로 |
| 개인정보처리방침 | 이메일·프로필 이미지·IP를 다루게 된다 | `/privacy`·`/en/privacy` 갱신이 **구현과 같은 PR에** 들어가야 한다 |
| §2.11 KR/EN | 댓글 UI·안내·에러 문구 전부 두 언어 | 문구는 한 곳(로케일 팩)에서 파생 |
| §3 Supabase 미사용 | `layout.js`에 스크립트가 주석 처리(`TODO(B2B)`)돼 있고 `supabase/schema.sql`은 폐기된 접근키 스키마다 | **되살리는 게 아니라 새로 만든다**. 접근키 스키마는 참고용으로만 두고 손대지 않는다 |

---

## 2. 결정해야 할 것 (구현 착수 전 Gondry님 확인 필요)

1. **로그인 제공자**: 구글만인가, GitHub·카카오도 여는가.
   구글만이면 도입 장벽이 가장 낮지만 Supabase에 Google OAuth 클라이언트 등록이 필요하다.
2. **모더레이션 기본값**: (a) 즉시 게시 후 사후 삭제 (b) 운영자 승인 후 게시.
   (b)는 스팸이 화면에 안 뜨지만 Gondry님이 매번 승인해야 하고, 새 글에 댓글이
   붙어도 아무도 못 본다. 개인 블로그 규모면 (a) + 신고 없음이 현실적.
3. **댓글 0건일 때 화면**: 빈 섹션을 두는가, 완전히 감추는가.
   96편 대부분이 한동안 0건일 텐데, 빈 "댓글 (0)"이 글마다 붙으면 방금 정리한
   "글 끝이 줄줄이"가 그대로 돌아온다. **접힌 상태 기본 + 쓰기 버튼만** 권장.
4. **SEO**: 댓글을 프리렌더 HTML에 넣을 것인가.
   넣으면 정적 페이지가 댓글마다 재빌드돼야 하고(현재 정적 301페이지), 안 넣으면
   클라이언트 렌더라 크롤러에 안 잡힌다. **안 넣는 쪽 권장** — 댓글은 순위 자산이 아니고,
   UGC를 인덱싱하면 스팸 리스크만 는다(`rel="ugc nofollow"`도 함께).

---

## 3. 데이터 모델 (초안)

```sql
create table blog_comments (
  id           uuid primary key default gen_random_uuid(),
  locale       text not null check (locale in ('ko','en')),
  post_slug    text not null,
  author_id    uuid not null references auth.users(id) on delete cascade,
  author_name  text not null,           -- 게시 시점 스냅샷(프로필이 바뀌어도 과거 댓글은 그대로)
  author_avatar text,
  body         text not null check (char_length(body) between 1 and 2000),
  parent_id    uuid references blog_comments(id) on delete cascade,  -- 1단계 답글만
  created_at   timestamptz not null default now(),
  edited_at    timestamptz,
  deleted_at   timestamptz              -- soft delete: 스레드 구조 보존
);
create index on blog_comments (locale, post_slug, created_at);
```

**`post_slug`는 외래키가 아니다** — 글은 `content/blog/*.md`(fs SSOT)라 DB가 모른다.
즉 **글을 삭제·리다이렉트하면 댓글이 고아가 된다**(§12.24 필라 통합 시 6곳 갱신에
"댓글 이관" 7번째 항목이 붙는다). 이걸 잡을 정합 검사가 필요하다:
발행 slug 목록에서 파생해 "DB에 있는데 발행 목록에 없는 slug"를 리포트하는 스크립트.

---

## 4. RLS 정책 (핵심 — 여기가 보안의 전부다)

```sql
alter table blog_comments enable row level security;

-- 읽기: 누구나(삭제된 건 제외)
create policy read_public on blog_comments
  for select using (deleted_at is null);

-- 쓰기: 로그인 사용자가 자기 이름으로만
create policy insert_own on blog_comments
  for insert with check (auth.uid() = author_id);

-- 수정: 본인 것만, 게시 후 15분 이내
create policy update_own on blog_comments
  for update using (auth.uid() = author_id and created_at > now() - interval '15 minutes');

-- 삭제(soft): 본인 또는 운영자
create policy delete_own_or_admin on blog_comments
  for update using (auth.uid() = author_id or is_site_admin());
```

**운영자 판별을 클라이언트에서 하지 말 것.** `email === 'noelnme@gmail.com'`을
프론트에서 비교하는 순간 그건 UI 표시일 뿐이고 권한이 아니다 — 누구나 콘솔에서
delete를 호출할 수 있다. 운영자는 **DB 함수**로 판정한다:

```sql
create or replace function is_site_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((auth.jwt() -> 'user_metadata' ->> 'email'), auth.email()) = 'noelnme@gmail.com'
$$;
```
(운영자 이메일을 소스에 박는 대신 별도 `site_admins` 테이블을 두는 편이 낫다 —
이메일이 바뀌면 마이그레이션 한 줄로 끝난다.)

**레이트 리밋**: RLS로는 못 막는다. `insert` 전 트리거에서 "같은 author_id가
최근 1분 내 3건 이상이면 raise exception"으로 DB 안에 둘 것. 클라이언트 디바운스는
방어가 아니다.

---

## 5. 프론트 배선 (예상 파일)

| 파일 | 역할 |
|---|---|
| `src/lib/supabaseClient.js` (신규) | anon key로 클라이언트 1개. **환경변수는 `NEXT_PUBLIC_*`** — 정적 프리렌더라 빌드타임에 굳는다 |
| `src/lib/blogComments.js` (신규) | 조회·작성·삭제 순수 래퍼 + 로케일 문구 팩 |
| `src/components/seo/BlogComments.jsx` (신규) | `"use client"`. 목록·작성 폼·로그인 버튼·운영자 삭제 |
| `src/app/(ko)/blog/[slug]/page.js` · `(en)/en/blog/[slug]/page.js` | FAQ 아래에 `<BlogComments locale post={slug} />` 한 줄 |
| `src/app/auth/callback/` (신규) | OAuth 리다이렉트 수신 |
| `src/app/(ko)/privacy` · EN | 수집 항목 추가 |
| `src/lib/brandFacts.js` | `account` 사실 문장 한정(§1 표) |

**§7 함정 적용**:
- 계측과 같은 이유로 **로컬 개발이 운영 DB에 쓰면 안 된다** — `analyticsHost.js`와
  같은 호스트 정확일치 게이트를 붙이거나, 로컬은 별도 Supabase 프로젝트를 볼 것.
- 댓글 본문은 사용자 입력이다. **`innerHTML` 절대 금지**, `textContent`/JSX 텍스트만.
  마크다운을 받고 싶다면 그때부터 sanitize가 필요하고, 지금 범위에서는 **평문만** 권장.
- `.blog-prose a`가 컨테이너 셀렉터로 자식을 납치한 사고(§7)와 같은 이유로,
  댓글 컴포넌트는 `.blog-prose` **바깥**에 둘 것.

---

## 6. 검증 계획

- 골든 없음(순수 수학 아님). **스모크 필수**: 비로그인 빈 상태 · 로그인 후 작성 폼 ·
  운영자 삭제 버튼이 비운영자에게 안 뜸 · 0건일 때 화면이 늘어나지 않음.
- RLS는 프론트 테스트로 검증 불가 — **SQL로 직접**: 다른 사용자 토큰으로
  update/delete가 거부되는지 확인하는 스크립트를 `supabase/`에 둔다.
  "UI에 버튼이 없다"는 권한 검증이 아니다.
- `npm run build`까지 — 새 환경변수·동적 import는 프리렌더에서만 드러난다(§16).

---

## 7. 규모 감각

Supabase 프로젝트 셋업·OAuth 등록 제외하고 **코드 700~1,100줄**(컴포넌트 350 ·
lib 200 · SQL 150 · 테스트 250 · 문구 KR/EN 100) 규모로 본다. 개인정보처리방침과
`brandFacts` 문장 수정이 여기 포함되며, 이 둘을 빼면 **정직성 계약이 깨진 채 배포**된다.
