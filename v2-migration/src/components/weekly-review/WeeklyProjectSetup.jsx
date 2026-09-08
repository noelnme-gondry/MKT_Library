"use client";

import { useState } from "react";
import Link from "next/link";

export default function WeeklyProjectSetup({ locale, name, setName, target, setTarget, metric, currency, canSave, targetInvalid, status, persistenceEnabled, onSave, hasResult, children }) {
  const [editing, setEditing] = useState(!hasResult);
  const en = locale === "en";
  const unit = metric === "roas" ? (en ? "ratio · 2 = 200%" : "배수 · 2 = 200%") : metric === "conversions" ? (en ? "conversions per period" : "기간당 전환 건수") : currency || (en ? "Declare the source currency after uploading" : "업로드 후 원본 통화를 먼저 선택하세요");
  return <section className="wr-project" id="wr-project" aria-labelledby="wr-project-title">
    <div className="wr-section-heading"><div><h2 id="wr-project-title">{name || (en ? "My weekly project" : "내 주간 프로젝트")}</h2><p>{metric.toUpperCase()} · {unit} · {en ? "One project on this device" : "이 기기의 프로젝트 1개"}</p></div><button type="button" className="btn" aria-expanded={editing} aria-controls="wr-project-fields" onClick={() => setEditing(!editing)}>{editing ? (en ? "Close settings" : "설정 접기") : (en ? "Edit project settings" : "프로젝트 기준 편집")}</button></div>
    <div id="wr-project-fields" hidden={!editing}>
      <p>{en ? "Choose the KPI you report on and its target. These settings are used in the review, decisions and shared report." : "매주 보고하는 KPI와 목표를 정하세요. 같은 기준으로 성과를 검토하고, 결정을 기록하고, 보고서를 만듭니다."}</p>
      <div className="wr-project-fields">
        <label className="wr-field"><span>{en ? "Project name" : "프로젝트 이름"}</span><input value={name} onChange={event => setName(event.target.value)} maxLength={120} placeholder={en ? "e.g. App acquisition · KR" : "예: 앱 신규 고객 확보 · 한국"} /></label>
        <label className="wr-field"><span id="wr-target-label">{en ? "KPI target (optional)" : "KPI 목표 (선택)"}</span><input value={target} onChange={event => setTarget(event.target.value)} inputMode="decimal" aria-labelledby="wr-target-label" aria-invalid={targetInvalid || undefined} aria-describedby="wr-target-unit" /><small id="wr-target-unit">{unit}{targetInvalid ? (en ? " · Enter a positive number." : " · 0보다 큰 숫자를 입력하세요.") : ""}</small></label>
      </div>
      {children}
      <div className="wr-project-actions"><button type="button" className="btn primary" disabled={!canSave} onClick={async () => { if (await onSave()) setEditing(false); }}>{en ? "Save setup for next week" : "다음 주를 위해 설정 저장"}</button><Link href={en ? "/en/storage" : "/storage"}>{en ? "Storage settings" : "저장소 설정"}</Link></div>
      <p className="wr-note">{persistenceEnabled ? (en ? "Settings and campaign aggregates stay in this browser for up to 90 days. Mapping is remembered by the uploader. Delete them in Storage." : "설정과 캠페인 집계는 이 브라우저에 최대 90일 보관합니다. 매핑은 업로더가 기억하며, 저장소에서 삭제할 수 있습니다.") : (en ? "Device storage is off. You can review now, but settings will not survive this session." : "기기 저장이 꺼져 있습니다. 지금 분석할 수 있지만 설정은 현재 세션만 유지됩니다.")}</p>
    </div>
    {status && <p role="status" className="wr-project-status">{status}</p>}
  </section>;
}
