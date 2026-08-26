# 감사 — #749 · #750 · #751 (구성 변화 후속 + 용어집/검색의도)

> 감사자: Claude (§1.1 감사 역할) · 대상 커밋: `a708a46`(#749) · `b97d7db`(#750) · `d9823a6`(#751)
> 기준 main: `d9823a6` · 작성 2026-08-26
> 이 문서는 **보고서**다. 코드는 고치지 않았다.

---

## 0. 한눈에

| # | 대상 | 판정 | 비고 |
|---|---|---|---|
| F1 | #749 자동 역할 선택 | **회귀(중간)** | 분석 단위로 식별자·자유 텍스트가 잡힌다. 재현 완료 |
| F2 | #751 검색의도 레지스트리 | 관찰(낮음) | 소비처 0곳인데 주석은 "화면 링크가 파생된다"고 말한다 |
| ✅ | #749 기간 키 정합 | 검증됨 | 실제로 결과가 통째로 비던 버그였다 |
| ✅ | #749 패널 캐시 | 검증됨 | 게이트 유지한 채 필터 변경 시 재빌드 제거 |
| ✅ | #750 용어집 편집 메타·sitemap | 검증됨 | 검토 메타를 날조하지 않음, KO/EN 동시 반영 |

---

## 1. 검증된 것 (문제 없음)

### 1.1 #749 기간 키 정합 — 주장이 사실이고, 심각한 버그였다

`defaultPeriods`가 원본 문자열을 그대로 쓰고 패널은 `normalizePeriod`로 ISO 정규화해서, **날짜 표기가 ISO가 아닌 CSV에서는 결과가 통째로 비었다.**

재현(합성 4행, `date="2026/03/01"`·`"2026/04/01"`):

```
이전 동작(원본 문자열 키):  status=INSUFFICIENT_DATA
                            reasons=LOW_PERIOD_POPULATION,MISSING_PERIOD
                            pre 모수=0
현재 동작(#749 이후):        status=READY, pre 모수=200
```

`periodKeys()`가 패널과 같은 정규화를 쓰도록 바꾼 것이 정확한 수정이다. 인과 확인의 개입 시점 선택도 같은 값으로 비교하므로, 같은 CSV에서 항상 `CUTOFF_OUT_OF_RANGE`로 막히던 것이 함께 풀렸다.

### 1.2 #749 패널 캐시 — 게이트를 유지한 채 재빌드만 제거

`panel` useMemo의 의존성이 `active`(기간·범위·선택 멤버 포함)에서 `[canBuildPanel, rows, roles, dimensions]`로 바뀌었다.

- 기간·경쟁 범위를 바꿔도 원본 재순회 없음 → 큰 파일에서 멈추던 문제 해소
- `canBuildPanel`이 `gateOpen`을 포함하므로 **분석 게이트(§12.5)는 그대로** 유지

### 1.3 #750 용어집 편집 메타 — 값을 날조하지 않았다

- `reviewer`·`reviewedAt` 필드는 `content/glossary/_TEMPLATE.md`에만 존재하고, **발행 용어 48편에는 값이 없다.**
  AGENTS §12.29 "검토 메타는 에이전트가 채우지 않는다 — 인프라만 유지하고 값은 비워 둔다"를 지켰다.
- KO(`(ko)/glossary/[slug]`)와 EN(`(en)/en/glossary/[slug]`) 페이지가 **함께** 수정됐다(§2.11).
- sitemap `lastModified`는 `contentLastModified()`로 통일되며 `updated || date` 폴백이라 기존 동작 대비 회귀 없음.

---

## 2. F1 — 분석 단위 자동 선택이 식별자·자유 텍스트를 받아들인다 (중간)

### 재현

**케이스 A — id 컬럼이 함께 있을 때**

```
입력 헤더: date, campaign_id, campaign, gender, signups
          (campaign_id = "c-8f3a91" 같은 식별자)

기대: 분석 단위 = campaign,     세그먼트 축 = gender
실제: 분석 단위 = campaign_id,  세그먼트 축 = campaign, gender
```

두 가지가 동시에 어긋난다.

1. Mix/Rate 분해 표가 사람이 못 읽는 `c-8f3a91` 단위로 나온다.
2. 진짜 캠페인 컬럼이 세그먼트 축으로 내려가 **"캠페인 구성이 바뀌었다"는 동어반복 축**이 랭킹에 올라온다.

**케이스 B — 자유 텍스트가 어휘에 걸릴 때**

```
입력 헤더: date, creative_message(긴 문장), gender, signups
실제: 분석 단위 = creative_message   ← 문장 하나하나가 하나의 "단위"가 된다
```

### 원인

`autoDeclare`의 역할 후보 필터가 `DATE_COLUMN`·`MEASURE_LIKE` 두 가지만 제외한다.

```js
const roleCandidates = profile.columns.filter((column) => (
  !used.has(column.header)
  && !column.reasons.includes(CANDIDATE_REASON.DATE_COLUMN)
  && !column.reasons.includes(CANDIDATE_REASON.MEASURE_LIKE)
));
```

#749의 의도는 "캠페인이 20개를 넘는다고 분석 단위가 사라지면 안 된다"였고 그 자체는 맞다.
문제는 그 과정에서 `HIGH_CARDINALITY`만이 아니라 **`IDENTIFIER_LIKE`·`FREE_TEXT` 제외까지 함께 풀린 것**이다.
(이전에는 `profile.candidates`를 썼기 때문에 이 둘이 자동으로 걸러졌다.)

부수적으로 `SINGLE_VALUE`는 scope에서만 제외되고 entity에서는 제외되지 않아 처리 방식이 비대칭이다.

### 제안 패치 (적용하지 않음)

의도는 그대로 두고 부작용만 닫는다 — **고카디널리티만 예외로 허용**한다.

```js
// 세그먼트 축의 cardinality 제한만 풀고, 축 자격을 잃은 다른 사유는 그대로 지킨다.
// 식별자·자유 텍스트가 분석 단위가 되면 Mix/Rate 표를 사람이 읽을 수 없다.
const ROLE_BLOCKING = [
  CANDIDATE_REASON.DATE_COLUMN,
  CANDIDATE_REASON.MEASURE_LIKE,
  CANDIDATE_REASON.IDENTIFIER_LIKE,
  CANDIDATE_REASON.FREE_TEXT,
  CANDIDATE_REASON.SINGLE_VALUE,
];
const roleCandidates = profile.columns.filter((column) => (
  !used.has(column.header) && !ROLE_BLOCKING.some((reason) => column.reasons.includes(reason))
));
```

`scope`의 개별 `SINGLE_VALUE` 필터는 위 목록에 흡수되므로 함께 제거한다.

### 회귀 테스트 제안

`autoDeclare.test.js`에 두 케이스를 그대로 고정한다. 두 입력 모두 **현재 코드에서 실패**한다.

- `campaign_id`와 `campaign`이 함께 있으면 분석 단위는 `campaign`, 축에는 `campaign`이 없다
- 긴 자유 텍스트 컬럼은 분석 단위가 되지 않는다
- 캠페인 값이 20개를 넘어도 분석 단위로 남는다(#749가 지키려던 것 — 함께 고정해야 되돌아가지 않는다)

---

## 3. F2 — 검색의도 레지스트리에 소비처가 없다 (낮음)

`src/lib/searchIntentRegistry.js`의 파일 주석:

> 화면 링크와 커버리지 테스트가 이 목록에서 함께 파생된다.

실측(전수 grep): 이 모듈을 읽는 곳은 **자기 자신과 자기 테스트뿐**이다. `intentLinksFor()`를 호출하는 화면이 없다.

- 커버리지 테스트는 실제로 파생된다 ✅
- **화면 링크는 아직 파생되지 않는다** ❌ — 주석이 현재 상태를 앞질러 있다

AGENTS §16 "신호를 계산해 놓고 판정에 안 쓰는 자리가 반복된다 — 플래그·점수를 만들었으면 읽는 곳을 그 자리에서 배선할 것", §12.29 "새 페이지는 sitemap에 넣었다고 사이트에 붙은 게 아니다"와 같은 형태다.

**해는 없다**(죽은 데이터일 뿐 잘못된 숫자를 만들지 않는다). 다만 다음 작업자가 주석을 읽고 "이미 배선됐다"고 판단할 위험이 있으므로, 둘 중 하나가 필요하다.

1. 다음 PR에서 화면 링크를 붙인다 — 그때까지 주석을 현재 상태로 낮춘다("링크 배선은 후속")
2. 지금 붙인다 — 용어집·블로그 상세의 관련 링크 영역이 자연스러운 자리다

---

## 4. 감사 범위와 방법

- **읽은 것**: 세 커밋의 diff 전문, `autoDeclare.js`·`SegmentCompositionChange.jsx`·`glossary.js`·`sitemap.js`·`EditorialTrust.jsx`·`searchIntentRegistry.js` 현재 상태
- **돌린 것**: 합성 CSV 3종으로 `autoDeclare` → `buildSegmentPanel` → `compareDistribution` 경로 직접 호출(임시 스크립트, 저장소에 남기지 않음)
- **보지 않은 것**: 브라우저 육안 확인(§6.1에 따라 Gondry님이 직접 확인), 성능 실측(패널 캐시는 의존성 배열로만 판정), #750의 SEO 실제 색인 반영

## 5. 우선순위 제안

1. **F1** — 재현 스크립트가 있으니 패치 3줄 + 골든 3개면 닫힌다. 실사용 CSV에 `campaign_id`가 흔해 바로 만난다
2. **F2** — 주석을 낮추거나 링크를 붙이거나, 둘 중 하나만 하면 된다
