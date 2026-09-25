import { describe, expect, it } from "vitest";
import { buildMappingContract } from "./mappingContract";
import { scoreMappingCandidates } from "./scoreMappingCandidates";
import { buildSampleJourney } from "@/lib/sampleJourney";
import { computeCsvEligibility } from "@/lib/assistant/csvEligibility";

const HEADERS = ["date", "channel", "source", "campaign_name", "cost", "installs"];
const ROWS = [
  { date: "2026-08-01", channel: "Meta", source: "paid", campaign_name: "A", cost: "100", installs: "10" },
  { date: "2026-08-02", channel: "Google", source: "organic", campaign_name: "B", cost: "120", installs: "11" },
];

describe("정확한 표준 필드명이 별칭과의 충돌을 가른다", () => {
  it("source를 쓰지 않는 도구에서 `channel` 헤더가 channel을 갖고 `source`는 비운다", () => {
    const contract = buildMappingContract({ toolId: "5-21", headers: HEADERS, rows: ROWS });
    expect(contract.mapping.channel).toBe("channel");
    expect(contract.mapping.source).toBe("__ignore__");
    expect(contract.conflicts).toEqual([]);
  });

  it("정확일치가 없는 두 별칭끼리의 충돌은 그대로 남아 사람이 고른다", () => {
    const fields = { channel: { type: "string", aliases: ["net", "media"] } };
    const rows = [{ net: "Meta", media: "Google" }, { net: "Kakao", media: "Naver" }];
    const scored = scoreMappingCandidates({ headers: ["net", "media"], rows, fields });
    expect(scored.selections).toEqual({ net: "channel", media: "channel" });
    expect(scored.conflicts).toEqual([{ field: "channel", headers: ["net", "media"] }]);
  });

  it("정확일치가 둘이면(대소문자만 다른 헤더) 가르지 않는다", () => {
    const fields = { channel: { type: "string", aliases: [] } };
    const rows = [{ channel: "Meta", Channel: "Google" }];
    const scored = scoreMappingCandidates({ headers: ["channel", "Channel"], rows, fields });
    expect(scored.conflicts).toEqual([{ field: "channel", headers: ["channel", "Channel"] }]);
  });

  it("홈 샘플은 효율 도구 5개가 확인 대기 없이 바로 계산 대상이 된다", () => {
    const ready = computeCsvEligibility({ ...buildSampleJourney("ko"), locale: "ko" })
      .filter((result) => result.status === "ready")
      .map((result) => result.toolId)
      .sort();
    expect(ready).toEqual(["5-2", "5-21", "5-22", "5-25", "5-3"]);
  });
});
