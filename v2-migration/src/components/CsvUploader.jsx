"use client";
import React, { useState, useRef, useMemo, useEffect } from "react";
import Papa from "papaparse";
import { useAppStore, TOOL_GROUP } from "@/store/useDataStore";
import { STANDARD_FIELDS, TOOL_REQUIRED_FIELDS, TOOL_OPTIONAL_FIELDS } from "@/utils/csvConstants";
import { buildDemoCsv } from "@/utils/demoData";
import DemoLoadButton from "@/components/DemoLoadButton";
import CsvGuide from "@/components/ds/CsvGuide";
import GoogleSheetConnect, { fetchSheetTable, sheetErrorMessage } from "@/components/GoogleSheetConnect";
import { findMappingConflicts, scoreMappingCandidates } from "@/lib/data-import/scoreMappingCandidates";
import { buildCanonicalDataset } from "@/lib/data-import/buildCanonicalDataset";
import { tableToRecords } from "@/lib/data-import/detectHeaderRow";
import { detectDatasetSignature } from "@/lib/data-import/detectDatasetSignature";
import { getTransformRecipe, saveTransformRecipe } from "@/lib/data-import/localHistory";
import { toolFieldKeys } from "@/lib/data-import/prepareDatasetForTool";
import { trackProductEvent } from "@/lib/analytics";
import DataQualityReport from "@/components/data-import/DataQualityReport";

// 셸 카피만 번역(드롭존·배너·버튼·미리보기 텍스트). STANDARD_FIELDS 필드 라벨(비용·노출수
// 등, csvConstants.js 210여 개)은 별도 백로그 — 공수가 자릿수 다름(§plan).
const CSV_COPY = {
  ko: {
    emptyCsv: "CSV 파일이 비어 있거나 올바르지 않습니다.",
    parseError: "CSV 파싱 중 오류 발생: ",
    dropTitle: "CSV 파일 드래그 & 드롭",
    dropSub: "또는 클릭하여 파일 선택",
    importing: "CSV 구조를 읽는 중…",
    importSuccess: (name, rows, cols) => `${name} 업로드 완료. ${rows.toLocaleString()}행, ${cols}컬럼을 읽었습니다. 컬럼 매핑을 확인하세요.`,
    demoBannerTitle: "🧪 지금 보고 있는 화면은 샘플(예시) 데이터입니다",
    demoBannerDesc: "실제 내 데이터가 아니며, 서버로 전송되지 않습니다. 내 CSV를 업로드하면 바로 교체됩니다.",
    demoBannerBtn: "📁 내 CSV 업로드하기",
    previewingDemo: "샘플 데이터로 미리보기 중",
    rowsCols: (rows, cols, demo) => `${rows.toLocaleString()}행 · ${cols}컬럼${demo ? " · 실제 데이터 아님" : ""}`,
    changeCsvTitle: "이 도구의 CSV를 제거하고 다른 파일 업로드",
    changeCsvBtn: "⟳ CSV 변경",
    sheetConnectedLabel: "구글 시트 연동됨",
    refreshSheetBtn: "🔄 최신 데이터 불러오기",
    refreshingSheet: "불러오는 중…",
    changeSheetBtn: "🔗 시트 변경",
    switchToCsvBtn: "📁 CSV 업로드로 전환",
    missingTitle: "⚠ 이 도구가 필요로 하는 필수 컬럼이 매핑되지 않았습니다",
    missingLabel: "필수: ",
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
    signatureSummary: (source, grain) => `데이터 형태 추정: ${source} · ${grain}`,
    wideWarning: "기간이 열로 펼쳐진 형식입니다. 자동 변환 전 날짜·값 컬럼을 확인해 주세요.",
  },
  en: {
    emptyCsv: "This CSV file is empty or invalid.",
    parseError: "Error parsing CSV: ",
    dropTitle: "Drag & drop a CSV file",
    dropSub: "or click to choose a file",
    importing: "Reading CSV structure…",
    importSuccess: (name, rows, cols) => `${name} uploaded. Read ${rows.toLocaleString()} rows and ${cols} columns. Review the column mapping next.`,
    demoBannerTitle: "🧪 You're viewing sample data",
    demoBannerDesc: "This isn't your real data and nothing is sent to a server. Upload your own CSV to replace it instantly.",
    demoBannerBtn: "📁 Upload my CSV",
    previewingDemo: "Previewing sample data",
    rowsCols: (rows, cols, demo) => `${rows.toLocaleString()} rows · ${cols} cols${demo ? " · not real data" : ""}`,
    changeCsvTitle: "Remove this tool's CSV and upload another file",
    changeCsvBtn: "⟳ Change CSV",
    sheetConnectedLabel: "Connected to Google Sheets",
    refreshSheetBtn: "🔄 Fetch latest data",
    refreshingSheet: "Fetching…",
    changeSheetBtn: "🔗 Change sheet",
    switchToCsvBtn: "📁 Switch to CSV upload",
    missingTitle: "⚠ Required columns for this tool aren't mapped yet",
    missingLabel: "Required: ",
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
    signatureSummary: (source, grain) => `Detected shape: ${source} · ${grain}`,
    wideWarning: "This looks like a period-as-columns report. Confirm the date and value columns before transforming it.",
  },
};

function buildImportInsights(headers, raw, toolId) {
  const result = scoreMappingCandidates({ headers, rows: raw, allowedKeys: toolFieldKeys(toolId), fields: STANDARD_FIELDS });
  return { profiles: result.profiles, candidates: result.candidates, conflicts: result.conflicts, selections: result.selections, signature: detectDatasetSignature(headers, raw) };
}

export default function CsvUploader({ toolId, locale = "ko" }) {
  const T = CSV_COPY[locale] || CSV_COPY.ko;
  const csvData = useAppStore((s) => s.csvData);
  const setCsvData = useAppStore((s) => s.setCsvData);
  const clearCsvGroup = useAppStore((s) => s.clearCsvGroup);
  // Group-scoped "user explicitly cleared this" flag — see clearCsvGroup in
  // the store. Prevents the mount-once demo-autoload effect below from
  // silently refilling data the user just cleared, since tools remount this
  // component across their hasData/analyzed JSX branches (§bugfix).
  const manuallyCleared = useAppStore((s) => s.csvClearedByGroup[TOOL_GROUP[toolId] || "efficiency"]);
  const demoDisabled = useAppStore((s) => s.demoDisabled);
  const setGroupAnalyzed = useAppStore((s) => s.setGroupAnalyzed);
  // 분석하기 클릭 시 광고 인터스티셜 게이트(adFree면 즉시 실행). 데모 자동로드는 게이트 없이 직접.
  const requestAd = useAppStore((s) => s.requestAd);
  // Single-source analyze gate (store, group-scoped §12.5). Reading the whole
  // store here (not a memoized selector) so the boolean recomputes on any
  // csvData / analyzedByGroup change — the same slice the tools render from.
  const isAnalyzed = useAppStore((s) => s.isGroupAnalyzed(toolId));
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importAnnouncement, setImportAnnouncement] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  // Preview table is auto-shown while mapping and collapsed after analysis.
  // User can re-expand it manually anytime (independent of gate state).
  const [previewOpen, setPreviewOpen] = useState(true);
  // 구글 시트 연동 상태(§sheet refresh/change UX). refreshingSheet=재조회 중,
  // sheetChangeOpen=hasFile 화면에서 "시트 변경" 눌러 URL 폼을 다시 펼친 상태.
  const [refreshingSheet, setRefreshingSheet] = useState(false);
  const [sheetChangeOpen, setSheetChangeOpen] = useState(false);

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

  const processFile = (file) => {
    setErrorMsg("");
    setImportAnnouncement("");
    setIsImporting(true);
    trackProductEvent("data_import_start", { tool_id: toolId, source: "csv" });
    Papa.parse(file, {
      worker: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          if (!results.data || results.data.length === 0) {
            setErrorMsg(T.emptyCsv);
            return;
          }
          const { headers, raw } = tableToRecords(results.data);
          if (!headers.length || !raw.length) {
            setErrorMsg(T.emptyCsv);
            return;
          }
          const insights = buildImportInsights(headers, raw, toolId);
          const recipe = await getTransformRecipe(headers).catch(() => null);
          const mapping = recipe?.mapping && Object.keys(recipe.mapping).every((header) => headers.includes(header)) ? recipe.mapping : insights.selections;
          const canonicalData = buildCanonicalDataset({ raw, headers, mapping });

          setCsvData({
            raw,
            headers,
            mapping,
            fileName: file.name,
            importInsights: { ...insights, recipeApplied: !!recipe },
            canonicalData,
          });
          setImportAnnouncement(T.importSuccess(file.name, raw.length, headers.length));
          trackProductEvent("data_import_success", { tool_id: toolId, source: "csv", column_count: headers.length, row_count: raw.length, mapped_count: Object.values(mapping).filter((value) => value !== "__ignore__").length, conflict_count: insights.conflicts.length });
          trackProductEvent("data_profile_completed", { tool_id: toolId, source: "csv", column_count: headers.length, row_count: raw.length, conflict_count: insights.conflicts.length });
          // New file → gate auto-resets in the store (sig change); re-open preview
          // so the user maps with data context.
          setPreviewOpen(true);
        } catch (error) {
          setErrorMsg(`${T.parseError}${error.message}`);
        } finally {
          setIsImporting(false);
        }
      },
      error: (err) => {
        setErrorMsg(T.parseError + err.message);
        setIsImporting(false);
      },
    });
  };

  // 구글 시트 로드 완료 콜백 — GoogleSheetConnect가 {headers, raw, fileName, sheetUrl}을
  // CSV 업로드와 동일한 모양으로 넘겨줌(sheetValuesToTable, §googleSheets.js). 자동매핑도
  // CSV 경로와 같은 함수(autoMapHeaders) 재사용 — 이후 파이프라인은 CSV/시트 구분 없음.
  // sheetUrl을 csvData에 같이 저장해두면(§setCsvData는 매번 전체 치환이라 CSV 경로에선
  // 자연히 undefined) "최신 데이터 불러오기"가 재입력 없이 같은 URL로 재조회 가능해짐.
  const handleSheetLoaded = ({ headers, raw, fileName, sheetUrl }) => {
    setErrorMsg("");
    const insights = buildImportInsights(headers, raw, toolId);
    const mapping = insights.selections;
    const canonicalData = buildCanonicalDataset({ raw, headers, mapping });
    setCsvData({ raw, headers, mapping, fileName, sheetUrl, importInsights: insights, canonicalData });
    setImportAnnouncement(T.importSuccess(fileName, raw.length, headers.length));
    trackProductEvent("data_import_success", { tool_id: toolId, source: "google_sheets", column_count: headers.length, row_count: raw.length, mapped_count: Object.values(mapping).filter((value) => value !== "__ignore__").length, conflict_count: insights.conflicts.length });
    trackProductEvent("data_profile_completed", { tool_id: toolId, source: "google_sheets", column_count: headers.length, row_count: raw.length, conflict_count: insights.conflicts.length });
    setPreviewOpen(true);
    setSheetChangeOpen(false);
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
    try {
      const result = await fetchSheetTable(apiKey, csvData.sheetUrl);
      if (result.error) {
        setErrorMsg(sheetErrorMessage(result.error, locale));
      } else {
        handleSheetLoaded(result);
      }
    } catch {
      setErrorMsg(sheetErrorMessage("fetch", locale));
    } finally {
      setRefreshingSheet(false);
    }
  };

  const handleMappingChange = (header, value) => {
    const mapping = { ...csvData.mapping, [header]: value };
    setCsvData({
      ...csvData,
      mapping,
      canonicalData: buildCanonicalDataset({ raw: csvData.raw, headers: csvData.headers, mapping }),
    });
    // Mapping edit changes the sig → store gate auto-resets. Re-open preview so
    // the user re-checks the columns before pressing 분석하기 again.
    setPreviewOpen(true);
  };

  const handleReset = () => {
    clearCsvGroup();
    setImportAnnouncement("");
    setPreviewOpen(true);
  };

  // Load a deterministic demo dataset for this tool's group and auto-confirm the
  // analyze gate so results render immediately (§12.8 demo pattern).
  const handleLoadDemo = () => {
    setErrorMsg("");
    const group = TOOL_GROUP[toolId] || "efficiency";
    const demo = buildDemoCsv(group);
    setCsvData({ ...demo, canonicalData: buildCanonicalDataset(demo) });
    setGroupAnalyzed(toolId);
    setPreviewOpen(false);
  };

  const hasFile = csvData && csvData.headers && csvData.headers.length > 0;
  const isDemo = !!(csvData && csvData.fileName && csvData.fileName.startsWith("demo_"));
  const isSheetSourced = !!(csvData && csvData.sheetUrl);
  // GoogleSheetConnect가 실제로 렌더되는지(=API 키 설정됨) — 그때만 데모버튼 앞에
  // 가변 높이 형제가 끼어드니 여백 모디파이어 적용. 미설정 배포는 기존 spacing 그대로.
  const hasSheetImport = !!process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY;

  // 첫 진입(데이터 없음) 시 샘플 데이터를 자동 로드해 빈 업로드 화면 대신 라이브
  // 분석 화면을 즉시 보여준다(SEO·첫인상 개선). 마운트 1회만 — 사용자가 CSV 변경으로
  // 명시적으로 비우면 재자동로드 없음(의도된 빈 드롭존 유지).
  // §bugfix: 도구가 hasData/analyzed 상태에 따라 이 컴포넌트를 3개의 서로 다른 JSX
  // 분기에 렌더하므로("!hasData"/"!analyzed"/analyzed details), 데이터를 지우는 순간
  // 분기가 바뀌어 이 컴포넌트가 리마운트된다 — 마운트 1회 조건만으로는 리마운트마다
  // 다시 조건이 참이 돼(데이터 없음) 즉시 데모를 재로드, "Change CSV" 클릭이 무효화됨.
  // manuallyCleared(store, 그룹 스코프)로 리마운트 여부와 무관하게 억제.
  useEffect(() => {
    // 마운트 1회성 초기 로드(다중 setState 의도적 — 데모 데이터+게이트+프리뷰 상태를
    // 한 번에 세팅, 루프·반복 트리거 아님).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!hasFile && !manuallyCleared && !demoDisabled) handleLoadDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (typeof r === "string") return STANDARD_FIELDS[r]?.label || r;
      if (r.oneOf)
        return T.oneOfSuffix(r.oneOf.map((k) => STANDARD_FIELDS[k]?.label || k).join(" / "));
      return "?";
    });

    // Determine allowKeys
    const allowed = new Set();
    reqs.forEach((r) => {
      if (typeof r === "string") allowed.add(r);
      else if (r.oneOf) r.oneOf.forEach((k) => allowed.add(k));
    });
    opts.forEach((o) => allowed.add(o.key));

    const groups = {};
    for (const [key, def] of Object.entries(STANDARD_FIELDS)) {
      if (allowed.size > 0 && !allowed.has(key)) continue;
      if (!groups[def.group]) groups[def.group] = [];
      groups[def.group].push({ key, label: def.label });
    }
    // Fallback if empty
    if (Object.keys(groups).length === 0) {
      for (const [key, def] of Object.entries(STANDARD_FIELDS)) {
        if (!groups[def.group]) groups[def.group] = [];
        groups[def.group].push({ key, label: def.label });
      }
    }

    return { missing: missingKeys, reqLabels: labels, fieldGroups: groups, allowKeys: allowed };
  }, [toolId, csvData.mapping, T]);

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

  if (!hasFile) {
    return (
      <div>
        {/* Keep this as the first child in both render branches so React
            preserves one live region while upload state changes. */}
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{isImporting ? T.importing : importAnnouncement}</div>
        <CsvGuide toolId={toolId} locale={locale} />
        <button
          type="button"
          className={`csv-dropzone ${isDragging ? "dragover" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          aria-busy={isImporting}
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
        <input type="file" accept=".csv,text/csv" hidden ref={fileInputRef} onChange={handleFileChange} />
        <GoogleSheetConnect onLoaded={handleSheetLoaded} onError={setErrorMsg} locale={locale} />
        <DemoLoadButton onLoad={handleLoadDemo} locale={locale} className={hasSheetImport ? "demo-load-row--spaced" : ""} />
        {errorMsg && <div role="alert" style={{ color: "var(--danger)", marginTop: "10px", fontSize: "12px" }}>{errorMsg}</div>}
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
  const mappedCount = Object.values(csvData.mapping || {}).filter((value) => value && value !== "__ignore__").length;
  const needsReview = csvData.headers.filter((header) => {
    const top = candidateByHeader[header]?.[0];
    return top && top.confidence >= 0.6 && top.confidence < 0.9;
  }).length;
  const confirmAnalysis = () => {
    const confidenceBucket = needsReview || mappingConflicts.length ? "review" : "high";
    const event = { tool_id: toolId, source: isSheetSourced ? "google_sheets" : "csv", mapped_count: mappedCount, confidence_bucket: confidenceBucket, conflict_count: mappingConflicts.length, missing_required_count: missing.length };
    trackProductEvent("mapping_confirmed", event);
    trackProductEvent("analysis_started", event);
    saveTransformRecipe({ headers: csvData.headers, mapping: csvData.mapping, source: isSheetSourced ? "google_sheets" : "csv" }).catch(() => {});
    requestAd(() => { setGroupAnalyzed(toolId); setPreviewOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); });
  };

  return (
    <div>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{isImporting ? T.importing : importAnnouncement}</div>
      {isDemo && (
        <div className="required-banner" style={{ borderLeftColor: "#f7b955", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <strong>{T.demoBannerTitle}</strong>
            <p style={{ margin: "0.25rem 0 0" }}>{T.demoBannerDesc}</p>
          </div>
          <button className="ab-button" onClick={handleReset}>{T.demoBannerBtn}</button>
        </div>
      )}
      <CsvGuide toolId={toolId} locale={locale} />
      <div className="file-state">
        <div className="meta-text">
          <span className="dot" style={{ background: isDemo ? "#f59e0b" : "#22c55e" }}></span>
          {isDemo ? (
            <strong>{T.previewingDemo}</strong>
          ) : (
            <strong>{csvData.fileName}</strong>
          )}
          <span className="csv-loaded-stats tnum">
            {T.rowsCols(csvData.raw.length, csvData.headers.length, isDemo)}
          </span>
        </div>
        {!isDemo && !isSheetSourced && (
          <button className="ab-pill csv-change-btn" title={T.changeCsvTitle} onClick={handleReset}>
            {T.changeCsvBtn}
          </button>
        )}
      </div>

      {/* 구글 시트 연동 상태 UX(§요청): 시트에서 온 데이터는 CSV와 다르게, "재조회"와
          "다른 시트로 교체"를 한 번의 재업로드 없이 바로 할 수 있어야 함. CSV 업로드로
          되돌아갈 길도 항상 열어둠(전환 자유도). */}
      {!isDemo && isSheetSourced && (
        <div style={{ marginBottom: "10px" }}>
          {sheetChangeOpen ? (
            <GoogleSheetConnect
              initialOpen
              onLoaded={handleSheetLoaded}
              onError={setErrorMsg}
              onCancel={() => setSheetChangeOpen(false)}
              locale={locale}
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
      {errorMsg && <div role="alert" style={{ color: "var(--danger)", marginBottom: "10px", fontSize: "12px" }}>{errorMsg}</div>}

      {missing.length > 0 ? (
        <div className="required-banner">
          <strong>{T.missingTitle}</strong>
          <p style={{ margin: "0.25rem 0 0" }}>
            {T.missingLabel}{reqLabels.map((l, i) => (
              <span key={i}><code className="inline">{l}</code>{i < reqLabels.length - 1 ? ", " : ""}</span>
            ))}
          </p>
        </div>
      ) : (
        <div className="required-banner ok">
          <strong>{T.okTitle}</strong>
          <p style={{ margin: "0.25rem 0 0" }}>{T.okDesc}</p>
        </div>
      )}

      {csvData.canonicalData && <DataQualityReport canonicalData={csvData.canonicalData} locale={locale} />}

      <div className="csv-mapping-block">
        <div className="csv-mapping-header">
          <div>
            <strong style={{ fontSize: "14px", color: "var(--primary, #adc6ff)" }}>{T.mappingHeader}</strong>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "8px" }}>
              {T.mappingSummaryPrefix(csvData.headers.length)}<strong style={{ color: "var(--text-primary)" }}>{mappedOptCount}/{totalOptCount}</strong>
            </span>
          </div>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{T.mappingHint}</span>
        </div>
        {importInsights && (
          <div style={{ margin: "0 0 10px", fontSize: "12px", color: mappingConflicts.length ? "var(--danger)" : "var(--text-secondary)" }}>
            <strong>{T.recognitionSummary(mappedCount, csvData.headers.length, needsReview, mappingConflicts.length)}</strong>
            <span style={{ color: "var(--text-muted)", marginLeft: "6px" }}>{T.recognitionHint}</span>
            {datasetSignature && <div style={{ color: "var(--text-muted)", marginTop: "4px" }}>{T.signatureSummary(datasetSignature.source, datasetSignature.grain)}{datasetSignature.needsWideToLong ? ` · ⚠ ${T.wideWarning}` : ""}</div>}
          </div>
        )}
        <div className="mapping-grid">
          <div className="mapping-header">{T.colHeaderCsv}</div>
          <div></div>
          <div className="mapping-header">{T.colHeaderStd}</div>
          <div className="mapping-header" style={{ textAlign: "right" }}>{T.colHeaderStatus}</div>
          
          {csvData.headers.map((h) => {
            const sel = csvData.mapping[h] || "__ignore__";
            const isUnmapped = sel === "__ignore__";
            
            const outOfScope = !isUnmapped && STANDARD_FIELDS[sel] && allowKeys.size > 0 && !allowKeys.has(sel);

            return (
              <React.Fragment key={h}>
                <div className="map-csv-col" title={h}>{h}</div>
                <div className="map-arrow">→</div>
                <select 
                  className={`map-select ${isUnmapped ? "unmapped" : "auto"}`}
                  value={sel}
                  onChange={(e) => handleMappingChange(h, e.target.value)}
                >
                  <option value="__ignore__">{T.ignoreOption}</option>
                  {outOfScope && (
                    <option value={sel}>
                      {STANDARD_FIELDS[sel].label}{T.outOfScopeSuffix}
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
                <div className={`map-status ${isUnmapped ? "" : "ok"}`}>
                  {isUnmapped ? T.unmapped : T.mapped}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 데이터 미리보기(#6) — 매핑 중에는 자동 펼침(맥락 확인), 분석 확정 후 접힘.
          사용자가 언제든 수동으로 다시 펼칠 수 있음(previewOpen 로컬 상태). */}
      {preview.cols.length > 0 && preview.rows.length > 0 && (
        <div className="csv-preview-block" style={{ marginTop: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "6px" }}>
            <div>
              <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>{T.previewTitle}</strong>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "8px" }}>
                {preview.usingMapped ? T.previewUsingMapped : T.previewAll} · {T.previewRows(preview.rows.length, preview.totalRows)}
              </span>
            </div>
            <button
              className="ab-pill"
              style={{ fontSize: "11px" }}
              onClick={() => setPreviewOpen((o) => !o)}
            >
              {previewOpen ? T.collapse : T.expand}
            </button>
          </div>
          {previewOpen && (
            <div className="table-wrap" style={{ marginTop: "4px", maxHeight: "320px", overflow: "auto" }}>
              <table className="data" style={{ fontSize: "11.5px" }}>
                <thead>
                  <tr>
                    {preview.cols.map((h) => {
                      const sel = csvData.mapping[h];
                      const stdLabel = sel && sel !== "__ignore__" ? STANDARD_FIELDS[sel]?.label : null;
                      return (
                        <th key={h} title={stdLabel ? `${h} → ${stdLabel}` : h} style={{ whiteSpace: "nowrap" }}>
                          {h}
                          {stdLabel && (
                            <span style={{ display: "block", fontSize: "10px", fontWeight: 400, color: "var(--primary, #adc6ff)" }}>
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
                        <td key={h} style={{ whiteSpace: "nowrap", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis" }}>
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

      {missing.length === 0 && (
        isAnalyzed ? (
          <div style={{ marginTop: "14px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ color: "#22c55e", fontSize: "12px", fontWeight: 600 }}>{T.analyzedBadge}</span>
            <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>{T.analyzedHint}</span>
            <button className="ab-pill" onClick={confirmAnalysis} style={{ marginLeft: "auto" }}>{T.reanalyzeBtn}</button>
          </div>
        ) : (
          <div style={{ marginTop: "14px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ color: "var(--danger)", fontSize: "12px", fontWeight: 600 }}>{T.checkMapping}</span>
            <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>{T.checkMappingHint}</span>
            <button className="ab-button" onClick={confirmAnalysis} style={{ marginLeft: "auto" }}>{T.analyzeBtn}</button>
          </div>
        )
      )}
    </div>
  );
}
