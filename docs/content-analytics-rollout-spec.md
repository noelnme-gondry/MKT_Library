# Content Analytics 확장 — 잔여 작업 (SSOT)

`[컨텐츠 분석]`(9-x) 대분류의 파일럿(9-1·9-2)은 PR #259, 9-3은 후속 PR로 완료. 본 문서는
**남은 3개 도구(9-5·9-6·9-7) + 마무리 작업**을 추적한다(9-4 CMM은 엔진 부적합으로 드롭 — §1 표). 패턴 상세는 `CLAUDE.md` §12.23,
경로 매핑은 `v2-migration/ARCHITECTURE.md` 참조.

---

## 0. 완료

| # | 도구 | 라우트 | 상태 |
|---|---|---|---|
| 9-1 | 콘텐츠 요소 분석기 | `/content/element-analysis` | ✅ (#259) 신규 UI(`ContentElementAnalyzer.jsx`) + `REG_STATS.ols` |
| 9-2 | 킬러 콘텐츠·충성 독자 발굴 | `/content/killer-content` | ✅ (#259) `AhaMomentFinder domain="content"` 래퍼(`KillerContentFinder.jsx`) |
| 9-3 | 콘텐츠 트래픽 변동 탐지 | `/content/traffic-variance` | ✅ `CampaignPvm domain="content"` 래퍼(`ContentTrafficVariance.jsx`) + `PVM_COPY` 라벨팩. 어휘=유입경로→카테고리→콘텐츠, 지표=방문당 비용, "결과 비중"→"트래픽 비중"(정의 불변). 격리 슬라이스 `content_traffic` |

배선 인프라(전부 완료, 재사용 가능): `IA`/`SECTIONS.content`(store) · `routeMap`(`/content/*`) ·
`csvGroups` 격리 슬라이스 패턴 · `contentDomain.js` 라벨팩 SSOT · `demoData.js` 도메인 데모 ·
`toolGuide.js` 업로드 가이드 · PageClient SOP 폴백 가드(`!startsWith("9-")`).

---

## 1. 잔여 도구 확장 (원 기획 #3~#7, 우선순위 미정 — 착수 전 사용자 확인)

각 항목은 **기존 배선 패턴을 그대로 반복**(§12.23) — 새 라우팅 구조 설계 불필요, 아래 5단계만:
IA/SECTIONS 그룹 09에 항목 추가 → routeMap 라우트 추가 → PageClient 디스패치 2줄 →
contentDomain.js 라벨팩 추가 → (소스 컴포넌트 재사용 시) domain prop 배선 /
(신규 UI 필요 시) 얇은 컴포넌트 작성 → demoData·toolGuide 콘텐츠 변형 → 스모크 테스트.

| # | 도구명(안) | 재사용 엔진 | 소스 컴포넌트 | 방식 | 비고 |
|---|---|---|---|---|---|
| ~~9-4~~ | ~~콘텐츠 기여·수명 분해(CMM)~~ | — | — | **드롭(재시도 금지)** | MMM 엔진이 "금액×수확체감" 전제(`mmmSaturation` 체크포인트 $10k/35k/60k 하드코딩·§2.1 불변)라 콘텐츠 "발행 편수"(0~30 카운트) 투입과 근본 불일치 — 편수 넣으면 한계효과 0 언더플로우로 "다음 예산 여기로" 액션 무의미. 비용 프레이밍으로 우회 가능하나 그건 5-18 중복. 콘텐츠 MMM은 엔진 부적합 결론(사용자 확정 2026-07-08). 프로토타입은 폐기 브랜치(커밋 bf9dc6f, unpushed)에만 존재 |
| 9-5 | 콘텐츠 포화도·적정 발행량 진단 | `satMath.js` + `allocationMath.js` | `MarketingEfficiency.jsx` | domain prop 파라미터화 | grain=포맷×기간×발행빈도. 5-3 곡선엔진 의존(CLAUDE.md §12.16 원칙 — 신규 곡선/아웃라이어 구현 금지) 그대로 승계. **주의: 9-4 교훈 — 곡선 엔진도 금액 스케일 전제일 수 있음, 착수 전 발행량 카운트 호환성 먼저 검증** |
| 9-6 | 콘텐츠 수명주기·피로도 진단기 | `creativeMath.js`(WLS/FATIGUE) | `CreativeAnalyzer.jsx` | domain prop 파라미터화 | grain=콘텐츠(시리즈)×일. "소재 피로도"→"콘텐츠 신선도" 재라벨 |
| 9-7 | 콘텐츠 운영 대시보드 | dashboard 엔진 일체(`dashboardAggregator`·`funnelMath`·`cohortMath`…) | `Dashboard.jsx` (8탭) | **결제전제 탭 제외**(사용자 확정 — LTV:CAC·ROAS 성숙도 등 결제 데이터 전제 탭 제거, 트래픽/참여 관련 탭만) | 착수 시 켤 탭 목록 최종 확정 |

### 1.1 파일럿에서 확립된 재사용 가능 패턴
- **라벨팩 방식**: 소스 컴포넌트가 1개 도메인만 다루면(5-20처럼) `domain` prop + `contentDomain.js`
  카피 객체 분기. `performance` 팩 = 기존 하드코딩 문자열과 **완전 동일**해야 골든/스모크가
  기존 도구 출력 불변을 보장(9-2에서 검증된 안전 패턴).
- **신규 UI가 필요한 경우**: 엔진은 있는데 단독 UI가 없을 때(9-1처럼 5-18 3탭 안에 회귀만
  묻혀 있던 경우)만 신규 컴포넌트 작성. 이 경우도 엔진 호출부는 반드시 기존 `*Math.js`
  import — 재계산·재구현 금지.
- **CSV 그룹 격리**: 콘텐츠 도구끼리도 grain이 다르면(9-1 콘텐츠×속성 vs 9-3 채널×기간)
  별도 슬라이스 필요. 같은 grain끼리는(9-5·9-6·9-7이 모두 "포맷/시리즈×기간"이면) 공유 고려.
- **정직성 문안**: 모든 파일럿에 "연관≠인과" 콜아웃 + 확정은 A/B로 유도하는 문구가 들어감 —
  나머지 도구도 동일 원칙(§8) 적용.

### 1.2 착수 전 확인 필요 (모호한 지점, §2.7 임의 확정 금지)
1. ~~**9-4 카니발 진단 탭**~~: 해소 불필요 — 9-4 자체가 드롭됨(§1 표. MMM 엔진 금액 스케일 vs 콘텐츠 편수 불일치).
2. **9-7 대시보드 탭 범위**: 9탭 전체 vs 콘텐츠에 안 맞는 탭(LTV:CAC 등) 제외.
3. **우선순위/범위**: 5개 전부 한 번에 vs 1~2개씩 단계적(파일럿 때와 동일 질문).

---

## 2. 마무리 작업 (파일럿 범위에서 의도적으로 남긴 것)

- **9-2 전문가 뷰(접힘) 잔여 카피**: `AhaMomentFinder.jsx`의 산점도 툴팁·k-스윕 캡션 일부에
  "유저" 등 퍼포먼스 문구가 라벨팩 밖에 하드코딩으로 남아있음(핵심 결론·칸반·드릴다운은 전환 완료).
  도구 확장 착수 전 또는 별도 소품 PR로 `contentDomain.js`에 항목 추가해 마저 전환.
- **§12.21 디자인시스템 규약 소급 적용 검토**: 9-1(`ContentElementAnalyzer.jsx`)은 신규
  컴포넌트라 `ds/DataTable`·`utils/format.js` 채택 대상 — 파일럿에서는 기존 5-20 표 스타일과
  통일감 위해 직접 `<table>` 사용. 확장 단계에서 §12.21 준수 여부 재검토.
- **사이드바 아이콘**: `GROUP_ICONS["09"]="✍️"` 확정 배치 완료(LandingPage.jsx) — Sidebar.jsx도
  동일 아이콘 상수를 쓰는지 확인(현재 Sidebar는 텍스트 라벨만 렌더해 영향 없음, 향후 아이콘
  추가 시 동기화 필요).

## 3. 다음 세션 시작점

1. PR #259 리뷰/머지 확인.
2. 위 §1.2 질문에 대한 답 확보 (AskUserQuestion).
3. 확정되면 §1 표 순서대로 도구 1개씩 파일럿과 동일 워크플로우로 구현 → 검증(`test:all`+`lint`+`build`) → PR.
