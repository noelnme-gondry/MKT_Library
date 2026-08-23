"use client";
import { useEffect, useId, useRef, useState } from "react";
import Papa from "papaparse";
import { parseGoogleSheetUrl, sheetValuesToTable, resolveSheetRange } from "@/utils/googleSheets";
import { forgetSheetSource, listSheetSources, rememberSheetSource } from "@/lib/data-import/localHistory";

// 구글 시트 불러오기 — CsvUploader 빈 드롭존의 대체 입력 경로(§CsvUploader.jsx 연동).
// 전체 공개 시트는 브라우저가 CSV export 주소를 직접 읽고, API 키가 있으면 Sheets
// API로 탭 이름까지 확인하는 향상 경로를 쓴다. 로그인·OAuth·서버 중계는 없으므로
// "링크가 있는 모든 사용자" 보기 권한이 필요하다. 우리 서버는 데이터를 전혀
// 거치지 않는다(§2.2 원칙 유지 — CSV 업로드와 동일한 신뢰 경계).
//
// 필요 설정(코드로 못 채우는 부분, 1회성): Google Cloud Console에서
// 1) 프로젝트 생성 → APIs & Services → Library에서 "Google Sheets API" 활성화
// 2) APIs & Services → Credentials → Create Credentials → API key 발급
//    (권장) Restrict key → API restrictions: Google Sheets API만 허용,
//    Application restrictions: HTTP referrers에 https://growthoptplaybook.com/* 등록
// 3) 발급된 키를 Railway 환경변수 NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY로 등록
// 무료(표준 사용량 과금 없음, 분당 300건 한도 — 개인 사용 범위에선 안 걸림).
const COPY = {
  ko: {
    openBtn: "📊 공개 Google Sheets에서 불러오기",
    urlLabel: "구글 시트 링크",
    urlHint: '이 시트가 "링크가 있는 모든 사용자에게 공개(보기)"로 설정돼 있어야 해요.',
    urlPlaceholder: "https://docs.google.com/spreadsheets/d/...",
    submitBtn: "불러오기",
    cancelBtn: "취소",
    loading: "시트 데이터 가져오는 중…",
    errInvalidUrl: "구글 시트 링크가 아닌 것 같아요. 주소창의 전체 URL을 붙여넣어 주세요.",
    errForbidden: '이 시트를 못 읽었어요. 구글 시트 우측 상단 "공유" → "링크가 있는 모든 사용자"로 보기 권한을 켜주세요.',
    errFetch: "시트를 불러오지 못했어요. 링크가 정확한지 확인해주세요.",
    errEmpty: "이 시트에 데이터가 없어요.",
    recentLabel: "이 브라우저에서 최근 연결한 시트",
    forgetSource: "목록에서 지우기",
    sourcePrivacy: "시트 URL과 이름만 이 브라우저에 기억합니다. 행 데이터는 저장하지 않습니다.",
  },
  en: {
    openBtn: "📊 Import from a public Google Sheet",
    urlLabel: "Google Sheets link",
    urlHint: 'This sheet needs to be shared as "Anyone with the link" (Viewer).',
    urlPlaceholder: "https://docs.google.com/spreadsheets/d/...",
    submitBtn: "Import",
    cancelBtn: "Cancel",
    loading: "Fetching sheet data…",
    errInvalidUrl: "That doesn't look like a Google Sheets link. Paste the full URL from the address bar.",
    errForbidden: 'Couldn\'t read this sheet. Open "Share" in Google Sheets and turn on "Anyone with the link" (Viewer).',
    errFetch: "Couldn't load the sheet. Check that the link is correct.",
    errEmpty: "This sheet has no data.",
    recentLabel: "Recently connected in this browser",
    forgetSource: "Remove from this list",
    sourcePrivacy: "Only the sheet URL and name are remembered in this browser. No row data is stored.",
  },
};

// 에러코드 → 사람이 읽을 메시지. handleSubmit과 CsvUploader.jsx의 "최신 데이터
// 불러오기"(재조회)가 동일 메시지를 쓰도록 공유(export).
export function sheetErrorMessage(code, locale = "ko") {
  const T = COPY[locale] || COPY.ko;
  if (code === "invalid_url") return T.errInvalidUrl;
  if (code === "forbidden") return T.errForbidden;
  if (code === "empty") return T.errEmpty;
  return T.errFetch;
}

// export: CsvUploader.jsx가 "최신 데이터 불러오기"(같은 URL 재조회)에 재사용한다.
export async function fetchSheetTable(apiKey, url) {
  const parsed = parseGoogleSheetUrl(url);
  if (!parsed) return { error: "invalid_url" };

  // 공개 시트는 API 키가 없어도 Google의 CSV export 주소를 브라우저에서 바로
  // 읽을 수 있다. 이 경로는 사용자가 요구한 “전체 공개 링크 하나”를 위한 기본값이며,
  // 기존 API 키 경로는 탭 이름·메타데이터를 더 정확히 가져오는 향상 경로로 남긴다.
  if (!apiKey) {
    const gid = parsed.gid ? `&gid=${encodeURIComponent(parsed.gid)}` : "";
    const response = await fetch(`https://docs.google.com/spreadsheets/d/${parsed.spreadsheetId}/export?format=csv${gid}`);
    if (response.status === 403 || response.status === 404) return { error: "forbidden" };
    if (!response.ok) return { error: "fetch" };
    const parsedCsv = Papa.parse(await response.text(), { skipEmptyLines: "greedy" });
    if (parsedCsv.errors?.length) return { error: "fetch" };
    const { headers: cols, raw } = sheetValuesToTable(parsedCsv.data);
    if (cols.length === 0 || raw.length === 0) return { error: "empty" };
    return {
      headers: cols,
      raw,
      fileName: `구글시트 — ${parsed.spreadsheetId}`,
      sheetUrl: url,
    };
  }

  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${parsed.spreadsheetId}?key=${apiKey}&fields=properties.title,sheets.properties`,
  );
  if (metaRes.status === 403 || metaRes.status === 404) return { error: "forbidden" };
  if (!metaRes.ok) return { error: "fetch" };
  const meta = await metaRes.json();
  const range = resolveSheetRange(meta, parsed.gid);
  if (!range) return { error: "fetch" };

  const valuesRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${parsed.spreadsheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`,
  );
  if (valuesRes.status === 403 || valuesRes.status === 404) return { error: "forbidden" };
  if (!valuesRes.ok) return { error: "fetch" };
  const { values } = await valuesRes.json();
  const { headers: cols, raw } = sheetValuesToTable(values);
  if (cols.length === 0 || raw.length === 0) return { error: "empty" };

  return {
    headers: cols,
    raw,
    fileName: `구글시트 — ${meta.properties?.title || parsed.spreadsheetId}`,
    // csvData에 실어 보관 — "최신 데이터 불러오기"가 유저에게 다시 안 물어보고
    // 같은 URL로 재조회할 수 있게(§CsvUploader.jsx handleRefreshSheet).
    sheetUrl: url,
  };
}

// initialOpen/onCancel: CsvUploader.jsx가 데이터 연동 후 상태에서 "시트 변경" 버튼으로
// 이 폼을 다시 열 때 사용(그때는 취소 시 pill 버튼이 아니라 부모의 3버튼 뷰로 돌아가야
// 하므로 onCancel로 위임 — 기본 사용처(빈 드롭존)는 그냥 내부 open 상태로 닫힘).
export default function GoogleSheetConnect({ onLoaded, onError, onCancel, onImportStart, initialOpen = false, locale = "ko", toolId = "" }) {
  const T = COPY[locale] || COPY.ko;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY;
  const [open, setOpen] = useState(initialOpen);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [recentSources, setRecentSources] = useState([]);
  const inputRef = useRef(null);
  const inputId = useId();

  const refreshRecentSources = () => listSheetSources(toolId).then(setRecentSources).catch(() => {});
  useEffect(() => { refreshRecentSources(); }, [toolId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSheet = async (sheetUrl) => {
    onImportStart?.();
    const parsed = parseGoogleSheetUrl(sheetUrl);
    if (!parsed) {
      onError?.(T.errInvalidUrl, "sheet_invalid_url");
      return;
    }
    onError?.("", null);
    setLoading(true);
    try {
      const result = await fetchSheetTable(apiKey, sheetUrl);
      if (result.error) {
        onError?.(sheetErrorMessage(result.error, locale), `sheet_${result.error}`);
      } else {
        await onLoaded?.(result);
        // 가져오기는 이미 성공했다. 최근 연결 목록 저장 실패를 데이터 가져오기 실패로
        // 오인하지 않도록 브라우저 기록은 best-effort로 분리한다.
        await rememberSheetSource({ toolId, url: sheetUrl, label: result.fileName }).catch(() => {});
        refreshRecentSources();
        setOpen(false);
        setUrl("");
      }
    } catch {
      onError?.(sheetErrorMessage("fetch", locale), "sheet_fetch");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await loadSheet(url);
  };

  if (!open) {
    return (
      <div className="sheet-connect-entry">
        <button
          type="button"
          className="sheet-connect-btn"
          onClick={() => {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          {T.openBtn}
        </button>
        {recentSources.length > 0 && (
          <div className="sheet-source-list">
            <span>{T.recentLabel}</span>
            {recentSources.map((source) => (
              <div className="sheet-source-list__item" key={source.id}>
                <button type="button" onClick={() => loadSheet(source.url)} disabled={loading}>{source.label || source.url}</button>
                <button
                  type="button"
                  aria-label={T.forgetSource}
                  title={T.forgetSource}
                  onClick={async () => { await forgetSheetSource(source.id); refreshRecentSources(); }}
                >×</button>
              </div>
            ))}
            <small>{T.sourcePrivacy}</small>
          </div>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}
    >
      <label htmlFor={inputId} style={{ fontSize: "11px", color: "var(--text-muted)" }}>{T.urlLabel}</label>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        <input
          ref={inputRef}
          id={inputId}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={T.urlPlaceholder}
          disabled={loading}
          style={{
            flex: "1 1 260px",
            padding: "8px 10px",
            fontSize: "12.5px",
            borderRadius: "var(--radius-md, 8px)",
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-container-lowest)",
            color: "var(--text-primary)",
          }}
        />
        <button type="submit" className="ab-button" disabled={loading || !url.trim()}>
          {loading ? T.loading : T.submitBtn}
        </button>
        <button
          type="button"
          className="ab-pill"
          disabled={loading}
          onClick={() => {
            setUrl("");
            onError?.("", null);
            if (onCancel) onCancel();
            else setOpen(false);
          }}
        >
          {T.cancelBtn}
        </button>
      </div>
      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{T.urlHint}</span>
      {recentSources.length > 0 && <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{T.sourcePrivacy}</span>}
    </form>
  );
}
