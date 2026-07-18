"use client";
import React from "react";
import Link from "next/link";
import { IA, SECTIONS } from "@/store/useDataStore";
import { idToPath, hasEnVersion } from "@/lib/routeMap";
import { trGroupTitle, trGroupDesc, trItemTitle } from "@/lib/enNavCopy";

// 가이드 인덱스 — 블로그(`/blog`)처럼 자체 주소(`/guide`)를 갖는 SOP 목록 페이지.
// 예전엔 랜딩 track 상태(무주소)로만 떠서 뒤로가기가 깨졌음 → 실제 라우트로 승격.
// 개별 가이드는 이미 `/guide/*` 주소가 있어 여기선 그 링크만 모아 보여준다.
const GUIDE_SECTION = SECTIONS.find((s) => s.id === "guide");
const GUIDE_GROUP_IDS = new Set(GUIDE_SECTION ? GUIDE_SECTION.groups : []);
const STEP_ICONS = ["🧭", "🚀", "🎨", "📈"];

const COPY = {
  ko: {
    eyebrow: "운영 가이드",
    title: "어느 가이드를 보시겠어요?",
    deck: "셋업 → 운영 → 소재 → 운영 후 분석. 참고할 순서대로 나열했습니다. 각 문서는 앱 그대로, 실무 표준 절차(SOP)입니다.",
    itemsSuffix: "개 항목",
    open: "시작하기 →",
  },
  en: {
    eyebrow: "Operating guides",
    title: "Which guide do you need?",
    deck: "Setup → operation → creative → post-launch analysis, listed in a sensible order. Each doc is a practical standard operating procedure.",
    itemsSuffix: " items",
    open: "Open →",
  },
};

export default function GuideIndex({ locale = "ko" }) {
  const C = COPY[locale] || COPY.ko;
  const groups = IA.filter((g) => GUIDE_GROUP_IDS.has(g.id));
  const hrefFor = (id) => (locale === "en" && hasEnVersion(id) ? `/en${idToPath(id)}` : idToPath(id));

  return (
    <>
      <div className="page-eyebrow">{C.eyebrow}</div>
      <h1 className="page-title">{C.title}</h1>
      <p className="page-deck">{C.deck}</p>

      <div className="phase-grid" style={{ marginTop: "1.4rem" }}>
        {groups.map((g, idx) => {
          const gTitle = trGroupTitle(g.id, locale, g.title);
          const items = g.items.filter((it) => !it.hidden);
          return (
            <div key={g.id} className="phase-card" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px" }}>{STEP_ICONS[idx] || "📘"}</span>
                <div className="phase-card-title" style={{ margin: 0 }}>{gTitle}</div>
              </div>
              {g.desc && <div className="phase-card-desc" style={{ margin: 0 }}>{trGroupDesc(g.id, locale, g.desc)}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "2px" }}>
                {items.map((it) => (
                  <Link
                    key={it.id}
                    href={hrefFor(it.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      textDecoration: "none",
                      color: "var(--text-secondary)",
                      fontSize: "13px",
                      transition: "background 0.15s, color 0.15s",
                    }}
                    className="guide-index-item"
                  >
                    <span>{trItemTitle(it.id, locale, it.title)}</span>
                    <span aria-hidden style={{ color: "var(--text-muted)" }}>→</span>
                  </Link>
                ))}
              </div>
              <div className="phase-card-meta tnum" style={{ marginTop: "auto", color: "var(--text-muted)", fontSize: "11.5px" }}>
                {items.length}{C.itemsSuffix}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
