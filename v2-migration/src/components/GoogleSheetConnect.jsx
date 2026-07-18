"use client";
import { useState, useRef } from "react";
import { parseGoogleSheetUrl, sheetValuesToTable, resolveSheetRange } from "@/utils/googleSheets";

// 구글 시트 불러오기 — CsvUploader 빈 드롭존의 대체 입력 경로(§CsvUploader.jsx 연동).
// API 키 방식(OAuth 아님) — 로그인 팝업·동의화면 없이 브라우저가 Sheets API를 바로
// 호출한다. 대신 시트가 "링크가 있는 모든 사용자에게 공개(보기)"로 설정돼 있어야
// 한다(비공개 시트는 API 키만으론 못 읽음 — 그건 OAuth가 필요한데, 그 무게가
// "그냥 링크 하나 붙이는" 이 기능의 UX와 안 맞아 1차 범위에서 뺌). 우리 서버는 이
// 데이터를 전혀 거치지 않는다(§2.2 원칙 유지 — CSV 업로드와 동일한 신뢰 경계).
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
    openBtn: "📊 구글 시트에서 불러오기",
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
  },
  en: {
    openBtn: "📊 Import from Google Sheets",
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
  },
};

async function fetchSheetTable(apiKey, url) {
  const parsed = parseGoogleSheetUrl(url);
  if (!parsed) return { error: "invalid_url" };

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
  };
}

export default function GoogleSheetConnect({ onLoaded, onError, locale = "ko" }) {
  const T = COPY[locale] || COPY.ko;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY;
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  // 설정(API 키) 전에는 아예 노출하지 않음 — 반쪽짜리 버튼을 유저에게 보여주지 않기 위해.
  if (!apiKey) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsed = parseGoogleSheetUrl(url);
    if (!parsed) {
      onError?.(T.errInvalidUrl);
      return;
    }
    onError?.("");
    setLoading(true);
    try {
      const result = await fetchSheetTable(apiKey, url);
      if (result.error === "invalid_url") {
        onError?.(T.errInvalidUrl);
      } else if (result.error === "forbidden") {
        onError?.(T.errForbidden);
      } else if (result.error === "fetch") {
        onError?.(T.errFetch);
      } else if (result.error === "empty") {
        onError?.(T.errEmpty);
      } else {
        onLoaded?.(result);
        setOpen(false);
        setUrl("");
      }
    } catch {
      onError?.(T.errFetch);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className="ab-pill"
        style={{ marginTop: "10px" }}
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        {T.openBtn}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}
    >
      <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>{T.urlLabel}</label>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        <input
          ref={inputRef}
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
            setOpen(false);
            setUrl("");
            onError?.("");
          }}
        >
          {T.cancelBtn}
        </button>
      </div>
      <span style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>{T.urlHint}</span>
    </form>
  );
}
