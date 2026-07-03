"use client";
import React from "react";

// Shared "데모 데이터" button — identical design & position across ALL tools
// (CsvUploader for the 7 standard tools + the self-hosted dropzones of 5-18/5-20).
// Sits directly under the CSV dropzone. `onLoad` wires the tool-specific loader.
export default function DemoLoadButton({ onLoad }) {
  return (
    <div className="demo-load-row">
      <button type="button" className="demo-load-btn" onClick={onLoad}>
        <span className="demo-load-icon" aria-hidden="true">✨</span>
        데모 데이터로 체험하기
      </button>
      <span className="demo-load-hint">CSV 없이 샘플 데이터로 결과를 바로 확인</span>
    </div>
  );
}
