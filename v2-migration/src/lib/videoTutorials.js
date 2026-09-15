import { ROUTES, isRoutePublished } from "./routeMap";
import { TOOL_GROUP } from "./toolGroups";

// Text, video captions and chapter timing share this source. Frames come from
// scripts/tutorials/capture.mjs using only synthetic data on the local app.
const step = (frame, koTitle, koBody, enTitle, enBody) => ({ frame, ko: { title: koTitle, body: koBody }, en: { title: enTitle, body: enBody } });
export const VIDEO_TUTORIALS = [
  { id: "import", ko: "데이터 준비와 첫 분석", en: "Prepare data and start", guide: "/guide/csv-data-prep", steps: [
    step("empty", "도구에 맞는 파일을 준비하세요", "운영 대시보드는 CSV·XLSX를 지원합니다. 다른 도구는 현재 화면의 입력 안내와 템플릿을 확인하세요.", "Prepare the right file", "The dashboard supports CSV and XLSX. For other tools, check the current screen’s input guide and template."),
    step("uploaded", "파일을 올리고 행 수를 확인하세요", "읽어 온 파일명·행 수·날짜가 예상과 맞는지 봅니다. 원본 데이터는 브라우저에서 처리합니다.", "Check what was imported", "Check the file name, row count and dates against your source. Source data is processed in your browser."),
    step("mapping", "자동 연결된 컬럼을 확인하세요", "날짜·비용·설치·전환을 구분하세요. 다른 뜻의 컬럼이 연결됐다면 분석 전에 고칩니다.", "Check the column mapping", "Distinguish date, cost, installs and conversions. Correct columns with a different meaning before analysis."),
    step("analyze", "준비가 끝나면 분석을 실행하세요", "필수 컬럼과 통화·전환 기준을 확인하고 ‘데이터 분석하기’를 누릅니다. 분석과 화면 결과 확인은 무료입니다.", "Run the analysis", "Check required columns, currency and the conversion definition, then select Analyze data. Analysis and on-screen results are free."),
  ] },
  { id: "mapping", ko: "CSV 컬럼 매핑 바로잡기", en: "Fix CSV column mapping", guide: "/guide/csv-data-prep", steps: [
    step("uploaded", "파일을 읽었다고 매핑이 끝난 것은 아닙니다", "자동 연결은 출발점입니다. 데이터 미리보기에서 각 컬럼의 실제 값과 단위를 먼저 확인하세요.", "Importing is only the first step", "Automatic mapping is a starting point. Check each column’s values and units in the data preview."),
    step("mapping", "원본 컬럼과 분석 항목을 연결하세요", "매핑 설정에서 컬럼의 의미를 선택합니다. 비용을 클릭 수로 연결하거나 설치 수를 가입 수로 바꾸지 마세요.", "Match source columns to analysis fields", "Choose the meaning of each column in mapping settings. Cost is not clicks; installs are not signups."),
    step("mapping", "필수 항목과 중복 연결을 확인하세요", "필수 항목이 비었거나 여러 컬럼이 같은 항목에 연결됐다면 수정합니다. 없는 값은 0으로 만들어 채우지 마세요.", "Resolve missing or duplicate fields", "Fix missing required fields or conflicting mappings. Do not invent zeros for data you do not have."),
    step("analyze", "수정한 기준으로 다시 분석하세요", "매핑을 바꾸면 분석을 다시 실행합니다. 데이터 부족 안내가 남으면 필요한 컬럼·행·기간을 먼저 보완하세요.", "Analyze again after changes", "Run analysis again after changing mappings. If data is still insufficient, supply the required columns, rows or periods first."),
  ] },
  { id: "sheets", ko: "Google Sheets 불러오기", en: "Import Google Sheets", guide: "/blog/marketing-report-sheets-bigquery", steps: [
    step("empty", "공개 시트 불러오기를 여세요", "파일 업로드 영역에서 공개 Google Sheets 불러오기를 선택합니다. 비공개 시트에 로그인하는 연결은 아닙니다.", "Open public Sheets import", "Choose Import from a public Google Sheet in the upload area. This does not sign into a private sheet."),
    step("sheets", "이미 공개된 시트의 링크를 넣으세요", "원하는 탭의 전체 주소를 붙여넣습니다. 사내·비공개 자료는 권한을 바꾸지 말고 CSV로 내려받아 올리세요.", "Paste an already-public sheet link", "Paste the full URL for the intended tab. Keep private or company sheets private and upload a downloaded CSV instead."),
    step("sheets-guide", "자동화 범위를 구분하세요", "BigQuery·시트 갱신은 원본 쪽에서 관리합니다. 이 사이트가 광고 계정을 자동 수집하거나 백그라운드 동기화하지는 않습니다.", "Understand the automation boundary", "Manage BigQuery and sheet refreshes at the source. This site does not collect ad accounts or sync them in the background."),
    step("uploaded", "새 데이터를 불러온 뒤 다시 확인하세요", "불러오기가 끝나면 날짜·행 수·컬럼을 확인하고 분석하세요. 최신 데이터가 필요할 때 다시 불러와야 합니다.", "Check the imported data", "After import, check dates, row counts and columns, then analyze. Import again when you need updated data."),
  ] },
  { id: "dashboard", ko: "대시보드와 필터 사용", en: "Use the dashboard and filters", guide: "/dashboard", steps: [
    step("analyze", "분석을 먼저 실행하세요", "파일과 매핑을 확인한 뒤 분석을 시작합니다. 데이터가 없는 지표는 추가 컬럼이 필요할 수 있습니다.", "Run analysis first", "Check the file and mapping, then start analysis. Metrics without data may need additional columns."),
    step("dashboard", "요약에서 변화를 읽으세요", "기간과 KPI의 분모를 함께 봅니다. CPA와 CPI처럼 이름이 비슷한 지표도 전환 기준이 다를 수 있습니다.", "Read the summary in context", "Check the period and KPI denominator. Similar-looking metrics such as CPA and CPI can use different outcomes."),
    step("filters", "기간·채널을 좁혀 확인하세요", "필터를 바꾼 뒤 현재 범위와 결과를 다시 확인합니다. 서로 다른 기간·통화·전환 기준을 그대로 비교하지 마세요.", "Narrow the period and channel", "After changing filters, check the active scope and results. Do not compare mismatched periods, currencies or outcomes."),
    step("ltv", "질문에 맞는 탭을 선택하세요", "LTV·ROAS는 관측 기간과 분모를 확인하세요. 매출 기반 비율만으로 이익이나 예산 증액을 확정할 수는 없습니다.", "Choose the tab for your question", "For LTV and ROAS, check the observation window and denominator. A revenue ratio alone does not establish profit or justify scaling."),
  ] },
  { id: "readiness", ko: "가능한 분석과 판단 보류", en: "Eligible analyses and withheld conclusions", guide: "/start", steps: [
    step("start", "가능한 분석부터 찾으세요", "시작 화면에 파일을 올리면 데이터로 할 수 있는 분석을 확인할 수 있습니다. 도구 이름보다 풀고 싶은 질문을 먼저 고르세요.", "Find eligible analyses", "Upload a file on Start to see analyses supported by your data. Begin with your question rather than a tool name."),
    step("mapping", "컬럼이 같아도 데이터 조건은 다릅니다", "각 도구는 필요한 행 수·기간·관측 단위가 다릅니다. 필수 입력과 부족 사유를 확인하세요.", "Columns are not the whole contract", "Tools need different row counts, periods and observation units. Check their required inputs and reasons for insufficient data."),
    step("verdict", "관측 변화와 원인을 구분하세요", "결과의 기간·분모·한계부터 읽습니다. 전후에 달라졌다는 사실만으로 광고가 원인이라고 단정하지 마세요.", "Separate change from cause", "Read the period, denominator and limitations. A before-and-after change alone does not prove advertising caused it."),
    step("causal", "판단 보류에는 확인할 조건이 있습니다", "실험·증분 분석은 배정 방식·동시 변경 등 설계를 확인합니다. 조건을 충족하지 못했다면 효과 없음이 아니라 추가 확인이 필요합니다.", "A withheld conclusion needs evidence", "For experiments and incrementality, check assignment and simultaneous changes. Unmet conditions call for more evidence, not a claim of no effect."),
  ] },
  { id: "review", ko: "주간 리뷰 만들기", en: "Create a weekly review", guide: "/weekly-review", steps: [
    // 이 문구는 녹화된 영상의 자막(.vtt)과 짝이다. 화면 이름이 "프로젝트"로 바뀌었지만
    // 영상은 아직 "주간 리뷰"라고 말하므로 문구만 고치면 자막이 영상과 어긋난다.
    // 이름을 맞추려면 영상을 다시 찍어야 한다(골든이 이 짝을 강제한다).
    step("review-empty", "주간 리뷰에 데이터를 올리세요", "새 리뷰에서 캠페인 데이터를 올립니다. 저장할 프로젝트는 분석을 확인한 뒤 정할 수 있습니다.", "Upload data to a new review", "Upload campaign data in a new review. You can choose its project after checking the analysis."),
    step("periods", "비교할 두 기간을 확인하세요", "이번 기간·이전 기간과 전환 기준을 확인합니다. 불완전한 주나 겹치는 기간이 섞이지 않았는지 살펴보세요.", "Check both comparison periods", "Check the current and previous periods and the outcome definition. Watch for incomplete weeks or overlapping periods."),
    step("verdict", "전체 변화에서 캠페인별 근거로 내려가세요", "요약을 읽고 캠페인별 변화를 확인합니다. 관측 변화의 분해는 인과 효과의 증명이 아닙니다.", "Move from summary to campaign evidence", "Read the summary, then inspect campaign changes. Decomposing an observed change does not prove a causal effect."),
    step("decision", "다음 행동과 확인할 날짜를 적으세요", "실행할 행동·판단 근거·검토일을 남깁니다. 저장에는 로그인과 유효 Pro 또는 체험이 필요합니다.", "Record the action and review date", "Record your action, reasoning and review date. Saving requires sign-in and active Pro or a trial."),
  ] },
  { id: "decisions", ko: "결정 저장과 다음 주 재검토", en: "Save and revisit decisions", guide: "/weekly-review", steps: [
    step("decision", "결정 초안을 먼저 확인하세요", "실행할 행동과 판단 근거를 확인하고 검토일을 정합니다. 저장하기 전에 메모 내용을 직접 점검하세요.", "Check the draft decision", "Check the action and reasoning and set a review date. Review the memo before saving it."),
    step("save", "저장 조건과 프로젝트를 확인하세요", "로그인과 유효 Pro가 필요합니다. 첫 체험은 선택한 메모의 계정 보관에 동의한 뒤 시작하며, 기기 저장은 별도로 확인합니다.", "Check access and the destination project", "Sign-in and active Pro are required. A first trial starts after consent to store the selected memo in your account; confirm device saving separately."),
    step("saved", "저장 완료를 확인하세요", "계정 메모와 기기 프로젝트 저장을 구분하세요. CSV 원본과 전체 보고서가 계정으로 자동 동기화되는 것은 아닙니다.", "Confirm the save succeeded", "Distinguish account memo storage from device project storage. Source CSV files and full reports do not automatically sync to the account."),
    step("projects", "같은 프로젝트에서 다음 결과를 검토하세요", "프로젝트를 열고 다음 기간 CSV를 올립니다. 지난 결정의 근거와 새 결과를 비교한 뒤 검토 상태를 갱신하세요.", "Review new results in the same project", "Open the project and upload the next period’s CSV. Compare the saved reasoning with new results before updating the review status."),
  ] },
  { id: "projects", ko: "프로젝트 관리와 백업", en: "Manage projects and backups", guide: "/weekly-review#project-management", steps: [
    step("projects", "고객·앱별 프로젝트를 분리하세요", "내 프로젝트에서 저장한 리뷰를 엽니다. 프로젝트 생성과 새 저장은 유효 Pro 또는 14일 체험 범위입니다.", "Separate projects by client or app", "Open saved reviews in My projects. Creating projects and saving new work require active Pro or the 14-day trial."),
    step("project-open", "현재 프로젝트를 확인하세요", "파일을 올리기 전에 프로젝트 이름을 봅니다. 프로젝트를 전환하면 해당 프로젝트의 파일·설정·기록을 불러옵니다.", "Check the current project", "Check the project name before uploading. Switching projects loads that project’s files, settings and records."),
    step("backup", "기기를 옮기기 전에 백업하세요", "백업 내보내기로 파일을 보관하세요. 프로젝트는 이 브라우저에 저장되며 기기 간 자동 동기화되지 않습니다.", "Back up before moving devices", "Export a backup file. Projects are stored in this browser and do not automatically sync between devices."),
    step("restore", "복원 대상과 교체 여부를 확인하세요", "백업을 선택하고 내용을 확인한 뒤 복원합니다. 새 복원은 유효 Pro가 필요하며, 현재 프로젝트 교체 전에는 백업을 남기세요.", "Check the restore destination", "Select a backup, inspect its contents and restore. Restoring requires active Pro. Back up before replacing a current project."),
  ] },
  { id: "reports", ko: "보고서 미리보기와 다운로드", en: "Preview and download reports", guide: "/weekly-review", steps: [
    step("report", "보고서의 기간과 근거를 확인하세요", "보고서에 포함할 현재 분석·비교 기간·한계를 먼저 확인합니다. 프로젝트 저장과 파일 다운로드는 서로 다른 동작입니다.", "Check the report’s scope", "Check the analysis, comparison periods and limitations. Saving a project and downloading a file are separate actions."),
    step("downloads", "현재 분석의 보고서를 미리 보세요", "Word·Excel 보고서 메뉴에서 무료 미리보기를 열 수 있습니다. 결론과 한계를 확인한 뒤 다운로드 형식을 고르세요.", "Preview the current analysis", "Open the free preview in the Word / Excel report menu. Check conclusions and limitations before choosing an export format."),
    step("preview", "다운로드에는 구매 이용권이 필요합니다", "분석과 화면 미리보기는 무료입니다. 보고서 다운로드는 유효한 구매 이용권이 필요하며 14일 체험만으로는 열리지 않습니다.", "Downloads require a purchased pass", "Analysis and on-screen previews are free. Report downloads require an active purchased pass; the 14-day trial alone does not unlock them."),
    step("downloads", "사용할 곳에 맞춰 형식을 고르세요", "Word·Excel 등 현재 도구에서 제공하는 형식을 선택합니다. 조건이 부족한 결과를 보고서에서 확정 결론으로 바꾸지 마세요.", "Choose a supported format", "Choose Word, Excel or another format offered by the current tool. Keep qualifications and withheld conclusions in the report."),
  ] },
];

export const TUTORIAL_STEP_SECONDS = 9;
export function tutorialMedia(id, locale = "ko") {
  const lang = locale === "en" ? "en" : "ko";
  const base = `/tutorials/${id}-${lang}`;
  return { video: `${base}.mp4`, poster: `${base}.jpg`, captions: `${base}.vtt` };
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
