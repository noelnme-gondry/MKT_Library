// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import GoogleSheetConnect, { fetchSheetTable } from "./GoogleSheetConnect";
import { listSheetSources, rememberSheetSource } from "@/lib/data-import/localHistory";

vi.mock("@/lib/data-import/localHistory", () => ({
  forgetSheetSource: vi.fn(() => Promise.resolve()),
  listSheetSources: vi.fn(() => Promise.resolve([])),
  rememberSheetSource: vi.fn(),
}));

describe("GoogleSheetConnect import outcome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY = "public-test-key";
    listSheetSources.mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY;
    delete globalThis.fetch;
  });

  it("does not turn a successful import into a failure when recent-source storage rejects", async () => {
    const responses = [
      { properties: { title: "Private title" }, sheets: [{ properties: { sheetId: 0, title: "Sheet1" } }] },
      { values: [["Date", "Spend"], ["2026-01-01", "100"]] },
    ];
    globalThis.fetch = vi.fn(async () => ({
      status: 200,
      ok: true,
      json: async () => responses.shift(),
    }));
    rememberSheetSource.mockRejectedValue(new Error("indexeddb unavailable"));
    const onLoaded = vi.fn(() => Promise.resolve());
    const onError = vi.fn();

    render(<GoogleSheetConnect toolId="5-2" onLoaded={onLoaded} onError={onError} locale="ko" />);
    fireEvent.click(screen.getByRole("button", { name: /공개 Google Sheets에서 불러오기/ }));
    fireEvent.change(screen.getByLabelText("구글 시트 링크"), {
      target: { value: "https://docs.google.com/spreadsheets/d/test-sheet/edit#gid=0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "불러오기" }));

    await waitFor(() => expect(onLoaded).toHaveBeenCalledTimes(1));
    expect(rememberSheetSource).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalledWith(expect.any(String), "sheet_fetch");
  });

  it("reads an anyone-with-link spreadsheet through its browser CSV export when no API key is configured", async () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY;
    globalThis.fetch = vi.fn(async () => ({
      status: 200,
      ok: true,
      text: async () => "Date,Spend\n2026-01-01,100\n",
    }));

    const result = await fetchSheetTable(undefined, "https://docs.google.com/spreadsheets/d/public-sheet/edit#gid=7");

    expect(globalThis.fetch).toHaveBeenCalledWith("https://docs.google.com/spreadsheets/d/public-sheet/export?format=csv&gid=7");
    expect(result.headers).toEqual(["Date", "Spend"]);
    expect(result.raw).toEqual([{ Date: "2026-01-01", Spend: "100" }]);
  });
});

describe("GoogleSheetConnect cancel affordance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listSheetSources.mockResolvedValue([]);
  });

  it("offers cancel when the visitor opened the form themselves", async () => {
    render(<GoogleSheetConnect onLoaded={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Google Sheets에서 불러오기/ }));
    // 스스로 연 폼은 취소하면 원래의 pill 버튼으로 돌아간다 — 갈 곳이 있다.
    expect(screen.getByRole("button", { name: "취소" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Google Sheets에서 불러오기/ })).toBeTruthy());
  });

  it("offers cancel when the parent hands back a view to return to", () => {
    render(<GoogleSheetConnect initialOpen onCancel={() => {}} onLoaded={() => {}} />);
    expect(screen.getByRole("button", { name: "취소" })).toBeTruthy();
  });

  it("hides cancel when the form is opened by the parent with nowhere to return to", () => {
    // 도치 접수처·첫 방문 오버레이가 이 경우다. 눌러도 화면이 달라지지 않는
    // 버튼은 어포던스가 아니라 노이즈다.
    render(<GoogleSheetConnect initialOpen onLoaded={() => {}} />);
    expect(screen.queryByRole("button", { name: "취소" })).toBe(null);
    expect(screen.getByRole("button", { name: "불러오기" })).toBeTruthy();
  });
});
