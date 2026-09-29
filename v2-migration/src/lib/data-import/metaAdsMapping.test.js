import { describe, expect, it } from "vitest";
import { buildMappingContract } from "@/lib/data-import/mappingContract";
import { PLATFORM_EXPORTS, platformExportHeaders } from "@/lib/platformExports";

// 헤더 목록은 템플릿 페이지가 보여 주는 SSOT(`lib/platformExports.js`)에서 가져온다 — 두 곳에 적으면 갈린다.
const exportHeaders = (id) => platformExportHeaders(PLATFORM_EXPORTS.find((entry) => entry.id === id));
import { buildCanonicalDataset } from "@/lib/data-import/buildCanonicalDataset";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { evaluateEligibility } from "@/lib/analysis-router/evaluateEligibility";
import { mapDataset } from "@/lib/data-import/semantic-mapper/mapDataset";
import { evaluateV2Eligibility } from "@/lib/data-import/schema/toolDataRequirements";

/**
 * Meta 광고 관리자에서 일별로 내보낸 CSV를 그대로 운영 대시보드(5-2)에 올리는 경로.
 *
 * 배경(2026-09-29 여정 점검): 한글 내보내기 헤더로 올리면 날짜·노출만 잡히고
 * 비용("지출 금액 (KRW)")·설치("앱 설치")가 `__ignore__`로 떨어져 결과가 열리지 않았다.
 * 영문판도 "Amount spent (USD)"의 통화 괄호 때문에 별칭 "amount spent"와 정확히 일치하지
 * 않아 같은 자리에서 막힌다. 데모 픽스처는 표준키를 헤더로 써서 이 실패가 보이지 않는다.
 *
 * 헤더 이름은 Meta 광고 관리자의 일반적인 표시 이름을 따른 것이다. 계정·언어 설정에 따라
 * 달라질 수 있으므로 실제 내보내기 파일로 한 번 더 확인할 것.
 */
const CASES = {
  "Meta 광고 관리자 (한글)": {
    headers: exportHeaders("meta-ads-ko"),
    row: (date, i) => ({ "일": date, "캠페인 이름": `KR_Install_${i}`, "광고 세트 이름": "set", "지출 금액 (KRW)": "412,300", "노출": "68000", "링크 클릭": "850", "앱 설치": "140", "구매 전환값": "448000" }),
    expect: { "일": "date", "캠페인 이름": "campaign_name", "지출 금액 (KRW)": "cost", "노출": "impressions", "링크 클릭": "clicks", "앱 설치": "installs" },
  },
  "Meta Ads Manager (English)": {
    headers: exportHeaders("meta-ads-en"),
    row: (date, i) => ({ "Day": date, "Campaign name": `US_Install_${i}`, "Ad set name": "set", "Amount spent (USD)": "312.40", "Impressions": "41000", "Link clicks": "620", "App installs": "95", "Purchases conversion value": "380.00" }),
    expect: { "Day": "date", "Campaign name": "campaign_name", "Amount spent (USD)": "cost", "Impressions": "impressions", "Link clicks": "clicks", "App installs": "installs" },
  },
};

const rowsFor = (testCase) => Array.from({ length: 21 }, (_, day) => [0, 1].map((i) => testCase.row(`2026-08-${String(day + 1).padStart(2, "0")}`, i))).flat();

describe("5-2 Meta 광고 관리자 CSV 자동매핑", () => {
  it.each(Object.entries(CASES))("%s 를 그대로 올려도 필수 열이 전부 잡힌다", (_name, testCase) => {
    const rows = rowsFor(testCase);
    const { mapping, requiredMissing } = buildMappingContract({ toolId: "5-2", headers: testCase.headers, rows });
    expect(requiredMissing).toEqual([]);
    for (const [header, field] of Object.entries(testCase.expect)) expect(mapping[header], header).toBe(field);
    // 필수 열은 "확인 필요"로 남으면 분석 버튼이 막힌다 — 자동 확정까지 가야 한다.
    const { assessments } = buildMappingContract({ toolId: "5-2", headers: testCase.headers, rows });
    const required = ["date", "cost", "installs"];
    const states = Object.fromEntries(assessments.filter((item) => required.includes(item.field)).map((item) => [item.field, item.state]));
    expect(states).toEqual({ date: "confirmed", cost: "confirmed", installs: "confirmed" });
  });

  it.each(Object.entries(CASES))("%s 의 구매 전환값은 D7 매출로 잡지 않는다", (_name, testCase) => {
    // Meta 전환값은 어트리뷰션 창 기준이라 코호트 D7 매출과 시간 의미가 다르다(§9).
    const { mapping } = buildMappingContract({ toolId: "5-2", headers: testCase.headers, rows: rowsFor(testCase) });
    const valueHeader = testCase.headers.at(-1);
    expect(String(mapping[valueHeader] || "__ignore__")).not.toMatch(/^revenue_d/);
  });

  it.each(Object.entries(CASES))("%s 를 canonical 데이터와 분석 자격까지 통과시킨다", (_name, testCase) => {
    const rows = rowsFor(testCase);
    const { mapping } = buildMappingContract({ toolId: "5-2", headers: testCase.headers, rows });
    const canonical = buildCanonicalDataset({ raw: rows, headers: testCase.headers, mapping });
    const mapped = getMappedRows({ raw: rows, mapping });
    expect(canonical.summary).toMatchObject({ inputRows: rows.length, invalidValueCount: 0 });
    expect(mapped.every((row) => row.cost > 0 && row.installs > 0)).toBe(true);
    expect(evaluateEligibility({ toolId: "5-2", mapping, canonicalData: canonical }).status).not.toBe("blocked");
  });

  // 업로드 화면은 기존 매핑과 별도로 의미 매퍼(V2) 바인딩으로도 자격을 판정한다. 두 매퍼가
  // 같은 헤더를 다르게 읽으면 "필수 컬럼 의미가 정해지지 않음"으로 막힌다(2026-09-29 실측).
  it.each(Object.entries(CASES))("%s 는 의미 매퍼에서도 비용·설치·날짜가 잡혀 분석이 막히지 않는다", (_name, testCase) => {
    const semantic = mapDataset({ headers: testCase.headers, rows: rowsFor(testCase) });
    expect(evaluateV2Eligibility({ toolId: "5-2", bindings: semantic.bindings }).status).not.toBe("blocked");
  });

  it("통화가 아닌 괄호는 떼지 않는다 — 기간 의미가 사라지면 다른 필드가 된다", () => {
    // 괄호를 가리지 않고 떼면 "비용 (D7)"이 "비용"이 되어 cost로 확정된다.
    const headers = ["date", "installs", "비용 (D7)", "지출 금액 (₩)"];
    const rows = [{ date: "2026-08-01", installs: "3", "비용 (D7)": "100", "지출 금액 (₩)": "120" }];
    const { mapping } = buildMappingContract({ toolId: "5-2", headers, rows });
    expect(mapping["비용 (D7)"]).not.toBe("cost");
    expect(mapping["지출 금액 (₩)"]).toBe("cost");
  });
});
