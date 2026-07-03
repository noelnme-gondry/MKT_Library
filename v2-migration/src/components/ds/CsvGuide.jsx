"use client";
import React, { useState } from "react";
import { getToolGuide } from "@/utils/toolGuide";

// CSV upload guidance (design-system baseline §1.4). Hybrid per claude-ux §0
// (avoid hidden-affordance trap): an always-visible 1-line summary + a prominent
// button that opens a modal with the full "when / why each column / prep / example".
// Sits ABOVE the dropzone. Used by CsvUploader + custom dropzones (5-18/5-20/holdout).
export default function CsvGuide({ toolId, onDownloadTemplate }) {
  const [open, setOpen] = useState(false);
  const guide = getToolGuide(toolId);
  if (!guide) return null;

  const reqCols = guide.needs.filter((n) => n.required).map((n) => n.label).join(" · ");

  return (
    <div className="csv-guide">
      <div className="csv-guide-summary">
        <div className="csv-guide-line">
          <span className="csv-guide-when">{guide.when}</span>
          {reqCols && <span className="csv-guide-need">필요: {reqCols}</span>}
        </div>
        <button type="button" className="csv-guide-btn" onClick={() => setOpen(true)}>
          📖 어떤 데이터가 왜 필요한가요?
        </button>
      </div>

      {open && (
        <div className="csv-guide-overlay" onClick={() => setOpen(false)}>
          <div className="csv-guide-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="csv-guide-modal-head">
              <strong>이 도구에 올릴 데이터 안내</strong>
              <button type="button" className="csv-guide-close" onClick={() => setOpen(false)} aria-label="닫기">✕</button>
            </div>

            <div className="csv-guide-modal-body">
              <section>
                <h4>언제 쓰나요?</h4>
                <p>{guide.when}</p>
                {guide.grain && <p className="csv-guide-grain">📄 {guide.grain}</p>}
              </section>

              <section>
                <h4>어떤 컬럼이 왜 필요한가요?</h4>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>컬럼</th>
                        <th style={{ textAlign: "left" }}>무엇</th>
                        <th style={{ textAlign: "left" }}>왜 필요</th>
                        <th style={{ textAlign: "center" }}>필수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {guide.needs.map((n, i) => (
                        <tr key={i}>
                          <td style={{ textAlign: "left" }}><code className="inline">{n.col}</code></td>
                          <td style={{ textAlign: "left" }}>{n.label}</td>
                          <td style={{ textAlign: "left", color: "var(--text-muted)" }}>{n.why}</td>
                          <td style={{ textAlign: "center" }}>{n.required ? "✅" : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {guide.prep && guide.prep.length > 0 && (
                <section>
                  <h4>준비 팁</h4>
                  <ul className="csv-guide-prep">
                    {guide.prep.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </section>
              )}

              {guide.example && (
                <section>
                  <h4>예시</h4>
                  <pre className="csv-guide-example">{guide.example}</pre>
                </section>
              )}
            </div>

            <div className="csv-guide-modal-foot">
              {onDownloadTemplate && (
                <button type="button" className="ab-pill" onClick={onDownloadTemplate}>⬇ 템플릿 CSV 받기</button>
              )}
              <button type="button" className="ab-button" onClick={() => setOpen(false)}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
