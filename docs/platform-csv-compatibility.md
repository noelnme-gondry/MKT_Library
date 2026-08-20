# 실제 플랫폼 CSV 호환성 매트릭스

> 상태: 3-A 입력 계약 기준선 · 최종 확인 2026-08-20

이 문서는 공개 안내에서 **명시적으로** 받는 플랫폼 export만 기록한다. 수치는 전부 합성값이며 계정·앱·광고 식별자는 포함하지 않는다.

| 도구 | 데이터 그룹 | 명시 원천 | 실제 헤더 fixture | canonical·eligibility | 엔진 진입 |
|---|---|---|---|---|---|
| 5-27 ASO 스토어 전환 | `aso_store` | App Store Connect | `Date`, `Source Type`, `Product Page Views`, `Total Downloads` | `storeConsoleMapping.test.js` | `storeFunnel` |
| 5-27 ASO 스토어 전환 | `aso_store` | Google Play Console | `Date`, `Traffic source`, `Store listing visitors`, `Store listing acquisitions` | `storeConsoleMapping.test.js` | `storeFunnel` |
| 5-26 ASA 키워드 | `asa_keyword` | Apple Ads search terms | `Date`, `Search Term`, `Match Type`, `Total Cost`, `Taps`, `Installs`, `Daily Budget`, `Target CPA`, `Avg CPT` | `asaSearchTermsMapping.test.js` | `buildAsaKeywordRecommendations` |

## 판정 범위

- 각 fixture는 `buildMappingContract → buildCanonicalDataset → evaluateEligibility → getMappedRows → 엔진`을 통과한다.
- 5-27은 앞뒤 기간 비교가 가능하도록 4일·2소스의 합성 행을 사용한다.
- Meta Ads와 Google Ads는 현재 특정 export 형식을 지원한다고 공개적으로 주장하지 않는다. 범용 효율 CSV 계약으로만 취급하며, 플랫폼별 fixture는 별도 근거가 확인될 때 추가한다.
- 플랫폼 헤더는 변경될 수 있다. 지원 범위를 넓히기 전에는 해당 플랫폼의 공식 문서와 실제 비식별 export 형식을 다시 대조한다.
