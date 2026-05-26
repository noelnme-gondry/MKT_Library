================================================================
  DevHub · App Performance Marketing Library
  Obsidian Flux Design System
================================================================

[ 파일 구조 ]

  index.html   — 전체 앱 (SPA, 외부 의존성 없음*)
  design.md    — Obsidian Flux 디자인 시스템 가이드
  .gitignore   — macOS/에디터 임시파일 제외 설정
  README.txt   — 이 파일

  * Google Fonts (Inter, JetBrains Mono) CDN 사용.
    오프라인 환경에서는 시스템 폰트로 자동 fallback 됨.


================================================================
  주요 기능
================================================================

  01. Foundation              MMP/Adjust 인프라 셋업
  02. Execution               UAC/AAP/ASA/리타겟팅 캠페인 운영
  03. Creative & Copy         ASO·소재 규격·3초 훅
  04. Analysis & Optimization KPI·코호트·카니발·프로드
  05. CSV Analyzer            데이터 업로드 후 KPI 자동 계산

  - 모든 페이지에 실제 SOP 콘텐츠 (Lorem ipsum 없음).
  - CSV Analyzer: 클라이언트 사이드 처리 (서버 전송 없음),
    별칭 자동 매칭으로 컬럼 자동 매핑, 누락 컬럼은 수동 연결,
    D0/D7/D14 코호트 토글로 매출/결제/잔존율 시점 전환.


================================================================
  CSV Analyzer 사용법
================================================================

  1) 좌측 사이드바 → 05 CSV Analyzer → 5-1. CSV 업로드 및 컬럼 매핑
  2) CSV 파일 드래그앤드롭 또는 클릭 업로드
     (UTF-8 인코딩, 첫 행이 헤더)
  3) 자동 매핑 결과 확인. 누락된 필수 컬럼이 있으면 노란 배너로 표시됨.
  4) 드롭다운으로 누락 컬럼을 표준 필드에 연결
  5) 상단의 [분석 대시보드로 이동] 클릭 → 5-2 자동 이동
  6) 5-2에서 D0/D7/D14 토글로 코호트 전환

  ── 표준 필수 컬럼 ──
    date          (별칭: dt, 날짜, event_date, day)
    channel       (별칭: network, source, media, 매체)
    cost          (별칭: spend, 비용, 광고비)
    installs      (별칭: install, 설치, inst)

  ── 표준 선택 컬럼 ──
    platform, campaign_name, impressions, clicks
    revenue_d0/d7/d14, pu_d0/d7/d14, ret_d0/d7/d14


================================================================
  로컬에서 바로 열기
================================================================

  index.html 파일을 브라우저에서 직접 열면 됩니다.
  (파일 더블클릭 또는 파인더에서 우클릭 → 브라우저로 열기)

  별도 서버, Node.js, 빌드 도구 불필요.


================================================================
  GitHub Pages 배포 방법 (처음 배포)
================================================================

  1) GitHub에서 새 리포지토리 생성
     ─ github.com/new 접속
     ─ Repository name 입력 (예: devhub-library)
     ─ Public 선택 (Private는 유료 플랜 필요)
     ─ "Add a README file" 체크 해제
     ─ [Create repository] 클릭

  2) 로컬에서 이 폴더를 git 리포지토리로 초기화 후 push
     (아래 명령어를 터미널에서 순서대로 실행)

     cd "/Users/gondry/Desktop/Claude Code/Library"

     git init
     git add index.html .gitignore README.txt
     git commit -m "feat: initial deploy — DevHub Marketing Library"

     git remote add origin https://github.com/{YOUR_USERNAME}/{REPO_NAME}.git
     git branch -M main
     git push -u origin main

     ※ {YOUR_USERNAME}, {REPO_NAME} 을 실제 값으로 교체하세요.

  3) GitHub Pages 활성화
     ─ 리포지토리 페이지 → [Settings] 탭 클릭
     ─ 좌측 사이드바 [Pages] 클릭
     ─ Source: "Deploy from a branch" 선택
     ─ Branch: main / (root) 선택 → [Save]
     ─ 1~2분 후 상단에 배포 URL 표시됨

     배포 URL 형식:
       https://{YOUR_USERNAME}.github.io/{REPO_NAME}/

  4) 완료 확인
     ─ Actions 탭에서 "pages build and deployment" 워크플로 완료 확인
     ─ 위 URL 접속하여 사이트 정상 로딩 확인


================================================================
  콘텐츠 수정 후 재배포
================================================================

  index.html 파일을 수정한 뒤:

     git add index.html
     git commit -m "docs: update {페이지명} 가이드"
     git push

  push 후 약 30초~1분 내 자동으로 GitHub Pages에 반영됩니다.


================================================================
  커스텀 도메인 연결 (선택)
================================================================

  1) 도메인 DNS 설정에서 CNAME 레코드 추가:
       CNAME  www  →  {YOUR_USERNAME}.github.io

  2) GitHub → Settings → Pages → Custom domain에 도메인 입력
  3) "Enforce HTTPS" 체크 (Let's Encrypt 자동 발급)

  ※ 루트 도메인(APEX) 사용 시 A 레코드 4개 등록:
       185.199.108.153
       185.199.109.153
       185.199.110.153
       185.199.111.153


================================================================
  참고사항
================================================================

  - 이 사이트는 순수 정적 HTML/CSS/JS로 구성되어 있어
    GitHub Pages 외에 Netlify, Vercel, Cloudflare Pages 등
    모든 정적 호스팅 서비스에서 동일하게 배포 가능합니다.

  - Netlify 드래그앤드롭 배포:
    app.netlify.com/drop 에 폴더 전체를 드래그하면
    설정 없이 즉시 배포됩니다.

================================================================
