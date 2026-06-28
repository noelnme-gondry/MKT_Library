# 범용 회귀 ⊕ Trend Forecast 통합 설계 스펙 (2026-06)

> 목표: 현재 **마케팅 반응 분석(5-18)** 안에 분리돼 있는 두 회귀 도구
> ─ ② **Trend Forecast**(MMM 고정구조·미래예측)와 ④ **범용 회귀(Lab)**(임의 CSV·예측없음) ─
> 를 **하나의 회귀+예측 도구**로 합친다. 사용자가 Cost를 포함한 **임의 비즈니스 변수**를
> 자유롭게 넣고, **미래 시나리오 예측**까지 하며, **OS(플랫폼)별 결과**가 자연히 나오게 한다.
>
> 본 문서는 자체완결(파일:줄·재사용 코드·규칙·함정·검증·단계) — 구현은 이 스펙만 보고 진행 가능.

---

## 0. 왜 합치나 (근거)

코드 실측 결과 두 도구는 **같은 OLS 엔진**(`REG_STATS`, `index.html:20045`)을 공유한다. 차이는 본질적으로 **딱 하나 — "미래로 투영하는가"**:

| 기능 | Trend Forecast | 범용 회귀 Lab |
|---|---|---|
| OLS 적합·계수·R²·VIF | ✅ | ✅ |
| adstock·log(포화) 변환 | ✅ `mmmLnMedia` | ✅ `adstock_log` 변환 |
| 계절성(Fourier sin/cos)·추세 | ✅ 자동(`mmmBuildFeatures:21211,21259`) | △ 없음(시간열 수동 필요) |
| 휴일/이벤트 더미·구조변화 step | ✅ | △ binary 독립변수로 가능 |
| **미래 예측(예산 시나리오)** | ✅ `mmmForecast:22954` | ❌ |
| **이벤트 지속/스텝 제어(미래)** | ✅ `fcStepOff` | ❌ |
| **95% 예측/신뢰 밴드** | ✅ | ❌ |
| 종속변수 | 가입/재활성 **고정** | **임의 열** 자유 |
| 독립변수 | 채널 지출 **고정** | **임의 열** 자유 |
| 데이터 | MMM colMap | 별도 CSV(`REG_LAB_STATE`) |

→ 범용회귀가 "회귀+변환"은 이미 더 유연하다(superset). TF가 유일하게 더 가진 건 **미래 투영 3종 세트**(예산 시나리오 + 이벤트 미래처리 + 밴드)와 **시간→계절성/추세 자동생성**.
→ 결론: **범용회귀에 "미래 투영 층"과 "시간→계절성/추세 변환"을 이식**하면 TF는 그 특수 케이스가 된다.

### TF "예측 불가" 진단 (부수 발견)
`mmmForecast`는 멀쩡하다. `fc=null`("예측을 만들 수 없습니다")은 **두 조건에서만** 발생(합성 재현 확인):
1. **행 수 ≤ 변수 수**(채널 + 더미 + 계절성항 합) → 회귀 행렬 특이 → `mmmOls` null(`:23072`).
2. **종속변수(가입/재활성) 열이 빈값**(`:22968`).

데모(90주·4채널)는 R²=0.98로 정상. 현재 UX 결함 = 실패 사유를 한 줄로 뭉개서 사용자가 "사라졌다"로 인지. **통합 시 진단 메시지를 구체화**(§6.1).

---

## 1. 현황 해부 — 재사용 자산 (파일:줄)

### 1.1 Trend Forecast (이식 대상)
| 자산 | 위치 | 역할 |
|---|---|---|
| `mmmForecast(panel,cfg,target,lam,model,futureSpend,horizon,stepOff,bandMode)` | `:22954` | 미래 예측 코어. 미래행 연장+예산 시나리오+밴드 |
| `mmmGetForecast(c)` | `:23192` | 활성상태(예산·horizon·단위)로 forecast 호출+메모 |
| `mmmBuildFeatures(panel,cfg,lam,withTrend)` | `:21202` | 설계행렬: sin/cos(21211)·더미(21225)·step(21246)·adstock-log채널(21257)·trend(21259)·rank드롭(`_nonRedundantCols`) |
| `renderMmmForecast(c)` | `:25088` | 예측 UI: 모델/밴드/단위/horizon 토글, **채널별 예산표**(25145), **이벤트 미래처리표 stepOff**(25168), 예측표 |
| forecast 차트 | `:26240` | 과거 실측+적합 + 미래 예측+95% 밴드 |
| `downloadMmmForecastCsv` | `:25200` | 계수·계산식·실측·예측 전체 CSV |
| `MMM_METH_STATE.{fcBudget,fcStepOff,fcBand,fcHorizon,fcUnit}` | `:23622` | 예측 컨트롤 상태 |
| 미래처리 의미 | `:25166` | 비움=지속(마지막값), N=N기간 후 끔, 0=즉시 끔 |

### 1.2 범용 회귀 Lab (확장 대상 — 여기에 얹는다)
| 자산 | 위치 | 역할 |
|---|---|---|
| `REG_LAB_STATE` | `:27929` | 자체 데이터·매핑·lambda·groupKeep·fit |
| 역할/타입/변환 상수 | `:27940-27948` | role: ignore/dependent/independent/group/label · type: continuous/binary/label · tf: none/log1p/zscore/minmax/**adstock_log** |
| `regLabGuess(col,rows)` | `:27951` | 자동매핑: cost/spend/budget→independent+adstock_log, 0/1→binary, regs/revenue→dependent, platform/channel/group→group, date/week→label |
| `regLabRun()` | `:28096` | 매핑읽기→그룹필터(28103)→n≤k 가드(28118)→변환(28126)→OLS+VIF(28135) |
| `regLabReadMapping()` | `:28065` | colMap→{dep,indep[],group,label,types,tf} |
| `monRegLabBody()` | `:28167` | 매핑 DnD UI + 결과 |
| `regLabCharts()` | `:28381` | 실제vs예측·기여도 차트 |
| `regLabSummary()` | `:28308` | 계수표·기여도 텍스트 |
| `regLabExportData/Coef` | `:28533,:28564` | CSV export |
| `runRegLabTests` (있으면) | grep `runRegLabTests` | 골든 |

### 1.3 공유 엔진 (둘 다 사용 — 재유도 금지)
`REG_STATS`(`:20045`, OLS/inv/특이행렬 throw) · `REG_TRANSFORMS`(none/log1p/zscore/minmax/adstock_log) · 검증됨(β복원·t검정).

### 1.4 플랫폼(OS) 현재 처리
- **TF**: `MMM_METH_STATE.platform`(All/iOS/Android, `:23610`)로 **행 필터**(`mmmGetPanel:24131`) → 선택 OS만 **재적합**. 단일선택 pills(`:25456`).
- **범용회귀**: `group` 역할 + `groupKeep`(Set, **다중선택 keep**) → union 행으로 **풀링 적합**(`regLabRun:28103`). per-group pills(`regLabRenderGroupPills:28348`).
- ⚠ 의미 차이: TF=OS별 분리모델, 범용회귀=선택그룹 합쳐 1모델. §4에서 통합 정의.

---

## 2. 통합 데이터 모델 (CSV 매핑 합치기)

**하나의 CSV·하나의 매핑**으로. 범용회귀 역할 체계를 베이스로 확장:

### 2.1 통합 역할(role)
| role | 의미 | 미래확장(§3) |
|---|---|---|
| `dependent` | 종속변수(가입·매출·재활성·임의 KPI) 1개 | — (예측 대상) |
| `independent` | 독립변수(Cost·가격·CS콜·날씨 등 임의 N개) | 변수별 미래스펙 |
| `group` | OS/플랫폼/세그먼트(분리축) | §4 |
| `time` | 날짜/주차(예측 X축·계절성/추세 생성원) | 자동 연장 |
| `ignore` | 미사용 | — |

→ 기존 `label`을 `time`으로 승격(예측엔 시간축이 1급 시민). binary는 type으로 유지(independent + type:binary = 이벤트/더미).

### 2.2 타입·변환
- type: continuous / binary / label (유지)
- tf: none / log1p / zscore / minmax / adstock_log (유지) **+ 신규** `fourier`(시간열→계절성), `trend`(시간열→표준화 추세) — §3.3
- binary는 변환 강제 none(현행 `regLabRun:28123` 유지).

### 2.3 통합 자동매핑 (Cost 자동 — 사용자 요구)
`regLabGuess`(`:27951`)를 베이스로 `mmmAutoMapPartial`(`:23768`) 규칙 흡수:
1. **Cost/지출 계열**(`cost|spend|비용|지출|budget|imp|click`) + 숫자 → `independent` + `adstock_log` ✅(이미)
2. **0/1 플래그** → `independent` + type:binary(이벤트/휴일)
3. **종속 후보**(`reg|가입|signup|install|react|재활성|revenue|매출|purchase|conv`) + 숫자 → `dependent`
4. **OS/플랫폼/세그먼트**(`platform|os|채널|channel|group|구분|세그|segment`) + 비숫자 → `group`
5. **날짜/주차**(`date|day|week|월|일자|주차`) → `time`
6. 파생열(ln/log/sin/cos·`derived` 정규식 `:23770`) → 자동 skip
7. 나머지 숫자 → `independent` + none

→ 단일 `unifiedGuess(col,rows)` 순수함수로. 우선순위는 위 순서(0/1 먼저 → 날짜 오인 방지, `regLabGuess:27964` 교훈).

### 2.4 함정 (매핑)
- **스코프 충돌**: `cost`(효율 5-2)와 `spend`(creative)·범용회귀 독립 — CLAUDE.md §7 "cost vs spend 별도 키". 범용회귀는 자체 CSV라 MMM colMap과 무관(독립 상태) — 그대로 유지.
- 종속·OS 중복 후보는 **첫 매칭만**(`regLabReadMapping:28078` `m.dep=m.dep||c` 패턴 유지).

---

## 3. 미래 투영 층 (신규 — TF에서 이식)

범용회귀 fit 후, **각 독립변수에 "미래엔 어떻게 될지" 스펙**을 받아 설계행렬을 미래로 연장 → `REG_STATS.ols` 계수로 외삽 + 밴드. `mmmForecast`의 로직을 범용 버전으로 일반화.

### 3.1 변수별 미래확장 규칙
| 변수 종류 | 미래 입력 | 기본값 | TF 대응 |
|---|---|---|---|
| continuous (Cost·예산·가격) | **미래 값**(시나리오) 입력 | 최근 N평균 | `futSpendByKey`(`:22985`) |
| binary/event (휴일·이벤트·구조변화) | 지속 / N기간 후 끔 / 즉시 끔(0) | 지속(마지막값) | `stepOff`(`:23023`) |
| time→fourier(계절성) | 자동 연장(사인/코사인 계속 순환) | 자동 | sin/cos(`:21211`) |
| time→trend(추세) | 자동 연장(계속 증가) | 자동 | trend(`:21259`) |

### 3.2 밴드 (재사용)
`mmmForecast`의 leverage 기반 95% 밴드(`:23081-23101`): mean(신뢰구간·평균추세·좁음) / pred(예측구간·개별행·넓음). `REG_STATS`에 `XtXinv`·`sigma2` 노출 필요(OLS fit 반환 확장) → leverage `lev(x)=xᵀ(XᵀX)⁻¹x`.

### 3.3 시간→계절성/추세 변환 (신규 — 유일한 진짜 신규 로직)
- `time` 열에서 행 인덱스 t 도출 → `fourier`: `cfg.periods`(주간 13/52 등)로 sin/cos 쌍 생성. `trend`: `(t−mean)/std`.
- 미래행은 t 연장 → sin/cos 자동 순환, trend 자동 외삽.
- 순수함수 `regBuildTimeFeatures(timeVals, periods, horizon)` → {hist, future} 열. `mmmBuildFeatures:21211,21259` 일반화.

### 3.4 코어 함수 (신규, 순수)
```
regForecast(state, mapping, futureSpec, horizon, bandMode)
  → { coef[], r2, vif[], histFitted[], futPred[], lo[], hi[],
      futRows{var→[]}, labels[], splitAt }
```
`mmmForecast:22954` 구조 그대로, 채널/더미 하드코딩만 "매핑된 independent/binary/time"으로 치환. `RegForecastMath` 객체에 모음(§8 통계표준).

---

## 4. OS(그룹)별 처리 — "자연히 다 포함"

사용자 요구: OS 구분이 자연스럽게 다 나와야. 두 방식 통합:

### 4.1 단일 OS 보기 (TF 방식)
group 매핑 시 **단일선택 pills**(전체/iOS/Android…). 선택 OS로 행 필터 → 그 OS만 적합+예측. `MMM_METH_STATE.platform` 패턴(`:24131`)을 범용 group으로.

### 4.2 OS별 비교 (신규, 권장 기본)
- "전체" 대신 **OS별 분리 모델 N개**를 한 번에 적합 → 계수·예측을 OS별로 나란히(작은 multiples 차트 + OS별 계수표).
- 각 OS는 독립 OLS(풀링 X) — OS 간 반응계수 차이가 핵심 인사이트(iOS adstock ≠ Android).
- 행 부족 OS는 "데이터 부족" 표시(§6.1 가드 재사용), 다른 OS는 정상 진행.

→ **기본 = OS별 분리**, 토글로 "전체 풀링"도 제공. (현재 범용회귀의 multi-keep 풀링은 "전체 풀링" 모드로 보존.)

---

## 5. UI 구성 (범용회귀 본문 확장)

`monRegLabBody`(`:28167`)에 섹션 추가(전부 render층 → 골든 byte-동일):
1. **§매핑**: 통합 DnD(역할·타입·변환), Cost 자동매핑 배지, OS(group)·time 역할 추가.
2. **§적합 결과**(기존): 계수표·VIF·실제vs예측·기여도. OS별이면 OS 탭/스몰멀티플.
3. **§미래 예측**(신규, TF 이식): 변수별 미래 입력표(연속=값, 이벤트=지속/N), horizon·단위·밴드 토글, 예측 차트(95% 밴드), 예측표, 전체 CSV.
4. **결론-우선**(§0 평어): "이 예산이면 ○○가 △△ 변화" 카드 먼저, 전문 진단은 `<details>`.

---

## 6. 함정 (구현 시 필수 — 재사용 교훈)

### 6.1 행≤변수 → 구체적 진단 (현재 silent null 개선)
`fc=null`/`n≤k` 시 "모델 적합 실패" 대신 **왜·얼마나 부족한지**: "표본 N행 < 변수 K개(채널 C + 이벤트 E + 계절성 S). 행을 늘리거나 변수를 줄이세요." `regLabRun:28118` throw 메시지 패턴 확장. OS별이면 OS마다 표시.

### 6.2 외삽 무효 경고 (이미 있음 — 유지)
log/adstock 변환항의 level-share 외삽 무효(`monRegLabBody:28265` 콜아웃). 미래 예측은 "관측 회귀의 외삽(가설)"·인과는 holdout(5-15) 전용 — 캐비엇 유지.

### 6.3 천단위 콤마 입력
예산·미래값 입력은 `type=text inputmode=numeric` + blur 재포맷, **모든 read 사이트 콤마 strip**(CLAUDE.md §7 `allocParseNum`). `parseFloat("72,341")=72` 함정.

### 6.4 차트
`destroyChartIfExists` 후 재렌더, `CHART_THEME` getter(다크/라이트), 인라인 script 금지(`bindRegLabHandlers`에서 `regLabCharts()` 직접 호출 — 현행 유지). `<details>` 안 canvas는 펼칠 때 `resize()`.

### 6.5 결정론·rank드롭
`Math.random` 금지. 완전공선/전부-0 열은 `_nonRedundantCols`(`:21271`) 또는 `REG_STATS.inv` 특이행렬 throw(`:20063`) catch → 사용자 안내. VIF로 공선 사전경고(`regLabRun:28135`).

### 6.6 OS별 분리 시 시그 캐시
캐시키에 OS·미래스펙 포함(`mmmMethCacheKey:24177`·`regLabSignature:28085` 패턴). 토글은 lookup만(§4.4).

---

## 7. 검증

1. **골든**: `runRegLabTests` 확장(없으면 신설) — 합성 데이터로 ① OLS 계수 복원 ② adstock_log 변환 ③ **신규: 미래 예측 외삽값 결정론**(byte-동일) ④ fourier/trend 시간확장 ⑤ OS별 분리 = 각 OS 독립적합. `node validate.js` 통과.
2. **주입식 harness**(§7 PR#102): `regForecast` 양 분기(밴드 mean/pred)·OS별 N모델·행부족 가드를 code+inject로 직접 호출 검증(render-throw는 골든이 못 잡음).
3. **회귀 동등성**: 통합 도구로 TF와 동일 매핑(가입+채널) → TF `mmmForecast`와 예측값 근사 일치 확인(이식 정확성).

---

## 8. 단계별 구현 (핸드오프 — 작은 PR 단위)

| Phase | 작업 | 산출 | 위험 |
|---|---|---|---|
| 1 | 진단 메시지 구체화(§6.1) — TF·범용회귀 양쪽 fc=null/n≤k | 즉시 UX 개선, 독립 머지 가능 | 低 |
| 2 | 통합 자동매핑 `unifiedGuess`(§2.3) + role에 `time`·OS group | 매핑 통합 | 低 |
| 3 | `regBuildTimeFeatures`(§3.3) 시간→fourier/trend + 골든 | 계절성/추세 | 中 |
| 4 | `RegForecastMath.regForecast`(§3.4) 미래투영 코어 + 밴드 + 골든 | 예측 로직 | 中 |
| 5 | 미래 예측 UI(§5.3) + 차트 + CSV — TF UI 이식 | 예측 화면 | 中 |
| 6 | OS별 분리/비교(§4) | OS 결과 | 中 |
| 7 | TF 탭 → 범용회귀 redirect 흡수(§9 결정 후) + IA·navigate 정리 | 단일 도구 | 中 |

각 Phase: `node validate.js` + 주입식 harness 통과 후 머지. 한 번에 한 종류(CLAUDE.md §4 안전원칙).

---

## 9. 결정 사항 (2026-06 확정)

1. **TF 탭 운명**: ⓐ **범용회귀로 redirect 흡수** = 단일 도구. 기존 ② Trend Forecast 탭 제거, 구 경로는 `navigate` redirect로 북마크 보존(§4.2 흡수 id 패턴). → Phase 7.
2. **도구 위치**: **5-18(마케팅 반응 분석) 탭으로 유지**. 독립 사이드바 승격 안 함 — 구조 변경 최소화, 5-18 host 탭 구성 내에서 통합.
3. **OS 기본 모드**: **OS별 분리 모델이 기본**(§4.2). iOS·Android 각각 독립 적합 → 계수·예측 나란히. 토글로 "전체 풀링"(현 범용회귀 multi-keep) 보존.
4. **종속변수 자유도**: 가입·매출 외 임의 KPI 종속 허용. 단 마케팅 외 데이터는 인과해석 캐비엇 문구 표시(§6.2 외삽 무효 경고와 한 세트).

→ 4건 모두 확정. 스펙 전체 구현 진행 가능. Phase 순서는 §8.

---

*근거 코드 위치는 모두 `index.html` 2026-06 기준. 구현 중 줄번호 이동 가능 — 함수명으로 재확인.*
