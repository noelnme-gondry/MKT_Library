# 구글 시트 연동 셋업 가이드

CSV 업로드 대신 구글 시트를 직접 불러올 수 있는 기능. `GoogleSheetConnect.jsx`가
**API 키**로 Sheets API를 브라우저에서 직접 호출한다(OAuth·로그인 팝업 없음 —
"링크 하나 붙이기"에 어울리는 무게로 의도적으로 가볍게 설계). 우리 서버는 이
데이터를 전혀 거치지 않는다 — CSV 업로드와 동일한 "클라이언트 사이드만" 원칙(§2.2).

**제약**: API 키 방식은 비공개 시트를 못 읽는다. 불러올 시트는 반드시
**"공유" → "링크가 있는 모든 사용자" → 뷰어**로 설정돼 있어야 한다. (완전 비공개
시트까지 지원하려면 OAuth가 필요한데, 그건 로그인 팝업·동의화면이 붙어 이 기능의
"그냥 링크 붙이기" UX와 안 맞아 1차 범위에서 제외했다. 필요해지면 별도 기능으로.)

---

## 1. Google Cloud 프로젝트 준비

1. [console.cloud.google.com](https://console.cloud.google.com) → 새 프로젝트 생성 (또는 기존 프로젝트 사용)
2. 좌측 메뉴 → **APIs & Services** → **Library**
3. `Google Sheets API` 검색 → **Enable**

## 2. API 키 발급

1. **APIs & Services** → **Credentials** → **+ Create Credentials** → **API key**
2. 발급된 키가 바로 표시됨 — 복사
3. (강력 권장) **Restrict key** 클릭해서 오남용 방지:
   - **API restrictions**: `Restrict key` → **Google Sheets API**만 체크
   - **Application restrictions**: `HTTP referrers` → `https://growthoptplaybook.com/*` 등록
     (로컬 개발도 테스트하려면 `http://localhost:3000/*` 추가)

이 제한을 걸어두면 키가 코드에 노출돼도(프론트엔드 특성상 항상 노출됨) 우리
도메인에서, Sheets API 용도로만 쓰이게 막을 수 있다.

## 3. 배포 환경변수 등록

Railway 서비스 설정 → **Variables**:

```
NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY=AIzaSy...
```

**주의**: `NEXT_PUBLIC_` 접두사 변수는 Next.js가 **빌드 시점**에 코드에 박아 넣는다.
런타임에만 변수를 넣고 재배포(재빌드)를 안 하면 반영 안 됨 — 값 등록 후 반드시
재배포(redeploy)까지 진행할 것.

## 4. 동작 확인

1. 이 환경변수가 없으면 `GoogleSheetConnect`가 아예 렌더되지 않는다(반쪽짜리 기능 노출 방지) —
   설정 전엔 기존 CSV 업로드 화면과 100% 동일.
2. 설정 후 아무 도구의 빈 업로드 화면에 "📊 구글 시트에서 불러오기" 버튼이 보이면 성공.
3. 테스트용 구글 시트를 "링크가 있는 모든 사용자"로 공유 설정 → 그 링크를 붙여넣어 데이터가 불러와지는지 확인.
4. 비공개 시트 링크를 넣으면 "공유 설정을 켜주세요" 안내 메시지가 뜨는지도 확인.

## 비용

Google Sheets API 표준 사용량은 무료(과금 없음, 신용카드 등록도 불필요). 분당
300 read 요청 한도가 있는데, 개인이 시트 하나씩 불러오는 이 기능의 사용 패턴으로는
현실적으로 걸리지 않는다.

## 아키텍처 메모

- `src/utils/googleSheets.js` — 순수 파싱 함수(URL→spreadsheetId/gid, values→table, 시트 탭 range 해석). 골든 테스트 있음(`googleSheets.test.js`).
- `src/components/GoogleSheetConnect.jsx` — API 키로 Sheets API 직접 호출. 403/404는 "비공개 시트" 안내로 구분 처리.
- `src/utils/csvConstants.js`의 `autoMapHeaders()` — CSV 업로드와 구글 시트 임포트가 **같은 자동매핑 로직**을 공유(원래 `CsvUploader.jsx` 안에 있던 걸 추출, 로직 변경 없음).
- 연동 지점은 `CsvUploader.jsx` 단 한 곳 — 이 컴포넌트를 쓰는 도구(운영 대시보드·예산배분·PVM·포화도·소재분석·A/B테스트 등 12개+)에 자동으로 다 퍼진다.
- API 키는 컴포넌트 로컬 요청에만 쓰이고 Zustand store에 안 들어감 → `persistPartialize`(§2.2 원본데이터 미저장 불변식) 무관.
