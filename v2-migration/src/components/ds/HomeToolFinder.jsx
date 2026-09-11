"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChartNoAxesCombined, TrendingUp, Wallet, Palette, Store, FlaskConical, Network, Bookmark } from "lucide-react";
import { toolIndexByStage } from "@/lib/toolIndex";
import { localizedHref } from "@/lib/localizedHref";

import { readSavedTools, parseSavedTools, subscribeSavedTools, toggleSavedTool, savedToolsServerSnapshot } from "@/lib/savedTools";

const QUESTION_ICONS = {
  monitor: ChartNoAxesCombined,
  baseline: TrendingUp,
  budget: Wallet,
  creative: Palette,
  store: Store,
  prove: FlaskConical,
  contribution: Network,
};

export default function HomeToolFinder({ locale = "ko", onItemClick }) {
  const searchInput = useRef(null);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [saveError, setSaveError] = useState(false);
  const savedIds = parseSavedTools(useSyncExternalStore(subscribeSavedTools, readSavedTools, savedToolsServerSnapshot));
  const en = locale === "en";
  const stages = toolIndexByStage(locale);
  const allTools = stages.flatMap(stage => stage.tools);
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const tools = terms.length ? allTools.filter(tool => {
    const text = [tool.name, tool.question, tool.answer, tool.searchText, ...tool.outputs, ...tool.needs].join(" ").toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  }) : selected === "saved" ? allTools.filter(tool => savedIds.includes(tool.id)) : stages.filter(stage => selected === "all" || stage.id === selected).flatMap(stage => stage.tools);
  const isOpen = Boolean(selected || terms.length);
  const savedCount = allTools.filter(tool => savedIds.includes(tool.id)).length;
  return <div className="home-tool-finder" data-searching={terms.length > 0}>
    <div className="home-tool-finder__search">
      <label htmlFor="home-tool-search">{en ? "Find an analysis" : "필요한 분석 찾기"}</label>
      <input ref={searchInput} id="home-tool-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={en ? "Search a question or metric, e.g. ROAS" : "질문이나 지표로 검색 · 예: ROAS"} aria-controls="home-tool-results" />
    {terms.length > 0 && <button type="button" className="btn" onClick={() => { setQuery(""); setSelected(null); searchInput.current?.focus(); }}>{en ? "Clear search" : "검색 지우기"}</button>}
      <button type="button" aria-pressed={selected === "saved" && !terms.length} onClick={() => { setQuery(""); setSelected(selected === "saved" ? null : "saved"); }}>
        <Bookmark size={18} aria-hidden="true" /> {en ? "Saved tools" : "저장한 도구"} ({savedCount})
      </button>
    </div>
    <div hidden={terms.length > 0} className="home-tool-finder__purposes" role="group" aria-label={en ? "Choose a purpose" : "목적 선택"}>
      {stages.map(purpose => {
        const Icon = QUESTION_ICONS[purpose.id];
        return <button type="button" key={purpose.id} aria-expanded={selected === purpose.id && !terms.length} aria-controls="home-tool-results" onClick={() => { setQuery(""); setSelected(selected === purpose.id ? null : purpose.id); }}>
          <Icon className="home-tool-finder__icon" size={24} strokeWidth={1.75} aria-hidden="true" />
          <strong>{purpose.homeQuestion}</strong><span>{purpose.tools.map(tool => tool.name).join(" · ")}</span>
        </button>;
      })}
    </div>
    <button hidden={terms.length > 0} className="dc-text-link dc-text-link--button" type="button" aria-expanded={selected === "all"} aria-controls="home-tool-results" onClick={() => { setQuery(""); setSelected(selected === "all" ? null : "all"); }}>
      {selected === "all" ? (en ? "Close all tools" : "전체 도구 접기") : (en ? "View all tools" : "전체 도구 보기")}
    </button>
    <div id="home-tool-results" hidden={!isOpen}>
      {isOpen && <div className="home-tool-finder__result-header"><h3>{terms.length ? (en ? "Search results" : "검색 결과") : selected === "saved" ? (en ? "Saved tools" : "저장한 도구") : (en ? "Available analyses" : "선택할 수 있는 분석")}</h3><p role="status">{en ? `${tools.length} tools` : `${tools.length}개 도구`}</p></div>}
      {selected === "saved" && !terms.length && <p>{en ? "Saved in this browser only. Save tools you want to use again." : "이 브라우저에만 저장됩니다. 다시 쓸 도구를 저장해 두세요."}</p>}
      {saveError && <p role="alert">{en ? "Could not save. Allow browser storage and try again." : "저장하지 못했습니다. 브라우저 저장 설정을 확인하고 다시 시도하세요."}</p>}
      {!tools.length && <p>{terms.length ? (en ? "No matching tools. Try another metric or choose a question above." : "검색 결과가 없습니다. 다른 지표를 입력하거나 위의 질문을 골라보세요.") : (en ? "No saved tools yet. Open all tools and select Save." : "아직 저장한 도구가 없습니다. 전체 도구에서 저장 버튼을 눌러보세요.")}</p>}
      <ul className="home-tool-finder__results">
        {tools.map(tool => <li key={tool.id} className="home-tool-finder__tool">
          <div className="home-tool-finder__tool-heading">
            <h3>{tool.name}</h3>
            <p>{tool.question}</p>
          </div>
          <dl>
            <div><dt>{en ? "What you get" : "확인할 결과"}</dt><dd>{tool.answer || tool.outputs.join(" · ")}</dd></div>
            <div className="home-tool-finder__data"><dt>{en ? "Data to prepare" : "준비할 데이터"}</dt><dd>{tool.needs.length ? <ul>{tool.needs.map(need => <li key={need}>{need}</li>)}</ul> : (en ? "Check input options in the tool" : "도구에서 입력 방법 확인")}</dd></div>
          </dl>
          <div className="home-tool-finder__actions">
            <Link className="home-tool-finder__open" href={localizedHref(tool.href, locale)} onClick={() => onItemClick?.(tool.id)} aria-label={`${en ? "Open" : "분석 열기"}: ${tool.name}`}>
              {en ? "Open analysis" : "분석 열기"}
            </Link>
            <button type="button" aria-label={`${en ? "Save" : "저장"}: ${tool.name}`} aria-pressed={savedIds.includes(tool.id)} onClick={() => setSaveError(!toggleSavedTool(tool.id))}>
              <Bookmark size={16} fill={savedIds.includes(tool.id) ? "currentColor" : "none"} aria-hidden="true" />{savedIds.includes(tool.id) ? (en ? "Saved" : "저장됨") : (en ? "Save" : "저장")}
            </button>
          </div>
        </li>)}
      </ul>
    </div>
  </div>;
}
