# 운영 대시보드 통합 + 통일 데이터 모델 + Sticky 압축바 (실행 스펙)

> **상태**: 스펙 확정 (2026-06-20). 다음 모델이 Phase 단위로 실행.
> **대상 도구**: 운영 대시보드 (내부 라우팅 id `5-2` — **절대 변경 금지** §12.8. 화면·대화에선 "운영 대시보드"로만 호칭, "효율 CSV"·"5-2" 라벨 노출 금지).
> **사용자 핵심 의도**: ① Revenue·Retention·PU 3계열을 **동일 Dn 범위·동일 trend predict**로 통일 ② 9개 탭이 "덕지덕지" → **겹치는 기능 정리해 3그룹·소수의 풍부한 대시보드**로 ③ 업로드 전엔 연결표 가이드만, 업로드 후엔 탭(잠금 표시) ④ 분석 페이지 상단을 **압축 sticky 바(제목+칩+필터)**로.

이 세션(직전 작업)에서 발생한 상태:
- PR #158 ROAS 성숙도 듀얼 메서드 / PR #159 sufficiency 2-pt / **PR #160에서 `renderCapabilityMatrix`+`MON_FEATURES` 통째 삭제** (오해로 잘못 삭제 — 사용자는 탭 카드 그리드를 지우라 한 것). **연결표는 Phase 4에서 새 형태로 복원해야 함.**

---

## 절대 제약 (변경 금지)
- 단일 `index.html`, vanilla JS, CDN만. 클라이언트 사이드 100% (CSV 서버 전송·저장 금지).
- 내부 id `5-2`/`5-8` 등 라우팅 id 불변. `git add` 명시적 파일만.
- main 직접 push 금지 → feat 브랜치 → PR → squash. syntax check + validate 필수.
- 통계 정확성·결정론 유지 (Math.random 금지, 골든 테스트 byte-동일 원칙).

---

## 데이터 모델 (통일 wide 포맷) — 모든 Phase의 기반

운영 대시보드는 **하나의 wide CSV**로 전 기능 동작. **1행 = 채널 × 설치일자(코호트)**, 컬럼에 그 코호트의 Dn 커브가 들어감.

신규/확장할 `STANDARD_FIELDS` (efficiency wide grain):
| 계열 | 키 | Dn 범위 | 현재 상태 |
|---|---|---|---|
| Revenue | `revenue_d0,7,14,30,60,90,180,360` | D0~D360 | ✅ 이미 있음 |
| PU(결제건수) | `pu_d0,7,14,30,60,90,180,360` | D0~D360 | ⚠ D0/7/14만 → **D30/60/90/180/360 추가** |
| Retention | `retention_d0,7,14,30,60,90,180,360` | D0~D360 | ❌ **전부 신규 추가** (값=잔존율 0~1 또는 %) |
| 비용/규모 | `cost`, `installs`, `actions`, `impressions`, `clicks` | — | ✅ |
| 차원 | `channel`, `platform`, `country` | — | ✅ |

파생(원본 컬럼 없음, 자동 계산):
- **ROAS_dN = revenue_dN / cost**
- **PUR_dN = pu_dN / installs** (분모는 installs; actions만 있으면 actions)

> 그룹 라벨은 `group: "코호트 D30"` 식 유지(매핑 UI 그룹핑). retention_dN도 같은 그룹에 합류시켜 D별로 Revenue/PU/Retention이 한 그룹에 모이게.

---

## Phase 1 — 데이터 모델 확장 (additive, 저위험)

1. `STANDARD_FIELDS`에 `pu_d30/60/90/180/360`, `retention_d0~d360` 추가 (alias 포함: `ret_dN`, `retention30`, `잔존율_d30` 등).
2. 파생 헬퍼: `roasDn(row, d)`, `purDn(row, d)` 순수함수 (0/누락 가드 — `getMappedRows`가 누락을 0으로 변환하므로 **분자>0 체크**, cf. §12.35 `h${d}` 버그).
3. 데모(`_demoEfficiencyData` 또는 통합 데모 빌더): retention_dN, pu_dN(D0~D360) 전 컬럼을 결정론(`seededNoise`)으로 채워 **모든 기능이 데모에서 활성**. (Retention은 D0=1.0에서 단조 감소, PU/Revenue는 단조 증가 곡선.)
4. **검증** `validate_datamodel.js`: 신규 키 존재, 데모 헤더에 전 계열 포함, roasDn/purDn 정확. 기존 골든 byte-동일(추가만).

---

## Phase 2 — 코호트 탭 wide 마이그레이션 (B안) ⚠ 최대 위험

현재 코호트 엔진은 **long 포맷**(`cohort_date`+`day_offset` 행 → `buildQualityCache` line 15901 → cohortMap.points). 이를 **wide**(설치일자 행 + retention_dN 컬럼)로 전환.

- `buildQualityCache`(15901)·`retentionCurve`·`COHORT_MATURATION`·`monCohortBody`(16308)를 wide 소스로 재작성:
  - 코호트 = 설치일자(또는 채널×설치일자) 행. retention 곡선 = 행의 retention_dN 컬럼.
  - 집계 = 행들을 cohort_size(=installs) 가중 평균.
- **리텐션 탭 재포커스** (사용자 명시 3대 기능만):
  1. **Week/Month별 리텐션** — 설치일자를 주/월 버킷으로 집계한 리텐션 곡선
  2. **세그먼트별 리텐션** — channel/country/platform별 곡선 비교
  3. **Retention Predict** — Dn trend 외삽(기존 COHORT_MATURATION 재활용, retention metric)
- **PUR·LTV 분리 제거**: `renderQualityPUR`(16406)·LTV 관련은 리텐션 탭에서 빼서 Phase 3의 "가치" 탭으로 이관.
- long 포맷 코호트 필드(`day_offset` 등)는 **deprecate**. 기존 5-8 long CSV 사용자 경로는 wide로 안내(또는 호환 어댑터 — 범위 결정 필요. 기본은 wide 전용).
- **검증**: 골든 재작성(retention 곡선·predict·세그먼트). long→wide 동일 데이터로 수치 일치 확인. render throw 가드(§12.22).

---

## Phase 3 — 탭 통합 (9개 → 3그룹·소수 대시보드)

**3그룹 확정** (사용자 승인):
- **모니터링**: 시각화 + 스코어카드 + 페이싱 + 이상탐지 → 한 대시보드에 풍부하게
- **장기가치**: 아래 "겹침 제거" 원칙으로 재분할
- **효율진단**: 퍼널 + 세그먼트

**장기가치 겹침 제거** (사용자 지적: 코호트 안에 PUR·LTV가 LTV:CAC·ROAS성숙도와 중복):
- **가치(LTV·ROAS·PUR)** 탭: LTV:CAC(회수기간·LTV배수) + Revenue/ROAS 성숙도 predict + PU/PUR 분석·predict — 돈/수익화 계열을 한 곳에.
- **리텐션** 탭: Phase 2의 3대 기능(Week/Month·세그먼트·predict) 전용.
- (정확한 탭 경계는 권장안. "합칠 놈 합쳐 한 화면에 많은 정보"가 원칙 — 관련 섹션을 한 탭에 §아코디언/카드로.)

**잠금 표시(탭 카드, 업로드 후)**: 각 탭 필요 메트릭이 미매핑이면 카드에 🔒 + "필요: X". 매핑 충족 시 활성. (연결표가 아니라 **탭 카드에** — 사용자 명시.)

---

## Phase 4 — 생애주기 + 데이터×기능 연결표 복원

- **업로드 전(게이트)**: ① CSV 업로드 박스 + ② **데이터×기능 연결표**(복원). 탭 카드 없음.
  - 연결표 = 업로드 **전 가이드**. "무슨 데이터를 매핑하면 무슨 기능이 켜지나".
  - **Dn 계열로 묶기**: revenue_d0~d360을 8행 펼치지 말고 **Revenue(Dn) / Retention(Dn) / PU(Dn)** 한 묶음씩.
  - **ROAS·PUR은 별도 행 없이** Revenue·PU 묶음 설명에 "→ ROAS·PUR 자동 산출" 표기 (B안).
  - 깔끔한 표(과거 `renderCapabilityMatrix`의 ●/◐ 매트릭스가 너무 복잡했음 — 계열 묶음으로 행 수 대폭 축소).
- **업로드 후**: 연결표 **사라짐**. 통합 탭만. 잠금은 탭 카드에.
- 게이트 본문에서 **`renderMonTabs()` 탭 카드 그리드 제거** (사용자가 지우라던 "덕지덕지"). 탭 카드는 업로드 후에만.

---

## Phase 5 — Sticky 압축바 (전역 공용, SOP↔분석 분리)

`pageShell`(3921)은 전 페이지 공용. **두 구조로 분기**:

- **분석 도구(5-x)**: 압축 sticky 바
  - **1줄차(sticky)**: 제목(`운영 대시보드`) + 칩(파일명·행수·인증·🎭)을 **한 줄**로 (스크린샷2의 칩을 제목 옆 현재 크기로).
  - **2줄차(sticky)**: 필터.
  - **eyebrow(`4-1…4-1-1`) + deck 제거.**
  - sticky 구현: `.toc`가 이미 sticky로 동작(스크롤 컨테이너에 sticky 깨는 overflow 조상 없음 — `.main`·`.content` 확인) → 헤더 영역 `position:sticky; top:<topbar高>` 가능. **현 `.mon-sticky-bar`(탭+필터 묶음) 해체** → 필터는 압축바로, 탭은 본문으로.
  - **전역 필터 슬롯**: `pageShell`에 `opts.stickyFilter` 슬롯 추가 → 운영 대시보드는 `renderMonFilterBar()` 주입. 다른 도구(5-3/5-4/5-6/5-18)는 자기 필터를 같은 슬롯으로 **점진 이전**(기존 `opts.tocFilters`도 여기로 흡수 검토).
- **SOP 문서(1-x~4-x)**: 현행 헤더 유지 + **불필요 칩 제거**(`상태 · 운영 중` 류 — 2곳, grep `상태 · 운영`).

---

## 실행 순서 권장
Phase 1(데이터) → Phase 5(sticky 바, 독립적·저위험) → Phase 4(연결표 복원+게이트) → Phase 3(탭 통합) → Phase 2(코호트 wide, 최대 위험은 마지막에 충분한 골든과). 각 Phase = 1 PR, syntax+validate+골든 통과 후 머지.

## Phase별 검증 파일 (주입식, `/tmp/validate_*.js`)
- P1 `validate_datamodel` · P2 `validate_retention_wide` · P3 `validate_tabs_consolidated` · P4 `validate_gate_capmatrix` · P5 `validate_sticky_shell`
- 차트·DnD·키보드·sticky는 headless 불가 → **브라우저 확인 필요**(§12.22 render throw repro 병행).

## 미결(실행 중 판단)
- 코호트 long CSV **호환 어댑터 둘지** vs wide 전용(기본=wide 전용, 안내 문구).
- 장기가치 탭을 2개(가치/리텐션)로 할지 더 쪼갤지 — "한 화면에 많은 정보" 원칙으로 최소화 권장.
- 전역 필터 슬롯에 다른 도구 필터를 이번에 다 이전할지, 운영 대시보드만 먼저 하고 후속 PR로 뺄지(후자 권장).
