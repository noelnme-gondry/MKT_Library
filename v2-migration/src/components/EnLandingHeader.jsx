"use client";
// /en 랜딩 전용 슬림 헤더 — Sidebar 없는 독립 라우트라 홈 이동·테마 토글만 최소 제공.
// BlogHeader.jsx와 같은 구조(테마 로직 동일)지만 브레드크럼 2번째 세그먼트("Blog")가
// 없고 홈 링크가 "/"가 아니라 "/en"을 가리킨다. 언어 전환(English/한국어) 링크는
// LandingPage.jsx 히어로 안에 있어 여기서는 중복 배치하지 않는다.
import { useEffect } from "react";
import Link from "next/link";
import { useAppStore } from "@/store/useDataStore";

export default function EnLandingHeader() {
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  const toggleTheme = useAppStore((state) => state.toggleTheme);

  useEffect(() => {
    if (isDarkMode) document.body.classList.remove("light-mode");
    else document.body.classList.add("light-mode");
    localStorage.setItem("mkt-library-theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  useEffect(() => {
    const saved = localStorage.getItem("mkt-library-theme");
    if (saved === "dark" && !isDarkMode) toggleTheme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <header className="topbar" role="banner">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link
          href="/en"
          className="crumb-link"
          style={{ textDecoration: "none", color: "inherit", display: "inline-flex", alignItems: "center", gap: "8px" }}
        >
          <span className="brand-mark" style={{ width: "26px", height: "26px", fontSize: "12px" }}>GO</span>
          <span style={{ fontWeight: 700 }}>Growth Opt Playbook</span>
        </Link>
      </nav>
      <div className="topbar-actions">
        <button
          className="btn ghost"
          type="button"
          aria-label="Toggle theme"
          title="Toggle theme"
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
