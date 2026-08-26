"use client";
import { useState } from "react";
import { ahaParseActionWindow } from "@/utils/ahaMath";

/* Aha(5-20) 컬럼 매핑 — MmmColumnMapper(5-18)와 같은 드래그앤드롭 존 방식으로
 * 통일(§ 유저 요청: "같은 툴을 쓰라는 게 아니라 방식을 비슷하게"). 5-20 전용
 * 별도 컴포넌트 — colMap 스키마(role/action/window)는 기존과 동일해 엔진·
 * cache 빌더는 변경 없음(렌더층 교체만).
 * colMap: { [header]: { role: target|feature|id|segment|ignore, action?, window? } }
 *   segment = 나눠보기 차원(성별·플랫폼·국가 등) — 분석 결과를 값별로 필터·재계산.
 *
 * 하위 컴포넌트(Chip/Zone)는 모듈 최상위에 고정 — 렌더마다 새 컴포넌트를
 * 만들면 안 된다는 lint 규칙(react-hooks/static-components) 대응.
 */

const WINDOW_PRESETS = [1, 3, 7, 14, 30];

const MAPPER_CHIP_LAYOUT_STYLE = {
  display: "inline-flex",
  alignItems: "center",
  flexWrap: "wrap",
  width: "fit-content",
  maxWidth: "100%",
  minWidth: "0px",
  boxSizing: "border-box",
};

const MAPPER_CHIP_LABEL_STYLE = {
  maxWidth: "100%",
  minWidth: "0px",
  overflowWrap: "anywhere",
};

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
const ROLE_OPTIONS = [
  ["ignore", "미지정", "Unassigned"],
  ["target", "타겟", "Target"],
  ["feature", "선행 행동", "Preceding action"],
  ["id", "사용자 ID", "User ID"],
  ["segment", "세그먼트", "Segment"],
];

function winValue(w) {
  if (w == null || w === Infinity) return "all";
  if (WINDOW_PRESETS.includes(w)) return String(w);
  return "custom";
}

function guessRole(col, rows) {
  const name = String(col).toLowerCase();
  const vals = (rows || []).map((r) => r[col]).filter((v) => v != null && String(v).trim() !== "");
  const nums = vals.map((v) => parseFloat(v)).filter((v) => !isNaN(v));
  const isNum = vals.length > 0 && nums.length >= vals.length * 0.8;
  const uniq = isNum ? [...new Set(nums)] : [];
  const isBin01 = isNum && uniq.length > 0 && uniq.every((v) => v === 0 || v === 1);
  if (/(^|_)(user|client|device)?_?id$|^id$|^uid$/.test(name)) return "id";
  if (isBin01 && /target|conv|retain|churn|activ|subscrib|signup|sign_up|register|타겟|전환|리텐션|정착|구독|가입/.test(name)) return "target";
  // 비수치 인구/플랫폼 차원은 나눠보기(segment)로 자동 배치 — 흔한 이름만(화이트리스트).
  // 그 외 임의 문자열은 tray(ignore)로 둬 사용자가 판단(오탐 방지).
  if (!isNum && /(^|_)(platform|os|gender|sex|country|nation|region|device|age_?group|tier|grade|segment|membership|plan)($|_)|플랫폼|성별|국가|지역|기기|기종|연령|등급|세그/.test(name)) return "segment";
  if (!isNum) return "ignore";
  return "feature";
}

// index.html/기존 ahaAutoMapColumns와 동일한 자동추정 규칙(컴포넌트 분리 후에도
// 기존 동작 유지) — target 후보가 하나도 없으면 가장 그럴듯한 bin01 컬럼 승격.
export function ahaAutoMapColumns(headers, rows) {
  const out = {};
  for (const h of headers || []) {
    const role = guessRole(h, rows);
    const aw = ahaParseActionWindow(h);
    out[h] = { role, action: aw.action, window: aw.window };
  }
  if (!Object.values(out).some((d) => d.role === "target")) {
    for (const h of headers || []) {
      const vals = (rows || []).map((r) => r[h]).filter((v) => v != null && String(v).trim() !== "");
      const nums = vals.map((v) => parseFloat(v)).filter((v) => !isNaN(v));
      const uniq = [...new Set(nums)];
      const isBin01 =
        nums.length >= vals.length * 0.8 && vals.length > 0 && uniq.length > 0 &&
        uniq.every((v) => v === 0 || v === 1) && uniq.length <= 2;
      if (isBin01 && out[h].role !== "id") { out[h].role = "target"; break; }
    }
  }
  return out;
}

function RoleSelect({ col, role, setRole, tr = (ko) => ko }) {
  return (
    <select
      value={role || "ignore"}
      onChange={(event) => setRole(col, event.target.value)}
      aria-label={tr(`${col} 역할`, `${col} role`)}
      title={tr("드래그 대신 역할을 직접 선택", "Choose a role instead of dragging")}
      className="map-select"
      style={{ maxWidth: "112px", minWidth: "0px", fontSize: "11px" }}
    >
      {ROLE_OPTIONS.map(([value, ko, en]) => <option key={value} value={value}>{tr(ko, en)}</option>)}
    </select>
  );
}

function FeatureChip({ col, cm, setRole, setField, setDragCol, tr = (ko) => ko }) {
  const def = cm[col] || { action: col, window: Infinity };
  const wv = winValue(def.window);
  return (
    <span
      className="reg-chip aha-mapper-chip aha-mapper-chip--feature"
      draggable
      onDragStart={() => setDragCol(col)}
      style={{ ...MAPPER_CHIP_LAYOUT_STYLE, gap: "4px", padding: "3px 8px", margin: "2px", borderRadius: "6px", background: "var(--bg-2)", border: "1px solid var(--border)", fontSize: "12px", cursor: "grab" }}
    >
      <strong title={col} style={MAPPER_CHIP_LABEL_STYLE}>{col}</strong>
      <RoleSelect col={col} role={def.role || "feature"} setRole={setRole} tr={tr} />
      <input
        type="text"
        value={def.action || col}
        onChange={(e) => setField(col, "action", e.target.value.trim() || col)}
        aria-label={tr(`${col} 액션명`, `${col} action name`)}
        title={tr("액션명(같은 이름끼리 윈도우별로 묶임)", "Action name (same names are grouped per window)")}
        style={{ width: "72px", maxWidth: "100%", minWidth: "0px", fontSize: "11px" }}
        className="map-select"
      />
      <select
        value={wv}
        aria-label={tr(`${col} 행동 윈도우`, `${col} action window`)}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "all") setField(col, "window", Infinity);
          else if (v === "custom") setField(col, "window", def.window === Infinity || WINDOW_PRESETS.includes(def.window) ? 1 : def.window);
          else setField(col, "window", parseInt(v, 10));
        }}
        style={{ maxWidth: "100%", minWidth: "0px", fontSize: "11px" }}
      >
        {WINDOW_PRESETS.map((w) => <option key={w} value={w}>D{w}</option>)}
        <option value="all">{tr("전체", "All")}</option>
        <option value="custom">{tr("Dn 직접입력", "Dn custom")}</option>
      </select>
      {wv === "custom" && (
        <input
          type="number"
          min="1"
          step="1"
          value={def.window === Infinity ? "" : def.window}
          aria-label={tr(`${col} 행동 윈도우 일수`, `${col} action window days`)}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            setField(col, "window", isFinite(n) && n > 0 ? n : 1);
          }}
          placeholder="N"
          title={tr("윈도우 일수 직접 입력", "Enter window days directly")}
          style={{ width: "44px", maxWidth: "100%", minWidth: "0px", fontSize: "11px" }}
          className="map-select"
        />
      )}
      <button type="button" className="aha-mapper-chip__clear" onClick={() => setRole(col, "ignore")} aria-label={tr(`${col} 매핑 해제`, `Clear ${col} mapping`)} style={MAPPER_CLEAR_BUTTON_STYLE}>✕</button>
    </span>
  );
}

function SimpleChip({ col, role, setRole, setDragCol, tr = (ko) => ko }) {
  return (
    <span
      className="reg-chip aha-mapper-chip aha-mapper-chip--simple"
      draggable
      onDragStart={() => setDragCol(col)}
      style={{ ...MAPPER_CHIP_LAYOUT_STYLE, gap: "4px", padding: "3px 8px", margin: "2px", borderRadius: "6px", background: "var(--bg-2)", border: "1px solid var(--border)", fontSize: "12px", cursor: "grab" }}
    >
      <strong style={MAPPER_CHIP_LABEL_STYLE}>{col}</strong>
      <RoleSelect col={col} role={role} setRole={setRole} tr={tr} />
      {role !== "ignore" && <button type="button" className="aha-mapper-chip__clear" onClick={() => setRole(col, "ignore")} aria-label={tr(`${col} 매핑 해제`, `Clear ${col} mapping`)} style={MAPPER_CLEAR_BUTTON_STYLE}>✕</button>}
    </span>
  );
}

function Zone({ role, label, single, feature, cols, cm, setRole, setField, dragCol, setDragCol, tr = (ko) => ko }) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); if (dragCol) setRole(dragCol, role); setDragCol(null); }}
      style={{ border: "1px dashed var(--border)", borderRadius: "8px", padding: "8px", minHeight: "44px" }}
    >
      <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "4px" }}>{label}</div>
      <div>
        {cols.length
          ? cols.map((c) => (feature
              ? <FeatureChip key={c} col={c} cm={cm} setRole={setRole} setField={setField} setDragCol={setDragCol} tr={tr} />
              : <SimpleChip key={c} col={c} role={role} setRole={setRole} setDragCol={setDragCol} tr={tr} />))
          : <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>{tr("여기로 드래그하거나 칩에서 역할 선택", "Drag here or choose the role on a chip")}</span>}
      </div>
      {single && cols.length > 1 && (
        <div style={{ fontSize: "11px", color: "var(--warning)", marginTop: "4px" }}>{tr("⚠ 1개만 사용됩니다(나중에 놓은 컬럼 우선)", "⚠ Only one is used (last dropped column wins)")}</div>
      )}
    </div>
  );
}

export default function AhaColumnMapper({ headers, rows, colMap, onChange, locale = "ko" }) {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const [dragCol, setDragCol] = useState(null);
  const cm = colMap || {};

  const setRole = (col, role) => {
    const next = { ...cm };
    if (role === "target" || role === "id") {
      // 단일 슬롯 역할 — 기존 점유 컬럼은 미지정으로 되돌림.
      for (const h of headers || []) {
        if (next[h] && next[h].role === role) next[h] = { ...next[h], role: "ignore" };
      }
    }
    const prev = next[col] || { action: col, window: Infinity };
    next[col] = { ...prev, role, action: prev.action || col };
    onChange(next);
  };
  const setField = (col, field, value) => {
    onChange({ ...cm, [col]: { ...(cm[col] || { action: col, window: Infinity }), [field]: value } });
  };

  const inRole = (role) => (headers || []).filter((h) => (cm[h]?.role || "ignore") === role);

  const tray = (headers || []).filter((h) => (cm[h]?.role || "ignore") === "ignore");
  const targetCols = inRole("target");
  const idCols = inRole("id");
  const featureCols = inRole("feature");
  const segmentCols = inRole("segment");
  const missing = [];
  if (!targetCols.length) missing.push(tr("타겟(target, 0/1) 1개", "1 target (0/1)"));
  if (!featureCols.length) missing.push(tr("선행 행동(feature) 1개 이상", "1+ preceding action (feature)"));

  // 매핑 완전 초기화(전부 미지정 트레이로) — 실수로 잘못 매핑했을 때 처음부터 다시.
  const clearAll = () => onChange({});
  // 타겟/id를 제외한 모든 컬럼을 선행 행동(feature)으로 일괄 배치. 액션·윈도우는
  // 헤더명 자동 파싱(ahaParseActionWindow) — 이벤트 컬럼이 많을 때 하나씩 드래그하지
  // 않고 한 번에 매핑.
  const mapAllAsFeature = () => {
    const next = { ...cm };
    for (const h of headers || []) {
      const role = next[h]?.role;
      // 타겟·id·세그먼트(나눠보기)는 일괄 feature 배치에서 제외(사용자 지정 보존).
      if (role === "target" || role === "id" || role === "segment") continue;
      const aw = ahaParseActionWindow(h);
      next[h] = { ...(next[h] || {}), role: "feature", action: next[h]?.action || aw.action, window: next[h]?.window ?? aw.window };
    }
    onChange(next);
  };
  // 헤더가 해당 윈도우(D1/D7)로 파싱되는 컬럼만 골라 feature로 자동 배치 — "D1 이벤트만
  // 매핑". 이미 배치된 다른 컬럼은 건드리지 않음(타겟·id·세그먼트·다른 윈도우 feature 보존).
  // (기존엔 배치된 feature 전체 window를 강제로 바꿔 "D1만 원하는데 전부 D1됨" 짜증 유발.)
  const mapWindowEvents = (w) => {
    const next = { ...cm };
    for (const h of headers || []) {
      const role = next[h]?.role;
      if (role === "target" || role === "id" || role === "segment") continue;
      if (ahaParseActionWindow(h).window === w) {
        next[h] = { ...(next[h] || {}), role: "feature", action: next[h]?.action || ahaParseActionWindow(h).action, window: w };
      }
    }
    onChange(next);
  };
  // 각 윈도우로 파싱되는 헤더 수(버튼 disabled·개수 표기용).
  const windowEventCount = (w) => (headers || []).filter((h) => {
    const role = cm[h]?.role;
    if (role === "target" || role === "id" || role === "segment") return false;
    return ahaParseActionWindow(h).window === w;
  }).length;
  const d1Count = windowEventCount(1);
  const d7Count = windowEventCount(7);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
        <p className="muted" style={{ fontSize: "12px", margin: 0 }}>
          {tr("컬럼을 역할 영역으로 드래그하거나 각 칩의 역할 선택을 사용하세요. 헤더가 ", "Drag columns onto a role zone or use each chip’s role selector. If a header looks like ")}<code className="inline">{"{action}_d{N}"}</code>{tr(" 형태면 액션·윈도우가 자동 파싱됩니다.", ", the action and window are parsed automatically.")}
        </p>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button type="button" className="ab-pill" onClick={() => onChange(ahaAutoMapColumns(headers, rows))}>{tr("🪄 전부 자동 추정", "🪄 Auto-map all")}</button>
          <button type="button" className="ab-pill" onClick={mapAllAsFeature} title={tr("타겟·id 제외 모든 컬럼을 선행 행동(feature)으로 일괄 배치", "Place every column except target/id as a preceding action (feature)")}>{tr("🏃 전체 이벤트 매핑", "🏃 Map all events")}</button>
          <button type="button" className="ab-pill" onClick={() => mapWindowEvents(1)} disabled={!d1Count} title={tr("헤더가 D1로 파싱되는 컬럼만 선행 행동으로 자동 매핑(다른 건 그대로)", "Auto-map only columns whose header parses to D1 (leave others as-is)")}>{tr("D1 이벤트 매핑", "Map D1 events")}{d1Count ? ` (${d1Count})` : ""}</button>
          <button type="button" className="ab-pill" onClick={() => mapWindowEvents(7)} disabled={!d7Count} title={tr("헤더가 D7로 파싱되는 컬럼만 선행 행동으로 자동 매핑(다른 건 그대로)", "Auto-map only columns whose header parses to D7 (leave others as-is)")}>{tr("D7 이벤트 매핑", "Map D7 events")}{d7Count ? ` (${d7Count})` : ""}</button>
          <button type="button" className="ab-pill" onClick={clearAll} title={tr("전체 매핑을 초기화하고 처음부터 다시", "Reset all mappings and start over")}>{tr("🗑 전체 해제", "🗑 Clear all")}</button>
        </div>
      </div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (dragCol) setRole(dragCol, "ignore"); setDragCol(null); }}
        style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "8px", marginBottom: "10px" }}
      >
        <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "4px" }}>{tr("📦 컬럼 (미지정 — 드래그해서 배치)", "📦 Columns (unassigned — drag to place)")}</div>
        <div>
          {tray.length
            ? tray.map((h) => <SimpleChip key={h} col={h} role="ignore" setRole={setRole} setDragCol={setDragCol} tr={tr} />)
            : <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>{tr("모두 배치됨", "All placed")}</span>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <Zone role="target" label={tr("🎯 타겟(target, 0/1) · 1개", "🎯 Target (0/1) · 1")} single cols={targetCols} cm={cm} setRole={setRole} setField={setField} dragCol={dragCol} setDragCol={setDragCol} tr={tr} />
        <Zone role="id" label={tr("🆔 user_id (미사용, 있으면 여기로)", "🆔 user_id (unused; drop here if present)")} single cols={idCols} cm={cm} setRole={setRole} setField={setField} dragCol={dragCol} setDragCol={setDragCol} tr={tr} />
      </div>
      <div style={{ marginTop: "10px" }}>
        <Zone role="feature" label={tr("🏃 선행 행동(feature) · 여러 개 · 액션명+윈도우(D1/D7/Dn) 개별 지정", "🏃 Preceding actions (feature) · many · set action name + window (D1/D7/Dn) each")} feature cols={featureCols} cm={cm} setRole={setRole} setField={setField} dragCol={dragCol} setDragCol={setDragCol} tr={tr} />
      </div>
      <div style={{ marginTop: "10px" }}>
        <Zone role="segment" label={tr("🔀 세그먼트(나눠보기) · 선택 · 성별·플랫폼·국가 등 값별로 결과를 나눠 봅니다", "🔀 Segment (split view) · optional · split results by gender/platform/country, etc.")} cols={segmentCols} cm={cm} setRole={setRole} setField={setField} dragCol={dragCol} setDragCol={setDragCol} tr={tr} />
      </div>
      {missing.length > 0 && (
        <div className="callout warning" style={{ marginTop: "10px" }}>
          <div className="ico">!</div>
          <div className="body"><strong>{tr("필수 역할이 비어 있습니다", "Required roles are empty")}</strong><p>{missing.join(", ")}</p></div>
        </div>
      )}
    </div>
  );
}
