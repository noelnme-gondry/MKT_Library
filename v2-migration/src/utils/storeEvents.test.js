import { describe, expect, it } from "vitest";
import {
  alignEventsToAxis,
  EVENT_TYPES,
  eventsFromEventRows,
  eventsFromRows,
  eventsToCsv,
  mergeEvents,
  normalizeEvent,
  normalizeEventDate,
  normalizeEventType,
  parseEventText,
} from "@/utils/storeEvents";

describe("normalizeEventDate", () => {
  it("구분자가 달라도 YYYY-MM-DD로 모은다", () => {
    expect(normalizeEventDate("2026-03-21")).toBe("2026-03-21");
    expect(normalizeEventDate("2026/3/7")).toBe("2026-03-07");
    expect(normalizeEventDate("2026.12.31")).toBe("2026-12-31");
  });

  it("날짜가 아니면 빈 문자열 — 억지로 만들지 않는다", () => {
    expect(normalizeEventDate("어제")).toBe("");
    expect(normalizeEventDate("2026-13-01")).toBe("");
    expect(normalizeEventDate("")).toBe("");
    expect(normalizeEventDate(null)).toBe("");
  });
});

describe("normalizeEventType", () => {
  it("표기가 달라도 안정 키로 모은다", () => {
    expect(normalizeEventType("creative")).toBe("creative");
    expect(normalizeEventType("스크린샷")).toBe("creative");
    expect(normalizeEventType("Screenshot / icon")).toBe("creative");
    expect(normalizeEventType("피처링")).toBe("external");
  });

  it("모르는 값은 other로 두고 버리지 않는다", () => {
    expect(normalizeEventType("무언가")).toBe("other");
    expect(normalizeEventType("")).toBe("other");
  });

  it("EVENT_TYPES는 KO·EN 라벨을 모두 갖는다", () => {
    for (const entry of EVENT_TYPES) {
      expect(entry.ko.trim()).not.toBe("");
      expect(entry.en.trim()).not.toBe("");
      expect(/[가-힣]/.test(entry.en), `${entry.value} EN 라벨에 한글`).toBe(false);
    }
  });
});

describe("normalizeEvent", () => {
  it("날짜나 라벨이 없으면 null", () => {
    expect(normalizeEvent({ date: "2026-03-21" })).toBeNull();
    expect(normalizeEvent({ label: "스크린샷 교체" })).toBeNull();
    expect(normalizeEvent(null)).toBeNull();
  });

  it("라벨은 60자, 메모는 300자로 자른다", () => {
    const event = normalizeEvent({ date: "2026-03-21", label: "가".repeat(80), note: "나".repeat(400) });
    expect(event.label).toHaveLength(60);
    expect(event.note).toHaveLength(300);
  });
});

describe("mergeEvents", () => {
  it("날짜·라벨 오름차순으로 결정론 정렬", () => {
    const merged = mergeEvents([
      { date: "2026-03-21", label: "나중" },
      { date: "2026-03-01", label: "먼저" },
      { date: "2026-03-21", label: "가나다" },
    ]);
    expect(merged.map((event) => `${event.date}/${event.label}`)).toEqual([
      "2026-03-01/먼저", "2026-03-21/가나다", "2026-03-21/나중",
    ]);
  });

  it("같은 날짜·라벨은 한 건으로 접고 빈 칸만 채운다", () => {
    const merged = mergeEvents(
      [{ date: "2026-03-21", label: "스크린샷 교체" }],
      [{ date: "2026-03-21", label: "스크린샷 교체", type: "creative", note: "1번 이미지" }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].type).toBe("creative");
    expect(merged[0].note).toBe("1번 이미지");
  });

  it("먼저 온 값을 나중 소스가 덮지 않는다", () => {
    const merged = mergeEvents(
      [{ date: "2026-03-21", label: "A", note: "원본" }],
      [{ date: "2026-03-21", label: "A", note: "나중" }],
    );
    expect(merged[0].note).toBe("원본");
  });

  it("한 날짜에 여러 이벤트를 허용한다", () => {
    expect(mergeEvents([
      { date: "2026-03-21", label: "스크린샷 교체" },
      { date: "2026-03-21", label: "가격 인하" },
    ])).toHaveLength(2);
  });
});

describe("입력 경로 3종", () => {
  it("① 본 CSV의 event 컬럼에서 뽑는다", () => {
    const events = eventsFromRows([
      { date: "2026-03-01", event: "", installs: 10 },
      { date: "2026-03-21", event: "스크린샷 교체", event_type: "creative" },
      { date: "2026-03-21", event: "스크린샷 교체" },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("creative");
  });

  it("② 별도 이벤트 CSV — 한 날짜 여러 건", () => {
    const events = eventsFromEventRows([
      { date: "2026-03-21", event: "스크린샷 교체", type: "creative" },
      { date: "2026-03-21", event: "가격 인하", type: "price" },
    ]);
    expect(events.map((event) => event.type)).toEqual(["price", "creative"]);
  });

  it("③ 붙여넣기 — 블록형", () => {
    const events = parseEventText([
      "EVENT: 스크린샷 교체",
      "DATE: 2026-03-21",
      "TYPE: creative",
      "SUMMARY: 첫 장을 러닝 화면으로 바꿈",
    ].join("\n"));
    expect(events).toEqual([{ date: "2026-03-21", label: "스크린샷 교체", type: "creative", note: "첫 장을 러닝 화면으로 바꿈" }]);
  });

  it("③ 붙여넣기 — 한 줄형과 블록형 혼용", () => {
    const events = parseEventText("2026-03-01, 가격 인하, price\n\nEVENT: 피처링\nDATE: 2026-03-10\nTYPE: 피처링");
    expect(events.map((event) => `${event.date}/${event.label}/${event.type}`)).toEqual([
      "2026-03-01/가격 인하/price", "2026-03-10/피처링/external",
    ]);
  });

  it("파싱 안 되는 줄은 조용히 버린다 — 잘못된 이벤트를 만들지 않는다", () => {
    expect(parseEventText("아무 말이나 적었을 때")).toEqual([]);
    expect(parseEventText("")).toEqual([]);
    expect(parseEventText(null)).toEqual([]);
  });
});

describe("eventsToCsv", () => {
  it("재업로드 가능한 헤더로 내보낸다", () => {
    const csv = eventsToCsv([{ date: "2026-03-21", label: "스크린샷 교체", type: "creative", note: "" }]);
    expect(csv.split("\r\n")[0]).toBe("date,event,type,note");
    // 내보낸 것을 그대로 ②경로로 되읽으면 같은 이벤트가 나와야 한다.
    const [, row] = csv.split("\r\n");
    const [date, event, type] = row.split(",");
    expect(eventsFromEventRows([{ date, event, type }])[0].label).toBe("스크린샷 교체");
  });

  it("콤마·따옴표를 이스케이프한다", () => {
    const csv = eventsToCsv([{ date: "2026-03-21", label: 'A,B "C"', type: "other" }]);
    expect(csv).toContain('"A,B ""C"""');
  });
});

describe("alignEventsToAxis", () => {
  const dates = ["2026-03-01", "2026-03-02", "2026-03-03"];

  it("축 위치를 붙인다", () => {
    const { onAxis } = alignEventsToAxis([{ date: "2026-03-02", label: "X" }], dates);
    expect(onAxis[0].index).toBe(1);
  });

  it("축 밖 이벤트는 버리지 않고 따로 돌려준다", () => {
    const { onAxis, offAxis } = alignEventsToAxis([
      { date: "2026-03-02", label: "안" },
      { date: "2025-01-01", label: "밖" },
    ], dates);
    expect(onAxis).toHaveLength(1);
    expect(offAxis.map((event) => event.label)).toEqual(["밖"]);
  });

  it("빈 입력에서 throw 하지 않는다", () => {
    expect(alignEventsToAxis(null, null)).toEqual({ onAxis: [], offAxis: [] });
  });
});
