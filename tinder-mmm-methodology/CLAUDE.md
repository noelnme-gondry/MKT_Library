# CLAUDE.md — MMM / 회귀 방법론 하네스

이 저장소는 **주간 모바일 성장 지표(가입·재활성)** 에 대해 "무엇이 트렌드를 얼마나 움직였는가"와
"매체가 오가닉을 잠식(카니발)하는가 아니면 외생 하락을 방어하는가"를 **방어 가능하게** 추정하는
결정론적 파이프라인이다. Claude Code는 이 문서의 규칙을 따른다.

---

## 0. 황금 규칙 (어기지 말 것)

1. **추세를 가정하지 말고 검정하라.** 회귀에 `t`를 넣고 그 계수를 "추세"라 부르는 건 순환논증이다
   (`t`가 부드러운 변동·지출 램프를 흡수해 음(−) 계수가 사실상 보장됨). 추세의 *존재*는
   `mmm.trend.trend_existence`(STL·Mann-Kendall·ADF/KPSS)로 따로 검정한다.
2. **준로그 수준-점유율 분해 금지.** `Y ~ β·ln(1+지출)`에서 "지출→0 대비 기여"를 더하면
   `ln(1)=0` 외삽으로 말도 안 되는 수치(미디어 점유 >100%)가 나온다. 귀인은 **Shapley R²**
   또는 **평균 대비 편차 분해**(`mmm.attribution`)만 쓴다.
3. **OLS 별표를 단독으로 신뢰하지 마라.** 주간 데이터는 자기상관 → SE 과소추정. 항상 **HAC + AR(1)**
   (`mmm.models.fit_hac`, `fit_ar1`)를 병기한다.
4. **공선은 식별 실패다.** VIF>10이거나 신규 채널이 구조 변화와 겹치면(예: CBUA↔line_off, corr 0.98)
   해당 채널을 **레짐 항으로 흡수**(config `collinearity.fold_into_regime`)하고 단독 해석하지 않는다.
5. **변수 선택은 R²가 아니라 식별 논리로.** 회귀변수를 추가하면 R²는 절대 안 떨어진다.
   "브랜드 넣으니 R²가 낮아져서 뺐다"는 잘못된 추론(대개 결측 행 손실). 브랜드는 강한 드라이버이므로 포함한다.
6. **인과 주장 자제.** 관측 회귀 = 연관. 카니발 vs 오가닉의 결정적 증거는 지오 홀드아웃/오가닉-split.
7. **데이터는 코드가 아니라 `config.yaml`로 바꾼다.** 컬럼 매핑·채널·더미·윈도우·파라미터 전부 config.

---

## 1. 실행 (Claude Code에서)

```bash
pip install -r requirements.txt
export PYTHONPATH=src

python -m mmm.cli validate          # 1) 스키마/결측/매크로 사실
python -m mmm.cli audit             # 2) 시트(스크린샷) 모델 검증
python -m mmm.cli trend             # 3) 추세 존재 검정 (타깃별)
python -m mmm.cli cannibalization   # 4) 카니발 vs 오가닉
python -m mmm.cli mmm               # 5) adstock CV·VIF·탄력성·Shapley·포화
python -m mmm.cli all               # 전체 + outputs/verdict.md + 그림
```

다른 데이터: `python -m mmm.cli all --config path/to/other.yaml`

---

## 2. 분석 워크플로우 (2단계 포크)

```
STEP 1  매체 제외 하락이 "실재"하는가?  -> mmm.trend.trend_existence
        ├─ 아니오(가입): 설명할 하락 없음. 종료.  ('−34%'는 t를 넣어서 나온 산물)
        └─ 예(재활성, 완만): STEP 2로.

STEP 2  그 하락은 카니발인가 오가닉인가?  -> mmm.cannibalization.verdict
        세 독립 검정의 삼각검증:
          ① 시간 선행성   램프 이전 저지출 구간에서 이미 하락? (원인은 결과에 선행)
          ② 허위상관      raw 음상관이 탈추세/1차차분에서 소멸·반전? (교란 = 시간)
          ③ 순증분        net 유료 탄력성 > 0? (강한 카니발이면 ≤0)
        2/3 이상 오가닉 → "매체는 방어, 원인 아님".

마지막: 결정적 검증(지오 홀드아웃 / 오가닉·유료 split 모델)을 다음 단계로 제시.
```

각 타깃(가입/재활성)은 **반드시 따로** 돌린다. 합성 지표(RR)에 맞는 스펙이 각 구성요소에 맞는 건 아니다.

---

## 3. 모듈 지도

| 모듈 | 역할 |
|---|---|
| `mmm/config.py`, `data.py` | config 로드 / 패널 적재·검증(스키마 assert, 결측 플래그, 매크로 사실) |
| `mmm/features.py` | adstock, **full sin+cos** 계절성, 음력 더미, 구조 스텝, 로그. `sheet_design`=시트 스펙 재현 |
| `mmm/diagnostics.py` | VIF, 공선쌍, 자기상관(DW·Ljung-Box) |
| `mmm/models.py` | HAC/AR(1) 적합, **adstock 롤링-CV 선택**, 로그-로그 탄력성 |
| `mmm/trend.py` | 추세 **존재** 배터리(STL·MK 4종·ADF·KPSS·drift·잔차MK) + 판정 |
| `mmm/attribution.py` | Shapley R²(몬테카를로 LMG) + **유효한** 평균-편차 주별 분해 |
| `mmm/saturation.py` | 응답곡선·한계생산성(+$1k당 KPI) |
| `mmm/cannibalization.py` | 선행성·탈추세·순증분 + 판정 |
| `mmm/audit.py` | 시트 스펙 재현·OLS vs HAC·브랜드 포함 검정·채널 계수 불안정 |
| `mmm/report.py`, `cli.py` | 그림·verdict.md / 서브커맨드 |

---

## 4. 확장·수정 시 지침

- **새 채널/더미 추가** → `config.yaml`의 `channels`/`dummies`만 편집. 코드 불변.
- **시트의 69주 윈도우 재현** → `config.sheet_audit.window_weeks: 69`로 두면 `audit`가 그 윈도우로
  돌며 Google 계수가 0 근처로 붕괴하는(공선) 현상을 그대로 보여준다.
- **음력 공휴일 보정** → `lunar_weeks`에 실제 설날·추석 주를 모든 연도 일관되게. (원본 더미는 누락 흔함)
- **adstock 격자/CV** → `config.adstock`. 즉시효과(λ=0)가 in-sample은 좋아도 CV가 나쁘면 과적합 → CV로만 선택.
- **새 분석을 추가**할 때도 위 황금 규칙을 깨지 말 것. 특히 (1) 추세 존재 검정 없이 추세 보고 금지,
  (2) 수준-점유율 분해 금지, (3) HAC/AR(1) 없는 p값 단독 보고 금지.

---

## 5. 검증 훅 (권장)

- 코드 변경 후 `python -m mmm.cli validate && python -m mmm.cli audit` 를 스모크 테스트로.
- 결론을 바꾸기 전, 같은 결과가 **여러 추정량**(HAC·AR1·1차차분)에서 부호·크기를 유지하는지 확인.
- `outputs/verdict.md`를 PR/리포트에 첨부해 재현성을 남긴다.

---

## 6. 이 데이터에서 이미 확인된 결론 (기준점)

- 매크로: Google 총지출 2024→2025 약 +139%인데 가입 −1.5%·재활성 −5.6% (수확체감).
- **가입: 견고한 추세 없음** (존재 검정 전부 no-trend; STL +15%). '−34%'는 `t` 산물.
- **재활성: 완만한 하락 실재**(STL −7%, MK·ADF/KPSS), 그러나 **카니발 아니라 오가닉**
  (램프 이전부터 하락 + 음상관 탈추세에서 반전 + net 양).
- **Line 종료 ≈ 0**(추세 통제 시 비유의). **브랜드는 넣어야**(adjR² Regs 0.16→0.42, p<0.001).
- Google ROI는 한계효율은 크나(탄력성 ~0.3) 현 구간 포화(한계 ~30명/+$1k) → 한계 증액 비효율.
