"use client";

import { useState } from "react";

export default function PlannerViews({ locale, diagnosis, execution, initial = "diagnosis" }) {
  const [view, setView] = useState(initial);
  const [visited, setVisited] = useState(() => new Set([initial]));
  const en = locale === "en";
  function select(next) {
    setVisited(previous => new Set([...previous, next]));
    setView(next);
  }
  return <div className="planner-views">
    <div className="planner-views__switch" role="group" aria-label={en ? "Planner workspace" : "운영 플래너 작업 선택"}>
      <button type="button" aria-pressed={view === "diagnosis"} onClick={() => select("diagnosis")}>{en ? "Campaign diagnosis" : "캠페인 효율 진단"}</button>
      <button type="button" aria-pressed={view === "execution"} onClick={() => select("execution")}>{en ? "Campaign plan & review" : "캠페인 집행 계획·기록"}</button>
    </div>
    <div hidden={view !== "diagnosis"}>{visited.has("diagnosis") && diagnosis}</div>
    <div hidden={view !== "execution"}>{visited.has("execution") && execution}</div>
  </div>;
}
