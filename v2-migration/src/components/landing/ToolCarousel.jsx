"use client";
import React, { useRef } from "react";
import ToolCardMock, { TOOL_MOCK_TYPE } from "./ToolCardMock";
import LiveMiniChart from "./LiveMiniChart";

// 랜딩 질문 캐러셀(Semrush 히어로 참조) — 도구를 "질문 카드"로 가로 슬라이드.
// 카드: 카테고리 eyebrow + 볼드 질문 헤드라인 + "+" + 제품 목업. 클릭 → 해당
// 대시보드. 목업은 CSS/SVG(ToolCardMock) 기본, liveCardId 1개만 실제 Chart.js
// (LiveMiniChart, 옵션4 비교 샘플).
export default function ToolCarousel({ cards, title, onPick, ctaLabel, liveCardId = "5-2", locale = "ko" }) {
  const scrollRef = useRef(null);
  const tr = (ko, en) => (locale === "en" ? en : ko);
  // 마우스 드래그 좌우 스크롤 상태(드래그 후 클릭 오발화 방지 위해 moved 추적).
  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: false });

  const scrollByCards = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector("[data-carousel-card]");
    const step = card ? card.offsetWidth + 20 : 360;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const onDown = (e) => {
    const el = scrollRef.current;
    if (!el) return;
    drag.current = { down: true, startX: e.clientX, startLeft: el.scrollLeft, moved: false };
    el.style.cursor = "grabbing";
    el.style.scrollBehavior = "auto"; // 드래그 중엔 즉시 반영(smooth 끊김 방지)
  };
  const onMove = (e) => {
    if (!drag.current.down) return;
    e.preventDefault();
    const el = scrollRef.current;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.startLeft - dx;
  };
  const endDrag = () => {
    const el = scrollRef.current;
    drag.current.down = false;
    if (el) { el.style.cursor = "grab"; el.style.scrollBehavior = ""; }
  };
  // 드래그로 스크롤한 뒤엔 카드 클릭(도구 진입)을 막는다.
  const guardedPick = (id) => { if (drag.current.moved) { drag.current.moved = false; return; } onPick(id); };

  return (
    <section style={{ marginTop: "2.5rem" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", marginBottom: "16px" }}>
        <h2 className="section-title" style={{ margin: 0, border: "none", padding: 0, maxWidth: "560px", lineHeight: 1.25 }}>
          {title}
        </h2>
        <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
          <button type="button" aria-label={tr("이전", "Previous")} onClick={() => scrollByCards(-1)} className="carousel-arrow">←</button>
          <button type="button" aria-label={tr("다음", "Next")} onClick={() => scrollByCards(1)} className="carousel-arrow">→</button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="carousel-track"
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        style={{
          display: "flex",
          gap: "20px",
          overflowX: "auto",
          // scroll-snap mandatory는 드래그를 매 프레임 카드 경계로 잡아채 "뚝뚝" 끊김 →
          // 제거하고 자유 스크롤(밀리는 느낌). 화살표는 scrollBy smooth로 부드럽게.
          // 위: 호버로 카드가 떠올라도 안 잘리게 여유. 아래: 스크롤바 자리.
          paddingTop: "12px",
          paddingBottom: "12px",
          scrollbarWidth: "none",
          cursor: "grab",
          userSelect: "none",
          scrollBehavior: "smooth",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {cards.map((c) => (
          <button
            key={c.id}
            data-carousel-card
            type="button"
            onClick={() => guardedPick(c.id)}
            draggable={false}
            style={{
              scrollSnapAlign: "start",
              flex: "0 0 auto",
              width: "360px",
              maxWidth: "82vw",
              textAlign: "left",
              cursor: "pointer",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "20px 20px 22px",
              background: "var(--surface-container-low, rgba(173,198,255,0.05))",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              transition: "transform 0.15s, box-shadow 0.15s, border-color 0.15s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.18)"; e.currentTarget.style.borderColor = "var(--primary, #adc6ff)"; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  {c.eyebrow}
                </div>
                <div style={{ fontSize: "17px", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.3, marginTop: "6px" }}>
                  {c.headline}
                </div>
              </div>
              <span aria-hidden style={{ flexShrink: 0, width: 30, height: 30, borderRadius: "50%", border: "1.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", color: "var(--text-secondary)" }}>+</span>
            </div>

            <div style={{ height: "168px" }}>
              {c.id === liveCardId
                ? <LiveMiniChart title={c.mockTitle} />
                : <ToolCardMock type={TOOL_MOCK_TYPE[c.id] || "kpiLine"} title={c.mockTitle} />}
            </div>

            <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--primary, #adc6ff)" }}>{ctaLabel}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
