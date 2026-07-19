"use client";
import React, { useRef } from "react";
import Link from "next/link";

const TOOL_CARD_SAMPLE = {
  "5-2": { label: ["Weekly brief", "주간 브리핑"], value: "CPA ₩8,240", delta: "−6.1%", rows: [["ROAS", 78, "214%"], ["Pacing", 61, "94%"], ["Anomaly", 18, "1 alert"]] },
  "5-21": { label: ["Variance explained", "변동 설명"], value: "+₩790", delta: "100%", rows: [["Meta rate", 82, "+₩510"], ["Mix", 51, "+₩380"], ["Google", 20, "−₩100"]] },
  "5-22": { label: ["Scale headroom", "증액 여력"], value: "+18%", delta: "Google", rows: [["Google", 76, "room"], ["Meta", 36, "hold"], ["TikTok", 18, "low data"]] },
  "5-3": { label: ["Budget move", "예산 이동"], value: "+₩8.4M", delta: "Google", rows: [["Google", 82, "+10%"], ["Meta", 43, "hold"], ["TikTok", 24, "−6%"]] },
  "5-4": { label: ["Experiment readout", "실험 판독"], value: "B +8.2%", delta: "p=.018", rows: [["Power", 84, "84%"], ["95% CI", 64, "+1.4–15%"], ["SRM", 12, "clear"]] },
  "5-23": { label: ["Incremental lift", "순증분 효과"], value: "+12.4%", delta: "+1,284", rows: [["Treatment", 74, "+18%"], ["Control", 39, "+5.6%"], ["CI", 58, "7–18%"]] },
  "5-18": { label: ["MMM scenario", "MMM 시나리오"], value: "+9.8%", delta: "4 weeks", rows: [["Model fit", 81, "R² .81"], ["Google", 72, "scale"], ["Meta", 46, "hold"]] },
  "5-20": { label: ["Aha signal", "Aha 신호"], value: "2.3× lift", delta: "3 days", rows: [["Onboarding ×2", 83, "F1 .68"], ["Search ×1", 54, "1.7×"], ["Share ×1", 31, "1.2×"]] },
  "9-6": { label: ["Creative queue", "소재 교체 큐"], value: "2 replace", delta: "4 / week", rows: [["UGC_07", 88, "CTR −31%"], ["STATIC_12", 70, "CPA +24%"], ["UGC_03", 24, "keep"]] },
  "9-1": { label: ["Element effect", "요소별 효과"], value: "+14.2%", delta: "Hook A", rows: [["Hook A", 79, "+14.2%"], ["Short form", 58, "+8.1%"], ["CTA end", 25, "unclear"]] },
};

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
  const guardedPick = (event, id) => {
    if (drag.current.moved) {
      event.preventDefault();
      drag.current.moved = false;
      return;
    }
    onPick(id);
  };

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
        {cards.map((c) => {
          const sample = TOOL_CARD_SAMPLE[c.id] || TOOL_CARD_SAMPLE["5-2"];
          return (
          <Link
            key={c.id}
            data-carousel-card
            href={c.href}
            onClick={(event) => guardedPick(event, c.id)}
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
              <div className="tool-card-sample__head"><span>{sample.label[locale === "en" ? 0 : 1]}</span><em>{c.id === liveCardId ? "SAMPLE" : c.id}</em></div>
              <div className="tool-card-sample__result"><strong>{sample.value}</strong><small>{sample.delta}</small></div>
              <div className="tool-card-sample__rows">
                {sample.rows.map(([label, width, value]) => <div key={label}><span><b>{label}</b><em>{value}</em></span><i><b style={{ width: `${width}%` }}></b></i></div>)}
              </div>
            </div>

            <div className="landing-tool-card__cta">{ctaLabel}<span aria-hidden>→</span></div>
          </Link>
        );})}
      </div>
    </section>
  );
}
