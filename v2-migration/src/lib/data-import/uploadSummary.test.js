import { describe, expect, test } from "vitest";
import { summarizeUpload } from "./uploadSummary";
import { PLATFORM_EXPORTS, platformExportHeaders } from "@/lib/platformExports";

describe("올린 파일 한 줄 요약", () => {
  test("행 수·기간은 실제 기록에서", () => {
    const summary = summarizeUpload({
      fileName: "a.csv",
      raw: new Array(1200).fill({}),
      headers: ["date", "cost"],
      canonicalData: { records: [{ date: "2026-09-13" }, { date: "2026-08-31" }, { date: null }, { date: "2026-09-01" }] },
    });
    expect(summary).toEqual({ fileName: "a.csv", rows: "1,200행", period: "2026-08-31 – 2026-09-13", format: null });
  });

  test("날짜가 없으면 기간을 지어내지 않는다", () => {
    expect(summarizeUpload({ raw: [{}], headers: ["x"], canonicalData: { records: [{ date: null }] }, locale: "en" }))
      .toMatchObject({ rows: "1 row", period: null });
  });

  test("확인된 내보내기 형식은 열 이름이 전부 있을 때만 말한다", () => {
    const meta = PLATFORM_EXPORTS.find((entry) => entry.id === "meta-ads-ko");
    expect(summarizeUpload({ headers: platformExportHeaders(meta) }).format).toBe("Meta 광고 관리자 (한글 화면) 형식");
    expect(summarizeUpload({ headers: platformExportHeaders(meta), locale: "en" }).format).toBe("Meta Ads Manager (Korean UI) format");
    // 하나라도 빠지면 그 매체 파일이라고 말할 근거가 없다.
    expect(summarizeUpload({ headers: Object.keys(meta.columns).slice(1) }).format).toBeNull();
  });
});
