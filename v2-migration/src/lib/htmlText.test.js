import { describe, expect, it } from "vitest";
import { decodeTextEntitiesOnce, stripHtmlTags } from "./htmlText";

describe("HTML 평문화", () => {
  it("중첩된 태그 조각이 새 script 태그로 되살아나지 않는다", () => {
    const plain = stripHtmlTags('<b>결론</b> <scr<script>ipt>alert(1)</script>');
    expect(plain).toBe("결론 ipt>alert(1)");
    expect(plain.toLowerCase()).not.toContain("<script");
  });

  it("HTML이 아닌 부등호 텍스트는 보존한다", () => {
    expect(stripHtmlTags("CPA < 10, ROAS > 2")).toBe("CPA < 10, ROAS > 2");
  });

  it("엔티티를 한 번만 해제한다", () => {
    expect(decodeTextEntitiesOnce("A &amp; B &quot;C&quot;")).toBe('A & B "C"');
    expect(decodeTextEntitiesOnce("&amp;quot;")).toBe("&quot;");
  });
});
