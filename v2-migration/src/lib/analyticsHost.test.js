import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ANALYTICS_HOSTS, isAnalyticsHost } from "./analyticsHost.js";

const SRC = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(SRC, rel), "utf8");
}

// 주석은 먼저 지운다 — 사유를 설명하는 주석에 걸려 "배선됐다"고 오판한 적이 있다(§16).
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("계측 호스트 판정", () => {
  it("운영 호스트만 통과시킨다", () => {
    for (const host of ANALYTICS_HOSTS) expect(isAnalyticsHost(host)).toBe(true);
    expect(isAnalyticsHost("GrowthOptPlaybook.com")).toBe(true);
    expect(isAnalyticsHost("  growthoptplaybook.com  ")).toBe(true);
  });

  it("로컬·미리보기·유사 도메인을 막는다", () => {
    for (const host of [
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "mkt-library-production.up.railway.app",
      // 접미사 일치로 검사하면 통과해 버리는 형태들 — 정확일치여야 한다.
      "growthoptplaybook.com.evil.example",
      "notgrowthoptplaybook.com",
      "",
    ]) {
      expect(isAnalyticsHost(host), host).toBe(false);
    }
  });

  it("문자열이 아닌 입력에서 던지지 않는다", () => {
    for (const bad of [null, undefined, 0, {}, []]) expect(isAnalyticsHost(bad)).toBe(false);
  });
});

describe("계측 스크립트는 게이트를 통해서만 실린다", () => {
  // 게이트를 우회해 스크립트를 되살리면 로컬 히트가 다시 운영 속성에 쌓인다.
  // 태그 URL을 직접 적을 수 있는 곳은 게이트 컴포넌트 두 개뿐이다.
  const GATED = new Set(["components/AnalyticsScripts.jsx", "components/AdSenseScript.jsx"]);
  const TAG_URLS = [
    "googletagmanager.com/gtag/js",
    "googletagmanager.com/gtm.js",
    "pagead2.googlesyndication.com",
  ];

  function walk(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else if (/\.jsx?$/.test(entry.name) && !/\.test\.jsx?$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  it("게이트 밖에서 태그 URL을 직접 싣지 않는다", () => {
    const offenders = [];
    for (const file of walk(SRC)) {
      const rel = path.relative(SRC, file).split(path.sep).join("/");
      if (GATED.has(rel)) continue;
      const body = stripComments(fs.readFileSync(file, "utf8"));
      for (const url of TAG_URLS) {
        // noscript GTM iframe은 의도된 예외다(사유는 RootDocument 주석).
        if (rel === "components/RootDocument.jsx" && url === "googletagmanager.com/gtm.js") continue;
        if (body.includes(url)) offenders.push(`${rel} → ${url}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("두 게이트 컴포넌트가 실제로 호스트 판정을 거친다", () => {
    // 판정은 훅 한 곳(useAnalyticsEnabled)이 소유하고, 그 훅만 순수 lib을 읽는다.
    // 호출 없이 import만 해 두면 게이트가 열린 채로 통과하므로 호출까지 확인한다.
    for (const rel of GATED) {
      const body = read(rel);
      expect(body, rel).toMatch(/import\s+useAnalyticsEnabled\s+from\s*"@\/components\/useAnalyticsEnabled"/);
      expect(body, rel).toContain("useAnalyticsEnabled()");
      expect(body, rel).toContain("if (!enabled) return null;");
    }
    expect(read("components/useAnalyticsEnabled.js")).toMatch(
      /import\s*\{[^}]*isAnalyticsHost[^}]*\}\s*from\s*"@\/lib\/analyticsHost"/
    );
  });

  it("RootDocument와 블로그 셸이 게이트 컴포넌트를 쓴다", () => {
    expect(stripComments(read("components/RootDocument.jsx"))).toContain("<AnalyticsScripts />");
    for (const rel of ["app/(ko)/blog/layout.js", "app/(en)/en/blog/layout.js"]) {
      expect(stripComments(read(rel)), rel).toContain("<AdSenseScript />");
    }
  });

  it("noscript 예외는 근거 주석이 남아 있을 때만 유효하다", () => {
    expect(read("components/RootDocument.jsx")).toContain("noscript 경로는 호스트 게이트를 못 건다");
  });
});
