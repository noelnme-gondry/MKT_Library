"use client";

const copy = {
  ko: { label: "개인 매핑 기억 사용", hint: "직접 확인한 컬럼 역할만 이 브라우저에 저장합니다. 원본 행·파일명·분석 결과는 저장하지 않습니다.", count: (value) => `${value}개 저장됨`, clear: "전체 삭제" },
  en: { label: "Use personal mapping memory", hint: "Only roles you confirm are stored in this browser. Source rows, filenames, and analysis results are never stored.", count: (value) => `${value} saved`, clear: "Clear all" },
};

export default function MappingMemorySettings({ enabled, onEnabledChange, count = 0, onClear, locale = "ko" }) {
  const t = copy[locale] || copy.ko;
  return <div className="csv-memory-note">
    <label><input type="checkbox" checked={enabled} onChange={(event) => onEnabledChange?.(event.target.checked)} /> {t.label}</label>
    <span>{t.hint}</span>
    {enabled && <span><strong>{t.count(count)}</strong> <button type="button" className="ab-pill" onClick={onClear}>{t.clear}</button></span>}
  </div>;
}
