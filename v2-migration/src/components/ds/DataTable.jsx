"use client";
import React from "react";

// Shared table (design-system baseline §1.3). Enforces the conventions we kept
// re-breaking by hand: <thead> always, numeric columns right-aligned, label
// columns left, header alignment === cell alignment (§7 thead 정렬 함정 근절),
// stable semantic hooks for the shared visual system. Use this instead of
// hand-rolled <table>.
//
// columns: [{ key, label, align?, tooltip?, fmt?, headClassName?, cellClassName?, headStyle?, cellStyle? }]
//   align  : "left" | "right" | "center"  (default: "right" for number-ish, else "left")
//   fmt    : (value, row) => ReactNode      (formatter; default String)
// rows    : array of row objects
// rowKey  : (row, i) => key  (default index)
// tableStyle: table 자체의 소비자별 밀도 조정. wrapper 여백은 style로 지정.
export default function DataTable({
  columns,
  rows,
  rowKey,
  stickyHeader = false,
  className = "",
  wrapperClassName = "",
  style,
  tableStyle,
  emptyText = "데이터 없음",
  ariaLabel = "데이터 표",
  caption = "",
}) {
  const cols = columns || [];
  const alignOf = (c) => c.align || "left";
  const joinClasses = (...names) => names.filter(Boolean).join(" ");

  return (
    <div className={joinClasses("table-wrap", "data-table-wrap", "ds-data-table-wrap", wrapperClassName)} style={style}>
      <table className={joinClasses("data", "data-table", "ds-data-table", className)} aria-label={ariaLabel} style={tableStyle}>
        {caption ? <caption className="sr-only data-table__caption">{caption}</caption> : null}
        <thead className={joinClasses("data-table__head", stickyHeader && "is-sticky")}>
          <tr className="data-table__head-row">
            {cols.map((c) => (
              <th
                key={c.key}
                scope="col"
                title={c.tooltip || undefined}
                className={joinClasses("data-table__head-cell", alignOf(c) === "right" && "tnum", c.headClassName)}
                data-numeric={alignOf(c) === "right" ? "true" : undefined}
                style={{ textAlign: alignOf(c), ...(c.headStyle || {}) }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="data-table__body">
          {(!rows || rows.length === 0) ? (
            <tr className="data-table__row is-empty">
              <td className="data-table__empty ds-data-table__empty" colSpan={cols.length}>
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr className="data-table__row" key={rowKey ? rowKey(row, i) : i}>
                {cols.map((c) => {
                  const raw = row[c.key];
                  const content = c.fmt ? c.fmt(raw, row) : (raw == null ? "" : String(raw));
                  const isNum = alignOf(c) === "right";
                  return (
                    <td
                      key={c.key}
                      className={joinClasses("data-table__cell", isNum && "tnum", c.cellClassName)}
                      data-numeric={isNum ? "true" : undefined}
                      style={{ textAlign: alignOf(c), ...(c.cellStyle || {}) }}
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
