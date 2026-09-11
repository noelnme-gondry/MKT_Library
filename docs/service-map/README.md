# Growth Opt Playbook — 서비스 구조

[한·영 전환 흐름도](index.html) · [한국어 SVG](workflow-ko.svg) · [English SVG](workflow-en.svg)

2026-09-11 현재 구현 기준. 도식의 분석 묶음은 목적별 요약이며 도구 개수를 의미하지 않습니다.

| 단계 | 사용자가 하는 일 | 서비스가 제공하는 것 | 범위와 한계 |
|---|---|---|---|
| 진입 | 질문 선택, 개별 도구 선택, CSV 또는 샘플 사용 | 도치 안내, 분석 찾기, 블로그·SOP·실무 가이드 | CSV 업로드가 필수 진입 경로는 아님 |
| 준비 | 파일 선택, 컬럼·기간·단위·설계 확인 | 자동 매핑, 품질 확인, 도구별 필수 조건 안내 | 원본은 브라우저에서 처리; 외부 플랫폼 자동 수집 없음 |
| 분석 | 적합한 도구와 조건으로 분석 실행 | 성과·예산, 실험·증분, 채널·예측, 고객 행동, 검색·스토어, 소재·콘텐츠 분석 | 데이터·설계 부족은 추정 불가; 모든 도구가 모든 CSV에서 실행되는 것은 아님 |
| 해석 | 차트·근거·불확실성 검토 | 핵심 지표, 비교, 상세 분석, 다음 확인 항목 | 관측 차이를 인과효과로 단정하지 않음 |
| 결정 | 행동·지표·목표·검토일 기록 | 결정 기록과 주간 리뷰 연결 | 자동 승인이나 조직 결재 시스템은 아님 |
| 실행 | 광고 플랫폼에서 직접 변경 | 서비스 밖의 사용자 작업 | 광고 API 연동·자동 집행 없음 |
| 재검토 | 새 CSV로 이전 결정 확인 | 저장 분석 설정 재사용, 컬럼·기간·단위 비교, 검토일 캘린더 내보내기 | 자동 수집·자동 알림 없음; 캘린더 등록과 재방문은 사용자 수행 |
| 보관 | 프로젝트 저장·백업·가져오기 | 브라우저 로컬 프로젝트, 설정과 파일 백업 | 계정 기반 클라우드 동기화 아님 |
| 보고서 | 샘플 확인, 필요하면 이용권 구매 | Word·Excel 보고서, 여러 프로젝트, 브랜딩 | 1개월 5,900원; 자동갱신 없음. 분석·결정 기록·프로젝트 1개·백업은 무료 |
| 이용권 복원 | 코드 입력 또는 구매자 확인 요청 | 다른 기기에서 권한 복원, 운영자 재발급 절차 | 프로젝트 데이터는 별도 백업 필요; 구매 증빙 부족 시 복원 불가 가능 |

## English

| Stage | User action | Service capability | Boundary |
|---|---|---|---|
| Entry | Choose a question, tool, CSV or sample | Dochi guidance, analysis discovery, blog and SOP | Upload is optional as an entry path |
| Preparation | Review columns, period, units and design | Mapping and quality checks | Browser processing; no platform data ingestion |
| Analysis | Run an eligible tool | Performance, experiments, channels, behavior, store and creative analysis | Eligibility depends on data and design; uncertainty remains visible |
| Decision | Review evidence and record an action | Decision log, targets and review dates | Human judgment, not automated approval |
| Execution | Edit campaigns in the ad platform | External user activity | No ad API integration or automatic execution |
| Review | Bring new data and revisit decisions | Saved settings, input comparison and calendar export | No automatic collection or notifications |
| Storage | Save, back up and import projects | Browser-local project storage | No account-based cloud sync |
| Reports | Inspect samples and buy a pass if needed | Word/Excel exports, multiple projects, branding | KRW 5,900 for one month; no auto-renewal |
| Recovery | Enter a code or request verification | Pass restoration and operator-assisted reissue | Does not restore project data |

## 근거 / Sources

- `docs/product-ssot.md`: public product and pricing contract.
- `src/lib/toolGroups.js`, `src/lib/routeMap.js`: published routes and CSV groups.
- `src/components/ProjectsPage.jsx`, `src/components/ds/SavedSetupReview.jsx`: saved work and input comparison.
- `src/components/ds/DecisionReview.jsx`, `src/components/WeeklyReview.jsx`: decisions and reviews.
- `docs/payment-pass-recovery.md`: purchase recovery procedure.

운영 결제 설정은 확인 당시 `enabled: true`, `mode: test`. 실제 결제·환불·재발급 성공을 뜻하지 않습니다.
