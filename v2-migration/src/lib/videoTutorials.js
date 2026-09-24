import { ROUTES, isRoutePublished } from "./routeMap";
import { TOOL_GROUP } from "./toolGroups";

// Text, video captions and chapter timing share this source. Frames come from
// scripts/tutorials/capture.mjs using only synthetic data on the local app.
const step = (frame, koTitle, koBody, enTitle, enBody) => ({ frame, ko: { title: koTitle, body: koBody }, en: { title: enTitle, body: enBody } });
export const VIDEO_TUTORIALS = [
  { id: "import", ko: "데이터 준비와 첫 분석", en: "Prepare data and start", guide: "/guide/csv-data-prep", steps: [
    step("empty", "파일 하나로 시작", "현재 도구의 템플릿에 맞는 CSV·XLSX를 준비하세요.", "Start with one file", "Use the template and file types supported by this tool."),
    step("uploaded", "읽힌 데이터 확인", "파일명·행 수·날짜가 원본과 맞는지 확인하세요.", "Check the import", "Match the file name, row count and dates to your source."),
    step("mapping", "이름보다 의미", "비용·설치·전환이 맞게 연결됐는지 확인하세요.", "Meaning before names", "Check that spend, installs and conversions map correctly."),
    step("analyze", "분석은 무료", "통화와 전환 기준을 확인하고 분석하기를 누르세요.", "Analyze for free", "Check currency and outcome definitions, then run analysis."),
  ] },
  { id: "mapping", ko: "CSV 컬럼 매핑 바로잡기", en: "Fix CSV column mapping", guide: "/guide/csv-data-prep", steps: [
    step("uploaded", "자동 연결, 확인은 필수", "실제 값과 단위를 먼저 보세요.", "Auto-mapped? Check it", "Inspect the actual values and units first."),
    step("mapping", "잘못 연결됐으면 수정", "원본 컬럼에 맞는 분석 항목을 고르세요.", "Fix the mismatch", "Select the analysis field matching the source column."),
    step("mapping", "빈칸과 중복 확인", "없는 값을 0으로 만들지 마세요.", "Check gaps and duplicates", "Missing data is not zero."),
    step("analyze", "고쳤다면 다시 분석", "부족 안내가 남으면 입력을 보완하세요.", "Run it again", "If data is insufficient, fix the input before concluding."),
  ] },
  { id: "sheets", ko: "Google Sheets 불러오기", en: "Import Google Sheets", guide: "/blog/marketing-report-sheets-bigquery", steps: [
    step("empty", "공개 시트 연결", "업로드 영역에서 Google Sheets 불러오기를 여세요.", "Open Sheets import", "Choose the public Google Sheets option in the uploader."),
    step("sheets", "원하는 탭의 URL", "비공개 자료는 공개하지 말고 CSV로 올리세요.", "Paste the tab URL", "Keep private data private; upload its CSV instead."),
    step("sheets-guide", "갱신은 원본에서", "광고 계정 자동 수집·백그라운드 동기화는 없습니다.", "Refresh at the source", "No automatic ad-account collection or background sync."),
    step("uploaded", "불러오고 확인", "최신 날짜·행 수·컬럼을 확인한 뒤 분석하세요.", "Import, check, analyze", "Check dates, rows and mappings after each new import."),
  ] },
  { id: "dashboard", ko: "대시보드와 필터 사용", en: "Use the dashboard and filters", guide: "/dashboard", steps: [
    step("analyze", "먼저 분석하기", "파일·매핑을 확인하면 결과를 볼 수 있습니다.", "Run analysis first", "Check your file and mapping to reveal results."),
    step("dashboard", "변화부터 읽기", "기간과 KPI 분모를 함께 확인하세요.", "Read the change", "Check the period and the KPI denominator together."),
    step("filters", "기간·채널 좁히기", "같은 통화·전환 기준으로 비교하세요.", "Narrow the scope", "Compare consistent currency and outcome definitions."),
    step("ltv", "질문에 맞는 탭", "LTV·ROAS는 관측 기간을 확인하세요.", "Choose your question", "For LTV and ROAS, check the observation window."),
  ] },
  { id: "readiness", ko: "가능한 분석과 판단 보류", en: "Eligible analyses and withheld conclusions", guide: "/start", steps: [
    step("start", "도구보다 질문부터", "파일을 올리고 가능한 분석을 고르세요.", "Start with the question", "Upload your file and choose a supported analysis."),
    step("mapping", "컬럼만 맞으면 끝?", "필요한 기간·행 수·관측 단위도 확인하세요.", "Columns are not enough", "Check required periods, rows and observation units."),
    step("verdict", "달라졌다고 원인은 아님", "관측 변화와 인과효과를 구분하세요.", "Change is not cause", "Separate observed changes from causal effects."),
    step("causal", "보류도 다음 행동", "배정·동시 변경 등 부족한 근거를 확인하세요.", "Withhold, then investigate", "Check assignment, concurrent changes and missing evidence."),
  ] },
  { id: "review", ko: "다음 마케팅 프로젝트로 만들기", en: "Make it my next marketing project", guide: "/weekly-review", steps: [
    step("review-empty", "이번 주, 무엇이 달라졌나", "프로젝트의 주간 성과 비교에 CSV를 올리세요.", "What changed this week?", "Upload a CSV in the project’s weekly comparison."),
    step("periods", "겹치지 않는 두 기간", "날짜·통화·전환 기준을 맞추세요.", "Two comparable periods", "Align dates, currency and outcome definitions."),
    step("verdict", "숫자에서 근거로", "캠페인별 변화를 읽고 원인 가설을 구분하세요.", "From numbers to evidence", "Inspect campaign changes; keep hypotheses separate."),
    step("decision", "결론 다음은 행동", "행동·근거·검토일을 기록하세요. 저장은 로그인·Pro/체험.", "End with an action", "Record action, evidence and review date. Saving needs sign-in and Pro/trial."),
  ] },
  { id: "decisions", ko: "결정 저장과 다음 주 재검토", en: "Save and revisit decisions", guide: "/weekly-review", steps: [
    step("decision", "다음 주의 나에게", "행동·근거·검토일을 구체적으로 적으세요.", "For next week’s you", "Write a specific action, reasoning and review date."),
    step("save", "어디에 저장할까", "프로젝트를 고르고 저장하세요. 로그인·Pro/체험 필요.", "Choose where to save", "Choose the project and save. Sign-in and Pro/trial required."),
    step("saved", "저장 완료까지 확인", "기기 저장 완료. 계정 메모 보관은 별도 선택입니다.", "Confirm it is saved", "Device save complete. Account memo storage is optional."),
    step("followup", "새 결과로 다시 판단", "다음 CSV와 지난 근거를 비교하고 후속 행동을 남기세요.", "Revisit with new evidence", "Compare the next CSV with saved reasoning; record the follow-up."),
  ] },
  { id: "projects", ko: "프로젝트 관리와 백업", en: "Manage projects and backups", guide: "/weekly-review#project-management", steps: [
    step("projects", "고객별로 섞이지 않게", "프로젝트를 나누세요. 새 저장은 Pro/체험 범위입니다.", "Keep clients separate", "Use separate projects. New saves need Pro/trial."),
    step("project-open", "지금 어느 프로젝트?", "업로드 전 이름과 불러온 설정을 확인하세요.", "Which project is open?", "Check the name and loaded settings before uploading."),
    step("backup", "기기 바꾸기 전 백업", "프로젝트는 브라우저 저장. 자동 동기화가 아닙니다.", "Back up before moving", "Projects stay in this browser; they do not auto-sync."),
    step("restore", "교체 전 한 번 더 확인", "복원 내용을 확인하세요. 복원은 유효 Pro가 필요합니다.", "Check before replacing", "Inspect the backup. Restoring requires active Pro."),
  ] },
  { id: "reports", ko: "보고서 미리보기와 다운로드", en: "Preview and download reports", guide: "/weekly-review", steps: [
    step("report", "보고할 근거부터 선택", "보고서에 담을 기간·결정·한계를 확인하세요.", "Choose the evidence", "Check the periods, decisions and limitations to include."),
    step("preview-entry", "내 보고서, 먼저 보기", "‘내 보고서 미리보기 · 무료’를 바로 누르세요.", "Preview your own report", "Select “Preview my report · Free” directly."),
    step("preview", "읽어보고 다운로드", "미리보기에서 Word·Excel로 연결됩니다. 구매 이용권 필요.", "Read, then download", "Continue to Word or Excel from the preview. Purchased pass required."),
    step("downloads", "회의에 가져갈 결과", "현재 도구의 형식을 고르세요. 한계도 함께 전달하세요.", "Ready for the discussion", "Choose a supported format and keep the limitations."),
  ] },
];

export const TUTORIAL_STEP_SECONDS = 6;
export function tutorialDuration(id) {
  return (VIDEO_TUTORIALS.find(item => item.id === id)?.steps.length || 0) * TUTORIAL_STEP_SECONDS;
}
export function tutorialMedia(id, locale = "ko") {
  const lang = locale === "en" ? "en" : "ko";
  const base = `/tutorials/${id}-${lang}`;
  return { video: `${base}.mp4?v=20260920`, poster: `${base}.jpg?v=20260920`, captions: `${base}.vtt?v=20260920` };
}
const publishedInputs = new Set(ROUTES.filter(route => isRoutePublished(route) && TOOL_GROUP[route.id]).map(route => route.slug));
export function tutorialIdsForPath(pathname, { projectManagement = false, mapping = false } = {}) {
  const path = (pathname || "/").replace(/^\/en(?=\/|$)/, "") || "/";
  if (path === "/projects" || path === "/storage" || (path === "/weekly-review" && projectManagement)) return ["projects", "decisions", "review", "reports"];
  if (path === "/weekly-review" || path === "/weekly-report") return [mapping ? "mapping" : "review", "decisions", "projects", "reports", "import", "sheets"];
  if (path === "/dashboard") return [mapping ? "mapping" : "dashboard", "import", "mapping", "reports", "review", "projects", "sheets", "readiness"].filter((id, index, list) => list.indexOf(id) === index);
  if (path === "/start" || publishedInputs.has(path)) return [mapping ? "mapping" : "readiness", "import", "mapping", "sheets", "review", "reports"].filter((id, index, list) => list.indexOf(id) === index);
  if (path === "/" || path === "/diagnose" || path.startsWith("/templates") || path === "/guide/csv-data-prep") return ["import", "mapping", "dashboard", "sheets", "review", "projects", "reports", "readiness", "decisions"];
  if (path === "/subscription" || path === "/account") return ["decisions", "projects", "reports"];
  return [];
}
