"use client";
import ModalDialog from "@/components/ds/ModalDialog";

// 분석이 끝난 도구에서 데이터·매핑을 고치는 곳. 결과 위에 매핑표를 펼쳐 두면 폰에서 결론이
// 3,000~4,900px 아래로 밀렸다(2026-09-24 실측). 제품 SSOT §4는 접기·펼치기 대신 "이름이
// 분명한 별도 편집 화면"을 쓰라고 하므로, 결과가 있을 때는 한 줄 요약 + 이 대화상자로 고친다.
// asDialog가 false(아직 분석 전)면 자식을 그 자리에 그대로 그린다 — 분석 전에는 매핑이 할 일이다.
export default function MappingEditorDialog({ asDialog, open, onClose, locale = "ko", children }) {
  if (!asDialog) return children;
  if (!open) return null;
  const en = locale === "en";
  return (
    <ModalDialog open onClose={onClose} ariaLabel={en ? "Edit data and mappings" : "데이터·매핑 편집"} overlayClassName="tutorial-overlay" panelClassName="decision-editor-panel">
      <header className="mapping-editor-dialog__head">
        <h2>{en ? "Edit data and mappings" : "데이터·매핑 편집"}</h2>
        <button type="button" className="btn" onClick={onClose}>{en ? "Close" : "닫기"}</button>
      </header>
      {children}
    </ModalDialog>
  );
}

// 결과 위에 남는 한 줄: 무엇을 읽었는지 + 편집 창 열기.
export function AnalyzedDataLine({ name, detail, onEdit, locale = "ko", id }) {
  const en = locale === "en";
  return (
    <section className="block csv-uploader csv-uploader--collapsed" id={id}>
      <p className="csv-collapsed-summary"><strong>{name}</strong><span className="tnum">{detail}</span></p>
      <button type="button" className="btn ghost csv-collapsed-edit" onClick={onEdit}>{en ? "Change data or mapping" : "데이터·매핑 바꾸기"}</button>
    </section>
  );
}
