"use client";
import React from "react";

// Shared table (design-system baseline §1.3). Enforces the conventions we kept
// re-breaking by hand: <thead> always, numeric columns right-aligned, label
// columns left, header alignment === cell alignment (§7 thead 정렬 함정 근절),
// vertical-align top. Use this instead of hand-rolled <table>.
//
// columns: [{ key, label, align?, tooltip?, fmt?, headStyle?, cellStyle? }]
//   align  : "left" | "right" | "center"  (default: "right" for number-ish, else "left")
//   fmt    : (value, row) => ReactNode      (formatter; default String)
// rows    : array of row objects
// rowKey  : (row, i) => key  (default index)
export default function DataTable({
  columns,
  rows,
  rowKey,
  stickyHeader = false,
  className = "",
  style,
  emptyText = "데이터 없음",
}) {
  const cols = columns || [];
  const alignOf = (c) => c.align || "left";
  const theadStyle = stickyHeader
    ? { position: "sticky", top: 0, zIndex: 1, background: "var(--bg-2)" }
    : undefined;

  return (
    <div className="table-wrap" style={style}>
      <table className={`data ${className}`.trim()}>
        <thead style={theadStyle}>
          <tr>
            {cols.map((c) => (
              <th
                key={c.key}
                title={c.tooltip || undefined}
                style={{ textAlign: alignOf(c), whiteSpace: "nowrap", ...(c.headStyle || {}) }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(!rows || rows.length === 0) ? (
            <tr>
              <td colSpan={cols.length} style={{ textAlign: "center", color: "var(--text-muted)", padding: "16px" }}>
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={rowKey ? rowKey(row, i) : i}>
                {cols.map((c) => {
                  const raw = row[c.key];
                  const content = c.fmt ? c.fmt(raw, row) : (raw == null ? "" : String(raw));
                  const isNum = alignOf(c) === "right";
                  return (
                    <td
                      key={c.key}
                      className={isNum ? "tnum" : undefined}
                      style={{ textAlign: alignOf(c), verticalAlign: "top", ...(c.cellStyle || {}) }}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
