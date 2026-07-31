# B1 프로젝트 설정 저장·복원 설계

> 상태: 설계 확정안 · 구현 전  
> 파일 형식: `.gop.json`

## 1. 목표

사용자가 컬럼 매핑, 필터, 뷰 설정을 파일로 저장했다가 다음 세션에 복원한다. 원본 CSV와 분석 행은 절대 저장하지 않는다. 복원 뒤 사용자가 CSV를 다시 선택하고 헤더 호환성을 확인해야 분석할 수 있다.

## 2. 제품 결정

| 항목 | 결정 | 이유 |
|---|---|---|
| 파일 | `project-name.gop.json` | 사람이 백업·이동 가능, 형식 식별 쉬움 |
| 저장 대상 | 설정 allowlist만 | raw 데이터 유출 차단 |
| CSV 재사용 | 사용자가 다시 업로드 | 브라우저 세션 밖 raw 영속 금지 |
| 매핑 복원 | 헤더 fingerprint 일치 후 | 다른 파일에 잘못된 매핑 자동 적용 방지 |
| 자동 분석 | 금지 | 사용자가 복원 결과를 확인해야 함 |
| 브라우저 저장 | 2차 단계, 명시적 opt-in | 기본은 새로고침 리셋 원칙 유지 |
| 파일명 저장 | 기본 제외 | 민감한 캠페인·클라이언트명 노출 가능 |

## 3. 파일 계약

```ts
type GopProjectV1 = {
  schemaVersion: 1;
  product: "growthopt-playbook";
  locale: "ko" | "en";
  exportedAt: string;
  groups: Record<string, {
    headerFingerprint: string; // 정규화된 header 목록 SHA-256
    mapping: Record<string, string>;
    filters: {
      dateStart?: string;
      dateEnd?: string;
      channels?: string[];
      countries?: string[];
    };
  }>;
  viewConfig: Record<string, unknown>;
  customMetrics: Array<unknown>;
  customCharts: Array<unknown>;
};
```

Set은 정렬된 배열로 저장한다. `exportedAt`은 진단용 메타이며 분석 결과의 결정론에는 쓰지 않는다.

## 4. 절대 제외

- `csvData`, `csvGroups`, `raw`, `rows`
- `canonicalData`, `mappedRows`, 파싱 캐시
- 계산 결과와 차트 데이터셋
- Google Sheet URL, 로컬 파일 경로, 파일명
- 인증 키, device token, localStorage 전체 복사
- 분석 handoff, report draft, findings

직렬화는 객체를 복사한 뒤 지우는 denylist 방식이 아니라, 허용된 필드만 새 객체로 만드는 allowlist 방식으로 구현한다.

## 5. 헤더 fingerprint

1. 헤더의 앞뒤 공백 제거.
2. Unicode NFKC 정규화.
3. 대소문자 정규화.
4. 중복을 보존한 채 정렬.
5. 구분자와 함께 직렬화 후 Web Crypto SHA-256.

값, 행 수, 파일명은 fingerprint에 포함하지 않는다. fingerprint는 데이터 동일성 증명이 아니라 매핑 호환성 검사다.

## 6. 복원 흐름

1. 사용자가 `.gop.json`을 선택한다.
2. 파일 크기, JSON, `product`, `schemaVersion`, 허용 키를 검증한다.
3. 복원 미리보기에서 포함 설정과 제외 데이터 원칙을 보여준다.
4. 사용자가 확인하면 설정을 `pendingProjectConfig`에 둔다.
5. 각 데이터 group에 CSV를 다시 업로드한다.
6. fingerprint 일치:
   - mapping과 filter를 적용
   - 화면에 적용 내역 표시
7. 불일치:
   - 일치·누락·충돌 컬럼을 비교
   - 자동 적용하지 않고 사용자가 매핑을 확인
8. 모든 경우 분석 버튼은 사용자가 다시 눌러야 한다.

## 7. UI 위치

- Header의 `프로젝트 설정` 메뉴
- `설정 내보내기`
- `설정 가져오기`
- 2차 단계: `이 브라우저에 마지막 설정 저장` opt-in

CSV 다운로드 허브와 섞지 않는다. 내보내기 전 미리보기에는 저장되는 항목과 저장되지 않는 항목을 동시에 표시한다.

## 8. 기존 코드 연결

- `src/store/useDataStore.js`
  - 현재 persist allowlist: `viewConfig`, `customMetrics`, `customCharts`
  - raw `csvGroups`와 group별 `dashboardFilterGroups` 존재
  - 새 serializer는 persist partialize와 별도 순수 모듈
- C4 group-scoped filters를 그대로 직렬화하되 Set을 배열로 변환.
- 분석 handoff와 B2/C3 세션 상태는 제외.

## 9. 파일 변경안

| 파일 | 변경 |
|---|---|
| `src/lib/project/projectSchema.js` | V1 검증·크기·키 제한 |
| `src/lib/project/serializeProject.js` | allowlist export, 금지 키 검사 |
| `src/lib/project/importProject.js` | migration, fingerprint, 호환성 비교 |
| `src/store/useDataStore.js` | pending config·확인 적용 액션 |
| `src/components/ProjectSettingsMenu.jsx` | 내보내기·가져오기 UI |
| `src/components/ProjectImportPreview.jsx` | 개인정보·호환성 미리보기 |
| `src/components/Header.jsx` | 메뉴 진입점 |

## 10. 보안 검증

- 최대 파일 크기 1MB.
- JSON depth, 배열 길이, 문자열 길이 제한.
- `__proto__`, `constructor`, `prototype` 키 거부.
- 알 수 없는 최상위 product 거부.
- 미래 schemaVersion은 명시적 오류. 과거 버전만 순방향 migration.
- mapping 대상은 현재 도구의 `TOOL_REQUIRED_FIELDS`와 `TOOL_OPTIONAL_FIELDS`로 다시 제한.
- import가 네트워크 요청을 발생시키지 않음.

## 11. 구현 단계

1. V1 schema·allowlist serializer·secret sentinel 테스트
2. 파일 export/import와 미리보기
3. CSV 재업로드 후 fingerprint handshake
4. group별 mapping/filter 복원과 수동 확인
5. 명시적 브라우저 저장 opt-in은 별도 후속

## 12. 검증

- [ ] raw 행에 심은 secret sentinel이 파일에 0건
- [ ] 금지 키가 중첩돼도 export 중단
- [ ] prototype pollution JSON 거부
- [ ] Set → 정렬 배열 → Set round-trip
- [ ] fingerprint 일치/불일치/중복 헤더
- [ ] 구버전 migration, 미래 버전 거부
- [ ] import 후 분석 자동 실행 없음
- [ ] mapping scope 밖 필드 자동 적용 없음
- [ ] KR/EN 미리보기·오류 의미 동등
- [ ] 전체 `test:all`, lint 통과

## 13. 완료 기준

원본 데이터 없이 설정 파일을 내보내고, 새 세션에서 CSV를 다시 선택한 뒤 안전하게 매핑·필터·뷰를 복원할 수 있으면 완료다.
