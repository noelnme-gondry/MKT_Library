import { describe, expect, it } from "vitest";
import { buildMappingContract } from "@/lib/data-import/mappingContract";

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
});
