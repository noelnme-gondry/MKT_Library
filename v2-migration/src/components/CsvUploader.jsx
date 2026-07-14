"use client";
import React, { useState, useRef, useMemo, useEffect } from "react";
import Papa from "papaparse";
import { useAppStore, TOOL_GROUP } from "@/store/useDataStore";
import { STANDARD_FIELDS, TOOL_REQUIRED_FIELDS, TOOL_OPTIONAL_FIELDS } from "@/utils/csvConstants";
import { buildDemoCsv } from "@/utils/demoData";
import DemoLoadButton from "@/components/DemoLoadButton";
import CsvGuide from "@/components/ds/CsvGuide";

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 셸 카피만 번역(드롭존·배너·버튼·미리보기 텍스트). STANDARD_FIELDS 필드 라벨(비용·노출수
// 등, csvConstants.js 210여 개)은 별도 백로그 — 공수가 자릿수 다름(§plan).
const CSV_COPY = {
  ko: {
    emptyCsv: "CSV 파일이 비어 있거나 올바르지 않습니다.",
    parseError: "CSV 파싱 중 오류 발생: ",
    dropTitle: "CSV 파일 드래그 & 드롭",
    dropSub: "또는 클릭하여 파일 선택",
    demoBannerTitle: "🧪 지금 보고 있는 화면은 샘플(예시) 데이터입니다",
    demoBannerDesc: "실제 내 데이터가 아니며, 서버로 전송되지 않습니다. 내 CSV를 업로드하면 바로 교체됩니다.",
    demoBannerBtn: "📁 내 CSV 업로드하기",
    previewingDemo: "샘플 데이터로 미리보기 중",
    rowsCols: (rows, cols, demo) => `${rows.toLocaleString()}행 · ${cols}컬럼${demo ? " · 실제 데이터 아님" : ""}`,
    changeCsvTitle: "이 도구의 CSV를 제거하고 다른 파일 업로드",
    changeCsvBtn: "⟳ CSV 변경",
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
  },
  en: {
    emptyCsv: "This CSV file is empty or invalid.",
    parseError: "Error parsing CSV: ",
    dropTitle: "Drag & drop a CSV file",
    dropSub: "or click to choose a file",
    demoBannerTitle: "🧪 You're viewing sample data",
    demoBannerDesc: "This isn't your real data and nothing is sent to a server. Upload your own CSV to replace it instantly.",
    demoBannerBtn: "📁 Upload my CSV",
    previewingDemo: "Previewing sample data",
    rowsCols: (rows, cols, demo) => `${rows.toLocaleString()} rows · ${cols} cols${demo ? " · not real data" : ""}`,
    changeCsvTitle: "Remove this tool's CSV and upload another file",
    changeCsvBtn: "⟳ Change CSV",
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
  },
};

export default function CsvUploader({ toolId, locale = "ko" }) {
  const T = CSV_COPY[locale] || CSV_COPY.ko;
  const csvData = useAppStore((s) => s.csvData);
  const setCsvData = useAppStore((s) => s.setCsvData);
  const setGroupAnalyzed = useAppStore((s) => s.setGroupAnalyzed);
  // 분석하기 클릭 시 광고 인터스티셜 게이트(adFree면 즉시 실행). 데모 자동로드는 게이트 없이 직접.
  const requestAd = useAppStore((s) => s.requestAd);
  // Single-source analyze gate (store, group-scoped §12.5). Reading the whole
  // store here (not a memoized selector) so the boolean recomputes on any
  // csvData / analyzedByGroup change — the same slice the tools render from.
  const isAnalyzed = useAppStore((s) => s.isGroupAnalyzed(toolId));
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  // Preview table is auto-shown while mapping and collapsed after analysis.
  // User can re-expand it manually anytime (independent of gate state).
  const [previewOpen, setPreviewOpen] = useState(true);

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
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          setErrorMsg(T.emptyCsv);
          return;
        }

        const headers = results.meta.fields || [];
        const raw = results.data;
        
        // Auto-mapping logic
        const mapping = {};
        const availableStandardKeys = Object.keys(STANDARD_FIELDS);
        
        headers.forEach((header) => {
          const hLow = header.toLowerCase().trim();
          let matched = null;
          
          for (const sKey of availableStandardKeys) {
            const def = STANDARD_FIELDS[sKey];
            if (sKey.toLowerCase() === hLow) {
              matched = sKey;
              break;
            }
            if (def.aliases) {
              const hasAlias = def.aliases.some((alias) => {
                const a = alias.toLowerCase();
                return hLow === a || hLow === a.replace(/_/g, "") || hLow.replace(/_/g, "") === a;
              });
              if (hasAlias) {
                matched = sKey;
                break;
              }
            }
          }
          if (matched) {
            mapping[header] = matched;
          } else {
            mapping[header] = "__ignore__";
          }
        });

        setCsvData({
          raw,
          headers,
          mapping,
          fileName: file.name,
        });
        // New file → gate auto-resets in the store (sig change); re-open preview
        // so the user maps with data context.
        setPreviewOpen(true);
      },
      error: (err) => {
        setErrorMsg(T.parseError + err.message);
      },
    });
  };

  const handleMappingChange = (header, value) => {
    setCsvData({
      ...csvData,
      mapping: {
        ...csvData.mapping,
        [header]: value
      }
    });
    // Mapping edit changes the sig → store gate auto-resets. Re-open preview so
    // the user re-checks the columns before pressing 분석하기 again.
    setPreviewOpen(true);
  };

  const handleReset = () => {
    setCsvData({ raw: [], headers: [], mapping: {}, fileName: "" });
    setPreviewOpen(true);
  };

  // Load a deterministic demo dataset for this tool's group and auto-confirm the
  // analyze gate so results render immediately (§12.8 demo pattern).
  const handleLoadDemo = () => {
    setErrorMsg("");
    const group = TOOL_GROUP[toolId] || "efficiency";
    const demo = buildDemoCsv(group);
    setCsvData(demo);
    setGroupAnalyzed(toolId);
    setPreviewOpen(false);
  };

  const hasFile = csvData && csvData.headers && csvData.headers.length > 0;
  const isDemo = !!(csvData && csvData.fileName && csvData.fileName.startsWith("demo_"));

  // 첫 진입(데이터 없음) 시 샘플 데이터를 자동 로드해 빈 업로드 화면 대신 라이브
  // 분석 화면을 즉시 보여준다(SEO·첫인상 개선). 마운트 1회만 — 사용자가 CSV 변경으로
  // 명시적으로 비우면 재자동로드 없음(의도된 빈 드롭존 유지).
  useEffect(() => {
    // 마운트 1회성 초기 로드(다중 setState 의도적 — 데모 데이터+게이트+프리뷰 상태를
    // 한 번에 세팅, 루프·반복 트리거 아님).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!hasFile) handleLoadDemo();
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
  }, [toolId, csvData.mapping]);

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
        <CsvGuide toolId={toolId} locale={locale} />
        <div
          className={`csv-dropzone ${isDragging ? "dragover" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="csv-drop-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </div>
          <div className="csv-drop-text">{T.dropTitle}</div>
          <div className="csv-drop-sub">{T.dropSub}</div>
          <input
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            ref={fileInputRef}
            onChange={handleFileChange}
          />
        </div>
        <DemoLoadButton onLoad={handleLoadDemo} locale={locale} />
        {errorMsg && <div style={{ color: "var(--danger)", marginTop: "10px", fontSize: "12px" }}>{errorMsg}</div>}
      </div>
    );
  }

  const mappedOptCount = (TOOL_OPTIONAL_FIELDS[toolId] || []).filter(
    (o) => csvData.mapping && csvData.mapping !== "__ignore__" && Object.values(csvData.mapping).includes(o.key)
  ).length;
  const totalOptCount = (TOOL_OPTIONAL_FIELDS[toolId] || []).length;

  return (
    <div>
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
        {!isDemo && (
          <button className="ab-pill csv-change-btn" title={T.changeCsvTitle} onClick={handleReset}>
            {T.changeCsvBtn}
          </button>
        )}
      </div>

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
                          {escapeHtml(h)}
                          {stdLabel && (
                            <span style={{ display: "block", fontSize: "10px", fontWeight: 400, color: "var(--primary, #adc6ff)" }}>
                              → {escapeHtml(stdLabel)}
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
                          {escapeHtml(row[h] != null ? String(row[h]) : "")}
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
            <button className="ab-pill" onClick={() => requestAd(() => { setGroupAnalyzed(toolId); setPreviewOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); })} style={{ marginLeft: "auto" }}>{T.reanalyzeBtn}</button>
          </div>
        ) : (
          <div style={{ marginTop: "14px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ color: "var(--danger)", fontSize: "12px", fontWeight: 600 }}>{T.checkMapping}</span>
            <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>{T.checkMappingHint}</span>
            <button className="ab-button" onClick={() => requestAd(() => { setGroupAnalyzed(toolId); setPreviewOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); })} style={{ marginLeft: "auto" }}>{T.analyzeBtn}</button>
          </div>
        )
      )}
    </div>
  );
}
