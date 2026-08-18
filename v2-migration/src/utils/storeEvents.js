/* ============================================================
 * storeEvents — 스토어 운영 이벤트(액션 로그) 정규화 · 병합 · 직렬화
 *
 * "3월 21일에 스크린샷을 갈았다"를 차트 위에 세로선으로 찍어, 전환율이 꺾인
 * 지점과 우리가 한 행동을 눈으로 맞춰 보게 하는 데 쓴다. 인과를 주장하는
 * 장치가 아니라 **가설을 세우는 단서**다(§8) — 렌더층에서도 그렇게 말한다.
 *
 * 입력 경로가 셋이고 전부 같은 정규형으로 모인다:
 *   1) 본 CSV의 event 컬럼        eventsFromRows()
 *   2) 별도 이벤트 CSV            eventsFromEventRows()   (한 날짜에 여러 건 가능)
 *   3) 도구 안에서 직접 추가       normalizeEvent()  + 다운로드는 eventsToCsv()
 * 셋 다 mergeEvents()로 합치고, 같은 (날짜·라벨)은 한 건으로 접는다.
 * ============================================================ */

// 액션 종류. value는 CSV·저장에 쓰는 안정 키이므로 바꾸지 말 것(저장본 호환).
export const EVENT_TYPES = [
  { value: "listing", ko: "스토어 등록정보", en: "Store listing" },
  { value: "creative", ko: "스크린샷·아이콘", en: "Screenshot / icon" },
  { value: "price", ko: "가격·프로모션", en: "Price / promotion" },
  { value: "campaign", ko: "광고 집행", en: "Ad campaign" },
  { value: "release", ko: "앱 릴리스", en: "App release" },
  { value: "external", ko: "외부 요인", en: "External factor" },
  { value: "other", ko: "기타", en: "Other" },
];

const TYPE_KEYS = new Set(EVENT_TYPES.map((entry) => entry.value));

// 한글·영문 표기를 안정 키로 되돌린다(사용자가 라벨을 그대로 적어 오는 경우).
const TYPE_ALIASES = new Map([
  ...EVENT_TYPES.map((entry) => [entry.ko, entry.value]),
  ...EVENT_TYPES.map((entry) => [entry.en.toLowerCase(), entry.value]),
  ["스크린샷", "creative"], ["아이콘", "creative"], ["소재", "creative"],
  ["등록정보", "listing"], ["키워드", "listing"], ["제목", "listing"],
  ["가격", "price"], ["할인", "price"], ["프로모션", "price"],
  ["광고", "campaign"], ["캠페인", "campaign"], ["ua", "campaign"],
  ["릴리스", "release"], ["업데이트", "release"], ["release", "release"],
  ["피처링", "external"], ["시즌", "external"], ["featuring", "external"],
]);

export function normalizeEventType(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "other";
  const lower = text.toLowerCase();
  if (TYPE_KEYS.has(lower)) return lower;
  return TYPE_ALIASES.get(text) || TYPE_ALIASES.get(lower) || "other";
}

// YYYY-MM-DD만 인정한다. 2026/03/21·2026.03.21도 받아 정규화한다.
// 로컬 타임존 파싱을 피하려고 Date를 아예 안 쓴다(§7 날짜 UTC 함정).
export function normalizeEventDate(raw) {
  const text = String(raw ?? "").trim();
  const match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!match) return "";
  const [, year, month, day] = match;
  const mm = Number(month);
  const dd = Number(day);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return "";
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

const clip = (value, max) => String(value ?? "").trim().slice(0, max);

/** 원본 한 건 → 정규형 이벤트. 날짜나 라벨이 없으면 null(억지로 만들지 않는다). */
export function normalizeEvent(raw) {
  if (!raw || typeof raw !== "object") return null;
  const date = normalizeEventDate(raw.date ?? raw.DATE ?? raw.날짜);
  const label = clip(raw.label ?? raw.event ?? raw.EVENT ?? raw.이벤트 ?? raw.action, 60);
  if (!date || !label) return null;
  return {
    date,
    label,
    type: normalizeEventType(raw.type ?? raw.TYPE ?? raw.종류 ?? raw.category),
    note: clip(raw.note ?? raw.SUMMARY ?? raw.summary ?? raw.메모 ?? raw.설명, 300),
  };
}

const eventKey = (event) => `${event.date}::${event.label}`;

/** 여러 소스의 이벤트를 합치고 (날짜·라벨) 중복을 접는다. 정렬은 결정론적. */
export function mergeEvents(...lists) {
  const byKey = new Map();
  for (const list of lists) {
    for (const raw of list || []) {
      const event = normalizeEvent(raw);
      if (!event) continue;
      const prev = byKey.get(eventKey(event));
      // 나중 소스가 메모·종류를 채워 주면 받아들이되, 이미 있는 값은 덮지 않는다.
      if (prev) {
        if (!prev.note && event.note) prev.note = event.note;
        if (prev.type === "other" && event.type !== "other") prev.type = event.type;
        continue;
      }
      byKey.set(eventKey(event), { ...event });
    }
  }
  return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
}

/** ① 본 CSV의 event 컬럼에서. 같은 날 같은 라벨이 반복되는 것은 mergeEvents가 접는다. */
export function eventsFromRows(rows, field = "event") {
  return mergeEvents((rows || []).map((row) => ({ date: row?.date, label: row?.[field], type: row?.event_type, note: row?.event_note })));
}

/** ② 별도 이벤트 CSV. 한 날짜에 여러 행을 두면 그대로 여러 건이 된다. */
export function eventsFromEventRows(rows) {
  return mergeEvents(rows || []);
}

/**
 * ③ 붙여넣기 파싱. 두 형태를 받는다.
 *   - 블록형: `EVENT: ...` / `DATE: ...` / `TYPE: ...` / `SUMMARY: ...` (빈 줄로 구분)
 *   - 한 줄형: `2026-03-21, 스크린샷 교체, creative, 메모`
 * 어느 쪽도 아니면 그 줄은 조용히 버린다(잘못 만든 이벤트보다 없는 편이 낫다).
 */
export function parseEventText(text) {
  const source = String(text ?? "");
  if (!source.trim()) return [];
  const events = [];
  for (const block of source.split(/\n\s*\n/)) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;
    const fields = {};
    const plain = [];
    for (const line of lines) {
      const match = line.match(/^([A-Za-z가-힣_]+)\s*[:：]\s*(.*)$/);
      if (match) fields[match[1].toLowerCase()] = match[2].trim();
      else plain.push(line);
    }
    if (fields.date || fields.날짜) {
      events.push({
        date: fields.date || fields.날짜,
        label: fields.event || fields.이벤트 || fields.label || "",
        type: fields.type || fields.종류 || "",
        note: fields.summary || fields.note || fields.메모 || "",
      });
    }
    // 블록 안의 비-키 줄, 또는 키가 하나도 없던 블록은 한 줄형으로 재시도한다.
    for (const line of plain) {
      const cells = line.split(",").map((cell) => cell.trim());
      if (cells.length >= 2) events.push({ date: cells[0], label: cells[1], type: cells[2] || "", note: cells.slice(3).join(", ") });
    }
  }
  return mergeEvents(events);
}

const csvCell = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** 저장·재업로드용 CSV. 그대로 ②경로로 다시 올릴 수 있는 헤더를 쓴다. */
export function eventsToCsv(events) {
  const header = ["date", "event", "type", "note"];
  const lines = [header, ...mergeEvents(events).map((event) => [event.date, event.label, event.type, event.note])];
  return lines.map((line) => line.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/**
 * 차트 x축(날짜 배열)에 이벤트를 붙인다. 축에 없는 날짜는 버리지 않고
 * `offAxis`로 돌려준다 — 조용히 사라지면 "왜 안 보이지"가 되기 때문이다.
 */
export function alignEventsToAxis(events, dates) {
  const index = new Map((dates || []).map((date, position) => [date, position]));
  const onAxis = [];
  const offAxis = [];
  for (const event of mergeEvents(events)) {
    const position = index.get(event.date);
    if (position == null) offAxis.push(event);
    else onAxis.push({ ...event, index: position });
  }
  return { onAxis, offAxis };
}
