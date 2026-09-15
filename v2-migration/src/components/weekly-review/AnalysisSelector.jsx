"use client";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ANALYSIS_CONTRACTS, evaluateEligibility, formatEligibilityBlocker } from "@/lib/analysis-router/evaluateEligibility";
import { TOOL_GROUP } from "@/lib/toolGroups";
import { toolIndexEntry } from "@/lib/toolIndex";
import { isRoutePublished } from "@/lib/routeMap";
import { useAppStore } from "@/store/useDataStore";
import { trackProductEvent } from "@/lib/analytics";

/**
 * 이 데이터로 할 수 있는 분석을 고르고, 고른 것만 돌린다.
 *
 * 예전에는 프로젝트 화면이 5-2 하나를 자동으로 돌리고 끝이었다. 어떤 분석이
 * 가능한지는 `evaluateEligibility`가 이미 알고 있었는데 **이 화면에 붙어 있지
 * 않아서** 사용자에게는 보이지 않았다(§16 — 신호를 만들고 읽는 곳을 안 배선).
 *
 * 목록은 `ANALYSIS_CONTRACTS`에서 파생한다. 손으로 쓴 배열을 돌면 도구가 늘 때
 * 조용히 빠진다(§7).
 *
 * 같은 CSV 그룹의 도구만 고를 수 있다. 다른 grain의 도구를 여기서 돌리려면
 * 그룹 슬라이스를 갈아끼워야 하는데, 그건 업로드 소실 사고가 난 자리다(§4.3).
 * 못 하는 것은 못 한다고 말하고 그 도구의 화면으로 보낸다.
 */
const TOOL_COMPONENTS = {
  "5-2": dynamic(() => import("@/components/Dashboard")),
  "5-3": dynamic(() => import("@/components/tools/BudgetAllocation")),
  "5-21": dynamic(() => import("@/components/tools/CampaignPvm")),
  "5-22": dynamic(() => import("@/components/tools/MarketingEfficiency")),
};

const COPY = {
  ko: {
    title: "이 데이터로 할 수 있는 분석",
    lead: "돌릴 분석을 고르세요. 여러 개를 함께 고를 수 있습니다.",
    run: (count) => count ? `분석 시작 (${count}개)` : "분석 시작",
    none: "고른 분석이 없습니다.",
    blocked: "데이터 보완 필요",
    resultsTitle: "분석 결과",
    collapse: "접기",
    expand: "펼치기",
    changeSelection: "분석 다시 고르기",
    empty: "지금 올린 데이터로 돌릴 수 있는 분석이 없습니다. 매핑을 먼저 확인해 주세요.",
    otherGrain: "데이터 단위가 다른 분석(주간 패널·증분·소재 등)은 여기서 돌지 않습니다. 그 도구 화면에서 결과를 본 뒤 ‘프로젝트로 넘기기’로 이어 오세요.",
  },
  en: {
    title: "Analyses available for this data",
    lead: "Choose what to run. You can select more than one.",
    run: (count) => count ? `Run analysis (${count})` : "Run analysis",
    none: "Nothing selected yet.",
    blocked: "More data needed",
    resultsTitle: "Results",
    collapse: "Collapse",
    expand: "Expand",
    changeSelection: "Change selection",
    empty: "No analysis can run on this data yet. Check the mapping first.",
    otherGrain: "Analyses on a different data grain (weekly panel, incrementality, creatives) do not run here. Read the result on that tool's page, then use ‘Carry into a project’ to bring it back.",
  },
};

export default function AnalysisSelector({ locale = "ko" }) {
  const t = COPY[locale === "en" ? "en" : "ko"];
  const csvData = useAppStore((state) => state.csvData);
  const activeDataGroup = useAppStore((state) => state.activeDataGroup);
  const [selected, setSelected] = useState(() => new Set(["5-2"]));
  const [running, setRunning] = useState([]);
  const [openId, setOpenId] = useState("");

  const candidates = useMemo(() => {
    if (!csvData?.raw?.length) return [];
    return Object.keys(ANALYSIS_CONTRACTS)
      // 같은 그룹 + 발행된 도구 + 이 화면이 실제로 마운트할 수 있는 컴포넌트가 있는 것.
      .filter((id) => TOOL_GROUP[id] === activeDataGroup && isRoutePublished(id) && TOOL_COMPONENTS[id])
      .map((id) => {
        const eligibility = evaluateEligibility({ mapping: csvData.mapping, canonicalData: csvData.canonicalData, toolId: id, locale });
        const entry = toolIndexEntry(id, locale);
        return {
          id,
          name: entry?.name || id,
          question: entry?.question || "",
          ready: eligibility.status !== "blocked",
          blocker: formatEligibilityBlocker(eligibility, locale),
          priority: ANALYSIS_CONTRACTS[id].priority ?? 99,
        };
      })
      .sort((left, right) => left.priority - right.priority);
  }, [csvData, activeDataGroup, locale]);

  if (!candidates.length) return null;

  const toggle = (id) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const start = () => {
    const ids = candidates.filter((item) => item.ready && selected.has(item.id)).map((item) => item.id);
    setRunning(ids);
    // 한 번에 여러 개를 펴면 어느 것을 읽는지 알 수 없다. 첫 번째만 펴고 나머지는 접는다.
    setOpenId(ids[0] || "");
    trackProductEvent("analysis_batch_started", { locale, count: ids.length, tool_ids: ids.join(",") });
  };

  const readySelected = candidates.filter((item) => item.ready && selected.has(item.id)).length;

  return (
    <section className="analysis-selector" aria-labelledby="analysis-selector-title">
      <h2 id="analysis-selector-title">{running.length ? t.resultsTitle : t.title}</h2>
      {!running.length && <>
        <p className="analysis-selector__lead">{t.lead}</p>
        <ul className="analysis-selector__options">
          {candidates.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`analysis-selector__option${selected.has(item.id) ? " is-selected" : ""}`}
                aria-pressed={selected.has(item.id)}
                disabled={!item.ready}
                onClick={() => toggle(item.id)}
              >
                <strong>{item.name}</strong>
                {item.question && <span>{item.question}</span>}
                {/* 못 쓰는 도구는 숨기지 않고 흐리게 둔다 — 숨기면 존재 자체를 못 본다(§12.31). */}
                {!item.ready && <em>{item.blocker || t.blocked}</em>}
              </button>
            </li>
          ))}
        </ul>
        <div className="analysis-selector__actions">
          <button type="button" className="btn primary" disabled={!readySelected} onClick={start}>{t.run(readySelected)}</button>
          {!readySelected && <span className="analysis-selector__hint">{t.none}</span>}
        </div>
        {/* 여기서 못 돌리는 분석이 있다는 사실을 적어 둔다. 말하지 않으면
            사용자는 없는 경로를 찾아 헤맨다(§8 — 못 하는 것은 못 한다고). */}
        <p className="analysis-selector__hint">{t.otherGrain}</p>
      </>}

      {running.length > 0 && <>
        <div className="analysis-selector__actions">
          <button type="button" className="btn" onClick={() => { setRunning([]); setOpenId(""); }}>{t.changeSelection}</button>
        </div>
        {/* 분석 하나당 접기 하나. 4~5개를 골라도 버튼 하나로 하나씩 관리된다. */}
        {running.map((id) => {
          const Tool = TOOL_COMPONENTS[id];
          const entry = candidates.find((item) => item.id === id);
          const open = openId === id;
          return (
            <section key={id} className="analysis-selector__result">
              <button
                type="button"
                className="analysis-selector__result-toggle"
                aria-expanded={open}
                onClick={() => setOpenId(open ? "" : id)}
              >
                <strong>{entry?.name || id}</strong>
                <span>{open ? t.collapse : t.expand}</span>
              </button>
              {/* 닫으면 언마운트한다 — 무거운 도구 넷을 동시에 붙들고 있으면 메인
                  스레드가 멈춘다(§7 무거운 compute). 다시 열면 게이트 뒤 캐시가 산다. */}
              {open && <div className="analysis-selector__result-body"><Tool locale={locale} /></div>}
            </section>
          );
        })}
      </>}
    </section>
  );
}
