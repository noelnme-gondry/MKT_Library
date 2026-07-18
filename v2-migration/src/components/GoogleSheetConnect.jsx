"use client";
import { useState, useRef } from "react";
import { parseGoogleSheetUrl, sheetValuesToTable, resolveSheetRange } from "@/utils/googleSheets";

// 구글 시트 불러오기 — CsvUploader 빈 드롭존의 대체 입력 경로(§CsvUploader.jsx 연동).
// 전 과정 브라우저 안에서만: GIS(Google Identity Services)로 유저 본인 OAuth 토큰을
// 받아 그 토큰으로 Sheets API를 브라우저가 직접 호출한다. 우리 서버는 이 데이터를
// 전혀 거치지 않는다(§2.2 원칙 그대로 유지 — CSV 업로드와 동일한 신뢰 경계).
//
// 필요 설정(코드로 못 채우는 부분, 1회성): Google Cloud Console에서
// 1) 프로젝트 생성 → APIs & Services → Library에서 "Google Sheets API" 활성화
// 2) APIs & Services → Credentials → OAuth 2.0 Client ID(웹 애플리케이션) 생성
//    Authorized JavaScript origins에 https://growthoptplaybook.com(+로컬 개발 origin) 등록
// 3) 발급된 Client ID를 Railway 환경변수 NEXT_PUBLIC_GOOGLE_CLIENT_ID로 등록
// Client ID는 OAuth 공개 식별자라 프론트에 노출돼도 안전(Supabase anon key와 동일 성격,
// service_role 같은 비밀키가 아님 — §2.3과 별개 사안).
const GIS_SRC = "https://accounts.google.com/gsi/client";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

const COPY = {
  ko: {
    openBtn: "📊 구글 시트에서 불러오기",
    urlLabel: "구글 시트 링크",
    urlPlaceholder: "https://docs.google.com/spreadsheets/d/...",
    submitBtn: "불러오기",
    cancelBtn: "취소",
    connecting: "구글 인증 확인 중…",
    loading: "시트 데이터 가져오는 중…",
    errInvalidUrl: "구글 시트 링크가 아닌 것 같아요. 주소창의 전체 URL을 붙여넣어 주세요.",
    errAuth: "구글 인증에 실패했거나 취소했어요.",
    errFetch: "시트를 불러오지 못했어요. 이 계정에 시트 열람 권한이 있는지 확인해주세요.",
    errEmpty: "이 시트에 데이터가 없어요.",
    errNotConfigured: "구글 시트 연동이 아직 설정되지 않았어요.",
  },
  en: {
    openBtn: "📊 Import from Google Sheets",
    urlLabel: "Google Sheets link",
    urlPlaceholder: "https://docs.google.com/spreadsheets/d/...",
    submitBtn: "Import",
    cancelBtn: "Cancel",
    connecting: "Confirming Google sign-in…",
    loading: "Fetching sheet data…",
    errInvalidUrl: "That doesn't look like a Google Sheets link. Paste the full URL from the address bar.",
    errAuth: "Google sign-in failed or was cancelled.",
    errFetch: "Couldn't load the sheet. Check that this Google account has access to it.",
    errEmpty: "This sheet has no data.",
    errNotConfigured: "Google Sheets import isn't configured yet.",
  },
};

// GIS 스크립트는 이 기능을 실제로 쓸 때만 지연 로드(모든 페이지에 무조건 심는 GTM·AdSense와
// 달리, 쓰는 사람만 다운로드 비용을 지불하게).
let gisLoadPromise = null;
function loadGis() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("gis script load failed"));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

// 토큰 클라이언트는 매 요청 새로 만들지 않고 재사용(같은 세션에서 재인증 팝업 최소화).
let tokenClient = null;
function getAccessToken(clientId) {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SHEETS_SCOPE,
        callback: () => {}, // requestAccessToken 호출마다 아래에서 override
      });
    }
    tokenClient.callback = (resp) => {
      if (resp.error) reject(new Error(resp.error));
      else resolve(resp.access_token);
    };
    tokenClient.requestAccessToken({ prompt: "" });
  });
}

async function fetchSheetTable(clientId, url) {
  const parsed = parseGoogleSheetUrl(url);
  if (!parsed) return { error: "invalid_url" };

  await loadGis();
  const accessToken = await getAccessToken(clientId).catch(() => null);
  if (!accessToken) return { error: "auth" };

  const headers = { Authorization: `Bearer ${accessToken}` };
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${parsed.spreadsheetId}?fields=properties.title,sheets.properties`,
    { headers },
  );
  if (!metaRes.ok) return { error: "fetch" };
  const meta = await metaRes.json();
  const range = resolveSheetRange(meta, parsed.gid);
  if (!range) return { error: "fetch" };

  const valuesRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${parsed.spreadsheetId}/values/${encodeURIComponent(range)}`,
    { headers },
  );
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
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("idle"); // idle | connecting | loading
  const inputRef = useRef(null);

  // 설정(Client ID) 전에는 아예 노출하지 않음 — 반쪽짜리 버튼을 유저에게 보여주지 않기 위해.
  if (!clientId) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsed = parseGoogleSheetUrl(url);
    if (!parsed) {
      onError?.(T.errInvalidUrl);
      return;
    }
    onError?.("");
    setStatus("connecting");
    try {
      const result = await fetchSheetTable(clientId, url);
      if (result.error === "invalid_url") {
        onError?.(T.errInvalidUrl);
      } else if (result.error === "auth") {
        onError?.(T.errAuth);
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
      setStatus("idle");
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

  const busy = status !== "idle";

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
          disabled={busy}
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
        <button type="submit" className="ab-button" disabled={busy || !url.trim()}>
          {busy ? (status === "connecting" ? T.connecting : T.loading) : T.submitBtn}
        </button>
        <button
          type="button"
          className="ab-pill"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setUrl("");
            onError?.("");
          }}
        >
          {T.cancelBtn}
        </button>
      </div>
    </form>
  );
}
