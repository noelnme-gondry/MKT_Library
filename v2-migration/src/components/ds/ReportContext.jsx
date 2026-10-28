"use client";
import React, { useRef, useState } from "react";
import ModalDialog from "@/components/ds/ModalDialog";

/**
 * 결과가 나온 뒤의 분석 조건 — 맥락 한 줄 + `조건 바꾸기` 창(product-ssot §1.1c 결정 4).
 *
 * 결과 화면의 첫 화면은 결론이 차지해야 한다. 분석 전에는 도구가 기간·대상·지표
 * 컨트롤을 그대로 펼치고, 결과가 생기면 같은 컨트롤을 이 창 안으로 옮긴다.
 * 컨트롤은 상태를 스토어·도구가 소유하므로 창에서 바꾸면 결과에 바로 반영된다
 * (조건의 주인은 한 곳 — 같은 조건을 두 자리에 따로 두지 않는다).
 *
 * parts: [{ text, emphasis? }] — 지금 결과가 무엇으로 계산됐는지(데이터·기간·지표·대상).
 * 빈 문자열은 버린다. 순서가 곧 읽는 순서다.
 */
const COPY = {
  ko: { change: "조건 바꾸기", close: "닫기", dialog: "분석 조건", hint: "바꾸면 결과에 바로 반영됩니다." },
  en: { change: "Change settings", close: "Close", dialog: "Analysis settings", hint: "Changes apply to the results right away." },
};

export default function ReportContext({ parts = [], locale = "ko", dialogTitle, children, className = "", onOpenChange }) {
  const T = COPY[locale === "en" ? "en" : "ko"];
  const [open, setOpenState] = useState(false);
  // 창 안에서 바꾼 값이 결과를 잠시 지워도(예: 시작일만 바꿈) 부르는 쪽이 창을 유지할 수 있게 알린다.
  const setOpen = (next) => { setOpenState(next); onOpenChange?.(next); };
  const trigger = useRef(null);
  const visible = parts.filter((part) => part && String(part.text || "").trim());
  const title = dialogTitle || T.dialog;
  return (
    <section className={`report-context ${className}`.trim()} aria-label={title}>
      <p className="report-context__line">
        {visible.map((part, index) => (
          <React.Fragment key={`${index}-${part.text}`}>
            {index > 0 && <span className="report-context__sep" aria-hidden="true"> · </span>}
            {part.emphasis ? <strong>{part.text}</strong> : <span>{part.text}</span>}
          </React.Fragment>
        ))}
      </p>
      {children && <button type="button" className="btn secondary report-context__edit" ref={trigger} onClick={() => setOpen(true)}>{T.change}</button>}
      {children && (
        <ModalDialog open={open} onClose={() => setOpen(false)} returnFocusRef={trigger} ariaLabel={title} overlayClassName="tutorial-overlay" panelClassName="tool-reference-panel report-context-dialog">
          <header className="tool-reference-panel__head">
            <h2>{title}</h2>
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>{T.close}</button>
          </header>
          <p className="report-context-dialog__hint">{T.hint}</p>
          <div className="report-context-dialog__body">{children}</div>
        </ModalDialog>
      )}
    </section>
  );
}
