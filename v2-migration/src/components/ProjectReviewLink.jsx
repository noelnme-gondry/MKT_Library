"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useDataStore";

export default function ProjectReviewLink({ projectId, locale = "ko", children, onNavigate }) {
  const router = useRouter();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const href = `${locale === "en" ? "/en" : ""}/weekly-review#wr-history`;
  return <><Link className="btn" href={href} aria-disabled={busy} onClick={async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(false);
    try {
      const state = useAppStore.getState();
      if (projectId && projectId !== state.activeProjectId && !await state.switchProject(projectId)) throw new Error("PROJECT_OPEN_FAILED");
      onNavigate?.();
      router.push(href);
    } catch { setError(true); }
    finally { setBusy(false); }
  }}>{children || (locale === "en" ? "See the saved decision" : "저장한 결정 확인")}</Link>{error && <p role="alert">{locale === "en" ? "Could not open the saved project. Your current analysis is still here." : "저장한 프로젝트를 열지 못했습니다. 현재 분석은 유지됩니다."}</p>}</>;
}
