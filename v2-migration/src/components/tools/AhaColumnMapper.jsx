"use client";
import { useState } from "react";
import { ahaParseActionWindow } from "@/utils/ahaMath";

/* Aha(5-20) 컬럼 매핑 — MmmColumnMapper(5-18)와 같은 드래그앤드롭 존 방식으로
 * 통일(§ 유저 요청: "같은 툴을 쓰라는 게 아니라 방식을 비슷하게"). 5-20 전용
 * 별도 컴포넌트 — colMap 스키마(role/action/window)는 기존과 동일해 엔진·
 * cache 빌더는 변경 없음(렌더층 교체만).
 * colMap: { [header]: { role: target|feature|id|ignore, action?, window? } }
 *
 * 하위 컴포넌트(Chip/Zone)는 모듈 최상위에 고정 — 렌더마다 새 컴포넌트를
 * 만들면 안 된다는 lint 규칙(react-hooks/static-components) 대응.
 */

const WINDOW_PRESETS = [1, 3, 7, 14, 30];

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
  if (isBin01 && /target|conv|retain|churn|activ|타겟|전환|리텐션|정착/.test(name)) return "target";
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

function FeatureChip({ col, cm, setRole, setField, setDragCol }) {
  const def = cm[col] || { action: col, window: Infinity };
  const wv = winValue(def.window);
  return (
    <span
      className="reg-chip"
      draggable
      onDragStart={() => setDragCol(col)}
      style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 8px", margin: "2px", borderRadius: "6px", background: "var(--bg-2)", border: "1px solid var(--border)", fontSize: "12px", cursor: "grab" }}
    >
      <strong title={col}>{col}</strong>
      <input
        type="text"
        value={def.action || col}
        onChange={(e) => setField(col, "action", e.target.value.trim() || col)}
        title="액션명(같은 이름끼리 윈도우별로 묶임)"
        style={{ width: "72px", fontSize: "11px" }}
        className="map-select"
      />
      <select
        value={wv}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "all") setField(col, "window", Infinity);
          else if (v === "custom") setField(col, "window", def.window === Infinity || WINDOW_PRESETS.includes(def.window) ? 1 : def.window);
          else setField(col, "window", parseInt(v, 10));
        }}
        style={{ fontSize: "11px" }}
      >
        {WINDOW_PRESETS.map((w) => <option key={w} value={w}>D{w}</option>)}
        <option value="all">전체</option>
        <option value="custom">Dn 직접입력</option>
      </select>
      {wv === "custom" && (
        <input
          type="number"
          min="1"
          step="1"
          value={def.window === Infinity ? "" : def.window}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            setField(col, "window", isFinite(n) && n > 0 ? n : 1);
          }}
          placeholder="N"
          title="윈도우 일수 직접 입력"
          style={{ width: "44px", fontSize: "11px" }}
          className="map-select"
        />
      )}
      <span onClick={() => setRole(col, "ignore")} style={{ cursor: "pointer", color: "var(--text-muted)" }}>✕</span>
    </span>
  );
}

function SimpleChip({ col, setRole, setDragCol }) {
  return (
    <span
      className="reg-chip"
      draggable
      onDragStart={() => setDragCol(col)}
      style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 8px", margin: "2px", borderRadius: "6px", background: "var(--bg-2)", border: "1px solid var(--border)", fontSize: "12px", cursor: "grab" }}
    >
      <strong>{col}</strong>
      <span onClick={() => setRole(col, "ignore")} style={{ cursor: "pointer", color: "var(--text-muted)" }}>✕</span>
    </span>
  );
}

function Zone({ role, label, single, feature, cols, cm, setRole, setField, dragCol, setDragCol }) {
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
              ? <FeatureChip key={c} col={c} cm={cm} setRole={setRole} setField={setField} setDragCol={setDragCol} />
              : <SimpleChip key={c} col={c} setRole={setRole} setDragCol={setDragCol} />))
          : <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>여기로 드래그</span>}
      </div>
      {single && cols.length > 1 && (
        <div style={{ fontSize: "10.5px", color: "#f59e0b", marginTop: "4px" }}>⚠ 1개만 사용됩니다(나중에 놓은 컬럼 우선)</div>
      )}
    </div>
  );
}

export default function AhaColumnMapper({ headers, rows, colMap, onChange }) {
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
  const missing = [];
  if (!targetCols.length) missing.push("타겟(target, 0/1) 1개");
  if (!featureCols.length) missing.push("선행 행동(feature) 1개 이상");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <p className="muted" style={{ fontSize: "12px", margin: 0 }}>
          컬럼을 역할 영역으로 드래그하세요. 칩을 끌어 언제든 수정 가능합니다. 헤더가 <code className="inline">{"{action}_d{N}"}</code> 형태면 액션·윈도우가 자동 파싱됩니다.
        </p>
        <button type="button" className="ab-pill" onClick={() => onChange(ahaAutoMapColumns(headers, rows))}>🪄 전부 자동 추정</button>
      </div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (dragCol) setRole(dragCol, "ignore"); setDragCol(null); }}
        style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "8px", marginBottom: "10px" }}
      >
        <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "4px" }}>📦 컬럼 (미지정 — 드래그해서 배치)</div>
        <div>
          {tray.length
            ? tray.map((h) => <SimpleChip key={h} col={h} setRole={setRole} setDragCol={setDragCol} />)
            : <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>모두 배치됨</span>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <Zone role="target" label="🎯 타겟(target, 0/1) · 1개" single cols={targetCols} cm={cm} setRole={setRole} setField={setField} dragCol={dragCol} setDragCol={setDragCol} />
        <Zone role="id" label="🆔 user_id (미사용, 있으면 여기로)" single cols={idCols} cm={cm} setRole={setRole} setField={setField} dragCol={dragCol} setDragCol={setDragCol} />
      </div>
      <div style={{ marginTop: "10px" }}>
        <Zone role="feature" label="🏃 선행 행동(feature) · 여러 개 · 액션명+윈도우(D1/D7/Dn) 개별 지정" feature cols={featureCols} cm={cm} setRole={setRole} setField={setField} dragCol={dragCol} setDragCol={setDragCol} />
      </div>
      {missing.length > 0 && (
        <div className="callout warning" style={{ marginTop: "10px" }}>
          <div className="ico">!</div>
          <div className="body"><strong>필수 역할이 비어 있습니다</strong><p>{missing.join(", ")}</p></div>
        </div>
      )}
    </div>
  );
}
