"use client";
import React, { useState, useRef, useMemo, useEffect, useSyncExternalStore } from "react";
import Papa from "papaparse";
import { computeAnalyzeSig, useAppStore, TOOL_GROUP } from "@/store/useDataStore";
import { STANDARD_FIELDS, TOOL_REQUIRED_FIELDS, TOOL_OPTIONAL_FIELDS } from "@/utils/csvConstants";
import { buildDemoCsv } from "@/utils/demoData";
import CsvGuide from "@/components/ds/CsvGuide";
import { getToolGuide } from "@/utils/toolGuide";
import { downloadTemplateCsv, hasToolTemplate } from "@/components/ds/csvTemplate";
import GoogleSheetConnect, { fetchSheetTable, sheetErrorMessage } from "@/components/GoogleSheetConnect";
import { assessMappingConfidence, findMappingConflicts } from "@/lib/data-import/scoreMappingCandidates";
import { buildCanonicalDataset } from "@/lib/data-import/buildCanonicalDataset";
import { buildCanonicalDatasetV2 } from "@/lib/data-import/canonical-v2/buildCanonicalDatasetV2";
import { buildLegacyRows } from "@/lib/data-import/canonical-v2/buildLegacyRows";
import { projectSemanticBindingsToLegacyMapping, semanticBindingsFromLegacyMapping } from "@/lib/data-import/canonical-v2/legacyProjection";
import { CANONICAL_FIELDS } from "@/lib/data-import/schema/canonicalFields";
import { canonicalFieldForLegacyKey } from "@/lib/data-import/schema/legacyFieldMigration";
import { evaluateV2Eligibility } from "@/lib/data-import/schema/toolDataRequirements";
import { applyCompatibleMemory, buildMappingMemoryRecord, mappingMemoryEnabled, setMappingMemoryEnabled } from "@/lib/data-import/memory/mappingMemory";
import { clearMappingMemory, confirmMappingMemory, listMappingMemory, putMappingMemory } from "@/lib/data-import/memory/indexedDbMappingMemory";
import { tableToRecords } from "@/lib/data-import/detectHeaderRow";
import { prepareCsvParseInput } from "@/lib/data-import/csvParseInput";
import { detectDatasetSignature } from "@/lib/data-import/detectDatasetSignature";
import { wideToLong } from "@/lib/data-import/wideToLong";
import { getTransformRecipe, saveTransformRecipe } from "@/lib/data-import/localHistory";
import { buildMappingContract } from "@/lib/data-import/mappingContract";
import { prepareImportedData } from "@/lib/data-import/dataPreparationWorkerClient";
import { parseXlsxFile } from "@/lib/data-import/xlsxWorkerClient";
import { xlsxImportErrorMessage } from "@/lib/data-import/xlsxImportPolicy";
import { csvImportErrorMessage, csvFailureState } from "@/lib/data-import/csvImportPolicy";
import { analysisResultEventKey, productAnalysisType, trackProductEvent, trackProductEventOnce } from "@/lib/analytics";
import DataQualityReport from "@/components/data-import/DataQualityReport";
import AnalysisBlockedTelemetry from "@/components/data-import/AnalysisBlockedTelemetry";
import { ANALYSIS_CONTRACTS, evaluateEligibility, formatEligibilityBlocker } from "@/lib/analysis-router/evaluateEligibility";
import { ANALYSIS_STATUS, deriveAnalysisStatus } from "@/lib/analysis-router/analysisStatus";
import AnalysisStatusBadge from "@/components/ds/AnalysisStatusBadge";
import AnalyzingOverlay from "@/components/ds/AnalyzingOverlay";
import SemanticMappingTable from "@/components/data-import/SemanticMappingTable";
import MappingMemorySettings from "@/components/data-import/MappingMemorySettings";
import DochiMappingCoach from "@/components/assistant/DochiMappingCoach";
import HelpTip from "@/components/ds/HelpTip";

const STANDARD_FIELD_EN_LABELS = {
  date: "Date", platform: "Platform (OS)", channel: "Channel / media", campaign_name: "Campaign name",
  snapshot_date: "Data snapshot date",
  country: "Country", source: "Source (paid / organic)", cost: "Cost", impressions: "Impressions",
  clicks: "Clicks", installs: "Installs", actions: "Actions / signups",
};

const subscribeHydration = () => () => {};
const hydratedClientSnapshot = () => true;
const hydratedServerSnapshot = () => false;

function localizedStandardFieldLabel(key, locale) {
  if (locale !== "en") return STANDARD_FIELDS[key]?.label || key;
  if (STANDARD_FIELD_EN_LABELS[key]) return STANDARD_FIELD_EN_LABELS[key];
  const match = String(key || "").match(/^(revenue|pu|ret)_d(\d+)$/);
  if (match) {
    const prefix = { revenue: "Revenue", pu: "Purchases", ret: "Retention" }[match[1]];
    return `${prefix} D${match[2]}`;
  }
  return String(key || "").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function localizedFieldGroupLabel(group, locale) {
  if (locale !== "en") return group;
  return ({ "디멘션": "Dimensions", "단일 지표": "Single metrics" })[group]
    || String(group || "").replaceAll("코호트", "Cohort ").replaceAll("지표", "metrics");
}

const CSV_COPY = {
  ko: {
    emptyCsv: "파일이 비어 있거나 올바르지 않습니다.",
    parseError: "파일을 읽는 중 오류 발생: ",
    dropTitle: "CSV 또는 XLSX 파일 드래그 & 드롭",
    dropSub: "또는 클릭하여 파일 선택 · XLSX는 25MB 이하",
    importing: "파일 구조를 읽는 중…",
    importSuccess: (name, rows, cols) => `${name} 업로드 완료. ${rows.toLocaleString()}행, ${cols}컬럼을 읽었습니다. 컬럼 매핑을 확인하세요.`,
    entryDemoBtn: "예시 데이터로 먼저 보기",
    entryDemoHint: "내 파일 없이 결과 화면을 그대로 확인할 수 있어요.",
    demoBannerTitle: "🧪 지금 보고 있는 화면은 샘플(예시) 데이터입니다",
    demoBannerDesc: "실제 내 데이터가 아니며, 서버로 전송되지 않습니다. 내 CSV를 업로드하면 바로 교체됩니다.",
    demoBannerBtn: "📁 내 CSV 업로드하기",
    previewingDemo: "샘플 데이터로 미리보기 중",
    rowsCols: (rows, cols, demo) => `${rows.toLocaleString()}행 · ${cols}컬럼${demo ? " · 실제 데이터 아님" : ""}`,
    changeCsvTitle: "이 도구의 CSV를 제거하고 다른 파일 업로드",
    changeCsvBtn: "⟳ CSV 변경",
    sheetConnectedLabel: "구글 시트 연동됨",
    savedMappingApplied: "이 브라우저에 기억된 컬럼 매핑을 적용했습니다",
    storingOnDevice: "이 기기에 저장하는 중…",
    storedOnDevice: "이 기기에 저장됨 · 마지막 사용 후 90일",
    storageUnavailable: "이 기기에 저장하지 못했습니다. 분석은 그대로 됩니다.",
    refreshSheetBtn: "🔄 최신 데이터 불러오기",
    refreshingSheet: "불러오는 중…",
    changeSheetBtn: "🔗 시트 변경",
    switchToCsvBtn: "📁 CSV 업로드로 전환",
    missingTitle: "⚠ 이 도구가 필요로 하는 필수 컬럼이 매핑되지 않았습니다",
    missingLabel: "필수: ",
    dataBlockedTitle: "⚠ 현재 데이터로는 이 분석을 시작할 수 없습니다",
    dataBlockedHint: "아래 부족한 조건을 채운 뒤 다시 분석해 주세요.",
    oneOfSuffix: (joined) => `(${joined} 중 1)`,
    okTitle: "✓ 필수 컬럼 매핑 완료.",
    okDesc: "아래 도구를 사용할 수 있습니다.",
    mappingHeader: "📋 CSV 컬럼 → 표준 필드 매핑",
    mappingSummaryPrefix: (total) => `전체 ${total}컬럼 · 옵션 매핑 `,
    mappingHint: "자동 + 수동. 드롭다운으로 변경 시 즉시 반영.",
    colHeaderCsv: "CSV 컬럼",
    colHeaderStd: "표준 필드",
    colHeaderStatus: "상태",
    ignoreOption: "(사용 안 함)",
    outOfScopeSuffix: " (이 도구 미사용)",
    unmapped: "사용 안 함",
    mapped: "매핑됨",
    previewTitle: "🔎 데이터 미리보기",
    previewUsingMapped: "매핑된 컬럼",
    previewAll: "전체 컬럼",
    previewRows: (shown, total) => `상위 ${shown}행 / 총 ${total.toLocaleString()}행`,
    collapse: "▾ 접기",
    expand: "▸ 펼치기",
    analyzedBadge: "✓ 분석 완료",
    analyzedHint: '매핑을 바꾸면 결과가 숨겨지고 다시 "분석하기"를 눌러야 합니다.',
    reanalyzeBtn: "↻ 다시 분석",
    checkMapping: "⚠ 매핑 확인 필요",
    checkMappingHint: '매핑이 올바른지 확인 후 "분석하기"를 클릭하여 분석을 시작하세요.',
    analyzeBtn: "데이터 분석하기",
    recognitionSummary: (mapped, total, review, conflicts) => `${total}개 컬럼 중 ${mapped}개 자동 인식${review ? ` · 확인 권장 ${review}개` : ""}${conflicts ? ` · 충돌 ${conflicts}건` : ""}`,
    recognitionHint: "확실한 항목은 자동 적용했고, 낮은 신뢰도나 충돌 항목만 확인해 주세요.",
    mappingConfirmed: "자동 확정",
    mappingReview: "확인 권장",
    mappingMustConfirm: "확인 필요",
    mappingManual: "수동 확인",
    mappingConflict: "중복 선택",
    mappingConfirmBtn: "확인",
    mappingBlockedTitle: "⚠ 필수 매핑을 확인해야 분석을 시작할 수 있습니다",
    mappingBlockedConflict: "같은 표준 필드에 여러 CSV 컬럼이 선택됐습니다. 하나만 남겨 주세요.",
    mappingBlockedConfirm: "'확인 필요' 상태인 필수 컬럼을 확인해 주세요.",
    semanticBlocked: "전역 역할이 확인되지 않은 필수 컬럼이 있습니다. Semantic Mapper V2에서 역할을 확인해 주세요.",
    signatureSummary: (source, grain) => `데이터 형태 추정: ${source} · ${grain}`,
    wideWarning: "기간이 열로 펼쳐진 형식입니다. 날짜 열을 행으로 바꾼 뒤 값의 의미를 직접 매핑해 주세요.",
    wideTransformTitle: "날짜 열 전개형 보고서를 찾았습니다",
    wideTransformDesc: (count) => `${count}개의 날짜 열을 행으로 바꿉니다. 원래의 차원 컬럼은 유지하고, 기간별 숫자는 “기간별 값”으로 만듭니다. 비용·성과·매출 중 무엇인지 추정하지 않습니다.`,
    wideTransformBtn: "날짜 열을 행으로 변환",
    cancelImportBtn: "다른 파일 선택",
    cancelActiveImportBtn: "가져오기 취소",
    workbookTitle: "가져올 시트를 선택하세요",
    workbookDesc: (count) => `${count}개의 데이터 시트를 찾았습니다. 한 번에 하나의 시트만 불러와 데이터가 섞이지 않도록 합니다.`,
    workbookSelectLabel: "시트",
    workbookImportBtn: "선택한 시트 불러오기",
    starterTemplateBtn: "⬇ 기본 CSV 템플릿 받기",
  },
  en: {
    emptyCsv: "This file is empty or invalid.",
    parseError: "Error reading file: ",
    dropTitle: "Drag & drop a CSV or XLSX file",
    dropSub: "or click to choose a file · XLSX up to 25MB",
    importing: "Reading file structure…",
    importSuccess: (name, rows, cols) => `${name} uploaded. Read ${rows.toLocaleString()} rows and ${cols} columns. Review the column mapping next.`,
    entryDemoBtn: "Preview with example data",
    entryDemoHint: "See the full result screen without your own file.",
    demoBannerTitle: "🧪 You're viewing sample data",
    demoBannerDesc: "This isn't your real data and nothing is sent to a server. Upload your own CSV to replace it instantly.",
    demoBannerBtn: "📁 Upload my CSV",
    previewingDemo: "Previewing sample data",
    rowsCols: (rows, cols, demo) => `${rows.toLocaleString()} rows · ${cols} cols${demo ? " · not real data" : ""}`,
    changeCsvTitle: "Remove this tool's CSV and upload another file",
    changeCsvBtn: "⟳ Change CSV",
    sheetConnectedLabel: "Connected to Google Sheets",
    savedMappingApplied: "Applied the column mapping remembered in this browser",
    storingOnDevice: "Saving on this device…",
    storedOnDevice: "Saved on this device · 90 days after last use",
    storageUnavailable: "This file could not be stored on this device. Analysis still works.",
    refreshSheetBtn: "🔄 Fetch latest data",
    refreshingSheet: "Fetching…",
    changeSheetBtn: "🔗 Change sheet",
    switchToCsvBtn: "📁 Switch to CSV upload",
    missingTitle: "⚠ Required columns for this tool aren't mapped yet",
    missingLabel: "Required: ",
    dataBlockedTitle: "⚠ This analysis cannot start with the current data",
    dataBlockedHint: "Meet the missing condition below, then analyze again.",
    oneOfSuffix: (joined) => `(1 of ${joined})`,
    okTitle: "✓ All required columns mapped.",
    okDesc: "You can use the tool below.",
    mappingHeader: "📋 CSV column → standard field mapping",
    mappingSummaryPrefix: (total) => `${total} columns total · optional mapped `,
    mappingHint: "Auto + manual. Changing a dropdown applies instantly.",
    colHeaderCsv: "CSV column",
    colHeaderStd: "Standard field",
    colHeaderStatus: "Status",
    ignoreOption: "(unused)",
    outOfScopeSuffix: " (not used by this tool)",
    unmapped: "Unused",
    mapped: "Mapped",
    previewTitle: "🔎 Data preview",
    previewUsingMapped: "Mapped columns",
    previewAll: "All columns",
    previewRows: (shown, total) => `top ${shown} rows / ${total.toLocaleString()} total`,
    collapse: "▾ Collapse",
    expand: "▸ Expand",
    analyzedBadge: "✓ Analysis done",
    analyzedHint: 'Changing the mapping hides results until you click "Analyze" again.',
    reanalyzeBtn: "↻ Re-analyze",
    checkMapping: "⚠ Check mapping",
    checkMappingHint: 'Confirm the mapping is correct, then click "Analyze" to start.',
    analyzeBtn: "Analyze data",
    recognitionSummary: (mapped, total, review, conflicts) => `${mapped} of ${total} columns recognized${review ? ` · ${review} need review` : ""}${conflicts ? ` · ${conflicts} conflicts` : ""}`,
    recognitionHint: "High-confidence fields are applied automatically; review only uncertain or conflicting fields.",
    mappingConfirmed: "Auto-confirmed",
    mappingReview: "Review suggested",
    mappingMustConfirm: "Confirmation needed",
    mappingManual: "Manually confirmed",
    mappingConflict: "Duplicate selection",
    mappingConfirmBtn: "Confirm",
    mappingBlockedTitle: "⚠ Confirm required mappings before analysis",
    mappingBlockedConflict: "Multiple CSV columns are assigned to the same standard field. Keep only one.",
    mappingBlockedConfirm: "Confirm every required column marked “Confirmation needed.”",
    semanticBlocked: "A required canonical role is unresolved. Confirm it in Semantic Mapper V2.",
    signatureSummary: (source, grain) => `Detected shape: ${source} · ${grain}`,
    wideWarning: "This is a period-as-columns report. Convert date columns to rows, then map the value meaning yourself.",
    wideTransformTitle: "Date-column report detected",
    wideTransformDesc: (count) => `This will turn ${count} date columns into rows. Dimension columns stay intact and each period number becomes “Period value.” We do not guess whether it means cost, outcome, or revenue.`,
    wideTransformBtn: "Convert date columns to rows",
    cancelImportBtn: "Choose another file",
    cancelActiveImportBtn: "Cancel import",
    workbookTitle: "Choose a worksheet to import",
    workbookDesc: (count) => `Found ${count} data worksheets. Import one at a time so data from different sheets never gets mixed.`,
    workbookSelectLabel: "Worksheet",
    workbookImportBtn: "Import selected worksheet",
    starterTemplateBtn: "⬇ Download starter CSV template",
  },
};

function buildImportInsights(headers, raw, toolId) {
  const contract = buildMappingContract({ headers, rows: raw, toolId, source: "csv" });
  return { ...contract, selections: contract.mapping, signature: detectDatasetSignature(headers, raw) };
}

function xlsxFailureState(error) {
  const code = String(error?.code || "");
  return /^xlsx_[a-z_]+$/.test(code) ? code : "xlsx_parse_failed";
}

export default function CsvUploader({
  toolId,
  analyticsToolId = toolId,
  locale = "ko",
  afterFileSummary = null,
  showMappingReview = false,
  collapseMappingReview = false,
  showMappingCoach = false,
  mappingCoachLeaving = false,
  onMappingReviewConfirmed = null,
  mappingReviewActionLabel = "",
  mappingReviewFallbackLabel = "",
  mappingReviewStage = "combined",
  onMappingReviewNeedsSemanticFallback = null,
  entryVariant = "default",
  sheetInitiallyOpen = false,
  onImportStart = null,
  onPrepared = null,
  onImportFailed = null,
}) {
  const T = CSV_COPY[locale] || CSV_COPY.ko;
  // 가이드가 있으면 예시 데이터 버튼은 가이드가 소유한다(아래 중복 블록 차단).
  const showGuide = entryVariant !== "dochi" && Boolean(getToolGuide(toolId, locale));
  const isRouterMode = toolId === "start-gate";
  const eventToolId = analyticsToolId || toolId;
  const csvData = useAppStore((s) => s.csvData);
  const workspaceDatasetSummaries = useAppStore((s) => s.workspaceDatasetSummaries);
  const workspaceStorageError = useAppStore((s) => s.workspaceStorageError);
  const deviceStorageEnabled = useAppStore((s) => s.decisionPersistenceEnabled);
  const setCsvData = useAppStore((s) => s.setCsvData);
  const clearCsvGroup = useAppStore((s) => s.clearCsvGroup);
  const setGroupAnalyzed = useAppStore((s) => s.setGroupAnalyzed);
  const requestAd = useAppStore((s) => s.requestAd);
  // Single-source analyze gate (store, group-scoped §12.5). Reading the whole
  // store here (not a memoized selector) so the boolean recomputes on any
  // csvData / analyzedByGroup change — the same slice the tools render from.
  const isAnalyzed = useAppStore((s) => s.isGroupAnalyzed(toolId));
  const isStale = useAppStore((s) => s.isGroupStale(toolId));
  const fileInputRef = useRef(null);
  const mappingDetailsRef = useRef(null);
  const isHydrated = useSyncExternalStore(subscribeHydration, hydratedClientSnapshot, hydratedServerSnapshot);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  // 분석 결과 컴포넌트의 무거운 useMemo는 그룹 게이트가 열리는 순간 실행된다.
  // 먼저 이 상태를 렌더하고 두 프레임 뒤에 게이트를 열어, 클릭이 멈춤으로 보이지
  // 않게 한다. 개별 도구마다 같은 패턴을 복사하지 않는 공용 진입점이다.
  const [isStartingAnalysis, setIsStartingAnalysis] = useState(false);
  const [importAnnouncement, setImportAnnouncement] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  // Preview table is auto-shown while mapping and collapsed after analysis.
  // User can re-expand it manually anytime (independent of gate state).
  const [previewOpen, setPreviewOpen] = useState(true);
  // 구글 시트 연동 상태(§sheet refresh/change UX). refreshingSheet=재조회 중,
  // sheetChangeOpen=hasFile 화면에서 "시트 변경" 눌러 URL 폼을 다시 펼친 상태.
  const [refreshingSheet, setRefreshingSheet] = useState(false);
  const [sheetChangeOpen, setSheetChangeOpen] = useState(false);
  const [confirmedHeaders, setConfirmedHeaders] = useState(() => new Set());
  const [isMappingMemoryEnabled, setIsMappingMemoryEnabled] = useState(() => mappingMemoryEnabled());
  const [mappingMemoryRecords, setMappingMemoryRecords] = useState([]);
  // XLSX는 여러 시트가 흔하므로 임의로 합치지 않는다. 먼저 사용자가 하나를 선택하게
  // 하고, 날짜 열 전개형도 변환 전에 의미를 확인할 수 있도록 별도 대기 상태로 둔다.
  const [pendingWorkbook, setPendingWorkbook] = useState(null);
  const [selectedWorkbookSheet, setSelectedWorkbookSheet] = useState("");
  const [pendingWideImport, setPendingWideImport] = useState(null);
  const preparationRequestRef = useRef(0);
  const importTaskRef = useRef(0);
  const trackImportFailure = (source, state) => trackProductEvent("data_import_failed", {
    tool_id: eventToolId,
    source,
    state,
    locale,
  });
  const reportImportFailure = ({ message, source, state }) => {
    setErrorMsg(message);
    trackImportFailure(source, state);
    onImportFailed?.({ source, state });
  };

  useEffect(() => {
    if (!isMappingMemoryEnabled) return undefined;
    let active = true;
    listMappingMemory().then((records) => { if (active) setMappingMemoryRecords(records); }).catch(() => { if (active) setMappingMemoryRecords([]); });
    return () => { active = false; };
  }, [isMappingMemoryEnabled]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
    // reset input
    e.target.value = null;
  };

  const applyImportedTable = async ({ headers, raw, fileName, source, worksheetName = null, sheetUrl = null, fileModifiedAt = null, workspaceSource = null }) => {
    if (!headers.length || !raw.length) {
      reportImportFailure({ message: T.emptyCsv, source, state: "empty_file" });
      return;
    }
    const requestId = ++preparationRequestRef.current;
    const prepared = await prepareImportedData({ headers, raw, toolId, source });
    if (requestId !== preparationRequestRef.current) return;
    const insights = prepared.insights;
    if (insights.signature.needsWideToLong) {
      setPendingWideImport({ headers, raw, fileName, source, worksheetName, fileModifiedAt, workspaceSource, insights });
      return;
    }
    const recipe = await getTransformRecipe(headers).catch(() => null);
    const hasValidRecipe = recipe?.mapping && Object.keys(recipe.mapping).every((header) => headers.includes(header));
    const mapping = hasValidRecipe ? recipe.mapping : insights.selections;
    const semanticMapping = isMappingMemoryEnabled ? applyCompatibleMemory(prepared.semanticMapping, mappingMemoryRecords) : prepared.semanticMapping;
    const canonicalData = hasValidRecipe ? buildCanonicalDataset({ raw, headers, mapping }) : prepared.canonicalData;
    const mappedRows = buildLegacyRows({ raw, legacyMapping: mapping, semanticBindings: semanticMapping?.bindings || [], toolId });
    const canonicalDataV2 = buildCanonicalDatasetV2({ raw, headers, bindings: semanticMapping?.bindings || [], valueBindingRecipes: semanticMapping?.valueBindingRecipes || [], representation: semanticMapping?.profile?.representation || "tabular" });
    const displayName = worksheetName ? `${fileName} · ${worksheetName}` : fileName;

    setCsvData({
      raw,
      headers,
      mapping,
      fileName: displayName,
      importSource: source,
      worksheetName,
      ...(sheetUrl ? { sheetUrl } : {}),
      ...(fileModifiedAt != null ? { fileModifiedAt } : {}),
      ...(workspaceSource ? { workspaceSource } : {}),
      importInsights: { ...insights, recipeApplied: !!recipe },
      canonicalData,
      mappedRows,
      mappingBindingsV2: semanticMapping?.bindings || [],
      canonicalDataV2,
      semanticMapping: semanticMapping || null,
      ...(prepared.parityReport ? { semanticParityReport: prepared.parityReport } : {}),
    });
    setConfirmedHeaders(new Set());
    setImportAnnouncement(T.importSuccess(displayName, raw.length, headers.length));
    trackProductEvent("data_import_success", { tool_id: eventToolId, source, column_count: headers.length, row_count: raw.length, mapped_count: Object.values(mapping).filter((value) => value !== "__ignore__").length, conflict_count: insights.conflicts.length, locale });
    trackProductEvent("data_profile_completed", { tool_id: eventToolId, source, column_count: headers.length, row_count: raw.length, conflict_count: insights.conflicts.length, locale });
    setPreviewOpen(true);
    onPrepared?.({ fileName: displayName, rowCount: raw.length, columnCount: headers.length, source });
  };

  const processFile = async (file) => {
    setErrorMsg("");
    setImportAnnouncement("");
    setIsImporting(true);
    const taskId = ++importTaskRef.current;
    const isWorkbook = /\.xlsx?$/i.test(file.name);
    const source = isWorkbook ? "xlsx" : "csv";
    onImportStart?.({ fileName: file.name, source });
    trackProductEvent("data_import_start", { tool_id: eventToolId, source, locale });
    if (isWorkbook) {
      try {
        const sheets = await parseXlsxFile(file);
        if (taskId !== importTaskRef.current) return;
        if (!sheets.length) {
          reportImportFailure({ message: T.emptyCsv, source, state: "empty_file" });
        } else if (sheets.length === 1) {
          await applyImportedTable({ ...sheets[0], fileName: file.name, source, worksheetName: sheets[0].name, fileModifiedAt: file.lastModified, workspaceSource: { blob: file.slice(), kind: "xlsx", originalFileName: file.name } });
        } else {
          setPendingWorkbook({ fileName: file.name, source, sheets, fileModifiedAt: file.lastModified, workspaceSource: { blob: file.slice(), kind: "xlsx", originalFileName: file.name } });
          setSelectedWorkbookSheet(sheets[0].name);
        }
      } catch (error) {
        if (taskId !== importTaskRef.current) return;
        reportImportFailure({
          message: error?.code ? xlsxImportErrorMessage(error.code, locale) : `${T.parseError}${error.message}`,
          source,
          state: xlsxFailureState(error),
        });
      } finally {
        if (taskId === importTaskRef.current) setIsImporting(false);
      }
      return;
    }
    // 공용·도구별 업로더가 같은 크기 상한과 CP949 복원을 쓰게 한다. 자체 드롭존만
    // 빠지면 한국 Excel CSV가 "성공"한 채 헤더가 깨지는 경로가 다시 생긴다.
    let parseInput;
    try {
      parseInput = await prepareCsvParseInput(file);
    } catch (error) {
      reportImportFailure({ message: csvImportErrorMessage(error?.code, locale), source, state: csvFailureState(error) });
      setIsImporting(false);
      return;
    }
    // 취소는 아래 complete 콜백의 taskId 가드가 처리한다(여기서 조기 반환하면 취소 후
    // 늦게 도착하는 워커 콜백 무시 경로가 사라진다).
    Papa.parse(parseInput, {
      worker: true,
      skipEmptyLines: true,
      complete: async (results) => {
        if (taskId !== importTaskRef.current) return;
        try {
          if (!results.data || results.data.length === 0) {
            reportImportFailure({ message: T.emptyCsv, source, state: "empty_file" });
            return;
          }
          const { headers, raw } = tableToRecords(results.data);
          if (!headers.length || !raw.length) {
            reportImportFailure({ message: T.emptyCsv, source, state: "empty_file" });
            return;
          }
          if (taskId === importTaskRef.current) await applyImportedTable({ headers, raw, fileName: file.name, source, fileModifiedAt: file.lastModified, workspaceSource: { blob: file.slice(), kind: "csv", originalFileName: file.name } });
        } catch (error) {
          if (taskId !== importTaskRef.current) return;
          reportImportFailure({ message: `${T.parseError}${error.message}`, source, state: "parse_error" });
        } finally {
          if (taskId === importTaskRef.current) setIsImporting(false);
        }
      },
      error: (err) => {
        if (taskId !== importTaskRef.current) return;
        reportImportFailure({ message: T.parseError + err.message, source, state: "parse_error" });
        setIsImporting(false);
      },
    });
  };

  const handleWorkbookImport = async () => {
    const sheet = pendingWorkbook?.sheets.find((item) => item.name === selectedWorkbookSheet);
    if (!sheet || !pendingWorkbook) return;
    setErrorMsg("");
    setIsImporting(true);
    try {
      await applyImportedTable({ ...sheet, fileName: pendingWorkbook.fileName, source: pendingWorkbook.source, worksheetName: sheet.name, fileModifiedAt: pendingWorkbook.fileModifiedAt, workspaceSource: pendingWorkbook.workspaceSource });
      setPendingWorkbook(null);
    } catch (error) {
      reportImportFailure({ message: `${T.parseError}${error.message}`, source: pendingWorkbook.source, state: "parse_error" });
    } finally {
      setIsImporting(false);
    }
  };

  const handleWideTransform = async () => {
    if (!pendingWideImport) return;
    setErrorMsg("");
    setIsImporting(true);
    try {
      const transformed = wideToLong(pendingWideImport);
      setPendingWideImport(null);
      await applyImportedTable({
        ...transformed,
        fileName: pendingWideImport.fileName,
        source: pendingWideImport.source,
        worksheetName: pendingWideImport.worksheetName,
        fileModifiedAt: pendingWideImport.fileModifiedAt,
        workspaceSource: pendingWideImport.workspaceSource,
      });
    } catch (error) {
      reportImportFailure({ message: `${T.parseError}${error.message}`, source: pendingWideImport.source, state: "transform_error" });
    } finally {
      setIsImporting(false);
    }
  };

  const cancelPendingImport = () => {
    setPendingWorkbook(null);
    setPendingWideImport(null);
    setSelectedWorkbookSheet("");
    setErrorMsg("");
  };

  const cancelActiveImport = () => {
    importTaskRef.current += 1;
    preparationRequestRef.current += 1;
    setIsImporting(false);
    setErrorMsg("");
    setImportAnnouncement("");
    onImportFailed?.({ source: "csv", state: "cancelled" });
  };

  // 시트도 일반 업로드와 같은 prepare 경로를 탄다. 즉, 같은 헤더의 이전 매핑 recipe를
  // 재사용해 새로고침 뒤에도 드롭다운을 다시 맞출 필요가 없다. 원본 행은 상태 메모리에만
  // 있고, sheetUrl만 별도 브라우저 기록에 남는다.
  const handleSheetLoaded = async ({ headers, raw, fileName, sheetUrl }) => {
    setErrorMsg("");
    try {
      await applyImportedTable({ headers, raw, fileName, sheetUrl, source: "google_sheets" });
      setSheetChangeOpen(false);
    } catch (error) {
      reportImportFailure({ message: `${T.parseError}${error.message}`, source: "google_sheets", state: "parse_error" });
    }
  };

  const handleSheetError = (message, state = null) => {
    if (message && state) reportImportFailure({ message, source: "google_sheets", state });
    else setErrorMsg(message);
  };

  // "🔄 최신 데이터 불러오기" — 저장해둔 sheetUrl로 재조회, URL 재입력 없음. 매핑은
  // 새 헤더 기준으로 다시 자동매핑(시트에 컬럼이 추가/삭제됐을 수 있어 기존 매핑을
  // 그대로 끌고 가면 어긋날 수 있음 — 새 CSV 재업로드와 동일 취급이 제일 안전).
  const handleRefreshSheet = async () => {
    if (!csvData?.sheetUrl) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY;
    if (!apiKey) return;
    setErrorMsg("");
    setRefreshingSheet(true);
    trackProductEvent("data_import_start", { tool_id: eventToolId, source: "google_sheets", locale });
    try {
      const result = await fetchSheetTable(apiKey, csvData.sheetUrl);
      if (result.error) {
        reportImportFailure({ message: sheetErrorMessage(result.error, locale), source: "google_sheets", state: `sheet_${result.error}` });
      } else {
        await handleSheetLoaded(result);
      }
    } catch {
      reportImportFailure({ message: sheetErrorMessage("fetch", locale), source: "google_sheets", state: "sheet_fetch" });
    } finally {
      setRefreshingSheet(false);
    }
  };

  const handleMappingChange = (header, value) => {
    const mapping = { ...csvData.mapping, [header]: value };
    const migration = canonicalFieldForLegacyKey(value);
    const bindings = (csvData.mappingBindingsV2 || []).map((binding) => binding.sourceColumn === header ? {
      ...binding,
      canonicalKey: migration?.canonicalKey || null,
      role: migration?.canonicalKey ? CANONICAL_FIELDS[migration.canonicalKey]?.family || "UNKNOWN" : "UNKNOWN",
      decision: migration?.canonicalKey ? "SUGGEST" : "UNKNOWN",
      evidence: migration?.canonicalKey ? [{ kind: "legacy_user", code: "USER_SELECTED_LEGACY_ROLE" }] : [],
      source: "user",
      member: migration?.memberHint ? { kind: migration.memberHint } : null,
      window: migration?.window || null,
    } : binding);
    setCsvData({
      ...csvData,
      mapping,
      canonicalData: buildCanonicalDataset({ raw: csvData.raw, headers: csvData.headers, mapping }),
      mappedRows: buildLegacyRows({ raw: csvData.raw, legacyMapping: mapping, semanticBindings: bindings, toolId }),
      mappingBindingsV2: bindings,
      canonicalDataV2: buildCanonicalDatasetV2({ raw: csvData.raw, headers: csvData.headers, bindings, valueBindingRecipes: csvData.semanticMapping?.valueBindingRecipes || [], representation: csvData.semanticMapping?.profile?.representation || "tabular" }),
    });
    setConfirmedHeaders((previous) => new Set([...previous, header]));
    // Mapping edit changes the sig → store gate auto-resets. Re-open preview so
    // the user re-checks the columns before pressing 분석하기 again.
    setPreviewOpen(true);
  };

  const handleSemanticBindingChange = (sourceColumn, canonicalKey) => {
    const field = canonicalKey ? CANONICAL_FIELDS[canonicalKey] : null;
    const bindings = (csvData.mappingBindingsV2 || []).map((binding) => binding.sourceColumn === sourceColumn ? {
      ...binding,
      canonicalKey: field?.key || null,
      role: field?.family || "UNKNOWN",
      decision: field ? "SUGGEST" : "UNKNOWN",
      evidence: field ? [{ kind: "manual", code: "USER_SELECTED_CANONICAL_ROLE" }] : [],
      source: "user",
    } : binding);
    const mapping = projectSemanticBindingsToLegacyMapping({ toolId, legacyMapping: csvData.mapping, bindings });
    setCsvData({
      ...csvData,
      mapping,
      mappingBindingsV2: bindings,
      canonicalData: buildCanonicalDataset({ raw: csvData.raw, headers: csvData.headers, mapping }),
      mappedRows: buildLegacyRows({ raw: csvData.raw, legacyMapping: mapping, semanticBindings: bindings, toolId }),
      canonicalDataV2: buildCanonicalDatasetV2({ raw: csvData.raw, headers: csvData.headers, bindings, valueBindingRecipes: csvData.semanticMapping?.valueBindingRecipes || [], representation: csvData.semanticMapping?.profile?.representation || "tabular" }),
    });
    setPreviewOpen(true);
  };

  const applySemanticFallback = () => {
    // 2단계는 화면을 하나 더 여는 대신, 확인된 semantic 후보를 같은 CSV 매핑표에
    // 투영한다. 사용자는 한 가지 매핑 UI에서만 최종 값을 확인·수정한다.
    const bindings = (csvData.mappingBindingsV2 || []).map((binding) => (
      binding.canonicalKey && binding.decision !== "UNKNOWN"
        ? { ...binding, source: "user" }
        : binding
    ));
    const mapping = projectSemanticBindingsToLegacyMapping({ toolId, legacyMapping: csvData.mapping, bindings });
    setErrorMsg("");
    setCsvData({
      ...csvData,
      mapping,
      mappingBindingsV2: bindings,
      canonicalData: buildCanonicalDataset({ raw: csvData.raw, headers: csvData.headers, mapping }),
      mappedRows: buildLegacyRows({ raw: csvData.raw, legacyMapping: mapping, semanticBindings: bindings, toolId }),
      canonicalDataV2: buildCanonicalDatasetV2({ raw: csvData.raw, headers: csvData.headers, bindings, valueBindingRecipes: csvData.semanticMapping?.valueBindingRecipes || [], representation: csvData.semanticMapping?.profile?.representation || "tabular" }),
    });
    onMappingReviewNeedsSemanticFallback?.();
  };

  const handleReset = async () => {
    await clearCsvGroup();
    setImportAnnouncement("");
    setPreviewOpen(true);
  };

  // Load a deterministic demo dataset for this tool's group and auto-confirm the
  // analyze gate so results render immediately (§12.8 demo pattern).
  const handleLoadDemo = () => {
    setErrorMsg("");
    const group = TOOL_GROUP[toolId] || "efficiency";
    const demo = buildDemoCsv(group, locale);
    setCsvData({ ...demo, canonicalData: buildCanonicalDataset(demo), mappedRows: buildLegacyRows({ raw: demo.raw, legacyMapping: demo.mapping, toolId }) });
    setGroupAnalyzed(toolId);
    setPreviewOpen(false);
  };

  const hasFile = csvData && csvData.headers && csvData.headers.length > 0;
  const isDemo = !!(csvData && csvData.fileName && csvData.fileName.startsWith("demo_"));
  const isSheetSourced = !!(csvData && csvData.sheetUrl);
  // 시트 원본은 도구 ID가 아니라 데이터 grain(효율·소재·MMM 등) 단위로 기억한다.
  // 같은 효율 CSV를 쓰는 5-2/5-3/5-21/5-22 사이에서 다시 URL을 입력하지 않게 한다.
  const sheetSourceScope = TOOL_GROUP[toolId] || "efficiency";
  const currentWorkspaceDataset = workspaceDatasetSummaries.find((entry) => entry.group === sheetSourceScope && entry.fileName === csvData?.fileName && entry.rowCount === csvData?.raw?.length);
  const isWorkspaceSavePending = deviceStorageEnabled && !!csvData?.workspaceSource && !currentWorkspaceDataset;
  // 자동 로드하지 않는다. 예전에는 도구에 들어가면 곧장 샘플 분석 화면이 떠서,
  // "내 데이터를 올리는 곳"이라는 사실도 "이 도구가 뭘 보여주는지"도 가려졌다.
  // 이제 빈 화면 대신 브리프(질문·답·볼 수 있는 것)와 눈에 띄는 예시 버튼을 준다.

  // --- Compute mapping requirements ---
  const { missing, reqLabels, fieldGroups, allowKeys } = useMemo(() => {
    if (!toolId) return { missing: [], reqLabels: [], fieldGroups: {}, allowKeys: new Set() };
    
    const reqs = TOOL_REQUIRED_FIELDS[toolId] || [];
    const opts = TOOL_OPTIONAL_FIELDS[toolId] || [];
    const mapped = new Set(
      Object.values(csvData.mapping || {}).filter((v) => v !== "__ignore__")
    );

    // checkRequiredForTool equivalent
    const missingKeys = [];
    reqs.forEach((r) => {
      if (typeof r === "string") {
        if (!mapped.has(r)) missingKeys.push(r);
      } else if (r.oneOf) {
        const hasAny = r.oneOf.some((k) => mapped.has(k));
        if (!hasAny) missingKeys.push(r.oneOf.join("|"));
      }
    });

    const labels = reqs.map((r) => {
      if (typeof r === "string") return localizedStandardFieldLabel(r, locale);
      if (r.oneOf)
        return T.oneOfSuffix(r.oneOf.map((k) => localizedStandardFieldLabel(k, locale)).join(" / "));
      return "?";
    });

    // Determine allowKeys
    const allowed = new Set();
    if (isRouterMode && showMappingReview) {
      // /start는 특정 도구의 좁은 계약이 아니라, 입력 데이터의 공용 역할을
      // 검토하는 곳이다. 효율 필드만 허용하면 다른 분석의 매핑을 바로잡을 수 없다.
      Object.keys(STANDARD_FIELDS).forEach((key) => allowed.add(key));
    } else {
      reqs.forEach((r) => {
        if (typeof r === "string") allowed.add(r);
        else if (r.oneOf) r.oneOf.forEach((k) => allowed.add(k));
      });
      opts.forEach((o) => allowed.add(o.key));
    }

    const groups = {};
    for (const [key, def] of Object.entries(STANDARD_FIELDS)) {
      if (allowed.size > 0 && !allowed.has(key)) continue;
      const group = localizedFieldGroupLabel(def.group, locale);
      if (!groups[group]) groups[group] = [];
      groups[group].push({ key, label: localizedStandardFieldLabel(key, locale) });
    }
    // Fallback if empty
    if (Object.keys(groups).length === 0) {
      for (const [key, def] of Object.entries(STANDARD_FIELDS)) {
        const group = localizedFieldGroupLabel(def.group, locale);
        if (!groups[group]) groups[group] = [];
        groups[group].push({ key, label: localizedStandardFieldLabel(key, locale) });
      }
    }

    return { missing: missingKeys, reqLabels: labels, fieldGroups: groups, allowKeys: allowed };
  }, [toolId, csvData.mapping, T, locale, isRouterMode, showMappingReview]);

  // --- Data preview (#6): first ~8 rows × MAPPED columns so the user maps with
  // context. Ignored columns are dropped; each header shows its standard-field
  // label. Falls back to all headers when nothing is mapped yet (fresh upload).
  const preview = useMemo(() => {
    const headers = csvData.headers || [];
    const mapping = csvData.mapping || {};
    const mappedHeaders = headers.filter((h) => mapping[h] && mapping[h] !== "__ignore__");
    // Before any mapping exists, show all columns so the raw data is still visible.
    const cols = mappedHeaders.length > 0 ? mappedHeaders : headers;
    const rows = (csvData.raw || []).slice(0, 8);
    return {
      cols,
      rows,
      usingMapped: mappedHeaders.length > 0,
      totalRows: (csvData.raw || []).length,
    };
  }, [csvData.headers, csvData.mapping, csvData.raw]);

  // 각 도구에 직접 들어와도 StartGate와 같은 데이터 계약을 적용한다. 등록되지 않은
  // 도구는 기존 필수 컬럼 게이트를 그대로 사용한다.
  const dataEligibility = useMemo(() => {
    if (!ANALYSIS_CONTRACTS[toolId] || !csvData.canonicalData) return null;
    return evaluateEligibility({ toolId, mapping: csvData.mapping, canonicalData: csvData.canonicalData, locale });
  }, [toolId, csvData.mapping, csvData.canonicalData, locale]);
  const semanticBindings = csvData.mappingBindingsV2?.length
    ? csvData.mappingBindingsV2
    : semanticBindingsFromLegacyMapping(csvData.mapping);
  const semanticEligibility = evaluateV2Eligibility({ toolId, bindings: semanticBindings });

  if (!hasFile) {
    return (
      <div className={`csv-uploader ${entryVariant === "dochi" ? "csv-uploader--dochi" : ""}`} data-analysis-status={ANALYSIS_STATUS.EMPTY} data-hydrated={isHydrated ? "true" : "false"}>
        {/* Keep this as the first child in both render branches so React
            preserves one live region while upload state changes. */}
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{isImporting ? T.importing : importAnnouncement}</div>
        {showGuide && <CsvGuide toolId={toolId} onTryExample={handleLoadDemo} locale={locale} />}
        {pendingWorkbook ? (
          <section className="required-banner" style={{ borderLeftColor: "var(--primary)" }}>
            <strong>{T.workbookTitle}</strong>
            <p style={{ margin: "0.35rem 0 0.8rem" }}>{T.workbookDesc(pendingWorkbook.sheets.length)}</p>
            <label style={{ display: "grid", gap: "5px", maxWidth: "440px", fontSize: "12px" }}>
              <span>{T.workbookSelectLabel}</span>
              <select value={selectedWorkbookSheet} onChange={(event) => setSelectedWorkbookSheet(event.target.value)}>
                {pendingWorkbook.sheets.map((sheet) => <option key={sheet.name} value={sheet.name}>{sheet.name} · {sheet.raw.length.toLocaleString()}행</option>)}
              </select>
            </label>
            <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
              <button className="ab-button" onClick={handleWorkbookImport} disabled={isImporting}>{T.workbookImportBtn}</button>
              <button className="ab-pill" onClick={cancelPendingImport}>{T.cancelImportBtn}</button>
            </div>
          </section>
        ) : pendingWideImport ? (
          <section className="required-banner" style={{ borderLeftColor: "var(--warning)" }}>
            <strong>{T.wideTransformTitle}</strong>
            <p style={{ margin: "0.35rem 0 0.8rem" }}>{T.wideTransformDesc(pendingWideImport.insights.signature.evidence.periodColumns)}</p>
            <p className="muted" style={{ margin: "0 0 12px", fontSize: "11px" }}>{T.wideWarning}</p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button className="ab-button" onClick={handleWideTransform} disabled={isImporting}>{T.wideTransformBtn}</button>
              <button className="ab-pill" onClick={cancelPendingImport}>{T.cancelImportBtn}</button>
            </div>
          </section>
        ) : (
          <>
        {/* 예시 데이터 진입점은 화면에 하나만 둔다. CsvGuide가 이미 같은 버튼을
            그리고 있으면 여기서 또 그리지 않는다 — 나란히 놓인 같은 동작의 버튼 둘은
            "무엇이 다른가"를 먼저 묻게 만든다(제품 SSOT §5.3 위계 없는 CTA). */}
        {toolId !== "start-gate" && !showGuide && (
          <div className="csv-entry-actions">
            <button type="button" className="csv-entry-actions__demo" onClick={handleLoadDemo}>
              {T.entryDemoBtn}
            </button>
            <span className="csv-entry-actions__hint">{T.entryDemoHint}</span>
          </div>
        )}
        <button
          type="button"
          className={`csv-dropzone ${isDragging ? "dragover" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          disabled={!isHydrated || isImporting}
          aria-busy={!isHydrated || isImporting}
        >
          <div className="csv-drop-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </div>
          <div className="csv-drop-text">{isImporting ? T.importing : T.dropTitle}</div>
          <div className="csv-drop-sub">{T.dropSub}</div>
        </button>
        <input type="file" accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" hidden ref={fileInputRef} onChange={handleFileChange} disabled={!isHydrated || isImporting} />
        {toolId === "start-gate" && hasToolTemplate(toolId) && (
          <div className="csv-upload-quick-actions">
            <button type="button" className="ab-pill" onClick={() => downloadTemplateCsv(toolId)}>{T.starterTemplateBtn}</button>
          </div>
        )}
        {isImporting && <button type="button" className="ab-pill" onClick={cancelActiveImport} style={{ marginTop: "10px" }}>{T.cancelActiveImportBtn}</button>}
        <GoogleSheetConnect
          onLoaded={handleSheetLoaded}
          onImportStart={() => {
            onImportStart?.({ source: "google_sheets" });
            trackProductEvent("data_import_start", { tool_id: eventToolId, source: "google_sheets", locale });
          }}
          onError={handleSheetError}
          locale={locale}
          toolId={sheetSourceScope}
          initialOpen={sheetInitiallyOpen}
        />
          </>
        )}
        {errorMsg && <div role="alert" className="csv-upload-error">{errorMsg}</div>}
      </div>
    );
  }

  const mappedOptCount = (TOOL_OPTIONAL_FIELDS[toolId] || []).filter(
    (o) => csvData.mapping && csvData.mapping !== "__ignore__" && Object.values(csvData.mapping).includes(o.key)
  ).length;
  const totalOptCount = (TOOL_OPTIONAL_FIELDS[toolId] || []).length;
  const importInsights = csvData.importInsights;
  const datasetSignature = importInsights?.signature;
  const candidateByHeader = importInsights?.candidates || {};
  const mappingConflicts = findMappingConflicts(csvData.mapping);
  const mappingAssessments = assessMappingConfidence({
    selections: csvData.mapping,
    candidates: candidateByHeader,
    initialSelections: importInsights?.selections || {},
    confirmedHeaders,
  });
  const assessmentByHeader = Object.fromEntries(mappingAssessments.map((assessment) => [assessment.header, assessment]));
  const requiredFieldKeys = new Set((TOOL_REQUIRED_FIELDS[toolId] || []).flatMap((field) => typeof field === "string" ? [field] : field?.oneOf || []));
  const hasRequiredMustConfirm = mappingAssessments.some((assessment) => assessment.state === "must_confirm" && requiredFieldKeys.has(assessment.field));
  const mappedCount = Object.values(csvData.mapping || {}).filter((value) => value && value !== "__ignore__").length;
  const needsReview = mappingAssessments.filter((assessment) => assessment.state === "review" || assessment.state === "must_confirm").length;
  const mappingBlocked = mappingConflicts.length > 0 || hasRequiredMustConfirm;
  const semanticBlocked = !isDemo && semanticEligibility.status === "blocked";
  const analysisBlocked = missing.length === 0 && (dataEligibility?.status === "blocked" || mappingBlocked || semanticBlocked);
  const analysisSource = isDemo ? "demo" : isSheetSourced ? "google_sheets" : csvData?.importSource || "csv";
  const blockedState = missing.length > 0
    ? "missing_required"
    : mappingConflicts.length > 0
      ? "mapping_conflict"
      : hasRequiredMustConfirm
        ? "mapping_confirmation"
        : dataEligibility?.status === "blocked"
          ? dataEligibility?.blockers?.[0]?.code || "data_eligibility"
          : semanticBlocked
            ? "semantic_mapping"
          : null;
  const analysisStatus = deriveAnalysisStatus({
    hasData: !!hasFile,
    hasRequiredMapping: missing.length === 0 && !analysisBlocked,
    isAnalyzed,
    isStale,
  });
  const confirmAnalysis = () => {
    if (analysisBlocked || isStartingAnalysis) return;
    const confidenceBucket = needsReview || mappingConflicts.length ? "review" : "high";
    const analysisType = productAnalysisType(eventToolId);
    const event = { tool_id: eventToolId, source: analysisSource, row_count: csvData?.raw?.length || 0, analysis_type: analysisType, mapped_count: mappedCount, confidence_bucket: confidenceBucket, conflict_count: mappingConflicts.length, missing_required_count: missing.length, locale };
    trackProductEvent("mapping_confirmed", event);
    trackProductEventOnce("analysis_started", analysisResultEventKey(eventToolId, analysisType, computeAnalyzeSig(csvData), "", locale), event);
    if (isMappingMemoryEnabled) {
      const profiles = Object.fromEntries((csvData.semanticMapping?.profile?.columns || []).map((profile) => [profile.header, profile]));
      const context = { representation: csvData.semanticMapping?.profile?.representation || "tabular", roleFamilies: (csvData.mappingBindingsV2 || []).map((binding) => binding.role).filter(Boolean) };
      const confirmed = (csvData.mappingBindingsV2 || []).filter((binding) => binding.source === "user" && binding.canonicalKey).map((binding) => buildMappingMemoryRecord({ normalizedColumnName: binding.sourceColumn, canonicalKey: binding.canonicalKey, profile: profiles[binding.sourceColumn], context }));
      Promise.all(confirmed.map(confirmMappingMemory)).then(() => listMappingMemory()).then(setMappingMemoryRecords).catch(() => {});
    }
    saveTransformRecipe({ headers: csvData.headers, mapping: csvData.mapping, source: isSheetSourced ? "google_sheets" : "csv" }).catch(() => {});
    setIsStartingAnalysis(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        requestAd(() => {
          setGroupAnalyzed(toolId);
          setPreviewOpen(false);
          setIsStartingAnalysis(false);
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      });
    });
  };
  const mappingStatusLabel = {
    confirmed: T.mappingConfirmed,
    review: T.mappingReview,
    must_confirm: T.mappingMustConfirm,
    manual: T.mappingManual,
    conflict: T.mappingConflict,
    ignored: T.unmapped,
  };
  const confirmHeader = (header) => setConfirmedHeaders((previous) => new Set([...previous, header]));
  const mappingNeedsAttention = missing.length > 0 || analysisBlocked || needsReview > 0 || mappingConflicts.length > 0;
  const isSemanticFallbackStage = mappingReviewStage === "semantic";
  const shouldOfferSemanticFallback = mappingReviewStage === "legacy" && (
    missing.length > 0 || mappingBlocked || semanticBlocked
  );
  const handleMappingReviewAction = () => {
    if (isSemanticFallbackStage) {
      if (!analysisBlocked) onMappingReviewConfirmed?.();
    } else if (shouldOfferSemanticFallback) {
      applySemanticFallback();
    } else if (!analysisBlocked) {
      onMappingReviewConfirmed?.();
    }
  };

  return (
    <div className="csv-uploader" data-analysis-status={analysisStatus} data-hydrated={isHydrated ? "true" : "false"}>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{isImporting ? T.importing : isStartingAnalysis ? (locale === "en" ? "Starting analysis…" : "분석을 시작하는 중…") : importAnnouncement}</div>
      <AnalyzingOverlay
        show={isStartingAnalysis}
        title={locale === "en" ? "Analyzing…" : "분석 중…"}
        sub={locale === "en" ? `Preparing ${Number(csvData?.raw?.length || 0).toLocaleString()} rows` : `${Number(csvData?.raw?.length || 0).toLocaleString()}행을 준비하는 중`}
      />
      {isDemo && (
        <div className="required-banner csv-demo-banner">
          <div className="csv-demo-banner__copy">
            <strong>{T.demoBannerTitle}</strong>
            <p className="csv-demo-banner__description">{T.demoBannerDesc}</p>
          </div>
          <button className="ab-button" onClick={handleReset}>{T.demoBannerBtn}</button>
        </div>
      )}
      <div className="file-state">
        <div className="meta-text">
          <span className={`dot ${isDemo ? "is-sample" : "is-source"}`} data-source-kind={isDemo ? "sample" : "user"} aria-hidden="true"></span>
          {isDemo ? (
            <strong>{T.previewingDemo}</strong>
          ) : (
            <strong>{csvData.fileName}</strong>
          )}
          <span className="csv-loaded-stats tnum">
            {T.rowsCols(csvData.raw.length, csvData.headers.length, isDemo)}
          </span>
        </div>
        {!isRouterMode && <AnalysisStatusBadge status={analysisStatus} locale={locale} compact />}
        {!isDemo && !isSheetSourced && (
          <button className="ab-pill csv-change-btn" title={T.changeCsvTitle} onClick={handleReset}>
            {T.changeCsvBtn}
          </button>
        )}
      </div>
      {csvData.importInsights?.recipeApplied && (
        <div className="csv-memory-note">◉ {T.savedMappingApplied}</div>
      )}
      {!isDemo && !isSheetSourced && deviceStorageEnabled && csvData?.workspaceSource && (
        <div className={`csv-memory-note${workspaceStorageError ? " is-error" : ""}`}>
          ◉ {workspaceStorageError ? T.storageUnavailable : isWorkspaceSavePending ? T.storingOnDevice : T.storedOnDevice}
        </div>
      )}

      {/* 구글 시트 연동 상태 UX(§요청): 시트에서 온 데이터는 CSV와 다르게, "재조회"와
          "다른 시트로 교체"를 한 번의 재업로드 없이 바로 할 수 있어야 함. CSV 업로드로
          되돌아갈 길도 항상 열어둠(전환 자유도). */}
      {!isDemo && isSheetSourced && (
        <div style={{ marginBottom: "10px" }}>
          {sheetChangeOpen ? (
            <GoogleSheetConnect
              initialOpen
              onLoaded={handleSheetLoaded}
              onImportStart={() => trackProductEvent("data_import_start", { tool_id: eventToolId, source: "google_sheets", locale })}
              onError={handleSheetError}
              onCancel={() => setSheetChangeOpen(false)}
              locale={locale}
              toolId={sheetSourceScope}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>🔗 {T.sheetConnectedLabel}</span>
              <button
                type="button"
                className="ab-pill"
                disabled={refreshingSheet}
                onClick={handleRefreshSheet}
              >
                {refreshingSheet ? T.refreshingSheet : T.refreshSheetBtn}
              </button>
              <button type="button" className="ab-pill" onClick={() => setSheetChangeOpen(true)}>
                {T.changeSheetBtn}
              </button>
              <button type="button" className="ab-pill" onClick={() => fileInputRef.current?.click()}>
                {T.switchToCsvBtn}
              </button>
              <input
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>
          )}
        </div>
      )}
      {errorMsg && <div role="alert" className="csv-upload-error csv-upload-error--loaded">{errorMsg}</div>}

      {!isRouterMode && blockedState && (
        <AnalysisBlockedTelemetry
          toolId={eventToolId}
          source={analysisSource}
          state={blockedState}
          signature={computeAnalyzeSig(csvData)}
          rowCount={csvData?.raw?.length || 0}
          mappedCount={mappedCount}
          conflictCount={mappingConflicts.length}
          missingCount={missing.length}
          locale={locale}
        />
      )}

      {!isRouterMode && (missing.length > 0 ? (
        <div className="required-banner">
          <strong>{T.missingTitle}</strong>
          <p className="required-banner__description">
            {T.missingLabel}{reqLabels.map((l, i) => (
              <span key={i}><code className="inline">{l}</code>{i < reqLabels.length - 1 ? ", " : ""}</span>
            ))}
          </p>
        </div>
      ) : analysisBlocked ? (
        <div className="required-banner">
          <strong>{mappingBlocked || semanticBlocked ? T.mappingBlockedTitle : T.dataBlockedTitle}</strong>
          <p className="required-banner__description">
            {mappingConflicts.length ? T.mappingBlockedConflict : hasRequiredMustConfirm ? T.mappingBlockedConfirm : semanticBlocked ? T.semanticBlocked : formatEligibilityBlocker(dataEligibility, locale) || T.dataBlockedHint}
          </p>
        </div>
      ) : (
        <div className="required-banner ok">
          <strong>{T.okTitle}</strong>
          <p className="required-banner__description">{T.okDesc}</p>
        </div>
      ))}

      {!isRouterMode && csvData.canonicalData && <DataQualityReport canonicalData={csvData.canonicalData} mappedRows={csvData.mappedRows} mapping={csvData.mapping} toolId={toolId} eligibility={dataEligibility} locale={locale} />}

      {(!isRouterMode || showMappingReview) && <details
        className={`csv-mapping-block${showMappingCoach ? " is-dochi-highlighted" : ""}`}
        ref={mappingDetailsRef}
        aria-describedby={showMappingCoach ? "dochi-mapping-coach-title" : undefined}
        open={collapseMappingReview ? undefined : isRouterMode || mappingNeedsAttention || undefined}
      >
        <summary className="csv-mapping-header">
          <div className="csv-mapping-heading">
            <strong className="csv-mapping-title">{T.mappingHeader}</strong>
            <span className="csv-mapping-progress">
              {T.mappingSummaryPrefix(csvData.headers.length)}<strong className="csv-mapping-progress-value">{mappedOptCount}/{totalOptCount}</strong>
            </span>
          </div>
          <span className="csv-mapping-hint">{T.mappingHint}</span>
          <span className="csv-mapping-chevron" aria-hidden="true">⌄</span>
        </summary>
        {importInsights && (
          <div className={`csv-recognition-summary ${mappingConflicts.length ? "has-conflict" : ""}`}>
            <strong>{T.recognitionSummary(mappedCount, csvData.headers.length, needsReview, mappingConflicts.length)}</strong>
            <span className="csv-recognition-hint">{T.recognitionHint}</span>
            {datasetSignature && <div className="csv-recognition-signature">{T.signatureSummary(datasetSignature.source, datasetSignature.grain)}{datasetSignature.needsWideToLong ? ` · ⚠ ${T.wideWarning}` : ""}</div>}
          </div>
        )}
        <div className="mapping-grid">
          <div className="mapping-header">{T.colHeaderCsv}</div>
          <div></div>
          <div className="mapping-header">{T.colHeaderStd}</div>
          <div className="mapping-header mapping-header--status">{T.colHeaderStatus}</div>
          
          {csvData.headers.map((h) => {
            const sel = csvData.mapping[h] || "__ignore__";
            const isUnmapped = sel === "__ignore__";
            const assessment = assessmentByHeader[h] || { state: "ignored", reasons: [] };
            
            const outOfScope = !isUnmapped && STANDARD_FIELDS[sel] && allowKeys.size > 0 && !allowKeys.has(sel);

            return (
              <React.Fragment key={h}>
                <div className="map-csv-col" data-mapping-source title={h}>{h}</div>
                <div className="map-arrow" data-mapping-arrow aria-hidden="true">→</div>
                <select 
                  className={`map-select ${isUnmapped ? "unmapped" : "auto"} ${assessment.state}`}
                  data-mapping-target
                  aria-label={`${h}: ${T.colHeaderStd}`}
                  value={sel}
                  onChange={(e) => handleMappingChange(h, e.target.value)}
                >
                  <option value="__ignore__">{T.ignoreOption}</option>
                  {outOfScope && (
                    <option value={sel}>
                      {localizedStandardFieldLabel(sel, locale)}{T.outOfScopeSuffix}
                    </option>
                  )}
                  {Object.entries(fieldGroups).map(([gr, fs]) => (
                    <optgroup key={gr} label={gr}>
                      {fs.map((f) => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div className={`map-status ${assessment.state}`} data-mapping-status>
                  {mappingStatusLabel[assessment.state]}
                  {!isUnmapped && assessment.reasons.length > 0 && (
                    <HelpTip compact label={assessment.reasons.join(" · ")}>{assessment.reasons.join(" · ")}</HelpTip>
                  )}
                  {assessment.state === "must_confirm" && (
                    <button type="button" className="map-status-confirm" onClick={() => confirmHeader(h)}>{T.mappingConfirmBtn}</button>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
        {isRouterMode && showMappingReview && mappingReviewStage === "combined" && <SemanticMappingTable bindings={csvData.mappingBindingsV2} semanticMapping={csvData.semanticMapping} locale={locale} onBindingChange={handleSemanticBindingChange} open={semanticBlocked} />}
      </details>}
      {showMappingCoach && <DochiMappingCoach
        locale={locale}
        isLeaving={mappingCoachLeaving}
        onReview={onMappingReviewConfirmed}
      />}
      {mappingReviewActionLabel && onMappingReviewConfirmed && (
        <div className="csv-mapping-review-action">
          <button type="button" className="ab-button" onClick={handleMappingReviewAction} disabled={!shouldOfferSemanticFallback && analysisBlocked}>
            {shouldOfferSemanticFallback ? mappingReviewFallbackLabel || mappingReviewActionLabel : mappingReviewActionLabel}
          </button>
        </div>
      )}
      {!isRouterMode && <SemanticMappingTable bindings={csvData.mappingBindingsV2} semanticMapping={csvData.semanticMapping} locale={locale} onBindingChange={handleSemanticBindingChange} open={semanticBlocked} />}
      {!isRouterMode && <MappingMemorySettings
        enabled={isMappingMemoryEnabled}
        count={mappingMemoryRecords.length}
        records={mappingMemoryRecords}
        locale={locale}
        onEnabledChange={(enabled) => {
          setMappingMemoryEnabled(enabled);
          setIsMappingMemoryEnabled(enabled);
          if (enabled) listMappingMemory().then(setMappingMemoryRecords).catch(() => setMappingMemoryRecords([]));
        }}
        onImport={(records) => Promise.all(records.map(putMappingMemory)).then(() => listMappingMemory()).then(setMappingMemoryRecords)}
        onClear={() => clearMappingMemory().then(() => setMappingMemoryRecords([])).catch(() => {})}
      />}
      {afterFileSummary}

      {/* 데이터 미리보기(#6) — 매핑 중에는 자동 펼침(맥락 확인), 분석 확정 후 접힘.
          사용자가 언제든 수동으로 다시 펼칠 수 있음(previewOpen 로컬 상태). */}
      {!isRouterMode && preview.cols.length > 0 && preview.rows.length > 0 && (
        <div className="csv-preview-block">
          <div className="csv-preview-header">
            <div className="csv-preview-title-group">
              <strong className="csv-preview-title">{T.previewTitle}</strong>
              <span className="csv-preview-meta">
                {preview.usingMapped ? T.previewUsingMapped : T.previewAll} · {T.previewRows(preview.rows.length, preview.totalRows)}
              </span>
            </div>
            <button
              className="ab-pill"
              aria-expanded={previewOpen}
              onClick={() => setPreviewOpen((o) => !o)}
            >
              {previewOpen ? T.collapse : T.expand}
            </button>
          </div>
          {previewOpen && (
            <div className="table-wrap csv-preview-table-wrap">
              <table className="data csv-preview-table" aria-label={T.previewTitle}>
                <caption className="sr-only">{T.previewTitle}</caption>
                <thead>
                  <tr>
                    {preview.cols.map((h) => {
                      const sel = csvData.mapping[h];
                      const stdLabel = sel && sel !== "__ignore__" ? localizedStandardFieldLabel(sel, locale) : null;
                      return (
                        <th className="csv-preview-heading" scope="col" key={h} title={stdLabel ? `${h} → ${stdLabel}` : h}>
                          {h}
                          {stdLabel && (
                            <span className="csv-preview-canonical">
                              → {stdLabel}
                            </span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, ri) => (
                    <tr key={ri}>
                      {preview.cols.map((h) => (
                        <td className="csv-preview-cell" key={h}>
                          {row[h] != null ? String(row[h]) : ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {toolId !== "start-gate" && missing.length === 0 && !analysisBlocked && (
        isAnalyzed ? (
          <div className="csv-analysis-cta-row is-analyzed">
            <span className="csv-analysis-status">{T.analyzedBadge}</span>
            <span className="csv-analysis-hint">{T.analyzedHint}</span>
            <button data-mobile-task=".csv-analysis-action" className="ab-pill csv-analysis-action" onClick={confirmAnalysis} disabled={isStartingAnalysis}>{T.reanalyzeBtn}</button>
          </div>
        ) : (
          <div className="csv-analysis-cta-row is-ready">
            <span className="csv-analysis-status">{T.checkMapping}</span>
            <span className="csv-analysis-hint">{T.checkMappingHint}</span>
            <button data-mobile-task=".csv-analysis-action" className="ab-button csv-analysis-action" onClick={confirmAnalysis} disabled={isStartingAnalysis}>{T.analyzeBtn}</button>
          </div>
        )
      )}
    </div>
  );
}
