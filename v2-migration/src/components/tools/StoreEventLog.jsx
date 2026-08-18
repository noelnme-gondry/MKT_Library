"use client";

import React, { useRef, useState } from "react";
import Papa from "papaparse";
import { useAppStore } from "@/store/useDataStore";
import { downloadCsv } from "@/utils/download";
import { EVENT_TYPES, eventsFromEventRows, eventsToCsv, parseEventText } from "@/utils/storeEvents";
import { eventMarkerColor } from "@/utils/chartEventMarkers";

/**
 * 액션 로그 패널 — 세 경로로 들어온 이벤트를 한 목록에서 보여준다.
 *   ① 본 CSV의 event 컬럼 (읽기 전용 — 원본이 소유하므로 여기서 지우지 않는다)
 *   ② 별도 이벤트 CSV 업로드
 *   ③ 직접 추가 / 붙여넣기
 * ②③은 세션 메모리에 남고, 다운로드한 CSV를 ②로 되올리면 그대로 복구된다.
 */
export default function StoreEventLog({ locale = "ko", csvEvents = [], mergedEvents = [], offAxis = [] }) {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const manual = useAppStore((state) => state.storeEventsManual);
  const addStoreEvents = useAppStore((state) => state.addStoreEvents);
  const removeStoreEvent = useAppStore((state) => state.removeStoreEvent);
  const clearStoreEvents = useAppStore((state) => state.clearStoreEvents);

  const [draft, setDraft] = useState({ date: "", label: "", type: "creative", note: "" });
  const [paste, setPaste] = useState("");
  const [notice, setNotice] = useState("");
  const fileRef = useRef(null);

  const csvKeys = new Set(csvEvents.map((event) => `${event.date}::${event.label}`));

  const submitDraft = (submitEvent) => {
    submitEvent.preventDefault();
    if (!draft.date || !draft.label.trim()) {
      setNotice(tr("날짜와 내용을 모두 적어야 합니다.", "Both date and label are required."));
      return;
    }
    addStoreEvents([draft]);
    setDraft({ date: "", label: "", type: draft.type, note: "" });
    setNotice("");
  };

  const submitPaste = () => {
    const parsed = parseEventText(paste);
    if (!parsed.length) {
      setNotice(tr(
        "읽을 수 있는 이벤트가 없습니다. `2026-03-21, 스크린샷 교체` 형태나 DATE:/EVENT: 블록으로 적어 주세요.",
        "No readable events. Use `2026-03-21, Screenshot swap` or a DATE:/EVENT: block.",
      ));
      return;
    }
    addStoreEvents(parsed);
    setPaste("");
    setNotice(tr(`${parsed.length}건을 추가했습니다.`, `Added ${parsed.length} event(s).`));
  };

  const onFile = (changeEvent) => {
    const file = changeEvent.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => String(header).trim().toLowerCase(),
      complete: (results) => {
        const parsed = eventsFromEventRows(results.data || []);
        if (!parsed.length) {
          setNotice(tr("이벤트를 못 읽었습니다. date·event 열이 있는지 확인하세요.", "No events read — check for date and event columns."));
        } else {
          addStoreEvents(parsed);
          setNotice(tr(`${parsed.length}건을 불러왔습니다.`, `Loaded ${parsed.length} event(s).`));
        }
        if (fileRef.current) fileRef.current.value = "";
      },
      error: () => setNotice(tr("파일을 읽지 못했습니다.", "Could not read the file.")),
    });
  };

  const typeLabel = (value) => {
    const found = EVENT_TYPES.find((entry) => entry.value === value);
    return found ? (locale === "en" ? found.en : found.ko) : value;
  };

  return (
    <section className="block" id="aso-events">
      <h2 className="section-title">{tr("액션 로그", "Action log")}</h2>
      <p className="muted">{tr(
        "그날 무엇을 했는지 적어 두면 추이 차트에 세로선으로 표시됩니다. 조치와 숫자가 움직인 시점을 눈으로 맞춰 보는 용도예요 — 선이 겹친다고 그 조치가 원인이라는 뜻은 아닙니다.",
        "Log what you did and it appears as a vertical line on the trend chart. It lines up actions against movements — a line landing on a change does not make it the cause.",
      )}</p>

      <div className="event-log__inputs">
        <form className="event-log__form" onSubmit={submitDraft}>
          <h3 className="event-log__subtitle">{tr("직접 추가", "Add one")}</h3>
          <div className="event-log__row">
            <label>
              <span>{tr("날짜", "Date")}</span>
              <input type="date" value={draft.date} onChange={(changeEvent) => setDraft({ ...draft, date: changeEvent.target.value })} required />
            </label>
            <label>
              <span>{tr("종류", "Type")}</span>
              <select value={draft.type} onChange={(changeEvent) => setDraft({ ...draft, type: changeEvent.target.value })}>
                {EVENT_TYPES.map((entry) => <option key={entry.value} value={entry.value}>{locale === "en" ? entry.en : entry.ko}</option>)}
              </select>
            </label>
          </div>
          <label>
            <span>{tr("내용", "What happened")}</span>
            <input
              type="text" maxLength={60} value={draft.label}
              placeholder={tr("예: 스크린샷 1번 교체", "e.g. Swapped first screenshot")}
              onChange={(changeEvent) => setDraft({ ...draft, label: changeEvent.target.value })} required
            />
          </label>
          <button type="submit" className="btn btn-primary">{tr("추가", "Add")}</button>
        </form>

        <div className="event-log__form">
          <h3 className="event-log__subtitle">{tr("여러 건 붙여넣기", "Paste several")}</h3>
          <textarea
            rows={5} value={paste} onChange={(changeEvent) => setPaste(changeEvent.target.value)}
            placeholder={tr(
              "2026-03-21, 스크린샷 1번 교체, creative\n2026-04-11, UA 예산 2배 증액, campaign",
              "2026-03-21, Swapped first screenshot, creative\n2026-04-11, Doubled UA budget, campaign",
            )}
          />
          <div className="event-log__row">
            <button type="button" className="btn" onClick={submitPaste}>{tr("읽어들이기", "Parse")}</button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>{tr("이벤트 CSV 올리기", "Upload event CSV")}</button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: "none" }} />
          </div>
        </div>
      </div>

      {notice && <p className="event-log__notice">{notice}</p>}

      {mergedEvents.length === 0 ? (
        <p className="muted">{tr("아직 등록된 이벤트가 없습니다.", "No events logged yet.")}</p>
      ) : (
        <>
          <ul className="event-log__list">
            {mergedEvents.map((event) => {
              const fromCsv = csvKeys.has(`${event.date}::${event.label}`);
              return (
                <li key={`${event.date}::${event.label}`} className="event-log__item">
                  <span className="event-log__dot" style={{ background: eventMarkerColor(event.type) }} aria-hidden="true" />
                  <span className="event-log__date">{event.date}</span>
                  <span className="event-log__type">{typeLabel(event.type)}</span>
                  <span className="event-log__label">{event.label}</span>
                  {event.note && <span className="event-log__note">{event.note}</span>}
                  {fromCsv ? (
                    <span className="event-log__origin">{tr("CSV 컬럼", "from CSV")}</span>
                  ) : (
                    <button
                      type="button" className="event-log__remove"
                      onClick={() => removeStoreEvent(event.date, event.label)}
                      aria-label={tr(`${event.date} ${event.label} 삭제`, `Remove ${event.date} ${event.label}`)}
                    >×</button>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="event-log__row">
            <button
              type="button" className="btn"
              onClick={() => downloadCsv(`﻿${eventsToCsv(mergedEvents)}`, "aso-store-events")}
            >{tr("이벤트 CSV 내려받기", "Download event CSV")}</button>
            {manual.length > 0 && (
              <button type="button" className="btn" onClick={clearStoreEvents}>
                {tr(`직접 추가한 ${manual.length}건 비우기`, `Clear ${manual.length} added`)}
              </button>
            )}
          </div>
          <p className="muted">{tr(
            "직접 추가한 이벤트는 새로고침하면 사라집니다. 오래 쓰려면 CSV로 내려받아 두었다가 다음에 다시 올리세요.",
            "Added events are cleared on refresh. Download the CSV and re-upload it next time to keep them.",
          )}</p>
        </>
      )}

      {offAxis.length > 0 && (
        <p className="event-log__notice">{tr(
          `데이터 기간 밖이라 차트에 표시되지 않은 이벤트 ${offAxis.length}건: ${offAxis.map((event) => event.date).join(", ")}`,
          `${offAxis.length} event(s) fall outside the data range and are not drawn: ${offAxis.map((event) => event.date).join(", ")}`,
        )}</p>
      )}
    </section>
  );
}
