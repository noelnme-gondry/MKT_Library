import { describe, expect, it } from "vitest";
import { buildMappingContract } from "@/lib/data-import/mappingContract";
import { buildCanonicalDataset } from "@/lib/data-import/buildCanonicalDataset";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { storeFunnel } from "@/utils/asoStoreMath";
import { evaluateEligibility } from "@/lib/analysis-router/evaluateEligibility";

/**
 * 스토어 콘솔이 실제로 내보내는 CSV가 5-27에서 자동매핑되는지 검사한다.
 *
 * 배경: 처음 배선했을 때 `source`(광고/오가닉, 값 어휘 organic·paid)를 유입 소스로
 * 재사용했고 `installs` 별칭에 스토어 콘솔 컬럼명이 없었다. 그래서 App Store Connect
 * export를 그대로 올리면 **필수 4개 중 소스와 설치 2개가 `__ignore__`** 로 떨어졌다.
 * 데모 픽스처는 표준키를 헤더로 쓰기 때문에 스모크·골든이 전부 통과했다 —
 * 자기가 만든 헤더로만 검사하면 실사용 CSV의 실패가 보이지 않는다.
 */

const CASES = {
  "App Store Connect (소스 유형 리포트)": {
    headers: ["Date", "Source Type", "Impressions", "Product Page Views", "Total Downloads"],
    rows: [
      { "Date": "2026-03-01", "Source Type": "App Store Search", "Impressions": "12900", "Product Page Views": "4300", "Total Downloads": "1935" },
      { "Date": "2026-03-01", "Source Type": "App Store Browse", "Impressions": "26400", "Product Page Views": "2400", "Total Downloads": "216" },
      { "Date": "2026-03-02", "Source Type": "App Store Search", "Impressions": "13200", "Product Page Views": "4400", "Total Downloads": "1980" },
      { "Date": "2026-03-02", "Source Type": "App Referrer", "Impressions": "3800", "Product Page Views": "950", "Total Downloads": "209" },
    ],
    expect: { "Date": "date", "Source Type": "store_source", "Impressions": "impressions", "Product Page Views": "product_page_views", "Total Downloads": "installs" },
  },
  "Google Play Console (스토어 실적)": {
    headers: ["Date", "Traffic source", "Store listing visitors", "Store listing acquisitions"],
    rows: [
      { "Date": "2026-03-01", "Traffic source": "Google Play search", "Store listing visitors": "5200", "Store listing acquisitions": "1560" },
      { "Date": "2026-03-01", "Traffic source": "Google Play explore", "Store listing visitors": "3100", "Store listing acquisitions": "279" },
      { "Date": "2026-03-02", "Traffic source": "Google Play search", "Store listing visitors": "5400", "Store listing acquisitions": "1620" },
      { "Date": "2026-03-02", "Traffic source": "Google Play explore", "Store listing visitors": "3300", "Store listing acquisitions": "297" },
    ],
    expect: { "Date": "date", "Traffic source": "store_source", "Store listing visitors": "product_page_views", "Store listing acquisitions": "installs" },
  },
};

describe("5-27 스토어 콘솔 CSV 자동매핑", () => {
  it.each(Object.entries(CASES))("%s 를 그대로 올려도 필수 열이 전부 잡힌다", (_name, testCase) => {
    const contract = buildMappingContract({ toolId: "5-27", headers: testCase.headers, rows: testCase.rows });
    expect(contract.mapping).toEqual(testCase.expect);
    expect(contract.requiredMissing).toEqual([]);
  });

  it("유입 소스는 광고/오가닉 축(`source`)으로 잡지 않는다", () => {
    // 두 축을 같은 키로 쓰면 매핑 화면 라벨이 "소스(광고/오가닉)"으로 뜨고
    // organic·paid 값 어휘가 스토어 소스 값을 잡지 못한다.
    const { mapping } = buildMappingContract({ toolId: "5-27", ...CASES["App Store Connect (소스 유형 리포트)"] });
    expect(Object.values(mapping)).not.toContain("source");
  });

  it.each(Object.entries(CASES))("%s를 canonical 데이터와 스토어 퍼널 입력까지 변환한다", (_name, testCase) => {
    // 5-27은 앞뒤 기간 비교 도구이므로, 실제 export의 열 형태를 보존한 4일 합성
    // fixture로 eligibility까지 통과시킨다. 계정·앱 정보는 넣지 않는다.
    const pipelineRows = [...testCase.rows, ...testCase.rows.map((row, index) => ({
      ...row,
      Date: `2026-03-0${index < 2 ? 3 : 4}`,
    }))];
    const { mapping } = buildMappingContract({ toolId: "5-27", headers: testCase.headers, rows: pipelineRows });
    const canonical = buildCanonicalDataset({ raw: pipelineRows, headers: testCase.headers, mapping });
    const mappedRows = getMappedRows({ raw: pipelineRows, mapping });
    const engineRows = mappedRows.map((row) => ({
      source: row.store_source,
      views: row.product_page_views,
      installs: row.installs,
    }));

    expect(canonical.summary).toMatchObject({ inputRows: pipelineRows.length, outputRows: pipelineRows.length, invalidValueCount: 0 });
    expect(canonical.records.every((row) => row.date && row.dimensions.store_source && row.metrics.product_page_views > 0 && row.metrics.installs > 0)).toBe(true);
    expect(mappedRows.every((row) => row.store_source && row.product_page_views && row.installs)).toBe(true);
    expect(storeFunnel(engineRows)).toMatchObject({ views: expect.any(Number), installs: expect.any(Number), viewToInstall: expect.any(Number) });
    expect(evaluateEligibility({ toolId: "5-27", mapping, canonicalData: canonical }).status).not.toBe("blocked");
  });
});
