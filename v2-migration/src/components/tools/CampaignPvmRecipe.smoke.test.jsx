// @vitest-environment jsdom
//
// 5-21 레시피(명령 입력창) 배선 스모크 — docs/result-autonomy-spec.md §4.
// 순수 어댑터는 lib/recipe/pvmRecipe.test.js가 보고, 여기서는 엔진(buildPvmCache)과 화면이
// 실제로 레시피를 따르는지, 그리고 축·범위를 바꿔도 항등식(Σ = 전체 변화)이 지켜지는지 본다.
import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import CampaignPvm, { buildPvmCache } from "@/components/tools/CampaignPvm";

const EMPTY_FILTER = () => ({
  dateStart: null, dateEnd: null, compareEnabled: false, comparisonStart: null, comparisonEnd: null,
  comparisonPreset: "previous", platforms: new Set(), countries: new Set(), channels: new Set(), sources: new Set(),
});

// 3주(2026-01-05 월 ~ 01-25) × OS 2 × 채널 2. 뒤 주로 갈수록 iOS·Meta 비중이 늘고 단가가 달라진다(결정론).
function makeSlice({ withChannel = true, caseVariants = false } = {}) {
  const headers = ["Date", "OS", "Channel", "Campaign", "Region", "Spend", "Installs"];
  const mapping = { Date: "date", OS: "platform", Campaign: "campaign_name", Spend: "cost", Installs: "installs" };
  if (withChannel) mapping.Channel = "channel";
  const raw = [];
  for (let d = 5; d <= 25; d += 1) {
    const date = `2026-01-${String(d).padStart(2, "0")}`;
    for (const os of ["iOS", "Android"]) {
      for (const ch of ["Meta", "TikTok"]) {
        const cost = (os === "iOS" ? 90000 : 60000) + (ch === "Meta" ? d * 4000 : d * 1000);
        const cpi = (os === "iOS" ? 5200 : 3900) + (ch === "Meta" ? d * 20 : -d * 10);
        const channel = caseVariants && ch === "Meta" && d % 3 === 0 ? "meta" : ch;
        raw.push({ Date: date, OS: os, Channel: channel, Campaign: `${ch}_${os}`, Region: d % 3 ? "수도권" : "지방", Spend: cost, Installs: Math.round(cost / cpi) });
      }
    }
  }
  return { raw, headers, mapping, fileName: "pvm_recipe.csv" };
}

function seed(slice) {
  useAppStore.setState({
    currentRouteId: "5-21",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice },
    csvData: slice,
    dashboardFilter: EMPTY_FILTER(),
    viewConfig: {},
    savedSetupAppliedInputs: {},
    savedSetupAppliedTool: null,
  });
}

const baseState = () => ({
  metric: "cpi", weekBasis: "calendar", lookback: 1, currency: "krw", denomBasis: "installs",
  dashboardFilter: EMPTY_FILTER(), locale: "ko", domain: "performance",
});
const sum = (rows) => rows.reduce((acc, row) => acc + row.contribution, 0);

describe("buildPvmCache — 레시피 축·범위", () => {
  it("축을 OS → 채널로 바꿔도 전체 변화는 같고 Σ 항등식이 성립한다", () => {
    const slice = makeSlice();
    const byChannel = buildPvmCache(slice, baseState());
    const byOs = buildPvmCache(slice, { ...baseState(), levelKeys: { ch: "platform", cmp: "channel", cr: null } });
    expect(byChannel.identity.ok).toBe(true);
    expect(byOs.identity.ok).toBe(true);
    expect(byOs.deltaCpa).toBeCloseTo(byChannel.deltaCpa, 9);
    expect(byOs.layer1.map((row) => row.key).sort()).toEqual(["Android", "iOS"]);
    expect(sum(byOs.layer1)).toBeCloseTo(byOs.deltaCpa, 9);
    // 하위(채널) 합 = 상위(OS) 기여 — 롤업 항등식.
    for (const os of byOs.layer1) {
      expect(sum(byOs.layer2.filter((row) => row.chKey === os.key))).toBeCloseTo(os.contribution, 9);
    }
  });

  it("분석 범위 필터는 다시 분해하고(숫자가 바뀐다), 합계 항등식은 유지된다", () => {
    const slice = makeSlice();
    const all = buildPvmCache(slice, baseState());
    const metaOnly = buildPvmCache(slice, { ...baseState(), recipeFilters: [{ field: "channel", op: "in", scope: "analysis", values: ["Meta"] }] });
    expect(metaOnly.layer1.map((row) => row.key)).toEqual(["Meta"]);
    expect(metaOnly.deltaCpa).not.toBeCloseTo(all.deltaCpa, 3);
    expect(sum(metaOnly.layer1)).toBeCloseTo(metaOnly.deltaCpa, 9);
  });

  it("대소문자만 다른 값은 기본으로 합치고, 구분하기면 따로 계산한다", () => {
    const slice = makeSlice({ caseVariants: true });
    const merged = buildPvmCache(slice, baseState());
    expect(merged.layer1.map((row) => row.key).sort()).toEqual(["Meta", "TikTok"]);
    expect(merged.valueMerges).toEqual([{ field: "channel", to: "Meta", from: expect.arrayContaining(["Meta", "meta"]) }]);
    const separate = buildPvmCache(slice, { ...baseState(), caseSensitive: true });
    expect(separate.layer1.map((row) => row.key).sort()).toEqual(["Meta", "TikTok", "meta"]);
  });

  it("채널 컬럼이 없어도 캠페인 축으로 분해한다", () => {
    const cache = buildPvmCache(makeSlice({ withChannel: false }), baseState());
    expect(cache.identity.ok).toBe(true);
    expect(cache.layer1.map((row) => row.key).sort()).toEqual(["Meta_Android", "Meta_iOS", "TikTok_Android", "TikTok_iOS"]);
  });
});

describe("축을 바꾼 결과의 파일·툴팁 문구", () => {
  it("분해 축 이름이 CSV와 진단 문구에 들어간다", async () => {
    const { buildPvmResultCsv, pvmGenerateDiagnosis } = await import("@/utils/pvmExport");
    const cache = buildPvmCache(makeSlice(), { ...baseState(), levelKeys: { ch: "platform", cmp: "channel", cr: null } });
    const csv = buildPvmResultCsv({ ...cache, levelNames: ["OS", "채널"] }, "CPI", "ko");
    expect(csv).toContain("분해 축(CHANNEL > CAMPAIGN > CREATIVE_FULL),OS > 채널");
    // 기본 축이면 행을 더하지 않는다(기존 파일 byte-동일).
    expect(buildPvmResultCsv(cache, "CPI", "ko")).not.toContain("분해 축");
    const tip = pvmGenerateDiagnosis(cache.layer1[0], "channel", String, "ko", "CPI", { channel: { ko: "OS", en: "OS" } });
    expect(tip).toContain("이 OS");
  });
});

describe("CampaignPvm — 명령 입력창", () => {
  beforeEach(() => seed(makeSlice()));

  const type = (text) => fireEvent.change(screen.getByRole("combobox"), { target: { value: text } });
  const choose = (label) => {
    const option = screen.getAllByRole("option").find((node) => node.querySelector("span")?.textContent === label);
    expect(option, `${label} 후보가 없다`).toBeTruthy();
    fireEvent.mouseDown(option);
  };

  it("분석 설정 입력창은 필터 막대 안에 있다 — 따로 떨어진 구역이 없다", () => {
    const { container } = render(<CampaignPvm />);
    expect(container.querySelector("#s-pvm-recipe")).toBeNull();
    const slot = container.querySelector(".tool-instrument-header .dashboard-filter-bar__command");
    expect(slot?.querySelector("[role=combobox]")).toBeTruthy();
    // 입력창이 필터 선택보다 위에 온다.
    const scope = container.querySelector(".dashboard-filter-bar__scope");
    expect(slot.compareDocumentPosition(scope) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("'Meta만 분석'은 칩이 아니라 공용 채널 필터로 들어가고, 필터 칩으로 보인다", () => {
    render(<CampaignPvm />);
    type("Meta만");
    choose("Meta만 분석");
    expect([...useAppStore.getState().dashboardFilter.channels]).toEqual(["Meta"]);
    // 레시피에는 단계가 생기지 않는다(같은 조건이 두 곳에 살지 않게).
    expect(useAppStore.getState().viewConfig["analysis-inputs:5-21"]?.recipeSteps || []).toEqual([]);
    expect(screen.getByRole("button", { name: "채널: Meta 빼기" })).toBeTruthy();
    // 필터 막대의 채널 버튼도 같은 값을 말한다.
    expect(document.querySelector(".mon-multisel-btn.is-active")?.textContent).toContain("Meta");
    fireEvent.click(screen.getByRole("button", { name: "채널: Meta 빼기" }));
    expect(useAppStore.getState().dashboardFilter.channels.size).toBe(0);
  });

  it("'X 제외하고 분석'은 나머지 값만 필터에 남긴다", () => {
    render(<CampaignPvm />);
    type("iOS 제외");
    choose("iOS 제외하고 분석");
    expect([...useAppStore.getState().dashboardFilter.platforms]).toEqual(["Android"]);
    expect(screen.getByRole("button", { name: "플랫폼: Android 빼기" })).toBeTruthy();
  });

  it("필터 막대에서 고른 조건도 입력창 칩 줄에 보인다", () => {
    useAppStore.setState({ dashboardFilter: { ...EMPTY_FILTER(), platforms: new Set(["iOS"]), dateStart: "2026-01-12" } });
    render(<CampaignPvm />);
    expect(screen.getByRole("button", { name: "플랫폼: iOS 빼기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "기간 2026-01-12 ~ 끝 빼기" })).toBeTruthy();
  });

  it("대소문자만 다른 원본 표기까지 함께 필터에 넣는다", () => {
    seed(makeSlice({ caseVariants: true }));
    render(<CampaignPvm />);
    type("Meta만");
    choose("Meta만 분석");
    expect([...useAppStore.getState().dashboardFilter.channels].sort()).toEqual(["Meta", "meta"]);
  });

  it("'OS별' → 첫 표가 OS별 결과가 되고 칩이 남는다", () => {
    const { container } = render(<CampaignPvm />);
    type("OS");
    choose("OS별");
    expect(within(container.querySelector("#s-pvm-channels")).getByRole("heading").textContent).toBe("OS별 결과");
    expect(screen.getByRole("button", { name: "OS별 빼기" })).toBeTruthy();
    // 2단이 없으니 캠페인·소재 표는 그리지 않는다.
    expect(container.querySelector("#s-pvm-campaigns")).toBeNull();
    // 칩을 빼면 기본(채널)으로 돌아온다.
    fireEvent.click(screen.getByRole("button", { name: "OS별 빼기" }));
    expect(within(container.querySelector("#s-pvm-channels")).getByRole("heading").textContent).toBe("채널별 결과");
  });

  it("매핑 안 된 CSV 컬럼(Region)도 축이 된다", () => {
    const { container } = render(<CampaignPvm />);
    type("Region");
    choose("Region별");
    const table = container.querySelector("#s-pvm-channels table");
    expect(table.textContent).toContain("수도권");
    expect(table.textContent).toContain("지방");
  });

  it("보기 설정은 표만 줄이고 Σ는 가린 행까지 전체로 계산한다", () => {
    const { container } = render(<CampaignPvm />);
    const sigmaBefore = container.querySelector("#s-pvm-channels .callout").textContent;
    type("상위 5");
    choose("상위 5개만 보기");
    // 채널이 2개라 5개 상한은 아무것도 가리지 않는다 → 안내도 없다.
    expect(container.querySelector("#s-pvm-channels").textContent).not.toContain("행을 가렸습니다");
    fireEvent.click(screen.getByRole("button", { name: "상위 5개만 보기 빼기" }));
    type("개선만");
    choose("개선만 보기");
    const section = container.querySelector("#s-pvm-channels");
    const rows = section.querySelectorAll("tbody tr");
    expect(rows.length).toBeLessThanOrEqual(2);
    expect(section.querySelector(".callout").textContent).toBe(sigmaBefore);
  });

  it("블록 숨기기 — 핵심 그림·요약은 숨고, 항등식 확인은 숨기기 단어 자체가 없다", () => {
    const { container } = render(<CampaignPvm />);
    type("핵심");
    choose("핵심 그림 숨기기");
    expect(container.querySelector(".tool-core-figure")).toBeNull();
    type("성과 변화");
    choose("성과 변화 요약 숨기기");
    expect(container.querySelector("#s-pvm-scorecard")).toBeNull();
    type("항등식");
    expect(screen.queryAllByRole("option").some((node) => node.textContent.includes("항등식 확인 숨기기"))).toBe(false);
  });

  it("다운로드 설정 단어(PNG 머리글·보고서 구획·파일 이름)도 칩이 되고 저장된다", () => {
    render(<CampaignPvm />);
    type("파일");
    choose("파일 이름: 도구_기간");
    type("PNG");
    choose("PNG에 제목만 넣기");
    type("보고서");
    choose("보고서에서 그림 빼기");
    expect(screen.getByRole("button", { name: "파일 이름: 도구_기간 빼기" })).toBeTruthy();
    expect(useAppStore.getState().viewConfig["analysis-inputs:5-21"].recipeSteps.map((step) => step.id))
      .toEqual(["export.filename.toolPeriod", "export.png.title", "export.report.hide"]);
  });

  it("한계 문구 빼고 받기를 고르면 파일에 무엇이 남는지 화면이 말한다", () => {
    render(<CampaignPvm />);
    type("한계");
    choose("한계 문구 빼고 받기");
    expect(screen.getByText(/분석 한계 문구를 빼고, 뺐다는 사실만 한 줄로/)).toBeTruthy();
  });

  it("지표 알약을 눌러도 칩(레시피)이 된다 — 두 벌 상태가 없다", () => {
    render(<CampaignPvm />);
    fireEvent.click(screen.getByRole("radio", { name: /2주전/ }));
    expect(screen.getByRole("button", { name: "2주 전과 비교 빼기" })).toBeTruthy();
    expect(useAppStore.getState().viewConfig["analysis-inputs:5-21"].recipeSteps).toEqual([{ id: "period.lookback.2", params: {} }]);
  });

  it("대소문자 합치기를 화면에 알린다", () => {
    seed(makeSlice({ caseVariants: true }));
    render(<CampaignPvm />);
    expect(screen.getByText(/같은 값 'Meta'로 합쳤습니다/)).toBeTruthy();
  });
});
