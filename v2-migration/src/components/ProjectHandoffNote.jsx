"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ProjectCreateGate from "@/components/ProjectCreateGate";
import { TOOL_GROUP, FALLBACK_DATA_GROUP } from "@/lib/toolGroups";
import { useAppStore } from "@/store/useDataStore";
import { hasPaidAccess } from "@/lib/subscription/entitlement";
import { trackProductEvent } from "@/lib/analytics";

/**
 * 이 결과를 프로젝트로 이어가기.
 *
 * 프로젝트 화면의 분석 선택기는 **같은 CSV 그룹의 도구만** 돌린다. 다른 grain을
 * 거기서 돌리려면 그룹 슬라이스를 갈아끼워야 하는데, 그게 업로드 소실 사고가 난
 * 자리다(§4.3 · PR #603·#608).
 *
 * 그래서 방향을 뒤집는다. 주간 패널 계열(5-18-*)처럼 프로젝트 화면이 못 돌리는
 * 분석은 **자기 화면에서 결과를 보고 여기서 프로젝트로 넘어간다.** 그 사실을
 * 화면에 적어 두는 것이 이 컴포넌트의 절반이다 — 못 하는 것을 말하지 않으면
 * 사용자는 없는 경로를 찾아 헤맨다.
 */
const COPY = {
  ko: {
    title: "이 결과를 프로젝트로 이어가기",
    body: "이 분석은 프로젝트 화면에서 직접 돌리지 않습니다. 데이터의 단위가 달라서예요. 여기서 결과를 확인하고 결정을 기록한 뒤, 프로젝트로 넘기면 다음 검토까지 이어집니다.",
    bodyPro: "여기서 결과를 확인하고 결정을 기록한 뒤 프로젝트로 넘기면 다음 검토까지 이어집니다.",
    cta: "프로젝트로 넘기기",
    open: "내 프로젝트 열기",
  },
  en: {
    title: "Continue this result in a project",
    body: "This analysis does not run inside the project screen because its data grain is different. Read the result here, record a decision, then carry it into a project to follow through at the next review.",
    bodyPro: "Read the result here, record a decision, then carry it into a project to follow through at the next review.",
    cta: "Carry into a project",
    open: "Open my projects",
  },
};

export default function ProjectHandoffNote({ toolId, locale = "ko" }) {
  const t = COPY[locale === "en" ? "en" : "ko"];
  const en = locale === "en";
  const router = useRouter();
  const entitlement = useAppStore((state) => state.entitlement);
  const [gateOpen, setGateOpen] = useState(false);
  const projectHref = en ? "/en/weekly-review" : "/weekly-review";

  // 프로젝트 화면이 실제로 돌릴 수 있는 그룹이면 이 안내는 거짓이 된다 —
  // 그 도구는 선택기에 이미 떠 있다. 파생으로 판정해 문구가 어긋나지 않게 한다.
  const projectGroup = TOOL_GROUP["weekly-review"] || FALLBACK_DATA_GROUP;
  const runsInProject = TOOL_GROUP[toolId] === projectGroup;
  const isPro = hasPaidAccess(entitlement);

  const go = () => {
    trackProductEvent("project_handoff_clicked", { locale, tool_id: toolId });
    router.push(projectHref);
  };

  return (
    <section className="project-handoff" aria-labelledby={`project-handoff-${toolId}`}>
      <h3 id={`project-handoff-${toolId}`}>{t.title}</h3>
      <p>{runsInProject ? t.bodyPro : t.body}</p>
      <div className="project-handoff__actions">
        {isPro
          ? <button type="button" className="btn primary" onClick={go}>{t.open}</button>
          : <button type="button" className="btn primary" onClick={() => setGateOpen(true)}>{t.cta}</button>}
      </div>
      <ProjectCreateGate locale={locale} open={gateOpen} onClose={() => setGateOpen(false)} onReady={() => { setGateOpen(false); go(); }} />
    </section>
  );
}
