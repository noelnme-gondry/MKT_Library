"use client";
import React from "react";
import { toolIndexEntry } from "@/lib/toolIndex";

/**
 * ToolBrief — 도구에 들어온 순간 "여기서 뭘 할 수 있나"를 세 줄로 답한다.
 *
 * 이름을 6~8자로 줄이면 이름만으로는 무엇을 하는 도구인지 알 수 없다. 그 손실을
 * 여기서 메운다. 목록(도구 인덱스)에 쓰는 문장과 **같은 문장**을 쓴다 — 목록에서
 * 보고 들어왔는데 다른 말이 적혀 있으면 고른 게 맞는지 다시 확인해야 한다.
 *
 * 규율: 상자 없음 · 배경 없음 · 세 줄 고정. 질문 / 답 / 필요한 데이터.
 * 늘리고 싶어지면 도구 본문의 롱폼(ToolLongform)으로 내린다.
 */
export default function ToolBrief({ toolId, locale = "ko" }) {
  const entry = toolIndexEntry(toolId, locale);
  if (!entry || (!entry.question && !entry.answer)) return null;

  return (
    <section className="tool-brief" aria-label={locale === "en" ? "What this tool does" : "이 도구가 하는 일"}>
      {entry.question && <p className="tool-brief__q">{entry.question}</p>}
      {entry.answer && <p className="tool-brief__a">{entry.answer}</p>}
      {entry.outputs.length > 0 && (
        <ul className="tool-brief__outputs">
          {entry.outputs.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
      {entry.needs.length > 0 && (
        <p className="tool-brief__needs">
          <span className="tool-brief__needs-label">{locale === "en" ? "Needs" : "필요한 데이터"}</span>
          {entry.needs.join(" · ")}
        </p>
      )}
    </section>
  );
}
