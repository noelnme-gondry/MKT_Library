import { describe, expect, it } from "vitest";
import { EEA_UK_REGIONS, consentDefaultSnippet, looksEeaVisitor } from "./consent";

// EEA/UK 방문자에게 동의 없이 GA4·GTM·AdSense가 로드되던 상태를 막는다.
// 법적 게이트는 Consent Mode의 region 기본값이 담당(판정은 Google이 IP로 수행),
// 배너 노출 여부만 타임존·언어로 추정한다.
describe("consentDefaultSnippet", () => {
  const snippet = consentDefaultSnippet();

  it("EEA/UK를 region으로 지정해 기본 거부를 건다", () => {
    expect(snippet).toContain("'consent','default'");
    expect(snippet).toContain("denied");
    for (const code of ["DE", "FR", "GB", "IE", "NO", "IS"]) {
      expect(snippet, code).toContain(`"${code}"`);
    }
    expect(EEA_UK_REGIONS).toContain("GB");
    expect(EEA_UK_REGIONS).not.toContain("KR");
    expect(EEA_UK_REGIONS).not.toContain("US");
  });

  it("v2 필수 신호 4종을 모두 선언한다", () => {
    for (const key of ["ad_storage", "ad_user_data", "ad_personalization", "analytics_storage"]) {
      expect(snippet, key).toContain(key);
    }
    // 태그가 기본값을 기다리도록 유예를 준다.
    expect(snippet).toContain("wait_for_update");
  });

  it("저장된 선택을 즉시 재적용한다(새 세션에서 다시 묻지 않음)", () => {
    expect(snippet).toContain("'consent','update'");
    expect(snippet).toContain("gop_consent_v1");
  });
});

describe("looksEeaVisitor", () => {
  it("EEA 타임존은 대상으로 본다", () => {
    for (const tz of ["Europe/Berlin", "Europe/Paris", "Europe/Dublin", "Atlantic/Reykjavik"]) {
      expect(looksEeaVisitor(tz, "en-US"), tz).toBe(true);
    }
  });

  it("비EEA 유럽 타임존(러시아·터키)은 제외한다", () => {
    for (const tz of ["Europe/Moscow", "Europe/Istanbul"]) {
      expect(looksEeaVisitor(tz, "en-US"), tz).toBe(false);
    }
  });

  it("한국·미국 방문자에게는 배너를 띄우지 않는다", () => {
    expect(looksEeaVisitor("Asia/Seoul", "ko-KR")).toBe(false);
    expect(looksEeaVisitor("America/New_York", "en-US")).toBe(false);
  });

  it("타임존을 못 읽으면 언어로 보조 판정한다", () => {
    expect(looksEeaVisitor("", "de-DE")).toBe(true);
    expect(looksEeaVisitor("", "ko-KR")).toBe(false);
    expect(looksEeaVisitor(undefined, undefined)).toBe(false);
  });
});
