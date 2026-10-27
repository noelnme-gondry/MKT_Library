"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Bookmark } from "lucide-react";
import ModalDialog from "@/components/ds/ModalDialog";
import AnalysisDataPrep from "@/components/finder/AnalysisDataPrep";
import { filterFinderCards, finderCards, finderSituations } from "@/lib/finder/analysisFinder";
import { localizedHref } from "@/lib/localizedHref";
import { trackProductEvent } from "@/lib/analytics";
import { parseSavedTools, readSavedTools, savedToolsServerSnapshot, subscribeSavedTools, toggleSavedTool } from "@/lib/savedTools";

/**
 * 분석 찾기 — 앱 안의 입구를 하나로 모은 화면(product-ssot §1.1c 결정 1).
 *
 * 위: 상황으로 찾기(7개 상황) | 파일로 찾기(aside — 이 화면의 주 행동인 업로드).
 * 아래: 분석 카드. 카드 한 장이 "이 분석을 쓰면 무엇을 받고, 무엇을 준비하면 되는지"를
 * 혼자 말한다 — 결론 예시(예시 데이터로 실제 계산한 문장) · 필요한 파일 · 예시 보고서 /
 * 내 파일로 하기 / 준비 방법 · 같은 파일로 되는 다른 분석.
 *
 * 카드 34장에 파란 버튼을 34개 두지 않는다 — 이 화면의 주 행동은 파일 놓기 하나다(design.md §2).
 */
const COPY = {
  ko: {
    situationTitle: "어떤 상황인가요?",
    all: "전체 보기",
    saved: "저장한 분석",
    count: (n) => `${n}개`,
    search: "분석 검색",
    searchPlaceholder: "질문·지표·파일 이름으로 검색 · 예: ROAS, 스토어",
    clear: "검색 지우기",
    results: (n) => `분석 ${n}개`,
    example: "예시 결론",
    answer: "보고서에 담기는 것",
    file: "필요한 파일",
    required: "필수",
    optional: "있으면 더 좋음",
    exampleCta: "예시 보고서 보기",
    toolCta: "내 파일로 하기",
    prep: "준비 방법",
    sameFile: "같은 파일로",
    more: (n) => `외 ${n}개`,
    save: "저장",
    savedHint: "이 브라우저에만 저장됩니다. 카드의 저장 버튼으로 다시 쓸 분석을 모아 두세요.",
    noSaved: "아직 저장한 분석이 없습니다.",
    noMatch: "맞는 분석이 없습니다. 다른 말로 찾거나 검색을 지우세요.",
    saveError: "저장하지 못했습니다. 브라우저 저장 설정을 확인하고 다시 시도하세요.",
    prepTitle: (name) => `준비 방법 · ${name}`,
    close: "닫기",
    exampleNote: "예시 데이터로 계산한 결과입니다.",
  },
  en: {
    situationTitle: "What is going on?",
    all: "Show all",
    saved: "Saved analyses",
    count: (n) => `${n}`,
    search: "Search analyses",
    searchPlaceholder: "Search a question, metric or file · e.g. ROAS, store",
    clear: "Clear search",
    results: (n) => `${n} analyses`,
    example: "Example conclusion",
    answer: "What the report shows",
    file: "File you need",
    required: "Required",
    optional: "Helpful",
    exampleCta: "View example report",
    toolCta: "Use my file",
    prep: "How to prepare",
    sameFile: "Same file",
    more: (n) => `+${n} more`,
    save: "Save",
    savedHint: "Saved in this browser only. Use the save button on a card to collect analyses you reuse.",
    noSaved: "No saved analyses yet.",
    noMatch: "No matching analysis. Try other words or clear the search.",
    saveError: "Could not save. Allow browser storage and try again.",
    prepTitle: (name) => `How to prepare · ${name}`,
    close: "Close",
    exampleNote: "Calculated on example data.",
  },
};

const SAME_FILE_SHOWN = 3;

function writeSituationToUrl(situation) {
  try {
    const url = new URL(window.location.href);
    if (situation === "all") url.searchParams.delete("situation");
    else url.searchParams.set("situation", situation);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch { /* 주소 동기화는 편의 기능이다 — 실패해도 화면 상태는 유지된다. */ }
}

export default function AnalysisFinder({ locale = "ko", initialSituation = "all", aside = null }) {
  const en = locale === "en";
  const T = COPY[en ? "en" : "ko"];
  const situations = useMemo(() => finderSituations(locale), [locale]);
  const cards = useMemo(() => finderCards(locale), [locale]);
  const [situation, setSituation] = useState(initialSituation);
  const [query, setQuery] = useState("");
  const [prepId, setPrepId] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const searchInput = useRef(null);
  const prepTrigger = useRef(null);
  const rootRef = useRef(null);
  const savedIds = parseSavedTools(useSyncExternalStore(subscribeSavedTools, readSavedTools, savedToolsServerSnapshot));
  const visible = filterFinderCards(cards, { situation, query, savedIds });
  const searching = query.trim().length > 0;
  // 전체 보기는 상황별로 묶어 읽게 한다. 검색·저장 목록은 상황이 섞이므로 평평하게 두고 카드에 상황을 적는다.
  const grouped = !searching && situation !== "saved";
  const groups = grouped
    ? situations
      .filter((item) => situation === "all" || item.id === situation)
      .map((item) => ({ ...item, cards: visible.filter((card) => card.situation.id === item.id) }))
      .filter((group) => group.cards.length > 0)
    : [{ id: "flat", cards: visible }];
  const prepCard = cards.find((card) => card.id === prepId) || null;

  // 홈의 상황 고르기는 #finder로 온다 — 클라이언트에서 그려지는 화면이라 브라우저 기본 스크롤이 닿지 않는다.
  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#finder") return;
    const frame = window.requestAnimationFrame(() => rootRef.current?.scrollIntoView({ block: "start" }));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const chooseSituation = (next) => {
    setSituation(next);
    writeSituationToUrl(next);
    trackProductEvent("finder_situation_selected", { locale, source: "analysis_finder", section_id: next });
  };
  const track = (name, card) => trackProductEvent(name, { locale, source: "analysis_finder", tool_id: card.id, section_id: card.situation.id });

  return (
    <section className="analysis-finder" id="finder" ref={rootRef} aria-label={en ? "Find an analysis" : "분석 찾기"}>
      <div className={`analysis-finder__entry${aside ? " has-aside" : ""}`}>
        <nav className="analysis-finder__situations" aria-labelledby="finder-situation-title">
          <h2 id="finder-situation-title">{T.situationTitle}</h2>
          <ul>
            {situations.map((item) => (
              <li key={item.id}>
                <button type="button" aria-pressed={situation === item.id} aria-controls="finder-results" onClick={() => chooseSituation(situation === item.id ? "all" : item.id)}>
                  <span className="analysis-finder__no" aria-hidden="true">{item.label}</span>
                  <strong>{item.title}</strong>
                  <small>{T.count(item.count)}</small>
                </button>
              </li>
            ))}
            <li className="analysis-finder__situation-extra">
              <button type="button" aria-pressed={situation === "all"} aria-controls="finder-results" onClick={() => chooseSituation("all")}>
                <strong>{T.all}</strong><small>{T.count(cards.length)}</small>
              </button>
            </li>
            <li className="analysis-finder__situation-extra">
              <button type="button" aria-pressed={situation === "saved"} aria-controls="finder-results" onClick={() => chooseSituation(situation === "saved" ? "all" : "saved")}>
                <Bookmark size={16} aria-hidden="true" /><strong>{T.saved}</strong><small>{T.count(savedIds.filter((id) => cards.some((card) => card.id === id)).length)}</small>
              </button>
            </li>
          </ul>
        </nav>
        {aside && <div className="analysis-finder__file">{aside}</div>}
      </div>

      <div className="analysis-finder__toolbar">
        <label htmlFor="finder-search">{T.search}</label>
        <div className="analysis-finder__search">
          <input ref={searchInput} id="finder-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={T.searchPlaceholder} aria-controls="finder-results" />
          {searching && <button type="button" className="btn" onClick={() => { setQuery(""); searchInput.current?.focus(); }}>{T.clear}</button>}
        </div>
        <p role="status" className="analysis-finder__count">{T.results(visible.length)}</p>
      </div>

      <div id="finder-results" className="analysis-finder__results">
        {situation === "saved" && !searching && <p className="analysis-finder__note">{T.savedHint}</p>}
        {saveError && <p role="alert" className="analysis-finder__note">{T.saveError}</p>}
        {visible.length === 0 && <p className="analysis-finder__note">{situation === "saved" && !searching ? T.noSaved : T.noMatch}</p>}
        {groups.map((group) => (
          <section className="analysis-finder__group" key={group.id} aria-labelledby={group.title ? `finder-group-${group.id}` : undefined} aria-label={group.title ? undefined : T.results(group.cards.length)}>
            {group.title && (
              <header className="analysis-finder__group-head">
                <h2 id={`finder-group-${group.id}`}><span className="analysis-finder__no">{group.label}</span> {group.title}</h2>
                <p>{group.description}</p>
              </header>
            )}
            <ul className="analysis-finder__cards">
              {group.cards.map((card) => {
                const saved = savedIds.includes(card.id);
                const moreSame = card.sameFile.length - SAME_FILE_SHOWN;
                return (
                  <li key={card.id} className="finder-card" data-tool-id={card.id}>
                    <div className="finder-card__head">
                      <h3 id={`finder-card-${card.id}`}>{card.name}</h3>
                      <button type="button" className="finder-card__save" aria-label={`${T.save}: ${card.name}`} aria-pressed={saved} onClick={() => setSaveError(!toggleSavedTool(card.id))}>
                        <Bookmark size={16} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
                      </button>
                    </div>
                    <p className="finder-card__question">{card.question}</p>
                    {(card.example || card.outputs.length > 0 || card.answer) && (
                      <p className={`finder-card__result${card.example ? " is-example" : ""}`}>
                        <span>{card.example ? T.example : T.answer}</span>
                        {card.example || (card.outputs.length ? card.outputs.join(" · ") : card.answer)}
                      </p>
                    )}
                    {card.source && (
                      <div className="finder-card__data">
                        <p><span>{T.file}</span><span><strong>{card.source.file}</strong> <small>{card.source.family}</small></span></p>
                        {card.required.length > 0 && <p><span>{T.required}</span><span>{card.required.join(" · ")}</span></p>}
                        {card.optional.length > 0 && <p><span>{T.optional}</span><span>{card.optional.join(" · ")}</span></p>}
                      </div>
                    )}
                    <div className="finder-card__actions">
                      {card.exampleHref && <Link className="btn secondary" href={card.exampleHref} onClick={() => track("finder_example_clicked", card)}>{T.exampleCta}</Link>}
                      <Link className="finder-card__tool" href={localizedHref(card.href, locale)} onClick={() => track("finder_tool_clicked", card)}>{T.toolCta} →</Link>
                      <button type="button" className="finder-card__prep" onClick={(event) => { prepTrigger.current = event.currentTarget; setPrepId(card.id); track("finder_prep_opened", card); }}>{T.prep}</button>
                    </div>
                    {card.sameFile.length > 0 && (
                      <p className="finder-card__same">
                        <span>{T.sameFile}</span>
                        {card.sameFile.slice(0, SAME_FILE_SHOWN).map((item, index) => (
                          <span key={item.id}>{index > 0 && " · "}<Link href={localizedHref(item.href, locale)}>{item.name}</Link></span>
                        ))}
                        {moreSame > 0 && <span> · {T.more(moreSame)}</span>}
                      </p>
                    )}
                    {!grouped && <p className="finder-card__situation">{card.situation.label} {card.situation.title}</p>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <ModalDialog open={Boolean(prepCard)} onClose={() => setPrepId(null)} returnFocusRef={prepTrigger} ariaLabel={prepCard ? T.prepTitle(prepCard.name) : T.prep} overlayClassName="tutorial-overlay" panelClassName="tool-reference-panel finder-prep-dialog">
        {prepCard && <>
          <header className="tool-reference-panel__head">
            <h2>{T.prepTitle(prepCard.name)}</h2>
            <button type="button" className="btn ghost" onClick={() => setPrepId(null)}>{T.close}</button>
          </header>
          <AnalysisDataPrep toolId={prepCard.id} locale={locale} exampleHref={prepCard.exampleHref} toolHref={localizedHref(prepCard.href, locale)} />
        </>}
      </ModalDialog>
    </section>
  );
}
