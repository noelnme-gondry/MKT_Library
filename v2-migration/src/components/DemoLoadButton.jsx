"use client";
import React from "react";

// Shared "데모 데이터" button — identical design & position across ALL tools
// (CsvUploader for the 7 standard tools + the self-hosted dropzones of 5-18/5-20).
// Sits directly under the CSV dropzone. `onLoad` wires the tool-specific loader.
const COPY = {
  ko: { btn: "데모 데이터로 체험하기", hint: "CSV 없이 샘플 데이터로 결과를 바로 확인" },
  en: { btn: "Try it with demo data", hint: "See results instantly with sample data, no CSV needed" },
};

// className: 기본 위치(드롭존 바로 아래, 음수 마진 전제) 외 다른 문맥에 놓일 때
// 여백을 재정의하기 위한 선택적 모디파이어(§CsvUploader 구글시트 겹침 버그).
export default function DemoLoadButton({ onLoad, locale = "ko", className = "" }) {
  const T = COPY[locale] || COPY.ko;
  return (
    <div className={`demo-load-row${className ? ` ${className}` : ""}`}>
      <button type="button" className="demo-load-btn" onClick={onLoad}>
        <span className="demo-load-icon" aria-hidden="true">✨</span>
        {T.btn}
      </button>
      <span className="demo-load-hint">{T.hint}</span>
    </div>
  );
}
