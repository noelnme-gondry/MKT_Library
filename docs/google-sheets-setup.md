# 구글 시트 연동 셋업 가이드

CSV 업로드 대신 구글 시트를 직접 불러올 수 있는 기능. `GoogleSheetConnect.jsx`가
Google Identity Services(GIS)로 사용자 본인 OAuth 토큰을 받아, 그 토큰으로
Sheets API를 **브라우저에서 직접** 호출한다. 우리 서버는 이 데이터를 전혀
거치지 않는다 — CSV 업로드와 동일한 "클라이언트 사이드만" 원칙(§2.2)을 그대로 지킨다.

---

## 1. Google Cloud 프로젝트 준비

1. [console.cloud.google.com](https://console.cloud.google.com) → 새 프로젝트 생성 (또는 기존 프로젝트 사용)
2. 좌측 메뉴 → **APIs & Services** → **Library**
3. `Google Sheets API` 검색 → **Enable**

## 2. OAuth 동의 화면

1. **APIs & Services** → **OAuth consent screen**
2. User Type: **External** (일반 구글 계정 사용자용)
3. 앱 이름 `Growth Opt Playbook`, 지원 이메일 등 기본 정보 입력
4. Scopes: `.../auth/spreadsheets.readonly` 추가(선택 — 테스트 단계에선 생략 가능)
5. 게시 상태를 "프로덕션"으로 전환하지 않으면 테스트 사용자로 등록된 계정만 로그인 가능 —
   실제 유저에게 열려면 **Publish App**까지 진행

## 3. OAuth Client ID 발급

1. **APIs & Services** → **Credentials** → **+ Create Credentials** → **OAuth client ID**
2. Application type: **Web application**
3. **Authorized JavaScript origins**에 등록:
   - `https://growthoptplaybook.com`
   - (로컬 개발 시) `http://localhost:3000`
4. 생성된 **Client ID**(`xxxxx.apps.googleusercontent.com` 형식)를 복사
   - ⚠️ Client Secret은 필요 없음(브라우저 전용 OAuth 흐름) — 발급돼도 사용하지 않음

## 4. 배포 환경변수 등록

Railway 서비스 설정 → **Variables**:

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
```

**주의**: `NEXT_PUBLIC_` 접두사 변수는 Next.js가 **빌드 시점**에 코드에 박아 넣는다.
런타임에만 변수를 넣고 재배포(재빌드)를 안 하면 반영 안 됨 — 값 등록 후 반드시
재배포(redeploy)까지 진행할 것.

Client ID는 OAuth 공개 식별자라 프론트엔드에 노출돼도 안전하다(Supabase anon key와
같은 성격 — service_role 같은 비밀키가 아님, §2.3과 별개 사안).

## 5. 동작 확인

1. 이 환경변수가 없으면 `GoogleSheetConnect`가 아예 렌더되지 않는다(반쪽짜리 기능 노출 방지) —
   설정 전엔 기존 CSV 업로드 화면과 100% 동일.
2. 설정 후 아무 도구의 빈 업로드 화면에 "📊 구글 시트에서 불러오기" 버튼이 보이면 성공.
3. 실제 시트 URL을 붙여넣고 구글 로그인 팝업 → 데이터 불러오기까지 확인.

## 아키텍처 메모

- `src/utils/googleSheets.js` — 순수 파싱 함수(URL→spreadsheetId, values→table). 골든 테스트 있음(`googleSheets.test.js`).
- `src/components/GoogleSheetConnect.jsx` — GIS 스크립트 지연 로드 + OAuth 토큰 요청 + Sheets API 호출.
- `src/utils/csvConstants.js`의 `autoMapHeaders()` — CSV 업로드와 구글 시트 임포트가 **같은 자동매핑 로직**을 공유(원래 `CsvUploader.jsx` 안에 있던 걸 추출, 로직 변경 없음).
- 연동 지점은 `CsvUploader.jsx` 단 한 곳 — 이 컴포넌트를 쓰는 도구(운영 대시보드·예산배분·PVM·포화도·소재분석·A/B테스트 등 12개+)에 자동으로 다 퍼진다.
- 토큰은 컴포넌트 로컬 상태에만 존재, Zustand store에 안 들어감 → `persistPartialize`(§2.2 원본데이터 미저장 불변식) 무관.
- 지원 범위: 시트 링크 붙여넣기 방식만(Google Picker UI는 별도 API 활성화·스코프 필요해 1차 범위에서 제외).
