"use client";
import React, { Fragment, useId, useRef, useState } from "react";
import DataTable from "./DataTable";
import ModalDialog from "./ModalDialog";

// 결과 화면의 보고서 층(임원 보고 형식) — 5-3에서 확립한 모양을 전 도구가 함께 쓴다.
// 결론 줄 · 대상별 표 · 확인할 점 표 · 조건 한 줄 · 자세히 보기. 계약은 docs/product-ssot.md §5.5.
// 문구·판정은 도구가 만들고, 이 파일은 배치·정렬·밀도만 소유한다.

/**
 * 결론 표시: 줄은 의미(주 결론·효과·감액·증액)별, 줄 안의 덩어리는 통째로 다음 줄로 넘어간다.
 * lines: [{ kind: "main"|"effect"|"down"|"up"|"keep", chunks: string[] }]
 * 공유·내보내기는 ResultActionCard의 headline 문자열이 맡고, 이 부품은 화면 전용이다.
 */
export function ResultHeadline({ lines = [] }) {
  return (
    <span className="result-headline">
      {lines.map((line, index) => (
        <span key={`${line.kind}-${index}`} className={`result-headline__line is-${line.kind || "main"}`}>
          {/* 덩어리 사이 공백은 덩어리 밖에 둔다 — 안에 두면 접혀서 줄을 바꿀 자리가 사라진다. */}
          {(line.chunks || [line.text]).filter((chunk) => chunk != null && chunk !== "").map((chunk, chunkIndex) => (
            <Fragment key={chunkIndex}>
              {chunkIndex > 0 ? " " : null}
              <span className="result-headline__chunk">{chunk}</span>
            </Fragment>
          ))}
          {index < lines.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

/** 결론 줄 배열 → 공유·내보내기용 한 문장. 효과 줄(→ 로 시작)은 앞 줄에 붙인다. */
export function headlineText(lines = []) {
  return lines.reduce((text, line, index) => {
    const body = (line.chunks || [line.text]).filter(Boolean).join(" ");
    if (index === 0) return body;
    return body.startsWith("→") ? `${text} ${body}` : `${text} · ${body}`;
  }, "");
}

/**
 * 증감 막대: 0을 가운데 두고 음수는 왼쪽, 양수는 오른쪽. 길이는 표 안 최대 변화 대비.
 * tone: "up"(강조색) · "down"(중립) · "good" · "bad" — 감액이 곧 나쁨은 아니므로 기본은 방향만 말한다.
 */
export function ChangeBar({ value, max, tone }) {
  const width = max > 0 && Number.isFinite(value) ? Math.min(50, (Math.abs(value) / max) * 50) : 0;
  const cls = tone || (value < 0 ? "down" : "up");
  return (
    <span className="change-bar" aria-hidden="true">
      <i className={`is-${cls} ${value < 0 ? "is-left" : "is-right"}`} style={{ width: `${width}%` }} />
    </span>
  );
}

/** 한쪽 막대(0부터): 비중·비율·지수처럼 음수가 없는 크기. ratio는 0~1. */
export function LevelBar({ ratio, tone = "up" }) {
  const width = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) * 100 : 0;
  return (
    <span className="level-bar" aria-hidden="true">
      <i className={`is-${tone}`} style={{ width: `${width}%` }} />
    </span>
  );
}

/** 판정 칩: 색은 의미 토큰(good·bad·warn·muted), 글자가 먼저 말한다. */
export function VerdictChip({ tone = "muted", children }) {
  return <span className={`verdict-chip is-${tone}`}>{children}</span>;
}

/**
 * 대상별 표: 제목·범위 한 줄 + DataTable. 좁은 칸에서는 행을 블록으로 쌓고 열 이름을 칸 안 라벨로 보인다.
 * columns는 DataTable과 같다. 첫 열이 대상 이름(primary)이다.
 * limit을 넘으면 앞에서 자르고 onShowAll(보통 "자세히 보기" 열기)을 붙인다.
 */
export function ResultTable({ title, meta, columns, rows, rowKey, ariaLabel, limit, onShowAll, showAllLabel, locale = "ko", className = "", id }) {
  const autoId = useId();
  const headingId = id || `result-table-${autoId.replace(/:/g, "")}`;
  const shown = limit ? rows.slice(0, limit) : rows;
  const tr = (ko, en) => (locale === "en" ? en : ko);
  return (
    <section className={`result-table ${className}`.trim()} aria-labelledby={title ? headingId : undefined}>
      {(title || meta) && (
        <div className="result-table__head">
          {title && <h3 id={headingId}>{title}</h3>}
          {meta && <span>{meta}</span>}
        </div>
      )}
      <DataTable
        ariaLabel={ariaLabel || (typeof title === "string" ? title : tr("결과 표", "Result table"))}
        className="result-table__table"
        rows={shown}
        rowKey={rowKey}
        columns={columns}
      />
      {rows.length > shown.length && onShowAll && (
        <button type="button" className="btn ghost result-table__more" onClick={onShowAll}>
          {showAllLabel || tr(`전체 ${rows.length}개 보기`, `Show all ${rows.length}`)}
        </button>
      )}
    </section>
  );
}

/** 확인할 점 표: 구분 · 대상 · 내용. 신호가 없으면 아무것도 그리지 않는다. */
export function IssueTable({ issues = [], locale = "ko", limit = 4, moreHint }) {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const rows = issues.filter(Boolean);
  if (!rows.length) return null;
  const shown = rows.slice(0, limit);
  return (
    <ResultTable
      className="result-table--issues"
      title={tr("확인할 점", "Check these")}
      meta={rows.length > shown.length ? (moreHint || tr(`외 ${rows.length - shown.length}건은 자세히 보기`, `${rows.length - shown.length} more in Details`)) : null}
      locale={locale}
      rows={shown}
      rowKey={(row, index) => `${row.kind}-${index}`}
      columns={[
        { key: "kind", label: tr("구분", "Type"), cellClassName: "result-table__kind" },
        { key: "target", label: tr("대상", "Target"), cellClassName: "result-table__primary" },
        { key: "text", label: tr("내용", "Detail"), cellClassName: "result-table__why" },
      ]}
    />
  );
}

/**
 * 자세히 보기: 기본 닫힘. 이름 있는 버튼이 열고 닫으며(삼각형 접기 아님) 닫힌 동안에도 무엇이 들어 있는지 한 줄로 말한다.
 * 내용은 열 때 마운트한다 — 닫힌 차트가 폭 0으로 그려지지 않게.
 * open/onOpenChange를 주면 제어 모드(결론 표의 "전체 보기"가 여는 경우).
 */
export function ResultDetails({ items = [], children, locale = "ko", open: openProp, onOpenChange, defaultOpen = false, id, title }) {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp ?? openState;
  const autoId = useId();
  const baseId = id || `result-details-${autoId.replace(/:/g, "")}`;
  const toggle = () => {
    const next = !open;
    if (openProp == null) setOpenState(next);
    onOpenChange?.(next);
  };
  const label = title || tr("자세히 보기", "Details");
  return (
    <section className={`result-details${open ? " is-open" : ""}`} id={baseId} aria-labelledby={`${baseId}-title`} data-result-details="">
      <h2 className="result-details__title" id={`${baseId}-title`}>
        <button type="button" className="btn secondary result-details__toggle" aria-expanded={open} aria-controls={`${baseId}-body`} onClick={toggle} data-result-details-toggle="">
          {label}
          <span aria-hidden="true">{open ? " ▾" : " ▸"}</span>
        </button>
      </h2>
      {!open && items.length > 0 && (
        <p className="result-details__summary">{items.filter(Boolean).join(" · ")}</p>
      )}
      <div className="result-details__body" id={`${baseId}-body`} hidden={!open}>
        {open ? children : null}
      </div>
    </section>
  );
}

/**
 * 조건 한 줄 + "조건 바꾸기" 창. 분석 조건(기간·지표·설계 선언·필터)은 창 안에서 고치고,
 * 화면에는 지금 적용된 조건이 한 줄로 남는다. dialogTitle은 창의 접근 가능한 이름이다.
 */
export function ConditionLine({ summary, children, locale = "ko", dialogTitle, buttonLabel, className = "", id, before = null }) {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  const title = dialogTitle || tr("분석 조건", "Analysis settings");
  return (
    <section className={`block condition-line ${className}`.trim()} aria-label={title} id={id}>
      <div className="condition-line__top">
        {before}
        <p className="condition-line__summary">{summary}</p>
        {children && (
          <button type="button" className="btn secondary condition-line__edit" ref={trigger} onClick={() => setOpen(true)}>
            {buttonLabel || tr("조건 바꾸기", "Change settings")}
          </button>
        )}
      </div>
      {children && (
        <ModalDialog open={open} onClose={() => setOpen(false)} returnFocusRef={trigger} ariaLabel={title} overlayClassName="tutorial-overlay" panelClassName="tool-reference-panel condition-dialog">
          <header className="tool-reference-panel__head">
            <h2>{title}</h2>
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>{tr("닫기", "Close")}</button>
          </header>
          <div className="condition-dialog__body">{children}</div>
        </ModalDialog>
      )}
    </section>
  );
}
