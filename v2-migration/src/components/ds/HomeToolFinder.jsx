"use client";

import { useState } from "react";
import Link from "next/link";
import { toolIndexByStage } from "@/lib/toolIndex";
import { localizedHref } from "@/lib/localizedHref";

export default function HomeToolFinder({ locale = "ko", onItemClick }) {
  const [selected, setSelected] = useState(null);
  const en = locale === "en";
  const stages = toolIndexByStage(locale);
  const tools = stages.filter(stage => selected === "all" || stage.id === selected).flatMap(stage => stage.tools);
  return <div className="home-tool-finder">
    <div className="home-tool-finder__purposes" role="group" aria-label={en ? "Choose a purpose" : "목적 선택"}>
      {stages.map(purpose => <button type="button" key={purpose.id} aria-expanded={selected === purpose.id} aria-controls="home-tool-results" onClick={() => setSelected(selected === purpose.id ? null : purpose.id)}>
        <strong>{purpose.homeQuestion}</strong><span>{purpose.tools.map(tool => tool.name).join(" · ")}</span>
      </button>)}
    </div>
    <button className="dc-text-link dc-text-link--button" type="button" aria-expanded={selected === "all"} aria-controls="home-tool-results" onClick={() => setSelected(selected === "all" ? null : "all")}>
      {selected === "all" ? (en ? "Close all tools" : "전체 도구 접기") : (en ? "View all tools" : "전체 도구 보기")}
    </button>
    <div id="home-tool-results" hidden={!selected}>
      {selected && <p role="status">{en ? `${tools.length} tools` : `${tools.length}개 도구`}</p>}
      <ul className="home-tool-finder__results">
        {tools.map(tool => <li key={tool.id}><Link className="tool-index__link" href={localizedHref(tool.href, locale)} onClick={() => onItemClick?.(tool.id)}>
          <strong>{tool.name}</strong><span>{tool.question}</span>
        </Link></li>)}
      </ul>
    </div>
  </div>;
}
