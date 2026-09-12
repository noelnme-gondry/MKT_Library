"use client";
import { useState } from "react";
import Link from "next/link";
import ProjectReviewLink from "./ProjectReviewLink";

export default function AccountDecisionLibrary({ locale, signedIn, memos, loading, records, busy, message, onCopy, onExport, onCalendar, onDelete, accountControls, renderSave, children, anchorId }) {
  const en = locale === "en";
  const [composing, setComposing] = useState(false);
  const [settings, setSettings] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const selected = records.find(record => record.id === selectedId);
  const startReview = () => {
    const upload = document.getElementById("wr-upload");
    if (upload?.tagName === "DETAILS") upload.open = true;
  };
  return <section id={anchorId} className="account-archive account-library block" aria-label={en ? "Account decision archive" : "계정 결정 보관함"}>
    {children}
    <header className="account-library__header"><div><h3>{en ? "Saved account decisions" : "계정에 저장한 결정"}</h3><p>{en ? "Review saved memos across devices. Source CSVs stay on their original device." : "다른 기기에서도 결정 메모를 확인하세요. CSV 원본은 저장한 기기에 남습니다."}</p></div>{signedIn && records.length > 0 && <button className="btn primary" aria-expanded={composing} onClick={() => setComposing(value => !value)}>{en ? "Save to account" : "계정에 보관하기"}</button>}</header>
    {!signedIn ? <div className="account-library__empty"><p>{en ? "Sign in to see your saved decisions." : "로그인하면 계정에 저장한 결정을 볼 수 있습니다."}</p>{accountControls}</div> : <>
      {loading ? <p role="status">{en ? "Loading saved decisions…" : "저장한 결정을 불러오는 중…"}</p> : memos.length ? <div className="account-library__records">{memos.map(memo => {
        const local = records.some(record => record.id === memo.id);
        return <article className="account-library__record" key={memo.id}>
          <div className="account-library__record-heading"><div><h4>{memo.action}</h4><p>{en ? "Review date" : "검토 예정일"} <time>{memo.reviewDate || (en ? "Not set" : "미설정")}</time></p></div>{local ? <ProjectReviewLink locale={locale}>{en ? "Continue review" : "검토 이어하기"}</ProjectReviewLink> : <button className="btn primary" disabled={busy} onClick={() => onCopy(memo)}>{en ? "Continue review" : "검토 이어하기"}</button>}</div>
          <details className="account-library__details"><summary>{en ? "Decision details" : "결정 내용 보기"}</summary>{memo.conclusion && <p>{memo.conclusion}</p>}{memo.learning && <p>{memo.learning}</p>}<div className="account-library__actions"><button className="btn" disabled={!memo.reviewDate} onClick={() => onCalendar(memo)}>{en ? "Add review to calendar" : "검토일 캘린더에 추가"}</button><button className="btn ghost" disabled={busy} onClick={() => onDelete(memo)}>{en ? "Delete account copy" : "계정 사본 삭제"}</button></div></details>
        </article>;
      })}</div> : <div className="account-library__empty"><h4>{en ? "No saved decisions yet" : "아직 저장한 결정이 없습니다"}</h4><p>{records.length ? (en ? "Choose a decision from this project to keep in your account." : "이 프로젝트의 결정 중 계정에 보관할 기록을 선택하세요.") : (en ? "Analyze your data, then record the next action." : "데이터를 분석하고 다음 행동을 결정으로 기록하세요.")}</p>{!records.length && <Link className="btn primary" href={`${en ? "/en" : ""}/weekly-review#wr-upload`} onClick={startReview}>{en ? "Record your first decision" : "첫 결정 기록하기"}</Link>}</div>}
      {composing && <section className="account-library__compose"><h4>{en ? "Save a decision to your account" : "계정에 보관할 결정"}</h4><label>{en ? "Choose a local decision to save" : "계정에 보관할 로컬 결정 선택"}<select value={selectedId} onChange={event => setSelectedId(event.target.value)}><option value="">{en ? "Choose a decision" : "결정 선택"}</option>{records.map(record => <option key={record.id} value={record.id}>{record.action}</option>)}</select></label>{selected && renderSave(selected)}<button className="btn ghost" onClick={() => setComposing(false)}>{en ? "Close" : "닫기"}</button></section>}
      <footer className="account-library__footer">{memos.length > 0 && <button className="btn ghost" onClick={onExport}>{en ? "Export existing memos · free" : "기존 메모 내보내기 · 무료"}</button>}<details className="account-library__details" onToggle={event => setSettings(event.currentTarget.open)}><summary>{en ? "Account settings" : "계정 설정"}</summary>{settings && accountControls}</details></footer>
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
