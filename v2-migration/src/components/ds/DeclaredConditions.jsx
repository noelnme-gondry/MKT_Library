"use client";
import { useRef, useState } from "react";
import ModalDialog from "@/components/ds/ModalDialog";

/**
 * 사용자가 선언하는 비교·설계 조건 — 한 줄 요약 + `확인하기` 창(product-ssot §1.1c 4단계).
 *
 * 조건 질문(3~5개 선택칸)을 결과 위에 늘 펼쳐 두면 결론이 첫 화면 밖으로 밀린다.
 * 판단 규칙은 그대로다: 조건이 갖춰지기 전에는 각 도구의 결론 문장이 판단 보류를 말한다.
 * 여기서는 "몇 개에 답했는지"와 지금 상태 한 줄만 보이고, 질문은 창 안에서 답한다.
 * 답의 상태는 부르는 쪽(useCausalDesign·useComparisonConditions)이 소유한다.
 * status는 한 줄에 들어갈 짧은 상태, note는 창 안의 자세한 설명이다.
 */
const COPY = {
  ko: { answer: "확인하기", edit: "답 고치기", close: "닫기", count: (answered, total) => `${total}개 중 ${answered}개 답함` },
  en: { answer: "Answer", edit: "Edit answers", close: "Close", count: (answered, total) => `${answered} of ${total} answered` },
};

export default function DeclaredConditions({ title, intro, status, note, ready = false, answered = 0, total = 0, locale = "ko", className = "", children }) {
  const T = COPY[locale === "en" ? "en" : "ko"];
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  return (
    <section className={`declared-conditions ${className}`.trim()} aria-label={title} data-ready={ready ? "true" : "false"}>
      <p className="declared-conditions__line">
        <strong>{title}</strong>
        <span className="declared-conditions__count">{T.count(answered, total)}</span>
        <span role="status" className="declared-conditions__status">{status}</span>
      </p>
      <button type="button" className="btn secondary declared-conditions__open" ref={trigger} onClick={() => setOpen(true)}>{answered ? T.edit : T.answer}</button>
      <ModalDialog open={open} onClose={() => setOpen(false)} returnFocusRef={trigger} ariaLabel={title} overlayClassName="tutorial-overlay" panelClassName="tool-reference-panel declared-conditions-dialog">
        <header className="tool-reference-panel__head">
          <h2>{title}</h2>
          <button type="button" className="btn ghost" onClick={() => setOpen(false)}>{T.close}</button>
        </header>
        {intro && <p className="declared-conditions-dialog__intro">{intro}</p>}
        <div className="declared-conditions-dialog__fields analysis-design-check">{children}</div>
        <p className="declared-conditions-dialog__status">{note || status}</p>
      </ModalDialog>
    </section>
  );
}
