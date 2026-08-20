"use client";

import { useRef } from "react";
import { parseMappingMemory, serializeMappingMemory } from "@/lib/data-import/memory/feedbackFile";
import { downloadJson } from "@/utils/download";

const copy = {
  ko: { label: "개인 매핑 기억 사용", hint: "직접 확인한 컬럼 역할만 이 브라우저에 저장합니다. 원본 행·파일명·분석 결과는 저장하지 않습니다.", count: (value) => `${value}개 저장됨`, clear: "전체 삭제", export: "내보내기", import: "가져오기", invalid: "기억 파일을 읽지 못했습니다." },
  en: { label: "Use personal mapping memory", hint: "Only roles you confirm are stored in this browser. Source rows, filenames, and analysis results are never stored.", count: (value) => `${value} saved`, clear: "Clear all", export: "Export", import: "Import", invalid: "Could not read this memory file." },
};

export default function MappingMemorySettings({ enabled, onEnabledChange, count = 0, records = [], onClear, onImport, locale = "ko" }) {
  const t = copy[locale] || copy.ko;
  const inputRef = useRef(null);
  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try { await onImport?.(parseMappingMemory(await file.text())); } catch { window.alert(t.invalid); }
  };
  return <div className="csv-memory-note">
    <label><input type="checkbox" checked={enabled} onChange={(event) => onEnabledChange?.(event.target.checked)} /> {t.label}</label>
    <span>{t.hint}</span>
    {enabled && <span><strong>{t.count(count)}</strong> <button type="button" className="ab-pill" onClick={() => downloadJson(serializeMappingMemory(records), "growthopt-mapping-memory", "json")}>{t.export}</button> <button type="button" className="ab-pill" onClick={() => inputRef.current?.click()}>{t.import}</button> <button type="button" className="ab-pill" onClick={onClear}>{t.clear}</button><input ref={inputRef} type="file" accept=".json,application/json" hidden onChange={importFile} /></span>}
  </div>;
}
