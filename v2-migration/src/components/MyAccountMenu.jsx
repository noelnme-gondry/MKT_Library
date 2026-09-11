"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AccountArchive from "./AccountArchive";

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
      {open && <AccountArchive locale={locale} profile />}
      <nav aria-label={en ? "My workspace" : "내 작업 관리"}>
        <Link href={href("/weekly-review#project-management")} onClick={event => navigateReview(event, true)}>{en ? "Manage my projects" : "내 프로젝트 관리"}</Link>
        <Link href={href("/weekly-review")} onClick={event => navigateReview(event, false)}>{en ? "Current project review" : "현재 프로젝트 리뷰"}</Link>
        <Link href={href("/storage")} onClick={close}>{en ? "Storage & backup settings" : "저장·백업 설정"}</Link>
        <Link href={href("/subscription")} onClick={close}>{en ? "Plans & subscription" : "구독·요금제"}</Link>
      </nav>
    </div>
  </details>;
}
