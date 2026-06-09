스프레드시트 "winner" 회귀 모델이 맞는지 검증한다.

실행:
```bash
PYTHONPATH=src python -m mmm.cli audit
```

확인할 것 (CLAUDE.md §0 규칙 기준):
1. 재현된 계수에서 `t`(추세)와 `ln_G`(Google)의 OLS p와 HAC p 차이 — 자기상관으로 OLS 별표가 과대평가됐는지.
2. LineOff가 비유의인지(추세 통제 시 Line 종료 효과 ≈ 0).
3. 브랜드 포함 검정: R²가 **오르는지**(회귀변수 추가 시 R²는 안 떨어짐 → "브랜드 빼면 R² 높다"는 오류).
4. 같은 스펙에서 Google 계수가 타깃별로 출렁이는지(공선 = 식별 실패). 시트의 69주를 보려면
   config의 `sheet_audit.window_weeks: 69`.
5. RR == Regs + React 인지(평균으로 정의 확인).

결과를 요약하고, "신뢰 가능(계절·공휴일·Line)"과 "교정 필요(추세·추론·브랜드·공선·윈도우·푸리에)"로 분류해 보고.
