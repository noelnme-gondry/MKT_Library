"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AccountArchive from "./AccountArchive";

function MenuIcon({ kind }) {
  const paths = { projects: "M3 7h7l2-3h9v16H3V7Z", review: "M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h5", storage: "M4 4h16v5H4z M4 15h16v5H4z M8 6v1 M8 17v1", plan: "M3 5h18v14H3z M3 10h18 M7 15h4" };
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[kind]} /></svg>;
}

export default function MyAccountMenu({ locale = "ko" }) {
  const en = locale === "en";
  const root = useRef(null);
  const [open, setOpen] = useState(false);
  const close = () => root.current?.removeAttribute("open");
  useEffect(() => {
    const outside = event => { if (!root.current?.contains(event.target)) close(); };
    const escape = event => {
      if (event.key !== "Escape" || !root.current?.open) return;
      close(); root.current.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  const href = path => en ? `/en${path}` : path;
  const navigateReview = (event, manage) => {
    close();
    if (window.location.pathname !== href("/weekly-review")) return;
    event.preventDefault();
    window.location.hash = manage ? "project-management" : "";
  };
  return <details ref={root} className="my-account-menu" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="btn ghost my-account-menu__trigger"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></svg><span>{en ? "My account" : "마이페이지"}</span></summary>
    <div className="my-account-menu__panel">
      <button type="button" className="my-account-menu__close" aria-label={en ? "Close my account" : "마이페이지 닫기"} onClick={() => { close(); root.current.querySelector("summary")?.focus(); }}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      {open && <AccountArchive locale={locale} profile />}
      <nav aria-label={en ? "My workspace" : "내 작업 관리"}>
        <Link href={href("/weekly-review#project-management")} onClick={event => navigateReview(event, true)}><MenuIcon kind="projects" /><span>{en ? "My projects" : "내 프로젝트"}</span></Link>
        <Link href={href("/storage")} onClick={close}><MenuIcon kind="storage" /><span>{en ? "Storage & backup settings" : "저장·백업 설정"}</span></Link>
        <Link href={href("/subscription")} onClick={close}><MenuIcon kind="plan" /><span>{en ? "Plans & subscription" : "구독·요금제"}</span></Link>
      </nav>
    </div>
  </details>;
}
