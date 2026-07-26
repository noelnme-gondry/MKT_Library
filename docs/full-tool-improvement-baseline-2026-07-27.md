# 전체 툴 개선 기준선 — 2026-07-27

## 기준 commit

- `HEAD`: `0627b7dac2c3f12ad458e5b596011db926e66934`
- `origin/main`: `0627b7dac2c3f12ad458e5b596011db926e66934`
- subject: `tune Classic MMM to Prism target gates (#452)`

## 보호 파일 hash

| 파일 | SHA-256 |
|---|---|
| `v2-migration/src/utils/mmmMathPr416.js` | `55849f8ab2afabaf6e4fe615d52f8419c6cb40cf49fc57cfdefd3c4006e1da84` |
| `v2-migration/src/components/tools/MarketingResponse.jsx` | `ada6eb94ab8b9a2cb6bc06a54e1d1c1eb981d257b6c78a1912a736261b1745f8` |
| `v2-migration/src/utils/mmmMath.js` | `64a3cb574f96cc711efa94c21d0375f79310897984c0bb295cc724ffe9e84547` |

`mmmMathPr416.js`와 Classic `MarketingResponse` 분기는 별도 승인 전까지 변경하지 않는다. `mmmMath.js`도 이번 공용 툴 개선 PR에서는 계산 변경 대상으로 삼지 않는다.

## 규모 스냅샷

- App route/page 파일: 38개
- `src/components`: 109개
- `src/utils + src/lib + src/store`: 144개

## 검증 기준선

| 명령 | 결과 |
|---|---|
| `npm test -- --run` | 67 files passed, 538 tests passed, 1 skipped |
| `npm run lint` | passed |
| `npm run build` | passed; 202 static paths generated |

## 범위 제외

- 별도 보안·저장 UX, local history 관리 화면, Google Sheets 고지 확장, Analytics opt-out은 이번 실행에서 제외한다.
- 기존 노서버·무비용·원본 CSV 서버 미전송 원칙은 유지한다.
- Classic MMM 숫자·추세·패널티·분배·입력 매핑은 변경하지 않는다.

## 다음 기준선 갱신 조건

다음 기준선은 PR-01 데이터 계약 작업이 머지될 때 갱신한다. 공용 계약 PR에서 Classic 보호 hash가 바뀌면 즉시 중단하고 변경 원인을 별도 조사한다.
