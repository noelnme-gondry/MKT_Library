"use client";
import React from "react";
import { useAppStore } from "@/store/useDataStore";
import { toolIndexEntry } from "@/lib/toolIndex";

// 목록과 같은 설명·입력 요건을 쓴다. 분석 후에는 결과 위에서 안내를 반복하지 않는다.
export default function ToolBrief({ toolId, locale = "ko" }) {
  const isAnalyzed = useAppStore((state) => state.isGroupAnalyzed(toolId));
  const entry = toolIndexEntry(toolId, locale);
  if (isAnalyzed || !entry || !entry.answer) return null;

  return (
    <section className="tool-brief" aria-label={locale === "en" ? "What this tool does" : "이 도구가 하는 일"}>
      {entry.answer && <p className="tool-brief__a">{entry.answer}</p>}
      {entry.needs.length > 0 && (
        <p className="tool-brief__needs">
          <span className="tool-brief__needs-label">{locale === "en" ? "Needs" : "필요한 데이터"}</span>
          {entry.needs.join(" · ")}
        </p>
      )}
    </section>
  );
}
