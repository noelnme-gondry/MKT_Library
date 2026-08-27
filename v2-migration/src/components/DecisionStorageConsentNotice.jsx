"use client";

import { useState } from "react";
import { trackProductEvent } from "@/lib/analytics";
import { serializeDecisionReviewCsv } from "@/lib/decisionReview";
import { useAppStore } from "@/store/useDataStore";
import { downloadCsv } from "@/utils/download";

const COPY = {
  ko: {
    title: "기기 저장 범위를 다시 확인해 주세요",
    body: (count) => `현재 보이는 결정 기록 ${count}개는 삭제하지 않고 보존했습니다. 앞으로는 원본 CSV·XLSX와 결정 기록을 함께 저장하므로, 계속 저장할지 직접 선택해 주세요.`,
    accept: "원본과 기록 계속 저장",
    decline: "이번 세션만 유지",
    export: "먼저 CSV 내보내기",
    error: "브라우저 저장소를 사용할 수 없습니다. CSV를 내보낸 뒤 다시 시도해 주세요.",
  },
  en: {
    title: "Review the updated device-storage scope",
    body: (count) => `We kept the ${count} decision record${count === 1 ? "" : "s"} currently visible instead of deleting them. Device storage now covers uploaded CSV/XLSX files together with decision records, so choose whether to keep using it.`,
    accept: "Keep files and records",
    decline: "Keep this session only",
    export: "Export CSV first",
    error: "Browser storage is unavailable. Export the CSV and try again.",
  },
};

export default function DecisionStorageConsentNotice({ locale = "ko", source = "storage_reconsent" }) {
  const T = COPY[locale] || COPY.ko;
  const records = useAppStore((state) => state.decisionRecords);
  const enabled = useAppStore((state) => state.decisionPersistenceEnabled);
  const preferenceSet = useAppStore((state) => state.decisionPersistencePreferenceSet);
  const setEnabled = useAppStore((state) => state.setDecisionPersistenceEnabled);
  const [error, setError] = useState("");
  const needsChoice = !enabled && preferenceSet !== true && records.length > 0;

  if (!needsChoice) return null;

  const choose = (nextEnabled) => {
    const didUpdate = setEnabled(nextEnabled);
    if (nextEnabled && didUpdate === false) {
      setError(T.error);
      return;
    }
    setError("");
    trackProductEvent("decision_persistence_changed", {
      state: nextEnabled ? "enabled" : "disabled",
      source,
      locale,
    });
  };

  return (
    <section className="decision-storage-consent" role="status" aria-labelledby={`${source}-storage-consent-title`}>
      <div>
        <strong id={`${source}-storage-consent-title`}>{T.title}</strong>
        <p>{T.body(records.length)}</p>
      </div>
      <div className="decision-storage-consent__actions">
        <button type="button" className="btn primary small" onClick={() => choose(true)}>{T.accept}</button>
        <button type="button" className="btn ghost small" onClick={() => choose(false)}>{T.decline}</button>
        <button type="button" className="btn text small" onClick={() => downloadCsv(serializeDecisionReviewCsv(records), "decision_review_before_storage_choice")}>{T.export}</button>
      </div>
      {error && <p className="decision-storage-consent__error" role="alert">{error}</p>}
    </section>
  );
}
