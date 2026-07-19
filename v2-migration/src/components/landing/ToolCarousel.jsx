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
    <section className="landing-tool-rail">
      <div className="landing-tool-rail__head">
        <div><span className="landing-tool-rail__eyebrow">{tr("NEXT QUESTION", "NEXT QUESTION")}</span>
        <h2 className="landing-tool-rail__title">
          {title}
        </h2></div>
        <div className="landing-tool-rail__controls">
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
          // scroll-snap mandatory는 드래그를 매 프레임 카드 경계로 잡아채 "뚝뚝" 끊김 →
          // 제거하고 자유 스크롤(밀리는 느낌). 화살표는 scrollBy smooth로 부드럽게.
          // 위: 호버로 카드가 떠올라도 안 잘리게 여유. 아래: 스크롤바 자리.
          padding: "12px 2px 16px",
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
            className="landing-tool-card"
          >
            <div className="landing-tool-card__head">
              <div style={{ minWidth: 0 }}>
                <div className="landing-tool-card__eyebrow">
                  {c.eyebrow}
                </div>
                <div className="landing-tool-card__question">
                  {c.headline}
                </div>
              </div>
              <span aria-hidden className="landing-tool-card__plus">+</span>
            </div>

            <div className="landing-tool-card__visual">
              {c.id === liveCardId
                ? <LiveMiniChart title={c.mockTitle} />
                : <ToolCardMock type={TOOL_MOCK_TYPE[c.id] || "kpiLine"} title={c.mockTitle} />}
            </div>

            <div className="landing-tool-card__cta">{ctaLabel}<span aria-hidden>→</span></div>
          </button>
        ))}
      </div>
    </section>
  );
}
