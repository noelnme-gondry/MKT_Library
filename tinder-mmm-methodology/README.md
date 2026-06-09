# Tinder KR — MMM / 회귀 방법론

주간 가입·재활성에 대해 **트렌드 존재 검정 + 카니발 vs 오가닉 식별 + 수확체감 기반 재배분**을
재현 가능하게 수행하는 결정론적 파이프라인. 스프레드시트 "winner" 모델을 검증(audit)하고,
그 위에 엄밀한 버전을 올린다.

## 빠른 시작

```bash
pip install -r requirements.txt
export PYTHONPATH=src
python -m mmm.cli all          # 전체 실행 → 콘솔 + outputs/verdict.md + 그림
```

개별 단계:

```bash
python -m mmm.cli validate          # 스키마·결측·매크로 사실
python -m mmm.cli audit             # 시트 모델이 맞는지 검증
python -m mmm.cli trend             # 하락 추세가 실재하는가
python -m mmm.cli cannibalization   # 카니발 vs 오가닉
python -m mmm.cli mmm               # adstock CV·탄력성·Shapley·포화
```

다른 데이터셋: `--config path/to/config.yaml`

## 구조

```
config.yaml          # 데이터 계약 + 모든 파라미터 (여기만 고치면 됨)
CLAUDE.md            # Claude Code 하네스: 방법론 규칙·워크플로우·결정 로직  ← 먼저 읽기
data/weekly.csv      # 주간 패널 (샘플 = Tinder KR Android 127주)
data/README.md       # 컬럼 계약
src/mmm/             # 패키지 (모듈 지도는 CLAUDE.md §3)
scripts/             # 얇은 러너 (cli 래퍼)
.claude/commands/    # 슬래시 커맨드 (/audit-sheet, /trend-test, /cannibalization, /run-mmm)
outputs/             # verdict.md + 그림 (실행 시 생성)
```

## 설계 원칙 (요약 — 전문은 CLAUDE.md §0)

1. 추세는 **가정하지 말고 검정**한다(STL·Mann-Kendall·ADF/KPSS).
2. 준로그 **수준-점유율 분해 금지** → Shapley R² / 평균-편차 분해.
3. OLS 별표 단독 신뢰 금지 → **HAC + AR(1)**.
4. 공선은 식별 실패 → 레짐으로 흡수, 단독 해석 금지.
5. 변수 선택은 **R²가 아니라 식별 논리**로(브랜드는 포함).
6. 결정적 인과는 지오 홀드아웃/오가닉-split이 필요.

## 데이터 바꿔 끼우기

`config.yaml`의 `data.path`를 새 CSV로, `channels`/`dummies`/`steps`를 컬럼명에 맞춰 매핑하면
코드 수정 없이 그대로 돈다. 시트의 69주 윈도우를 재현하려면 `sheet_audit.window_weeks: 69`.
