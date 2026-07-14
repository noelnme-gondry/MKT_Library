"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { IA, SECTIONS } from "@/store/useDataStore";
import { idToSlug, hasEnVersion } from "@/lib/routeMap";
import { trItemTitle, trGroupTitle } from "@/lib/enNavCopy";
import { useAppStore } from "@/store/useDataStore";

// "내 데이터로 분석 시작" 진입 게이트 — 데모 없이 어떤 분석부터 할지 고르는 페이지.
// 진입 시 demoDisabled=true(세션) → 어느 도구로 가도 데모 자동로드 없이 빈 업로드
// 화면. "예시부터 둘러보기"를 고르면 demoDisabled=false로 되돌리고 대시보드 데모로.
const ANALYSIS_SECTION = SECTIONS.find((s) => s.id === "analysis");
const OPS_GROUP_IDS = new Set(ANALYSIS_SECTION ? ANALYSIS_SECTION.groups : []);
const DATA_GUIDE_GROUP = "08";

const COPY = {
  ko: {
    eyebrow: "내 데이터로 시작",
    title: "어떤 분석부터 할까요?",
    deck: "샘플 없이 바로 내 데이터로 시작합니다. 원하는 분석을 고르면 업로드 화면으로 이동합니다.",
    demoLink: "먼저 예시(데모)로 둘러볼래요 →",
    open: "이 분석 시작 →",
  },
  en: {
    eyebrow: "Start with your data",
    title: "Which analysis first?",
    deck: "Start straight from your own data (no sample). Pick an analysis and you'll go to its upload screen.",
    demoLink: "I'd rather browse the demo first →",
    open: "Start this →",
  },
};

export default function StartGate({ locale = "ko" }) {
  const C = COPY[locale] || COPY.ko;
  const router = useRouter();
  const setDemoDisabled = useAppStore((s) => s.setDemoDisabled);
  const startMyData = useAppStore((s) => s.startMyData);

  // 진입 = 내 데이터 의도 → 데모 자동로드 억제 + 이미 로드된 데모 슬라이스 비움.
  useEffect(() => {
    startMyData();
  }, [startMyData]);

  const groups = IA.filter((g) => OPS_GROUP_IDS.has(g.id) && g.id !== DATA_GUIDE_GROUP);
  const goTool = (id) => router.push(locale === "en" && hasEnVersion(id) ? `/en${idToSlug[id] || ""}` : idToSlug[id] || "/");
  const goDemo = () => { setDemoDisabled(false); router.push(locale === "en" ? "/en/dashboard" : "/dashboard"); };

  return (
    <>
      <div className="page-eyebrow">{C.eyebrow}</div>
      <h1 className="page-title">{C.title}</h1>
      <p className="page-deck">{C.deck}</p>

      {groups.map((g) => (
        <section key={g.id} className="block" style={{ marginTop: "1.2rem" }}>
          <h2 className="section-title" style={{ margin: "0 0 10px", border: "none", padding: 0 }}>
            {trGroupTitle(g.id, locale, g.title)}
          </h2>
          <div className="phase-grid">
            {g.items.filter((it) => !it.hidden).map((it) => (
              <a
                key={it.id}
                href="#"
                className="phase-card phase-card-tool"
                onClick={(e) => { e.preventDefault(); goTool(it.id); }}
                style={{ cursor: "pointer", textDecoration: "none" }}
              >
                <div className="phase-card-title">{trItemTitle(it.id, locale, it.title)}</div>
                {it.desc && <div className="phase-card-desc">{it.desc}</div>}
                <div className="phase-card-cta">{C.open}</div>
              </a>
            ))}
          </div>
        </section>
      ))}

      <div style={{ marginTop: "1.6rem", textAlign: "center" }}>
        <button type="button" onClick={goDemo} className="btn ghost" style={{ fontSize: "13px" }}>
          {C.demoLink}
        </button>
      </div>
    </>
  );
}
