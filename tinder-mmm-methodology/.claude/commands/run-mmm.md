전체 MMM을 돌리고 결과를 해석한다.

실행:
```bash
PYTHONPATH=src python -m mmm.cli mmm     # 또는 all (검증/감사/추세/카니발 + 그림 + verdict.md)
```

산출: adstock 롤링-CV로 λ 선택, VIF/공선쌍, 로그-로그 탄력성(HAC/AR1), Shapley R² 분해, 포화곡선.

해석 규칙:
- 귀인은 Shapley(분산 점유)로. **수준-점유율 분해 금지**.
- "한계효율(탄력성)"과 "분산 점유"는 다른 개념 — Google ROI는 탄력성 크지만 점유 작을 수 있음(둘 다 사실).
- 포화: 현 운영구간의 +$1k당 KPI로 "증액 vs 재배분"을 판단.
- adstock는 즉시효과(λ=0)가 in-sample 좋아도 CV가 나쁘면 과적합 → CV로만 선택.
