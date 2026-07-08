"use client";
// 블로그 전용 슬림 헤더 — /blog·/blog/[slug]는 메인 셸(Sidebar/Header)이 없는
// 독립 라우트라 홈 이동·테마 토글이 없었음. 여기서 최소한(브랜드→홈, 블로그 목록,
// 다크/라이트 토글)만 제공. 테마 로직은 Header.jsx와 동일(body.light-mode + localStorage).
import { useEffect } from "react";
import Link from "next/link";
import { useAppStore } from "@/store/useDataStore";

export default function BlogHeader() {
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  const toggleTheme = useAppStore((state) => state.toggleTheme);

  // body 클래스 + localStorage 반영(Header와 동일). 블로그 라우트에도 테마 적용.
  useEffect(() => {
    if (isDarkMode) document.body.classList.remove("light-mode");
    else document.body.classList.add("light-mode");
    localStorage.setItem("mkt-library-theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  // 마운트 시 저장된 테마 복원(Header와 동일 — 블로그로 딥링크 진입해도 유지).
  useEffect(() => {
    const saved = localStorage.getItem("mkt-library-theme");
    if (saved === "dark" && !isDarkMode) toggleTheme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <header className="topbar" role="banner">
      <nav className="breadcrumb" aria-label="페이지 경로">
        <Link href="/" className="crumb-link" style={{ textDecoration: "none", color: "inherit", display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <span className="brand-mark" style={{ width: "26px", height: "26px", fontSize: "12px" }}>GO</span>
          <span style={{ fontWeight: 700 }}>Growth Ops Playbook</span>
        </Link>
        <span className="sep">/</span>
        <Link href="/blog" className="current" style={{ textDecoration: "none", color: "var(--text-secondary)" }}>블로그</Link>
      </nav>
      <div className="topbar-actions">
        <Link href="/" className="btn ghost" style={{ textDecoration: "none" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span>홈</span>
        </Link>
        <button
          className="btn ghost"
          type="button"
          aria-label="테마 전환"
          title="테마 전환 (라이트/다크)"
          onClick={toggleTheme}
        >
          {isDarkMode ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
