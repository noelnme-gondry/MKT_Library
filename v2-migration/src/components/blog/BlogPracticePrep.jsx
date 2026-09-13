"use client";

import { useState } from "react";
import { ArrowDown, Download } from "lucide-react";
import { downloadFile } from "@/utils/download";

export default function BlogPracticePrep({ practice }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!practice) return null;
  const download = async () => {
    setBusy(true); setError("");
    try {
      const { buildBlogPracticeDownload } = await import("@/lib/blogPracticeData");
      const file = buildBlogPracticeDownload(practice);
      if (!downloadFile(new Blob([file.text], { type: "text/csv;charset=utf-8" }), file.file)) throw new Error("download");
    } catch {
      setError(practice.locale === "en" ? "The download could not start. Please try again." : "다운로드를 시작하지 못했습니다. 다시 시도해 주세요.");
    } finally { setBusy(false); }
  };
  return <aside className="blog-practice-prep" aria-label={practice.before}>
    <div className="blog-practice-prep__copy">
      <span className="blog-practice__eyebrow">{practice.before}</span>
      <p>{practice.invitation}</p>
      <span className="blog-practice-prep__source">{practice.source}</span>
      {error && <p role="alert">{error}</p>}
    </div>
    <div className="blog-practice-prep__actions">
      {practice.demoGroup ? <button type="button" className="blog-practice-prep__download" disabled={busy} onClick={download}>
        <Download size={16} aria-hidden="true" />{practice.download}
      </button> : <a className="blog-practice-prep__download" href={practice.href} download={practice.file}>
        <Download size={16} aria-hidden="true" />{practice.download}
      </a>}
      <a className="blog-practice-prep__jump" href="#blog-practice">
        {practice.jump}<ArrowDown size={14} aria-hidden="true" />
      </a>
    </div>
  </aside>;
}
