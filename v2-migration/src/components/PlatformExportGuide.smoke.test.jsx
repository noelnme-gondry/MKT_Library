// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import PlatformExportGuide, { platformExportNames } from "./PlatformExportGuide";

afterEach(cleanup);

describe("PlatformExportGuide", () => {
  it("KO 5-2: Meta 두 화면의 열과 읽지 않는 열의 사유를 보여 준다", () => {
    render(<PlatformExportGuide toolId="5-2" locale="ko" />);
    expect(screen.getByRole("heading", { level: 2, name: "플랫폼에서 내보낸 파일 그대로 올리기" })).toBeTruthy();
    const table = screen.getByRole("region", { name: "Meta 광고 관리자 (한글 화면) 열 연결" });
    expect(within(table).getByText("지출 금액 (KRW)")).toBeTruthy();
    expect(within(table).getByText("비용")).toBeTruthy();
    expect(screen.getAllByText(/D7 매출과 시간 의미가 달라/).length).toBe(2);
    // 검증할 수 없는 한계를 같은 화면에서 말한다.
    expect(screen.getByText(/계정 언어·열 설정에 따라 다를 수 있습니다/)).toBeTruthy();
  });

  it("EN 5-27: 두 스토어 콘솔을 영어로만 보여 준다", () => {
    const { container } = render(<PlatformExportGuide toolId="5-27" locale="en" />);
    expect(screen.getByRole("heading", { level: 3, name: "Google Play Console" })).toBeTruthy();
    expect(screen.getByText("Store listing acquisitions")).toBeTruthy();
    expect(container.textContent).not.toMatch(/[가-힣]/);
  });

  it("5-22는 노출·클릭을 읽지 않으므로 그 열을 보여 주지 않는다", () => {
    render(<PlatformExportGuide toolId="5-22" locale="ko" />);
    const table = screen.getByRole("region", { name: "Meta 광고 관리자 (한글 화면) 열 연결" });
    expect(within(table).queryByText("노출")).toBeNull();
    expect(within(table).getByText("앱 설치")).toBeTruthy();
  });

  it("안내할 파일이 없는 도구는 아무것도 그리지 않는다", () => {
    const { container } = render(<PlatformExportGuide toolId="5-4" locale="ko" />);
    expect(container.innerHTML).toBe("");
    expect(platformExportNames("5-2", "ko")).toEqual(["Meta 광고 관리자"]);
    expect(platformExportNames("5-27", "en")).toEqual(["App Store Connect", "Google Play Console"]);
  });
});
