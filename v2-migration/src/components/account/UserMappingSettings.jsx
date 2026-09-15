"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Papa from "papaparse";
import { CANONICAL_FIELDS } from "@/lib/data-import/schema/canonicalFields";
import { MAPPING_MEMORY_SCHEMA_VERSION, mappingMemoryEnabled, setMappingMemoryEnabled } from "@/lib/data-import/memory/mappingMemory";
import { clearMappingMemory, deleteMappingMemory, listMappingMemory, putMappingMemory } from "@/lib/data-import/memory/indexedDbMappingMemory";
import { parseMappingMemory, serializeMappingMemory } from "@/lib/data-import/memory/feedbackFile";
import { downloadJson } from "@/utils/download";

/**
 * 내 컬럼 매핑 — 사용자가 직접 관리하는 규칙 목록.
 *
 * 왼쪽이 내 파일의 컬럼 이름, 오른쪽이 이 도구가 쓰는 항목이다. 분석 흐름 중에
 * 매핑 표를 또 펴게 하지 않으려고 여기로 모았다 — 흐름에서는 자동으로 적용되고,
 * 바꾸고 싶을 때만 이 화면에 온다.
 *
 * 규칙은 이 기기에만 저장된다(IndexedDB). 서버로 보내지 않는다(§2.2).
 * CSV로 컬럼을 불러올 때도 **헤더 한 줄만** 읽고 데이터 행은 읽지 않는다.
 */
const COPY = {
  ko: {
    title: "내 컬럼 매핑",
    lead: "내 파일의 컬럼 이름을 이 도구가 쓰는 항목에 연결해 둡니다. 다음 업로드부터 자동으로 적용됩니다. 규칙은 이 기기에만 저장하며 서버로 보내지 않습니다.",
    enable: "저장한 매핑 사용",
    enableHint: "끄면 규칙을 지우지 않고 적용만 멈춥니다.",
    sourceHead: "내 파일의 컬럼",
    canonicalHead: "이 도구가 쓰는 항목",
    remove: "삭제",
    empty: "아직 저장한 매핑이 없습니다.",
    addTitle: "매핑 추가",
    fromCsv: "CSV에서 컬럼 불러오기",
    fromCsvHint: "헤더 한 줄만 읽습니다. 데이터 행은 읽지도, 저장하지도 않습니다.",
    manual: "직접 입력",
    sourcePlaceholder: "예: mkt_country",
    choose: "항목 선택",
    add: "추가",
    clearAll: "전체 삭제",
    loaded: (count) => `컬럼 ${count}개를 불러왔습니다. 연결할 항목을 고르세요.`,
    readFailed: "CSV를 읽지 못했습니다. 헤더가 있는 파일인지 확인해 주세요.",
    storeFailed: "이 브라우저에 저장하지 못했습니다. 시크릿 창이거나 저장이 차단된 상태일 수 있습니다.",
    duplicate: "이미 저장된 컬럼이라 기존 규칙을 바꿉니다.",
    exportRules: "규칙 내보내기",
    importRules: "규칙 가져오기",
    importFailed: "매핑 파일을 읽지 못했습니다.",
  },
  en: {
    title: "My column mappings",
    lead: "Link the column names in your files to the fields this tool uses. They apply automatically from your next upload. Rules stay on this device and are never sent to a server.",
    enable: "Use saved mappings",
    enableHint: "Turning this off stops them applying without deleting them.",
    sourceHead: "Column in my file",
    canonicalHead: "Field this tool uses",
    remove: "Remove",
    empty: "No saved mappings yet.",
    addTitle: "Add a mapping",
    fromCsv: "Load columns from a CSV",
    fromCsvHint: "Only the header row is read. Data rows are never read or stored.",
    manual: "Enter manually",
    sourcePlaceholder: "e.g. mkt_country",
    choose: "Choose a field",
    add: "Add",
    clearAll: "Delete all",
    loaded: (count) => `Loaded ${count} columns. Choose a field for each.`,
    readFailed: "Could not read the CSV. Check that the file has a header row.",
    storeFailed: "Could not save on this browser. Private windows or blocked storage can cause this.",
    duplicate: "That column is already saved, so the existing rule is replaced.",
    exportRules: "Export rules",
    importRules: "Import rules",
    importFailed: "Could not read this mapping file.",
  },
};

const normalize = (value) => String(value || "").normalize("NFKC").trim().toLowerCase().replace(/[\s_-]+/g, "_");

// 스냅샷은 모듈에 굳힌다. 매번 localStorage를 다시 읽으면 값이 같아도 새 참조가
// 나와 useSyncExternalStore가 무한히 다시 그린다(§12.29b와 같은 함정).
const ENABLED_EVENT = "gop-mapping-memory-changed";
let enabledSnapshot = false;
function readEnabledSnapshot() { return enabledSnapshot; }
function serverEnabledSnapshot() { return false; }
function subscribeEnabled(onChange) {
  const sync = () => { const next = mappingMemoryEnabled(); if (next !== enabledSnapshot) { enabledSnapshot = next; onChange(); } };
  sync();
  window.addEventListener("storage", sync);
  window.addEventListener(ENABLED_EVENT, sync);
  return () => { window.removeEventListener("storage", sync); window.removeEventListener(ENABLED_EVENT, sync); };
}

// 사용자가 직접 확정한 규칙이라 프로파일 지문 없이 저장한다 — 지문은 자동 추론이
// 되살아날 때 쓰는 신호이고, 여기서는 사용자가 이미 정했다.
// 컴포넌트 밖에 두는 이유: `Date.now()`는 렌더 순수성 규칙에 걸린다.
function buildUserRule(normalizedColumnName, canonicalKey) {
  return {
    schemaVersion: MAPPING_MEMORY_SCHEMA_VERSION,
    normalizedColumnName,
    canonicalKey,
    profile: { inferredType: "unknown", numericRateBucket: 1, missingRateBucket: 1, cardinality: "unknown", unitHint: "unknown" },
    context: { representation: "tabular", roleFamilies: [] },
    confirmationCount: 1,
    confirmedAt: Date.now(),
    source: "user_rule",
  };
}

export default function UserMappingSettings({ locale = "ko" }) {
  const t = COPY[locale === "en" ? "en" : "ko"];
  const en = locale === "en";
  const [records, setRecords] = useState([]);
  const enabled = useSyncExternalStore(subscribeEnabled, readEnabledSnapshot, serverEnabledSnapshot);
  const [message, setMessage] = useState("");
  const [headers, setHeaders] = useState([]);
  const [draftSource, setDraftSource] = useState("");
  const [draftKey, setDraftKey] = useState("");

  // 항목 목록은 레지스트리에서 파생한다. 여기 손으로 적으면 필드가 늘 때 어긋난다.
  const fieldOptions = useMemo(() => Object.values(CANONICAL_FIELDS)
    .map((field) => ({ key: field.key, label: en ? (field.labelEn || field.label) : field.label, family: field.family }))
    .sort((left, right) => left.family.localeCompare(right.family) || left.label.localeCompare(right.label)), [en]);

  const reload = () => listMappingMemory().then(setRecords).catch(() => setRecords([]));
  // setState는 외부 저장소 콜백에서만 부른다 — 이펙트 본문에서 동기로 부르면
  // 연쇄 렌더가 되고 lint가 막는다.
  useEffect(() => { reload(); }, []);

  const save = async (sourceColumn, canonicalKey) => {
    const name = normalize(sourceColumn);
    if (!name || !CANONICAL_FIELDS[canonicalKey]) return;
    try {
      await putMappingMemory(buildUserRule(name, canonicalKey));
      await reload();
    } catch { setMessage(t.storeFailed); }
  };

  const readHeaders = (file) => {
    if (!file) return;
    // 헤더 한 줄만 파싱한다(`preview: 1`). 데이터 행은 메모리에도 올리지 않는다.
    Papa.parse(file, {
      header: false, preview: 1, skipEmptyLines: true,
      complete: (result) => {
        const row = (result.data?.[0] || []).map((value) => String(value || "").trim()).filter(Boolean);
        if (!row.length) { setMessage(t.readFailed); return; }
        const known = new Set(records.map((record) => record.normalizedColumnName));
        setHeaders(row.filter((header) => !known.has(normalize(header))));
        setMessage(t.loaded(row.length));
      },
      error: () => setMessage(t.readFailed),
    });
  };

  return (
    <section className="account-mapping" aria-labelledby="account-mapping-title">
      <h3 id="account-mapping-title">{t.title}</h3>
      <p className="account-mapping__lead">{t.lead}</p>

      <label className="account-mapping__toggle">
        <input type="checkbox" checked={enabled} onChange={(event) => { setMappingMemoryEnabled(event.target.checked); window.dispatchEvent(new Event(ENABLED_EVENT)); }} />
        <span>{t.enable}</span>
      </label>
      <p className="account-mapping__hint">{t.enableHint}</p>
      {message && <p className="account-mapping__hint" role="status">{message}</p>}

      {records.length === 0
        ? <p className="account-mapping__empty">{t.empty}</p>
        : <table className="account-mapping__table">
          <thead><tr><th scope="col">{t.sourceHead}</th><th scope="col">{t.canonicalHead}</th><th scope="col"><span className="sr-only">{t.remove}</span></th></tr></thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.normalizedColumnName}>
                <th scope="row">{record.normalizedColumnName}</th>
                <td>
                  <select
                    aria-label={`${record.normalizedColumnName} → ${t.canonicalHead}`}
                    value={record.canonicalKey}
                    onChange={(event) => save(record.normalizedColumnName, event.target.value)}
                  >
                    {fieldOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                  </select>
                </td>
                <td>
                  <button type="button" className="btn" onClick={() => deleteMappingMemory(record.normalizedColumnName).then(reload).catch(() => setMessage(t.storeFailed))}>{t.remove}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>}

      <h4>{t.addTitle}</h4>
      <label className="account-mapping__file">
        <span>{t.fromCsv}</span>
        <input type="file" accept=".csv,text/csv" onChange={(event) => { readHeaders(event.target.files?.[0]); event.target.value = ""; }} />
      </label>
      <p className="account-mapping__hint">{t.fromCsvHint}</p>

      {headers.length > 0 && <table className="account-mapping__table">
        <thead><tr><th scope="col">{t.sourceHead}</th><th scope="col">{t.canonicalHead}</th></tr></thead>
        <tbody>
          {headers.map((header) => (
            <tr key={header}>
              <th scope="row">{header}</th>
              <td>
                <select aria-label={`${header} → ${t.canonicalHead}`} defaultValue="" onChange={(event) => { if (event.target.value) { save(header, event.target.value); setHeaders((list) => list.filter((item) => item !== header)); } }}>
                  <option value="">{t.choose}</option>
                  {fieldOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>}

      <div className="account-mapping__manual">
        <label>
          <span>{t.manual}</span>
          <input value={draftSource} placeholder={t.sourcePlaceholder} onChange={(event) => setDraftSource(event.target.value)} />
        </label>
        <label>
          <span>{t.canonicalHead}</span>
          <select aria-label={t.canonicalHead} value={draftKey} onChange={(event) => setDraftKey(event.target.value)}>
            <option value="">{t.choose}</option>
            {fieldOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
        </label>
        <button type="button" className="btn primary" disabled={!draftSource.trim() || !draftKey} onClick={() => {
          if (records.some((record) => record.normalizedColumnName === normalize(draftSource))) setMessage(t.duplicate);
          save(draftSource, draftKey).then(() => { setDraftSource(""); setDraftKey(""); });
        }}>{t.add}</button>
      </div>

      {/* 내보내기·가져오기는 예전에 업로드 흐름 안에만 있었다. 설정을 여기로 옮기면서
          같이 옮긴다 — 화면만 치우고 능력을 조용히 잃으면 안 된다. */}
      <div className="account-mapping__actions">
        {records.length > 0 && <button type="button" className="btn" onClick={() => downloadJson(serializeMappingMemory(records), "growthopt-mapping-memory", "json")}>{t.exportRules}</button>}
        <label className="btn account-mapping__import">
          <span>{t.importRules}</span>
          <input type="file" accept=".json,application/json" onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            try {
              const parsed = parseMappingMemory(await file.text());
              await Promise.all(parsed.map(putMappingMemory));
              await reload();
              setMessage("");
            } catch { setMessage(t.importFailed); }
          }} />
        </label>
        {records.length > 0 && <button type="button" className="btn" onClick={() => clearMappingMemory().then(reload).catch(() => setMessage(t.storeFailed))}>{t.clearAll}</button>}
      </div>
    </section>
  );
}
