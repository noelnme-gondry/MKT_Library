import { describe, expect, it } from "vitest";
import { pvmGenerateDiagnosis } from "./pvmExport";

// EN 페이지(5-21)에서 💡 툴팁이 한글로 떴다. data-tip은 속성이라 textContent를
// 읽는 EN 로케일 스모크(EnglishToolLocale.smoke)의 사각지대였다 → 직접 고정한다.
const HANGUL = /[가-힣]/;
const money = (v) => `$${Math.round(v)}`;

describe("pvmGenerateDiagnosis locale", () => {
  const cases = [
    { name: "둘 다 상승", e: { mix: 10, rate: 5, contribution: 15 } },
    { name: "둘 다 하락", e: { mix: -10, rate: -5, contribution: -15 } },
    { name: "상반", e: { mix: 10, rate: -5, contribution: 5 } },
  ];

  for (const level of ["channel", "campaign", "creative"]) {
    for (const { name, e } of cases) {
      it(`${level}/${name} — en은 한글을 포함하지 않는다`, () => {
        const en = pvmGenerateDiagnosis(e, level, money, "en");
        expect(en).toBeTruthy();
        expect(HANGUL.test(en), en).toBe(false);
      });
      it(`${level}/${name} — ko는 기존 한글 문구를 유지한다(회귀 가드)`, () => {
        const ko = pvmGenerateDiagnosis(e, level, money, "ko");
        expect(HANGUL.test(ko)).toBe(true);
        // locale 미지정 기본값이 ko와 동일해야 기존 호출부가 안 깨진다.
        expect(pvmGenerateDiagnosis(e, level, money)).toBe(ko);
      });
    }
  }
});
