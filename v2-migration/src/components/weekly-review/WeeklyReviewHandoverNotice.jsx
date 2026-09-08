"use client";

/**
 * `/weekly-review`의 의미가 바뀐 것을 도치가 한 번 알린다(명세 §1.2).
 *
 * **결정이 1건 이상 저장된 사용자에게만** 뜬다. 새 사용자에게 없어진 화면을 설명하는 것은
 * 소음이다.
 *
 * 열림은 **렌더 파생**이다 — effect에서 setState로 열면 안 된다(§5 set-state-in-effect).
 * 저장소 판정은 `lib/weeklyReviewHandover.js`가 모듈에 굳힌 스냅샷이 소유한다. 스냅샷이
 * 저장소를 매번 다시 읽으면, 안내가 열리며 세션 표식을 남기는 순간 false로 뒤집혀 스스로
 * 닫힌다(기존 도치 온보딩에서 이미 겪은 함정).
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import DochiSprite from "@/components/assistant/DochiSprite";
import {
  handoverServerSnapshot,
  markHandoverSessionSeen,
  readHandoverStorageSnapshot,
  subscribeHandover,
  writeHandoverDismissed,
} from "@/lib/weeklyReviewHandover";

const COPY = {
  ko: {
    title: "결정 검토함이 여기로 들어왔어요.",
    body: "이제 매주 데이터를 올리면 지난 결정의 결과까지 한 번에 확인할 수 있어요.",
    keep: (n) => `지금까지 저장한 결정 ${n}건은 그대로 있습니다.`,
    go: "지난 결정 보기",
    ok: "알겠어요",
    close: "닫기",
  },
  en: {
    title: "The decision log now lives here.",
    body: "Upload your data each week and you'll see how last week's decision turned out, in the same place.",
    keep: (n) => `Your ${n} saved decisions are still here.`,
    go: "See past decisions",
    ok: "Got it",
    close: "Close",
  },
};

export default function WeeklyReviewHandoverNotice({ locale = "ko", decisionCount = 0 }) {
  const t = COPY[locale] || COPY.ko;
  const storageAllows = useSyncExternalStore(
    subscribeHandover,
    readHandoverStorageSnapshot,
    handoverServerSnapshot,
  );
  const dialogRef = useRef(null);
  const [closed, setClosed] = useState(false);

  const open = storageAllows && decisionCount >= 1 && !closed;

  // 열린 사실을 저장소에 남기는 것은 사이드이펙트다 — 열림 판정 자체는 렌더에서 끝난다.
  useEffect(() => {
    if (open) markHandoverSessionSeen();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const buttons = [...dialog.querySelectorAll("button")];
    buttons[0].focus();
    const onKey = (event) => {
      if (event.key === "Escape") setClosed(true);
      if (event.key === "Tab") {
        const index = buttons.indexOf(document.activeElement);
        event.preventDefault();
        buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length].focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (document.activeElement === document.body || dialog.contains(document.activeElement)) previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;

  const dismissForever = () => {
    writeHandoverDismissed();
    setClosed(true);
  };

  const openHistory = () => {
    dismissForever();
    const details = document.querySelector(".wr-history");
    if (details) {
      details.open = true;
      details.querySelector("summary")?.focus();
      details.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div
      ref={dialogRef}
      className="wr-handover"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wr-handover-title"
      onClick={(event) => { if (event.target === event.currentTarget) setClosed(true); }}
    >
      <div className="wr-handover__box">
        <DochiSprite pose="point-up" className="wr-handover__dochi" />
        <div className="wr-handover__body">
          <p className="wr-handover__title" id="wr-handover-title">{t.title}</p>
          <p className="wr-handover__text">{t.body}</p>
          <p className="wr-handover__keep">{t.keep(decisionCount)}</p>
        </div>
        <button type="button" className="wr-handover__x" onClick={() => setClosed(true)} aria-label={t.close}>×</button>
        <div className="wr-handover__acts">
          <button type="button" className="btn primary" onClick={openHistory}>{t.go}</button>
          <button type="button" className="btn" onClick={dismissForever}>{t.ok}</button>
        </div>
      </div>
    </div>
  );
}
