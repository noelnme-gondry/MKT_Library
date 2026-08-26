"use client";

import { useEffect } from "react";
import Link from "next/link";
import { findMeta, useAppStore } from "@/store/useDataStore";
import { TOOL_GROUP } from "@/lib/toolGroups";

const COPY = {
  ko: {
    eyebrow: "DEVICE STORAGE",
    title: "이 기기에 저장된 것",
    intro: "이 목록은 이 브라우저 안에만 있어요. 서버로 보내지 않아서 만든 사람도 볼 수 없어요.",
    enabled: "이 기기에 저장하기",
    enabledHint: "올린 파일과 결정 기록을 90일 동안 이 기기에 보관합니다. 끄면 저장된 파일과 기록을 즉시 지웁니다.",
    disabledHint: "저장이 꺼져 있어요. 현재 세션의 분석은 계속 쓸 수 있지만, 새로고침 뒤에는 남지 않습니다.",
    empty: "저장된 업로드 파일이 없어요.",
    remove: "지우기",
    removeAll: "전부 지우기",
    removeOneConfirm: "이 그룹의 저장 파일을 지울까요? 현재 화면의 데이터도 함께 비워집니다.",
    removeAllConfirm: "이 기기에 저장된 업로드 파일을 모두 지울까요? 현재 화면의 데이터도 함께 비워집니다.",
    rows: (count) => `${count.toLocaleString()}행`,
    lastUsed: "마지막 사용",
    remaining: (days) => `남은 기간 ${days}일`,
    expired: (count) => `90일 넘게 안 쓴 데이터 ${count}건을 지웠어요.`,
    unavailable: "이 브라우저에서는 저장이 안 돼요. 분석은 그대로 됩니다.",
    quota: "기기 공간이 부족해 저장하지 못했어요. 지난 데이터를 지우면 됩니다.",
    privacy: "저장 방식과 삭제 범위는 개인정보 처리방침에서 확인할 수 있어요.",
  },
  en: {
    eyebrow: "DEVICE STORAGE",
    title: "Stored on this device",
    intro: "This list stays in this browser only. It is not sent to a server, so not even we can see it.",
    enabled: "Store on this device",
    enabledHint: "Keep uploaded files and decision records on this device for 90 days. Turning it off removes stored files and records immediately.",
    disabledHint: "Storage is off. You can keep working in this session, but it will not remain after a refresh.",
    empty: "There are no saved upload files.",
    remove: "Remove",
    removeAll: "Remove all",
    removeOneConfirm: "Remove this saved dataset? The data currently open for this group will also be cleared.",
    removeAllConfirm: "Remove every saved upload on this device? The data currently open will also be cleared.",
    rows: (count) => `${count.toLocaleString()} rows`,
    lastUsed: "Last used",
    remaining: (days) => `${days} days left`,
    expired: (count) => `We removed ${count} dataset${count === 1 ? "" : "s"} unused for over 90 days.`,
    unavailable: "Storage is unavailable in this browser. Analysis still works.",
    quota: "Your device is out of space, so we could not save this file. Remove old data and try again.",
    privacy: "Read the Privacy Policy for storage and deletion details.",
  },
};

function groupLabel(group, locale) {
  const routeId = Object.keys(TOOL_GROUP).find((id) => TOOL_GROUP[id] === group);
  const meta = routeId ? findMeta(routeId) : null;
  return locale === "en" ? meta?.titleEn || meta?.title || group : meta?.title || group;
}

function formatBytes(bytes, locale) {
  const value = Number(bytes) || 0;
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))}KB`;
  return `${(value / (1024 * 1024)).toLocaleString(locale === "en" ? "en-US" : "ko-KR", { maximumFractionDigits: 1 })}MB`;
}

function formatDate(value, locale) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ko-KR", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

export default function WorkspaceStoragePage({ locale = "ko" }) {
  const T = COPY[locale] || COPY.ko;
  const enabled = useAppStore((state) => state.decisionPersistenceEnabled);
  const datasets = useAppStore((state) => state.workspaceDatasetSummaries);
  const expiredCount = useAppStore((state) => state.workspaceExpiredCount);
  const error = useAppStore((state) => state.workspaceStorageError);
  const refresh = useAppStore((state) => state.refreshWorkspaceDatasets);
  const remove = useAppStore((state) => state.removeWorkspaceDataset);
  const clear = useAppStore((state) => state.clearWorkspaceDatasets);
  const setEnabled = useAppStore((state) => state.setDecisionPersistenceEnabled);

  useEffect(() => { refresh(); }, [refresh]);

  const removeOne = async (group) => {
    if (window.confirm(T.removeOneConfirm)) await remove(group);
  };
  const removeAll = async () => {
    if (window.confirm(T.removeAllConfirm)) await clear();
  };
  const errorCopy = error === "WORKSPACE_STORAGE_QUOTA" ? T.quota : error ? T.unavailable : null;

  return <div className="workspace-storage-page">
    <header className="workspace-storage-page__header">
      <span>{T.eyebrow}</span>
      <h1>{T.title}</h1>
      <p>{T.intro}</p>
    </header>
    {expiredCount > 0 && <p className="workspace-storage-page__notice" role="status">{T.expired(expiredCount)}</p>}
    {errorCopy && <p className="workspace-storage-page__error" role="alert">{errorCopy}</p>}
    <section className="workspace-storage-page__toggle" aria-label={T.enabled}>
      <div><strong>{T.enabled}</strong><p>{enabled ? T.enabledHint : T.disabledHint}</p></div>
      <label>
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        <span aria-hidden="true" />
      </label>
    </section>
    <section className="workspace-storage-page__list" aria-label={T.title}>
      {datasets.length === 0 ? <p className="workspace-storage-page__empty">{T.empty}</p> : datasets.map((dataset) => <article key={dataset.group} className="workspace-storage-page__dataset">
        <div>
          <strong>{groupLabel(dataset.group, locale)}</strong>
          <span>{dataset.fileName}</span>
          <small>{T.rows(dataset.rowCount)} · {formatBytes(dataset.byteSize, locale)} · {T.lastUsed} {formatDate(dataset.lastUsedAt, locale)} · {T.remaining(dataset.remainingDays)}</small>
        </div>
        <button type="button" className="btn ghost" onClick={() => removeOne(dataset.group)}>{T.remove}</button>
      </article>)}
    </section>
    {datasets.length > 0 && <button type="button" className="btn ghost workspace-storage-page__clear" onClick={removeAll}>{T.removeAll}</button>}
    <p className="workspace-storage-page__privacy">{T.privacy} <Link href={locale === "en" ? "/en/privacy" : "/privacy"}>{locale === "en" ? "Privacy Policy" : "개인정보 처리방침"}</Link></p>
  </div>;
}
