# 통합 CSV 스키마 + 도구별 데이터×기능 연결표 — 설계 스펙

> 상태: **Phase ② 제안(사용자 확정 대기)**. Phase ①(5-2 장기가치·리텐션 필드 버그)은 별도 PR로 선행 완료.
> 목적: "효율 & 예산 분석" 4개 도구(5-2·5-3·5-22·5-21)의 CSV를 **하나의 통합 템플릿**으로 통일하고,
> 도구마다 **데이터×기능 연결표**(스크린샷3 디자인)로 필수/옵션/타툴전용을 명시 + 템플릿 CSV 다운로드.

---

## 0. 핵심 결론 먼저

- **그레인이 2종 섞여 있다**(중요): 5-2·5-3·5-22 = **효율 그레인**(일×채널/캠페인, `cost`),
  5-21 = **소재 그레인**(일×채널×캠페인×소재, `spend`, 5-6과 CSV 공유 — `TOOL_GROUP="creative"`).
  → 통합 템플릿은 **소재 그레인 superset**(소재 컬럼 포함)으로 만들고, 효율 도구는 소재 컬럼을 무시(롤업).
- **컬럼명 불일치 3건**을 통일해야 함(아래 §3 결정 필요): `cost`↔`spend`, `campaign_name`↔`campaign_id`,
  `creative_id`/`creative_url`↔사용자가 원하는 `creative_name`/`url`. + `adgroup_name`은 **신규 추가 필요**.
- 다운로드 CSV는 **깨끗한 헤더만**(자동매핑 안 깨지게). 필수/옵션/타툴전용 범례는 **화면 연결표**가 담당(사용자 확정).

---

## 1. 현재 4개 도구의 필드 (실측 — index.html TOOL_REQUIRED/OPTIONAL_FIELDS)

| 도구 | 그레인 | 필수 | 옵션 |
|---|---|---|---|
| **5-2** 운영 대시보드 | 효율 | `date`, oneOf(`installs`/`actions`/`cost`) | `channel`,`campaign_name`,`platform`,`country`,`impressions`,`clicks`,`actions`,`revenue_d0~d360`,`ret_d7~d360`,`pu_d7~d360` |
| **5-3** 예산 배분 | 효율 | `date`,`cost`,oneOf(`channel`/`campaign_name`),oneOf(`installs`/`actions`) | `country`,`platform`,`revenue_d7`,`pu_d7`,`impressions`,`clicks` |
| **5-22** 포화도 탐지 | 효율 | `date`,`cost`,oneOf(`channel`/`campaign_name`),oneOf(`installs`/`actions`) | `campaign_name`,`revenue_d7`,`platform`,`actions` |
| **5-21** 성과 변동 탐지 | **소재** | `date`,`spend`,`channel`,oneOf(`installs`/`actions`) | `campaign_id`,`creative_id`,`creative_url`,`impressions`,`clicks` |

관찰:
- 효율 3총사는 `cost`·`channel`/`campaign_name`·`installs`/`actions`가 공통 핵심.
- 5-21만 `spend`(=비용, alias에 "cost"·"비용" 포함)·`campaign_id`·`creative_id`·`creative_url` 사용.
- 매출/리텐션 장기 윈도우(d30~d360)는 **5-2만** 사용(LTV·리텐션 탭). 5-3/5-22는 `revenue_d7`만.

---

## 2. 제안 — 통합 캔버니컬 컬럼 순서 (차원 먼저, 값은 퍼널/가치 순)

사용자 요구 순서 반영: **차원(depth 순) → 지표(퍼널·가치 순)**.

```
# 차원 (dimensions) — 굵을수록 상위
date, country, platform, campaign_name, adgroup_name, creative_name, creative_url

# 지표 (metrics) — 퍼널 → 가치
cost, impressions, clicks, installs, registrations,
pu_d0, pu_d7, pu_d14, pu_d30, pu_d60, pu_d90, pu_d180, pu_d360,
revenue_d0, revenue_d7, revenue_d14, revenue_d30, revenue_d60, revenue_d90, revenue_d180, revenue_d360,
ret_d7, ret_d14, ret_d30, ret_d60, ret_d90, ret_d180, ret_d360
```

- `registrations` = 기존 `actions`(가입/회원가입/전환)의 표시명. 키는 `actions` 유지, **헤더 alias로 `registrations`/`regs`/`가입` 추가**.
- 사용자 표현 "purchase user (Dn)" → `pu_dN`(결제 유저수). "revenue (Dn)" → `revenue_dN`. "retention (Dn)" → `ret_dN`.

---

## 3. 결정 필요 — 컬럼명 통일 (★ 사용자 확정 포인트)

CLAUDE.md §7은 `cost`(효율)와 `spend`(Creative)를 **의도적으로 별도 키**로 두었음(스코프 충돌 방지).
통합하려면 아래를 정해야 함:

| # | 충돌 | 옵션 A (권장) | 옵션 B |
|---|---|---|---|
| 3-1 | `cost`(효율) vs `spend`(5-21) | 템플릿 헤더는 **`cost`** 단일. 5-21의 `spend` alias에 이미 "cost" 포함 → `cost` 헤더가 5-21에선 `spend`로 매핑됨(코드 무변경). | 두 컬럼 다 노출 |
| 3-2 | `campaign_name`(효율) vs `campaign_id`(5-21) | **`campaign_name`** 단일 헤더 + 5-21이 `campaign_name`도 캠페인 차원으로 받게 보강(alias/매핑). | 둘 다 유지 |
| 3-3 | 소재: `creative_id`/`creative_url`(5-21) vs 사용자 희망 `creative_name`/`url` | 캔버니컬 **`creative_name`**(신규)+**`creative_url`**, `url`은 alias. `creative_id`는 alias로 흡수. | 기존 `creative_id` 유지, 표시만 변경 |
| 3-4 | `adgroup_name` 부재 | **신규 STANDARD_FIELDS 키 추가**(차원), 현재 어느 도구도 필수 아님 → 전 도구 "타툴/미래용" 표기 | 추가 안 함(요구 순서에서 제외) |

> 권장: 전부 옵션 A. 단 3-2·3-3은 **5-21 매핑 로직 보강**이 필요(현재 id 기반) — 구현 시 영향 범위 점검.

---

## 4. 도구별 데이터×기능 연결표 (스크린샷3 디자인) — 컴포넌트 설계

- 기존 전역 `renderCapabilityMatrix()`(5-2 전용, 스크린샷3)를 **범용 `renderDataFeatureMatrix(toolId)`**로 일반화.
- 행 = 통합 스키마의 데이터 계열(기본/식별/세그먼트/매출(Dn)/PU(Dn)/리텐션(Dn)/소재속성).
- 열 = 데이터 계열 · 컬럼 예시 · **이 도구에서의 상태**(필수/옵션/미사용) · 열리는 기능.
- **미사용 행**엔 "이 도구는 안 씀 — 〈다른 도구〉에서 필요" 명시(사용자 요구).
- 표 우상단에 **⬇ 이 도구 템플릿 CSV** 버튼(깨끗한 헤더 = 그 도구의 필수+옵션 컬럼만, 또는 통합 전체 — 4-1 결정).
- 데이터 출처: `TOOL_REQUIRED_FIELDS`+`TOOL_OPTIONAL_FIELDS`+`STANDARD_FIELDS`(label/group/aliases)에서 자동 생성(하드코딩 표 제거 → 표류 방지).

### 4-1. 결정 필요 — 템플릿 CSV 범위
- 옵션 A(권장): **통합 전체 템플릿 1개** + 도구별 연결표에서 "이 도구 필수/옵션" 강조. (사용자의 "하나로 합쳐서" 취지)
- 옵션 B: 도구별로 그 도구가 쓰는 컬럼만 담은 템플릿. (작게)
- 절충: 둘 다 — "통합 템플릿"(전체) + "이 도구만"(부분) 두 버튼.

---

## 5. 구현 단계 (Phase ② → ③)

**Phase ②(이 스펙 확정 후, 효율&예산 4도구):**
1. STANDARD_FIELDS 보강: `adgroup_name`,`creative_name` 신규 + `registrations`/`url` alias + 3-1~3-3 통일.
2. `renderDataFeatureMatrix(toolId)` 범용 컴포넌트(자동 생성) — 4개 도구 페이지의 매핑 안내 자리에 삽입.
3. 템플릿 CSV 다운로드(`buildTemplateCsv(scope)`) — 깨끗한 헤더(BOM+CRLF, §7 CSV 규칙) + 연결표 버튼 바인딩.
4. 5-21 매핑 보강(campaign_name/creative_name 수용) — 영향 범위 점검 + 주입식 harness.
5. 검증: `node validate.js` + 주입식 probe(4도구 연결표 렌더·자동매핑·템플릿 헤더 순서).

**Phase ③(나머지 도구):** 동일 `renderDataFeatureMatrix`를 5-4·5-18·5-20·5-x 전반에 확장(그 도구 그레인 맞는 템플릿).

---

## 6. 함정 / 주의 (CLAUDE.md §7 연계)

- 자동매핑·드롭다운은 **도구별 `toolFieldKeySet`로 스코프**(§7). 통합 헤더라도 각 도구는 자기 필드만 매핑.
  → 통합 템플릿을 5-3에 올려도 d30~d360·소재 컬럼은 5-3 스코프 밖이라 "이 도구 미사용"으로 표시(데이터 손실 X).
- `cost`/`spend` alias 충돌: 효율은 `cost` 우선, 5-21은 `cost`가 스코프 밖이라 `spend`로 잡힘(§7 기존 설계 유지).
- 템플릿 CSV는 **헤더만**(가짜 데이터행 금지) — 자동매핑은 헤더명 기준이라 주석행 넣으면 파싱 깨짐.
- 표는 하드코딩 금지 — `STANDARD_FIELDS`에서 생성해야 필드 추가 시 연결표·템플릿이 자동 동기화.
