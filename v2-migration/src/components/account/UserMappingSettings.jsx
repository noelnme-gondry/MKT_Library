"use client";
import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { CANONICAL_FIELDS } from "@/lib/data-import/schema/canonicalFields";
import { accountRequest } from "@/lib/account/accountClient";
import { accountMappingRule, normalizeMappingName } from "@/lib/account/mappingContract";
import { listMappingMemory } from "@/lib/data-import/memory/indexedDbMappingMemory";
import { parseMappingMemory, serializeMappingMemory } from "@/lib/data-import/memory/feedbackFile";
import { downloadJson } from "@/utils/download";

const COPY = {
  ko: {
    title: "내 컬럼 매핑",
    lead: "내 파일의 컬럼 이름을 이 도구가 쓰는 항목에 연결해 둡니다. 다음 업로드부터 자동으로 적용됩니다. Pro에서는 컬럼 이름과 연결 규칙만 계정에 저장해 다른 기기의 CSV·Google Sheets에도 적용합니다. 원본 행은 전송하지 않습니다.",
    enable: "저장한 매핑 사용",
    enableHint: "끄면 규칙을 지우지 않고 적용만 멈춥니다.",
    sourceHead: "내 파일의 컬럼",
    canonicalHead: "이 도구가 쓰는 항목",
    remove: "삭제",
    empty: "아직 저장한 매핑이 없습니다.",
    addTitle: "매핑 추가",
    fromCsv: "CSV에서 컬럼 불러오기",
    fromCsvHint: "CSV에서 컬럼 이름을 추출합니다. 원본 파일은 서버로 보내지 않으며 매핑 규칙만 저장합니다.",
    loadFailed: "저장한 매핑을 불러오지 못했습니다. 저장된 규칙이 없는지는 확인할 수 없습니다.",
    manual: "직접 입력",
    sourcePlaceholder: "예: mkt_country",
    choose: "항목 선택",
    add: "추가",
    clearAll: "전체 삭제",
    loaded: (count) => `컬럼 ${count}개를 불러왔습니다. 연결할 항목을 고르세요.`,
    readFailed: "CSV를 읽지 못했습니다. 헤더가 있는 파일인지 확인해 주세요.",
    storeFailed: "계정에 저장하지 못했습니다. 로그인·Pro 상태와 연결을 확인하고 다시 시도해 주세요.",
    duplicate: "이미 저장된 컬럼이라 기존 규칙을 바꿉니다.",
    exportRules: "규칙 내보내기",
    importRules: "규칙 가져오기",
    importFailed: "매핑 파일을 읽지 못했습니다.",
  },
  en: {
    title: "My column mappings",
    lead: "Link the column names in your files to the fields this tool uses. They apply automatically from your next upload. With Pro, only header names and field rules are saved in your account for CSV and Google Sheets on other devices. Source rows are never uploaded.",
    enable: "Use saved mappings",
    enableHint: "Turning this off stops them applying without deleting them.",
    sourceHead: "Column in my file",
    canonicalHead: "Field this tool uses",
    remove: "Remove",
    empty: "No saved mappings yet.",
    addTitle: "Add a mapping",
    fromCsv: "Load columns from a CSV",
    fromCsvHint: "Extract column names from the CSV. The file is never sent to a server; only mapping rules are saved.",
    loadFailed: "Could not load saved mappings. We cannot tell whether any rules are stored.",
    manual: "Enter manually",
    sourcePlaceholder: "e.g. mkt_country",
    choose: "Choose a field",
    add: "Add",
    clearAll: "Delete all",
    loaded: (count) => `Loaded ${count} columns. Choose a field for each.`,
    readFailed: "Could not read the CSV. Check that the file has a header row.",
    storeFailed: "Could not save to your account. Check sign-in, Pro access and your connection, then retry.",
    duplicate: "That column is already saved, so the existing rule is replaced.",
    exportRules: "Export rules",
    importRules: "Import rules",
    importFailed: "Could not read this mapping file.",
  },
};

const normalize = normalizeMappingName;

export default function UserMappingSettings({ locale = "ko", accountId = null }) {
  const t = COPY[locale === "en" ? "en" : "ko"];
  const en = locale === "en";
  const [records, setRecords] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [enabled, setEnabled] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [headers, setHeaders] = useState([]);
  const [draftSource, setDraftSource] = useState("");
  const [draftKey, setDraftKey] = useState("");

  // 항목 목록은 레지스트리에서 파생한다. 여기 손으로 적으면 필드가 늘 때 어긋난다.
  const fieldOptions = useMemo(() => Object.values(CANONICAL_FIELDS)
    .map((field) => ({ key: field.key, label: en ? (field.labelEn || field.label) : field.label, family: field.family }))
    .sort((left, right) => left.family.localeCompare(right.family) || left.label.localeCompare(right.label)), [en]);

  const accept = data => { setRecords(data.rules); setEnabled(data.enabled); setLoadState("ready"); };
  useEffect(() => {
    if (!accountId) return;
    let active = true;
    accountRequest("mappings").then(data => { if (active && data.accountId === accountId) { setRecords(data.rules); setEnabled(data.enabled); setCanEdit(data.canApply); setLoadState("ready"); } }).catch(() => { if (active) setLoadState("failed"); });
    return () => { active = false; };
  }, [accountId]);
  const change = async (body, method = "POST") => {
    if (busy) return false;
    setBusy(true);
    try { accept(await accountRequest("mappings", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })); setMessage(en ? "Account mappings saved." : "계정 매핑을 저장했습니다."); return true; }
    catch (error) { if (error.message === "PRO_REQUIRED") setCanEdit(false); setMessage(error.message === "MAPPING_LIMIT" ? (en ? "Keep up to 200 rules per account." : "계정당 최대 200개 규칙을 저장할 수 있습니다.") : t.storeFailed); return false; }
    finally { setBusy(false); }
  };
  const save = async (sourceColumn, canonicalKey) => {
    try { return await change({ rules: [accountMappingRule({ normalizedColumnName: sourceColumn, canonicalKey })] }); }
    catch { setMessage(en ? "Use a valid column name of up to 200 characters." : "200자 이내의 유효한 컬럼 이름을 입력해 주세요."); return false; }
  };

  const readHeaders = (file) => {
    if (!file) return;
    // preview로 파싱 결과를 제한한다. 파일 리더는 헤더 뒤 바이트도 포함한 청크를 읽을 수 있다.
    Papa.parse(file, {
      header: false, preview: 1, skipEmptyLines: true,
      complete: (result) => {
        const row = (result.data?.[0] || []).map((value) => String(value || "").trim()).filter(Boolean);
        if (!row.length) { setMessage(t.readFailed); return; }
        const known = new Set(records.map((record) => record.normalizedColumnName));
        setHeaders([...new Map(row.filter(header => !known.has(normalize(header))).map(header => [normalize(header), header])).values()]);
        setMessage(t.loaded(row.length));
      },
      error: () => setMessage(t.readFailed),
    });
  };

  return (
    <section className="account-mapping" aria-labelledby="account-mapping-title">
      <h3 id="account-mapping-title">{t.title} <span className="badge">Pro</span></h3>
      <p className="account-mapping__lead">{t.lead}</p>

      {!accountId && <p>{en ? "Sign in above to manage account mappings." : "위에서 로그인하면 계정 매핑을 관리할 수 있습니다."}</p>}
      {accountId && !canEdit && loadState === "ready" && <p>{en ? "Active Pro is needed to change and apply rules. Existing rules can still be exported or deleted." : "규칙 변경·자동 적용은 유효 Pro에서 사용할 수 있습니다. 기존 규칙은 내보내거나 삭제할 수 있습니다."}</p>}
      <label className="account-mapping__toggle">
        <input type="checkbox" checked={enabled} disabled={!canEdit || busy} onChange={(event) => change({ enabled: event.target.checked })} />
        <span>{t.enable}</span>
      </label>
      <p className="account-mapping__hint">{t.enableHint}</p>
      {message && <p className="account-mapping__hint" role="status">{message}</p>}
      {loadState === "failed" && <p role="alert">{t.loadFailed}</p>}

      {records.length === 0
        ? loadState === "ready" && <p className="account-mapping__empty">{t.empty}</p>
        : <table className="account-mapping__table">
          <thead><tr><th scope="col">{t.sourceHead}</th><th scope="col">{t.canonicalHead}</th><th scope="col"><span className="sr-only">{t.remove}</span></th></tr></thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.normalizedColumnName}>
                <th scope="row">{record.normalizedColumnName}</th>
                <td>
                  <select disabled={!canEdit || busy}
                    aria-label={`${record.normalizedColumnName} → ${t.canonicalHead}`}
                    value={record.canonicalKey}
                    onChange={(event) => save(record.normalizedColumnName, event.target.value)}
                  >
                    {fieldOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                  </select>
                </td>
                <td>
                  <button type="button" className="btn" disabled={busy} onClick={() => change({ name: record.normalizedColumnName }, "DELETE")}>{t.remove}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>}

      <fieldset className="account-mapping__editor" disabled={!canEdit || busy}><legend>{t.addTitle}</legend>
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
                <select aria-label={`${header} → ${t.canonicalHead}`} defaultValue="" onChange={async (event) => { if (event.target.value && await save(header, event.target.value)) setHeaders((list) => list.filter((item) => item !== header)); }}>
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
          save(draftSource, draftKey).then(saved => { if (saved) { setDraftSource(""); setDraftKey(""); } });
        }}>{t.add}</button>
      </div>

      </fieldset>

      {/* 내보내기·가져오기는 예전에 업로드 흐름 안에만 있었다. 설정을 여기로 옮기면서
          같이 옮긴다 — 화면만 치우고 능력을 조용히 잃으면 안 된다. */}
      <div className="account-mapping__actions">
        <button type="button" className="btn" disabled={!canEdit || busy} onClick={async () => { try { const local = await listMappingMemory(); await change({ rules: local.map(record => accountMappingRule({ normalizedColumnName: record.normalizedColumnName, canonicalKey: record.canonicalKey })) }); } catch { setMessage(t.importFailed); } }}>{en ? "Import this device’s rules into account" : "이 기기의 기존 규칙을 계정으로 가져오기"}</button>
        {records.length > 0 && <button type="button" className="btn" onClick={() => downloadJson(serializeMappingMemory(records), "growthopt-mapping-memory", "json")}>{t.exportRules}</button>}
        <label className="btn account-mapping__import">
          <span>{t.importRules}</span>
          <input disabled={!canEdit || busy} type="file" accept=".json,application/json" onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            try {
              const parsed = parseMappingMemory(await file.text());
              await change({ rules: parsed.map(record => accountMappingRule({ normalizedColumnName: record.normalizedColumnName, canonicalKey: record.canonicalKey })) });
            } catch { setMessage(t.importFailed); }
          }} />
        </label>
        {records.length > 0 && <button type="button" className="btn" disabled={busy} onClick={() => change({ all: true }, "DELETE")}>{t.clearAll}</button>}
      </div>
    </section>
  );
}
