"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import DiagnosisWorkbench from "./DiagnosisWorkbench";
import { usePlannerEntry } from "./usePlannerEntry";

const LibraryOverview = dynamic(() => import("@/components/LandingPage"));

export default function DiagnosisHome({ locale = "ko", reading }) {
  const [showOverview, setShowOverview] = useState(false);
  usePlannerEntry(locale);
  const en = locale === "en";
  return (
    <>
      {showOverview ? <LibraryOverview locale={locale} reading={reading} /> : <DiagnosisWorkbench locale={locale} shared />}
      <div className="diagnosis-directory">
        <button type="button" onClick={() => {
          setShowOverview(!showOverview);
          document.getElementById("main-content")?.focus();
          window.scrollTo(0, 0);
        }}>
          {showOverview ? (en ? "Back to campaign diagnosis" : "캠페인 효율 진단으로 돌아가기") : (en ? "Browse all tools and guides" : "전체 도구와 가이드 둘러보기")}
        </button>
      </div>
    </>
  );
}
