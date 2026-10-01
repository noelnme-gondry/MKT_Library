"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, FolderPlus, X } from "lucide-react";
import ModalDialog from "@/components/ds/ModalDialog";
import ToolConnections from "@/components/ToolConnections";
import ToolLongform from "@/components/ToolLongform";
import ToolEvidenceLinks from "@/components/ToolEvidenceLinks";
import ProjectHandoffNote from "@/components/ProjectHandoffNote";

export default function ToolNextStepPanel({ toolId, locale, evidenceLinks, hasHandoff }) {
  const [panel, setPanel] = useState(null);
  const triggerRef = useRef(null);
  const en = locale === "en";
  const references = en ? "Method and references" : "분석 방법과 참고 자료";
  const project = en ? "Continue in a project" : "프로젝트로 이어가기";
  const open = (event, next) => { triggerRef.current = event.currentTarget; setPanel(next); };
  return <section className="tool-next-step-panel" aria-label={en ? "Next analysis" : "다음 분석"}>
    <ToolConnections toolId={toolId} locale={locale} compact />
    <div className="tool-next-step-panel__actions">
      <button type="button" className="btn ghost" onClick={event => open(event, "references")}><BookOpen size={16} aria-hidden="true" />{references}</button>
      {hasHandoff && <button type="button" className="btn ghost" onClick={event => open(event, "project")}><FolderPlus size={16} aria-hidden="true" />{project}</button>}
      <Link href={en ? "/en/start" : "/start"}>{en ? "Find other analyses" : "다른 분석 찾기"}</Link>
    </div>
    <ModalDialog open={panel !== null} onClose={() => setPanel(null)} returnFocusRef={triggerRef} ariaLabel={panel === "project" ? project : references} overlayClassName="tutorial-overlay" panelClassName="tool-reference-panel">
      <header className="tool-reference-panel__head"><h2>{panel === "project" ? project : references}</h2><button type="button" className="btn ghost" aria-label={en ? "Close" : "닫기"} onClick={() => setPanel(null)}><X size={20} aria-hidden="true" /></button></header>
      {panel === "references" && <><ToolLongform toolId={toolId} locale={locale} /><ToolEvidenceLinks items={evidenceLinks} locale={locale} /></>}
      {panel === "project" && <ProjectHandoffNote toolId={toolId} locale={locale} />}
    </ModalDialog>
  </section>;
}
