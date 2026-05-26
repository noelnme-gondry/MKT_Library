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
