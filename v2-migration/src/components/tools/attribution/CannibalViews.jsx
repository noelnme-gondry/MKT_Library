"use client";
import React from "react";
import Link from "next/link";
import "./reports.css";
export default function CannibalViews({ detail = false, locale = "ko" }) {
  const prefix = locale === "en" ? "/en" : "";
  return <nav className="report-view-nav" aria-label={locale === "en" ? "Cannibalization views" : "잠식 분석 보기"}>
    <Link className={detail ? "btn ghost" : "btn primary"} aria-current={!detail ? "page" : undefined} href={`${prefix}/tools/cannibalization-diagnosis`}>{locale === "en" ? "Spend-based signals" : "지출 기반 신호"}</Link>
    <Link className={detail ? "btn primary" : "btn ghost"} aria-current={detail ? "page" : undefined} href={`${prefix}/tools/cannibalization-diagnosis/detail`}>{locale === "en" ? "Weekly campaign detail" : "주간 캠페인 상세"}</Link>
  </nav>;
}
