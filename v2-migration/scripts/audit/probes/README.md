# 감사 탐침 (probes)

회차별로 실측에 쓴 임시 테스트다. **`src/` 밖에 둔다** — vitest include가
`src/**/*.smoke.test.jsx`라 여기 있는 동안은 `test:all`에 섞이지 않는다.

## 실행

```bash
cp scripts/audit/probes/r1-probe.jsx src/components/dashboard/__probe.smoke.test.jsx
npx vitest run --project smoke src/components/dashboard/__probe.smoke.test.jsx --reporter=verbose
rm src/components/dashboard/__probe.smoke.test.jsx
```

상대 import(`../../../scripts/audit/degenerate-fixtures.mjs`)가 위 경로 기준이므로
`src/components/dashboard/` 아래에 두고 돌려야 한다.

## 목록

| 파일 | 무엇을 재는가 | 회차 |
|---|---|---|
| `r1-probe.jsx` | 5-2 탭 9개 × 퇴화 입력 6종 — Infinity·NaN·undefined 출현 | R1 |
| `r1-dash.jsx` | 5-2 전체 화면 × 퇴화 입력 — 차단 여부·결측 고지 위치·가시성 경로 | R1 |
| `r1-denom.jsx` | 성과 기준(설치/가입) 토글이 탭별로 실제 전파되는가 | R1 |
| `r2-curve.jsx` | 5-3·5-22 × 퇴화 입력 6종 — 거짓 숫자·throw | R2 |
| `r2-budget-overrun.jsx` | 5-3 계획 지출이 입력 예산을 넘는가 · `holdLowConfidence` on/off 대조 | R2 |

**주의**: 탐침이 공허하게 통과하지 않는지 먼저 확인할 것. `r1-probe`는 처음에
아무것도 출력하지 않았는데, 그건 결함이 없어서가 아니라 출력 자체를 안 하고
있었기 때문이었다(렌더 길이를 찍어 확인). 셋업이 상태를 바꿨다면 그 사실을
단언한다(`expect(isGroupAnalyzed(...)).toBe(true)`) — §7.
