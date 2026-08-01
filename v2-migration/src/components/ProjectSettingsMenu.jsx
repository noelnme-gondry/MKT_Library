"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/useDataStore";
import { headerFingerprint, parseProjectText, serializeProject } from "@/lib/project/serializeProject";
import { downloadJson } from "@/utils/download";

const COPY = {
  ko: {
    menu: "프로젝트 설정",
    export: "설정 내보내기",
    import: "설정 가져오기",
    preview: "가져오기 미리보기",
    apply: "호환 설정 적용",
    close: "닫기",
    compatible: "헤더 일치 · 적용 가능",
    pending: "CSV 재선택 필요",
    privacy: "컬럼 매핑·필터·뷰만 저장합니다. 원본 CSV, 파일명, 분석 결과는 포함하지 않습니다.",
    imported: "설정 파일을 확인했습니다. 분석은 자동 실행하지 않습니다.",
    error: "설정 파일을 읽지 못했습니다.",
  },
  en: {
    menu: "Project settings",
    export: "Export settings",
    import: "Import settings",
    preview: "Import preview",
    apply: "Apply compatible settings",
    close: "Close",
    compatible: "Headers match · ready",
    pending: "Re-select CSV",
    privacy: "Stores only mappings, filters, and views. Source CSV, filenames, and analysis results are excluded.",
    imported: "Settings verified. Analysis will not run automatically.",
    error: "Could not read this settings file.",
  },
};

export default function ProjectSettingsMenu({ locale = "ko" }) {
  const t = COPY[locale] || COPY.ko;
  const csvGroups = useAppStore((state) => state.csvGroups);
  const pendingProjectConfig = useAppStore((state) => state.pendingProjectConfig);
  const setPendingProjectConfig = useAppStore((state) => state.setPendingProjectConfig);
  const applyProjectConfig = useAppStore((state) => state.applyProjectConfig);
  const [project, setProject] = useState(null);
  const [compatibility, setCompatibility] = useState({});
  const [message, setMessage] = useState("");
  const inputRef = useRef(null);
  const activeProject = project || pendingProjectConfig;

  useEffect(() => {
    if (!activeProject) return;
    let cancelled = false;
    Promise.all(Object.entries(activeProject.groups || {}).map(async ([group, config]) => {
      const headers = csvGroups[group]?.headers || [];
      const fingerprint = headers.length ? await headerFingerprint(headers) : null;
      return [group, Boolean(fingerprint && fingerprint === config.headerFingerprint)];
    })).then((entries) => {
      if (!cancelled) setCompatibility(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [activeProject, csvGroups]);

  const exportSettings = async () => {
    const payload = await serializeProject(useAppStore.getState(), locale);
    downloadJson(payload, "growthopt-project", "gop.json");
  };

  const importSettings = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = parseProjectText(await file.text());
      setProject(parsed);
      setPendingProjectConfig(parsed);
      setMessage(t.imported);
    } catch {
      setMessage(t.error);
    }
  };

  const apply = () => {
    if (!activeProject) return;
    const compatibleGroups = Object.entries(compatibility).filter(([, matches]) => matches).map(([group]) => group);
    applyProjectConfig(activeProject, compatibleGroups);
    setProject(null);
    setMessage(t.imported);
  };

  return (
    <details className="project-settings no-print">
      <summary className="btn ghost" aria-label={t.menu}>
        <span className="project-settings__label">{t.menu}</span>
        <span className="project-settings__mobile-icon" aria-hidden="true">⚙</span>
      </summary>
      <div className="project-settings__panel">
        <p>{t.privacy}</p>
        <div>
          <button className="btn ghost" type="button" onClick={exportSettings}>{t.export}</button>
          <button className="btn ghost" type="button" onClick={() => inputRef.current?.click()}>{t.import}</button>
          <input ref={inputRef} type="file" accept=".json,.gop.json,application/json" hidden onChange={importSettings} />
        </div>
        {message && <p role="status">{message}</p>}
        {activeProject && (
          <section>
            <strong>{t.preview}</strong>
            <ul>
              {Object.keys(activeProject.groups || {}).map((group) => (
                <li key={group}>{group} — {compatibility[group] ? t.compatible : t.pending}</li>
              ))}
            </ul>
            <button className="btn primary" type="button" onClick={apply}>{t.apply}</button>
          </section>
        )}
      </div>
    </details>
  );
}
