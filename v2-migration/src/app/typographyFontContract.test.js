import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { stripSourceComments } from "@/test-utils/stripSourceComments";

const ROOT = process.cwd();
const rootDocument = stripSourceComments(readFileSync(path.join(ROOT, "src/components/RootDocument.jsx"), "utf8"));
const css = stripSourceComments(readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8"));

describe("Korean typography contract", () => {
  it("loads self-hosted Unicode subsets without preloading full Korean fonts", () => {
    const fonts = readFileSync(path.join(ROOT, "src/app/korean-fonts.css"), "utf8");
    expect(rootDocument).toContain('import "@/app/korean-fonts.css"');
    expect(rootDocument).not.toContain("Variable.woff2");
    expect(fonts).toContain('font-weight:400 1000');
    expect(fonts).toContain('font-weight:100 900');
    expect(fonts).toContain('unicode-range:');
    const files = [...fonts.matchAll(/url\("(.*?)"\)/g)].map(match => match[1]);
    expect(files.length).toBeGreaterThan(2);
    expect(files.every(file => file.startsWith("/fonts/subsets/") && existsSync(path.join(ROOT, "public", file)))).toBe(true);
    const common = files.filter(file => /-0-[a-f0-9]+\.woff2$/.test(file));
    expect(common).toHaveLength(2);
    expect(common.reduce((sum, file) => sum + statSync(path.join(ROOT, "public", file)).size, 0)).toBeLessThan(850000);
    expect(readFileSync(path.join(ROOT, "public/fonts/WantedSans-OFL.txt"), "utf8")).toContain("SIL Open Font License");
  });

  it("uses Wanted Sans for body and display hierarchy", () => {
    expect(css).toContain("--font-sans: var(--font-wanted-sans)");
    expect(css).not.toMatch(/--font-display\s*:/);
    expect(css).not.toMatch(/var\(--font-display\)/);
  });

  // 2026-11-09 재설계(사용자 결정): 결과의 큰 수치만 고정폭으로 자릿수를 세로로 맞추고, 본문·표의
  // 숫자는 여전히 본문 글꼴 + tabular-nums다. 고정폭이 번지면 결과 화면이 터미널처럼 보이므로(2026-09-24)
  // 허용 대상은 선택자 한 줄로만 선언한다 — 새 자리에 고정폭이 필요하면 그 줄에 더할 것.
  it("limits mono to code and the headline result numbers; other numbers use tabular figures", () => {
    expect(css).toMatch(/:where\(pre, code, kbd, samp, \.mono\) \{\s*font-family: var\(--font-mono\);/);
    expect(css).toMatch(/:where\(\.tnum, \.kpi-card \.value\) \{\s*font-variant-numeric: tabular-nums;/);
    expect(css).toMatch(/:where\(\.kpi-card \.value, \.result-action-card__stats strong, \.metric-value-atom\) \{\s*font-family: var\(--font-mono\);/);
    expect(css.match(/var\(--font-mono\)/g)).toHaveLength(2);
    // 고정폭 글꼴은 --font-mono 정의 한 곳에서만 불린다.
    expect(css.match(/var\(--font-jetbrains-mono\)/g)).toHaveLength(1);
  });

  // 결론 문장·큰 제목은 명조 한 벌(Noto Serif KR 600, 자체 호스팅 분할본)이다. 굵기는 하나뿐이고,
  // 분할 파일은 public/fonts/serif에 실재해야 한다(외부 글꼴 서버에 배포를 걸지 않는다).
  it("loads the self-hosted serif once and uses it only through --font-serif", () => {
    expect(rootDocument).toContain('import "@/app/serif-fonts.css"');
    const serif = readFileSync(path.join(ROOT, "src/app/serif-fonts.css"), "utf8");
    const files = [...serif.matchAll(/url\("(.*?)"\)/g)].map(match => match[1]);
    expect(files.length).toBeGreaterThan(50);
    expect(files.every(file => file.startsWith("/fonts/serif/") && existsSync(path.join(ROOT, "public", file)))).toBe(true);
    expect(serif.match(/font-weight:600/g)).toHaveLength(files.length);
    expect(readFileSync(path.join(ROOT, "public/fonts/NotoSerifKR-OFL.txt"), "utf8")).toContain("SIL Open Font License");
    expect(css).toMatch(/--font-serif:\s*"GOP Serif"/);
    expect(css.match(/"GOP Serif"/g)).toHaveLength(1);
  });

  // 이 검사는 오래 리터럴 px를 그대로 적고 있었다(`--type-body: 14px` ·
  // `thead th … 11px`). 그러면 크기를 고치는 순간 테스트가 먼저 반대한다 — §7
  // "가드가 '지금 값'을 그대로 적으면 그 순간부터 버그를 지킨다"의 실제 사례다.
  // 게다가 `--type-*`는 `--fs-*`와 나란히 존재하던 **두 번째 타입 토큰 계열**이라,
  // 이 가드가 그 분열을 고정하고 있었다. 지금은 한국어 본문에 필요한 **관계**만
  // 지킨다: 본문은 스케일의 본문 단을 쓰고, 표 헤더는 본문보다 작지 않은 메타 단을
  // 쓰며, 크기는 전부 스케일 토큰에서 온다(스케일 자체는 typeScale.test.js가 소유).
  it("keeps Korean body and table metadata on the shared scale", () => {
    expect(css).toMatch(/--fs-base:\s*14px/);
    expect(css).toMatch(/--fs-xs:\s*12px/);
    expect(css).toMatch(/table\.data thead th[\s\S]{0,400}?font-size:\s*var\(--fs-(xs|sm)\)/);
    expect(css).not.toMatch(/--type-(body|meta|title|display-lg)\s*:/);
  });
});
