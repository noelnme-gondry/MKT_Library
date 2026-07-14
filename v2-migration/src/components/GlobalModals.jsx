"use client";
import { useAppStore } from "@/store/useDataStore";

const COPY = {
  ko: { placeholder: "도구·가이드 이동 또는 명령 실행…", move: "이동", run: "실행", close: "닫기" },
  en: { placeholder: "Jump to a tool/guide or run a command…", move: "move", run: "run", close: "close" },
};

export default function GlobalModals({ locale = "ko" }) {
  const T = COPY[locale] || COPY.ko;
  const isCmdkOpen = useAppStore((state) => state.isCmdkOpen);
  const setCmdkOpen = useAppStore((state) => state.setCmdkOpen);

  return (
    <>
      <div id="toast-container" className="toast-container" role="status" aria-live="polite"></div>

      {/* ⌘K 명령 팔레트 */}
      <div id="cmdk" className="cmdk-overlay" hidden={!isCmdkOpen}>
        <div className="cmdk-panel" role="dialog" aria-modal="true">
          <div className="cmdk-inputwrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              id="cmdk-input" 
              type="text" 
              placeholder={T.placeholder}
              autoComplete="off" 
              spellCheck="false" 
            />
            <kbd onClick={() => setCmdkOpen(false)} style={{cursor: 'pointer'}}>esc</kbd>
          </div>
          <div id="cmdk-results" className="cmdk-results">
             {/* 검색 결과 렌더링 영역 */}
          </div>
          <div className="cmdk-foot">
            <span><kbd>↑</kbd><kbd>↓</kbd> {T.move}</span>
            <span><kbd>↵</kbd> {T.run}</span>
            <span onClick={() => setCmdkOpen(false)} style={{cursor: 'pointer'}}><kbd>esc</kbd> {T.close}</span>
          </div>
        </div>
      </div>
    </>
  );
}
