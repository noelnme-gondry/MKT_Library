// R0-b · 도구 표면 채택 인벤토리
// 결론 카드 / 다운로드 / 차트 계약 / 가드 두께를 도구별로 파생한다.
// 주의: 문자열 포함 검사는 자기 설명 주석에 속는다(§16) → 주석을 먼저 제거하고
// "사용"(<Comp / import ... from)으로만 판정한다.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const { ROUTES, publishedToolIds } = await import("@/lib/routeMap");

const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");

const compOf = Object.fromEntries(ROUTES.map((r) => [r.id, r.component]));
const DIRS = ["src/components/tools", "src/components", "src/components/dashboard", "src/components/content"];
const fileFor = (name) => DIRS.map((d) => path.join(ROOT, d, `${name}.jsx`)).find(fs.existsSync) || null;

// 디스패치 라우트(파일 없음)는 실제 렌더 컴포넌트로 되돌린다.
const DISPATCH = { MarketingResponseTrend: "MarketingResponse", MarketingResponseCannibal: "MarketingResponse", MarketingResponseMmm: "MarketingResponse", MarketingResponseForecast: "MarketingResponse" };

const rows = publishedToolIds().map((id) => {
  const name = DISPATCH[compOf[id]] || compOf[id];
  const f = fileFor(name);
  const raw = f ? fs.readFileSync(f, "utf8") : "";
  const src = stripComments(raw);
  const smokePath = f ? f.replace(/\.jsx$/, ".smoke.test.jsx") : null;
  // 스모크도 주석을 먼저 지운다 — 5-25 스모크의 `setAnalyzed?.()`는 그 사고를
  // **설명하는 주석**이었는데, 주석을 둔 채 세면 고쳐진 자리가 결함으로 잡힌다(§16).
  const smoke = smokePath && fs.existsSync(smokePath) ? stripComments(fs.readFileSync(smokePath, "utf8")) : "";
  const uses = (tag) => new RegExp(`<${tag}[\\s/>]`).test(src);
  const imports = (mod) => new RegExp(`import[^;]*from\\s*["'][^"']*${mod}["']`).test(src);
  const hasCanvas = /<canvas[\s/>]/.test(src) || /new Chart\(/.test(src);
  return {
    id, comp: name,
    결론카드: uses("ResultActionCard") ? "O" : "—",
    다운로드허브: uses("DownloadHub") ? "O" : "—",
    csvBody: imports("utils/download") ? "O" : "—",
    차트: hasCanvas ? "O" : "—",
    chartOpts: hasCanvas ? (/chartCommonOpts\(/.test(src) ? "O" : "X") : "-",
    CHART_THEME: hasCanvas ? (/CHART_THEME/.test(src) ? "O" : "X") : "-",
    // 하드코딩 색: 차트 데이터셋에 들어갈 위험이 있는 리터럴 hex
    rawHex: (src.match(/#[0-9a-fA-F]{6}\b/g) || []).length,
    인라인폰트: (src.match(/fontSize:\s*["']?\d+/g) || []).length,
    스모크줄: smoke ? smoke.split("\n").length : 0,
    스모크단언: smoke ? (smoke.match(/expect\(/g) || []).length : 0,
    옵셔널단언: smoke ? (smoke.match(/\?\.\(/g) || []).length : 0,
  };
});

const cols = Object.keys(rows[0]);
console.log("| " + cols.join(" | ") + " |");
console.log("|" + cols.map(() => "---").join("|") + "|");
for (const r of rows) console.log("| " + cols.map((c) => r[c]).join(" | ") + " |");

console.log("\n## 주의 신호");
const flag = (label, fn) => { const hit = rows.filter(fn).map((r) => r.id); if (hit.length) console.log(`- **${label}**: ${hit.join(", ")}`); };
flag("결론 카드 없음", (r) => r.결론카드 === "—");
flag("다운로드 허브 없음", (r) => r.다운로드허브 === "—");
flag("차트인데 chartCommonOpts 미사용", (r) => r.chartOpts === "X");
flag("차트인데 CHART_THEME 미사용", (r) => r.CHART_THEME === "X");
flag("스모크 단언 10개 미만", (r) => r.스모크단언 < 10);
flag("테스트 내 옵셔널 호출(?.()) 있음", (r) => r.옵셔널단언 > 0);
flag("raw hex 20개 이상", (r) => r.rawHex >= 20);
