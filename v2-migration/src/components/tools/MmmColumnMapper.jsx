"use client";
import { useState } from "react";
import { autoGuessColMap, colMapMissing, mmmForecastInputWarnings, guessPlat, guessedStepMode } from "@/lib/data-import/mmmColumnMapping";

// 기존 호출자의 공개 API는 보존하고, 매핑/패널 구성은 React와 분리한다.
export { normalizePlatformValue, isOperationalDeliveryCostHeader, autoGuessColMap, colMapRoles, mmmForecastInputWarnings, colMapMissing, mmmPlatformTags, mmmSegmentValues, buildPanelFromColMap } from "@/lib/data-import/mmmColumnMapping";

const ZONES = [
  ["week", "주차(t) · 1개", "Week (t) · 1", false, false],
  ["date", "날짜 · 1개 (표시용)", "Date · 1 (for display)", false, false],
  ["reg", "가입 Regs", "Regs", false, true],
  ["paid", "Paid 가입 Regs (선택)", "Paid regs (optional)", false, true],
  ["react", "재활성 React", "Reactivation", false, true],
  ["traffic", "총유입 Traffic", "Total traffic", false, true],
  ["purchasers", "구매자 Purchasers", "Purchasers", false, true],
  ["revenue", "매출 Revenue", "Revenue", false, true],
  ["channel", "채널 spend (여러 개 · perf/brand · 플랫폼)", "Channel spend (many · perf/brand · platform)", true, true],
  ["geo", "GEO (선택 · 없으면 National-level)", "GEO (optional · National-level fallback)", false, false],
  ["reach", "Reach (선택 · RF)", "Reach (optional · RF)", false, true],
  ["frequency", "Frequency (선택 · RF)", "Frequency (optional · RF)", false, true],
  ["external", "연속형 컨트롤 (시장 수요·가격 지수 등 · 여러 개 · 플랫폼)", "Continuous controls (market demand, price index, etc. · many · platform)", false, true],
  ["dummy", "더미/이벤트 (0·1 · true/false · yes/no · on/off)", "Dummy/event (0/1 · true/false · yes/no · on/off)", false, true],
  ["step", "구조변화 step (상태열 또는 경계 pulse · 중단+재개 단일쌍은 기간 자동 생성)", "Structural step (state or boundary pulse · one shutdown/reopen pair derives the interval)", false, true],
  ["platform", "세그먼트/플랫폼 단일 컬럼 (선택 · 성별·플랫폼·국가 등 값별로 나눠보기)", "Segment/platform single column (optional · split by gender/platform/country, etc.)", false, false],
];

const MAPPER_CLEAR_BUTTON_STYLE = {
  display: "inline-grid",
  placeItems: "center",
  flex: "0 0 44px",
  width: "44px",
  minWidth: "44px",
  height: "44px",
  minHeight: "44px",
  border: 0,
  padding: 0,
  background: "transparent",
  cursor: "pointer",
  color: "var(--text-muted)",
  touchAction: "manipulation",
};

// 역할 영역의 설명은 Zone 제목에서 충분히 제공한다. select에는 조작에 필요한
// 짧은 역할명만 보여, 채널의 보조 control이 같은 폭을 두고 경쟁하지 않게 한다.
function roleSelectLabel(role, locale) {
  const labels = {
    week: ["주차", "Week"], date: ["날짜", "Date"], reg: ["가입 Regs", "Regs"],
    paid: ["Paid 가입 Regs", "Paid regs"], react: ["재활성 React", "Reactivation"],
    traffic: ["총유입 Traffic", "Total traffic"], purchasers: ["구매자", "Purchasers"],
    revenue: ["매출", "Revenue"], channel: ["채널 spend", "Channel spend"],
    external: ["연속형 컨트롤", "Continuous control"], dummy: ["더미/이벤트", "Dummy/event"],
    step: ["구조변화 step", "Structural step"], platform: ["세그먼트/플랫폼", "Segment/platform"],
    geo: ["GEO", "GEO"], reach: ["Reach", "Reach"], frequency: ["Frequency", "Frequency"],
  };
  return labels[role]?.[locale === "en" ? 1 : 0] || role;
}

export default function MmmColumnMapper({ headers, rows, colMap, onChange, locale = "ko", allowNoSpend = false }) {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const [dragCol, setDragCol] = useState(null);
  const [selectedCol, setSelectedCol] = useState(null);
  const [dragOverRole, setDragOverRole] = useState(null);
  const [mapperTab, setMapperTab] = useState("core");
  const cm = colMap || {};

  const setRole = (col, role) => {
    const next = { ...cm };
    if (["week", "date", "platform", "geo"].includes(role)) {
      for (const h of headers || []) {
        if (next[h] && next[h].role === role) next[h] = { ...next[h], role: "ignore" };
      }
    }
    const prev = next[col] || {};
    const nextDef = {
      ...prev,
      role,
      plat: ["reg", "paid", "react", "traffic", "purchasers", "revenue", "channel", "dummy", "step", "external", "reach", "frequency"].includes(role) ? prev.plat || guessPlat(col) : prev.plat,
      stepMode: role === "step" ? prev.stepMode || guessedStepMode(col) : prev.stepMode,
    };
    // 사용자가 직접 역할을 지정하면 자동 경계 추론보다 명시적 선택을 우선한다.
    delete nextDef.autoBoundaryKind;
    next[col] = nextDef;
    onChange(next);
  };
  const setField = (col, field, value) => {
    const nextDef = { ...(cm[col] || {}), [field]: value };
    if (nextDef.role === "step" && ["plat", "stepMode"].includes(field)) delete nextDef.autoBoundaryKind;
    onChange({ ...cm, [col]: nextDef });
  };

  // React state만으로 drag 대상을 기억하면 브라우저가 onDrop 전에 렌더를 끊는
  // 경우 대상이 사라질 수 있다. native DataTransfer에도 함께 넣어 한 번의 drag로
  // 안정적으로 배치하고, click→zone 선택은 드래그가 불안정한 환경의 즉시 대안이다.
  const beginDrag = (event, col) => {
    setDragCol(col);
    setSelectedCol(col);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("application/x-mmm-column", col);
      event.dataTransfer.setData("text/plain", col);
    }
  };
  const draggedColumn = (event) => event.dataTransfer?.getData("application/x-mmm-column")
    || event.dataTransfer?.getData("text/plain")
    || dragCol
    || selectedCol;
  const placeColumn = (col, role) => {
    if (!col) return;
    setRole(col, role);
    setDragCol(null);
    setSelectedCol(null);
    setDragOverRole(null);
  };

  const inRole = (role) => (headers || []).filter((h) => (cm[h]?.role || "ignore") === role);

  const Chip = ({ col, withKind, withPlat }) => {
    const def = cm[col] || {};
    const isUnassigned = (def.role || "ignore") === "ignore";
    return (
      <span
        className={`reg-chip mmm-mapper-chip ${isUnassigned ? "mmm-mapper-chip--unassigned" : "mmm-mapper-chip--mapped"}`}
        role="group"
        tabIndex={0}
        aria-label={tr(`${col} 매핑 설정`, `${col} mapping controls`)}
        draggable
        onDragStart={(event) => beginDrag(event, col)}
        onDragEnd={() => { setDragCol(null); setDragOverRole(null); }}
        onClick={(event) => { event.stopPropagation(); setSelectedCol(col); }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
          event.preventDefault();
          setSelectedCol(col);
        }}
        style={{ background: selectedCol === col ? "color-mix(in srgb, var(--primary) 14%, var(--bg-2))" : "var(--bg-2)", border: selectedCol === col ? "1px solid var(--primary)" : "1px solid var(--border)", boxShadow: selectedCol === col ? "0 0 0 2px color-mix(in srgb, var(--primary) 20%, transparent)" : "none" }}
      >
        <strong className="mmm-mapper-chip__label" title={col}>{col}</strong>
        <span className="mmm-mapper-chip__controls">
          <select
            className="mmm-mapper-chip__role"
            value={def.role || "ignore"}
            aria-label={tr(`${col} 역할`, `${col} role`)}
            title={tr("드래그 대신 역할을 직접 선택", "Choose a role instead of dragging")}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setRole(col, event.target.value)}
          >
            <option value="ignore">{tr("미지정", "Unassigned")}</option>
            {ZONES.map(([role]) => <option key={role} value={role}>{roleSelectLabel(role, locale)}</option>)}
          </select>
          {withKind && (
            <select className="mmm-mapper-chip__kind" value={def.kind || "perf"} aria-label={tr(`${col} 채널 유형`, `${col} channel type`)} onClick={(event) => event.stopPropagation()} onChange={(e) => setField(col, "kind", e.target.value)}>
              <option value="perf">perf spend</option>
              <option value="brand">brand spend</option>
            </select>
          )}
          {withPlat && (
            <select className="mmm-mapper-chip__platform" value={def.plat || "common"} aria-label={tr(`${col} 플랫폼`, `${col} platform`)} onClick={(event) => event.stopPropagation()} onChange={(e) => setField(col, "plat", e.target.value)}>
              <option value="common">{tr("공통", "Common")}</option>
              <option value="android">Android</option>
              <option value="ios">iOS</option>
            </select>
          )}
          {def.role === "step" && (
            <select className="mmm-mapper-chip__step" value={def.stepMode || "state"} aria-label={tr(`${col} 구조변화 방식`, `${col} structural-step mode`)} onClick={(event) => event.stopPropagation()} onChange={(e) => setField(col, "stepMode", e.target.value)}>
              <option value="state">{tr("상태열 (입력값 유지)", "State series (keep input)")}</option>
              <option value="boundary">{tr("경계 pulse→이후 1", "Boundary pulse → post=1")}</option>
            </select>
          )}
        </span>
        <button type="button" className="mmm-mapper-chip__clear" onClick={(event) => { event.stopPropagation(); placeColumn(col, "ignore"); }} aria-label={tr(`${col} 매핑 해제`, `Clear ${col} mapping`)} style={MAPPER_CLEAR_BUTTON_STYLE}>✕</button>
      </span>
    );
  };

  const Zone = ({ role, label, withKind, withPlat }) => (
    <div
      data-mmm-role-zone={role}
      role={selectedCol ? "button" : undefined}
      tabIndex={selectedCol ? 0 : -1}
      aria-label={selectedCol ? tr(`${selectedCol}을 ${label}에 배치`, `Place ${selectedCol} in ${label}`) : undefined}
      onDragEnter={(event) => { event.preventDefault(); setDragOverRole(role); }}
      onDragOver={(event) => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = "move"; setDragOverRole(role); }}
      onDragLeave={() => setDragOverRole((current) => current === role ? null : current)}
      onDrop={(event) => { event.preventDefault(); placeColumn(draggedColumn(event), role); }}
      onClick={() => placeColumn(selectedCol, role)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        placeColumn(selectedCol, role);
      }}
      className="mmm-mapper-zone"
      style={{ border: dragOverRole === role ? "2px solid var(--primary)" : "1px dashed var(--border)", background: dragOverRole === role ? "color-mix(in srgb, var(--primary) 8%, var(--bg-1))" : selectedCol ? "color-mix(in srgb, var(--primary) 3%, var(--bg-1))" : "transparent", cursor: selectedCol ? "pointer" : "default" }}
    >
      <div className="mmm-mapper-zone__label">{label}</div>
      <div>
        {inRole(role).length
          ? inRole(role).map((c) => <Chip key={c} col={c} withKind={withKind} withPlat={withPlat} />)
          : <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-xs)" }}>{tr("여기로 드래그하거나 칩에서 역할 선택", "Drag here or choose the role on a chip")}</span>}
      </div>
    </div>
  );

  const tray = (headers || []).filter((h) => (cm[h]?.role || "ignore") === "ignore");
  const missing = colMapMissing(headers, cm, locale).filter((item) =>
    !allowNoSpend || !["채널 spend 1개 이상", "1+ channel spend"].includes(item),
  );
  const hasMappedTime = (headers || []).some((header) => ["date", "week"].includes(cm[header]?.role));
  const hasMappedPlatform = (headers || []).some((header) => cm[header]?.role === "platform");
  const optionalRoles = new Set(["geo", "reach", "frequency"]);
  const visibleZones = ZONES.filter(([role]) => mapperTab === "meridian" ? optionalRoles.has(role) : !optionalRoles.has(role));
  const hasGeo = inRole("geo").length > 0;
  const hasReach = inRole("reach").length > 0;
  const hasFrequency = inRole("frequency").length > 0;
  const hasContinuousControls = inRole("external").length > 0;
  const forecastInputWarnings = mmmForecastInputWarnings(headers, rows, cm, locale);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <p className="muted" style={{ fontSize: "var(--fs-xs)", margin: 0 }}>
          {selectedCol
            ? tr(`“${selectedCol}” 선택됨 — 넣을 역할 영역을 한 번 클릭하세요.`, `“${selectedCol}” selected — click the role zone to place it.`)
            : tr("컬럼을 드래그하거나 칩의 역할 선택을 사용하세요. 칩을 클릭한 뒤 역할 영역을 클릭해도 됩니다.", "Drag columns or use each chip’s role selector. You can also click a chip and then a role zone.")}
        </p>
        <button
          type="button"
          className="ab-pill"
          onClick={() => onChange(autoGuessColMap(headers, rows, false))}
        >
          {tr("전부 자동 추정", "Auto-map all")}
        </button>
      </div>
      <div style={{ display: "flex", gap: "6px", borderBottom: "1px solid var(--border)", marginBottom: "10px" }}>
        {["core", "meridian"].map((tab) => (
          <button key={tab} type="button" className="ab-pill" onClick={() => setMapperTab(tab)} style={{ borderBottom: mapperTab === tab ? "2px solid var(--primary)" : "2px solid transparent", borderRadius: "6px 6px 0 0" }}>
            {tab === "core" ? tr("기본 MMM", "Core MMM") : tr("Meridian 입력 (선택)", "Meridian inputs (optional)")}
          </button>
        ))}
      </div>
      {mapperTab === "meridian" && (
        <div className="callout" style={{ marginBottom: "10px" }}>
          <div className="ico">i</div>
          <div className="body"><strong>{tr("선택 입력입니다", "Optional inputs")}</strong><p>{tr("GEO가 없으면 National-level로 분석합니다. Reach/Frequency가 없으면 spend 기반으로 분석합니다. 현재 매핑은 입력을 보존하며 기본 적합은 spend 기반입니다.", "Without GEO, the model uses a national-level fallback. Without Reach/Frequency, it uses spend-based inputs. Mapping preserves these fields; the current fit remains spend-based.")}</p></div>
        </div>
      )}
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); placeColumn(draggedColumn(event), "ignore"); }}
        style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "8px", marginBottom: "10px" }}
      >
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginBottom: "4px" }}>{tr("컬럼 (미지정 — 드래그해서 배치)", "Columns (unassigned — drag to place)")}</div>
        <div>
          {tray.length ? tray.map((h) => <Chip key={h} col={h} withKind={false} withPlat={false} />) : <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-xs)" }}>{tr("모두 배치됨", "All placed")}</span>}
        </div>
      </div>
      <div className="mmm-mapper-zones" style={{ display: "grid", gap: "10px", alignItems: "start" }}>
        {visibleZones.map(([role, koLabel, enLabel, withKind, withPlat]) => (
          <Zone key={role} role={role} label={tr(koLabel, enLabel)} withKind={withKind} withPlat={withPlat} />
        ))}
      </div>
      {hasContinuousControls && (
        <div className="callout" style={{ marginTop: "10px" }} data-mmm-control-contract>
          <div className="ico">i</div>
          <div className="body">
            <strong>{tr("연속형 컨트롤 입력 계약", "Continuous-control input contract")}</strong>
            <p>{tr(
              "시장 수요·가격 지수·검색량처럼 매체 지출이 아닌 주간 수준값만 넣으세요. 타깃과 같은 기간·주기로 빈칸 없이 관측돼야 합니다. 0/1 사건은 더미/이벤트, 변경 후 계속 유지되는 상태는 구조변화 step이 맞습니다.",
              "Use weekly level measures outside media spend, such as market demand, a price index, or search volume. They must cover the same periods and cadence as the target with no gaps. Use Dummy/event for 0/1 events and Structural step for a persistent post-change state.",
            )}</p>
            <p>{tr(
              "모델은 각 컨트롤을 평소 대비 상대 변화로 바꿔 광고와 함께 추정합니다. 이 변수는 교란 가능성을 줄이는 관측 통제일 뿐 인과효과를 보장하지 않으며, 채널 기여·ROAS·예산 후보로 취급하지 않습니다.",
              "The model converts each control to change relative to its typical level and estimates it jointly with media. This is observational adjustment, not causal proof, and controls are never treated as channel contribution, ROAS, or budget candidates.",
            )}</p>
          </div>
        </div>
      )}
      <div style={{ marginTop: "10px", fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
        {tr(`Meridian 입력 상태 · GEO: ${hasGeo ? "매핑됨" : "없음 → National-level"} · Reach: ${hasReach ? "매핑됨" : "없음"} · Frequency: ${hasFrequency ? "매핑됨" : "없음"}`, `Meridian inputs · GEO: ${hasGeo ? "mapped" : "missing → National-level"} · Reach: ${hasReach ? "mapped" : "missing"} · Frequency: ${hasFrequency ? "mapped" : "missing"}`)}
      </div>
      {!hasMappedTime && !hasMappedPlatform && (
        <label style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginTop: "10px", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "var(--fs-xs)", color: "var(--text-1)" }}>
          <input
            type="checkbox"
            checked={cm.__mmmRowOrderConfirmed === true}
            onChange={(event) => onChange({ ...cm, __mmmRowOrderConfirmed: event.target.checked })}
          />
          <span>{tr(
            "날짜/주차 컬럼이 없습니다. 이 CSV는 이미 주별 1행이고 오래된 주→최신 주 순서로 정렬되어 있음을 확인합니다.",
            "No date/week column is mapped. I confirm this CSV already has one row per week and is ordered oldest to newest.",
          )}</span>
        </label>
      )}
      {!hasMappedTime && hasMappedPlatform && (
        <div className="callout warning" style={{ marginTop: "10px" }}>
          <div className="ico">!</div>
          <div className="body"><strong>{tr("플랫폼 행에는 날짜/주차가 필요합니다", "Platform rows require date/week")}</strong><p>{tr("Android·iOS 등 같은 기간의 여러 행을 Total 한 주로 합치려면 날짜 또는 주차 컬럼을 매핑하세요.", "Map a date or week column so Android, iOS, and other rows for the same period can be combined into one Total week.")}</p></div>
        </div>
      )}
      {forecastInputWarnings.length > 0 && (
        <div className="callout warning" style={{ marginTop: "10px" }}>
          <div className="ico">!</div>
          <div className="body">
            <strong>{tr("미래예측 입력 확인", "Forecast input check")}</strong>
            {forecastInputWarnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        </div>
      )}
      {missing.length > 0 && (
        <div className="callout warning" style={{ marginTop: "10px" }}>
          <div className="ico">!</div>
          <div className="body"><strong>{tr("필수 역할이 비어 있습니다", "Required roles are empty")}</strong><p>{missing.join(", ")}</p></div>
        </div>
      )}
    </div>
  );
}
