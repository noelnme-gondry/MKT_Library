# 데이터 계약 (data/weekly.csv)

주간 1행. 컬럼명은 `config.yaml`에서 매핑하므로 아래는 **샘플(현재 config 기준)** 이다.

| 컬럼 | 의미 | 비고 |
|---|---|---|
| `t` | 주 인덱스(1부터) | 날짜 = `week1_start` + (t−1)·7일 |
| `Regs` | Android 가입 수 | 종속변수 |
| `React` | Android 재활성 수 | 종속변수. RR := Regs + React |
| `G_ROI` | Google ROI 캠페인 지출($/주) | 상시 |
| `G_CBUA` | Google CBUA 지출($/주) | 2025 신규. line_off와 공선(0.98) → 레짐 흡수 |
| `Meta` | Meta 지출 | |
| `TT` | TikTok 지출 | 저물량(비-0 주 적음) |
| `Brand` | 브랜드 지출 | 결측(NaN)은 features에서 직전 수준으로 대치 |
| `PreLNY`,`Seollal` | 설날(음력) 더미 | 0/1 |
| `ChuseokOnly`,`PostChuWk` | 추석 더미 | 0/1 |
| `OtherHol` | 기타 공휴일 단주 충격 | 0/1 |
| `postChuStep`,`LineOff` | (참고) 영구 스텝 원본 | config의 `steps`는 from_week로 자체 생성 |

## 요구사항
- 주 인덱스가 **연속**(검증에서 assert).
- 지출 컬럼의 **결측(NaN) vs 진짜 0** 구분: NaN은 "미보고"로 보고 대치, 0은 "미집행"으로 유지.
  시계열 끝 결측을 0으로 코딩하면 인위적 절벽이 생기므로 NaN으로 두는 게 안전.
- 음력 공휴일(설날·추석)은 매년 날짜가 이동 → `config.lunar_weeks`에 **모든 연도** 주를 명시.

## 새 데이터 적용
1. CSV를 `data/`에 두고 `config.data.path` 변경.
2. `channels`/`dummies`/`steps`/`targets`를 컬럼명에 맞게 매핑.
3. `python -m mmm.cli validate` 로 스키마 확인 후 진행.
