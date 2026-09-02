/**
 * 공용 소셜 카드(OG 이미지) 생성기 — `public/og-card.png` 하나를 만든다.
 *
 * 왜 정적 파일인가: 예전에는 글·도구마다 `next/og`로 카드를 그렸는데, 그 경로가
 * 빌드 타임에 Google Fonts에서 한글 폰트를 받아 왔다. 200으로 응답하고 본문만
 * 잘려도 satori 폰트 파서가 `RangeError`를 던져 **배포 빌드 전체가 죽는다**
 * (실제로 PR #790에서 발생). 카드 한 장을 미리 만들어 두면 빌드가 외부 네트워크에
 * 의존하지 않는다.
 *
 * 실행: (v2-migration에서) node scripts/build-og-card.mjs
 * 폰트는 저장소 안의 Wanted Sans를 그대로 쓴다 — 화면과 같은 글자체.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// setContent로 띄운 문서의 오리진은 about:blank라 file:// 하위 리소스가 막힌다 —
// 폰트도 마크도 data: URI로 인라인해야 실제로 그려진다(안 그러면 깨진 이미지 아이콘이 찍힌다).
const dataUri = (p, mime) => `data:${mime};base64,${readFileSync(path.join(root, "public", p)).toString("base64")}`;

// 문구는 brandFacts.js의 사실만 쓴다 — 카드가 새 주장을 만들지 않는다.
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
  @font-face { font-family: "Wanted Sans"; src: url("${dataUri("fonts/WantedSansVariable.woff2", "font/woff2")}") format("woff2-variations"); font-weight: 100 900; }
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; font-family: "Wanted Sans", system-ui, sans-serif; }
  .card {
    width: 1200px; height: 630px; padding: 64px 72px; display: flex; flex-direction: column;
    justify-content: space-between; color: #f4f7fb;
    background: linear-gradient(135deg, #0c121d 0%, #111a28 62%, #17243a 100%);
    position: relative; overflow: hidden;
  }
  .card::after {
    content: ""; position: absolute; right: -140px; top: -140px; width: 520px; height: 520px;
    border-radius: 50%; background: radial-gradient(circle, rgba(130,170,255,.20), transparent 68%);
  }
  .top { display: flex; align-items: center; gap: 18px; }
  .mark { width: 60px; height: 60px; border-radius: 15px; }
  .brand { font-size: 27px; font-weight: 750; letter-spacing: -.02em; }
  .domain { margin-top: 3px; color: #8290a5; font-size: 15px; letter-spacing: .06em; }
  .body { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 18px; }
  .rule { width: 78px; height: 5px; border-radius: 3px; background: #82aaff; }
  h1 { font-size: 62px; font-weight: 800; line-height: 1.1; letter-spacing: -.045em; }
  .en { color: #a9b4c4; font-size: 25px; font-weight: 500; line-height: 1.4; letter-spacing: -.01em; }
  .facts { display: flex; gap: 10px; padding-top: 22px; border-top: 1px solid rgba(255,255,255,.12); }
  .fact { padding: 9px 15px; border: 1px solid rgba(255,255,255,.14); border-radius: 999px;
          background: rgba(255,255,255,.04); color: #d9e0ea; font-size: 17px; font-weight: 600; }
</style></head><body><div class="card">
  <div class="top">
    <img class="mark" src="${dataUri("assets/brand/dochi-app-icon.png", "image/png")}" alt="">
    <div><div class="brand">Growth Opt Playbook</div><div class="domain">growthoptplaybook.com</div></div>
  </div>
  <div class="body">
    <div class="rule"></div>
    <h1>숫자로 먼저 판단하는<br>마케팅 데이터 분석</h1>
    <div class="en">Free browser-based analytics for performance marketers</div>
  </div>
  <div class="facts">
    <div class="fact">무료 · Free</div>
    <div class="fact">가입 없음 · No signup</div>
    <div class="fact">브라우저에서 처리 · In-browser</div>
  </div>
</div></body></html>`;

// 환경마다 브라우저 빌드 번호가 다르므로 실행 파일을 직접 지정할 수 있게 둔다
// (CI·로컬 재생성 시 PW_CHROMIUM 환경변수, 없으면 playwright 기본 경로).
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "load" });
// 폰트와 이미지가 실제로 그려진 뒤에 찍는다 — load 이벤트만 믿으면 마크가 반쯤
// 그려진 채로 캡처된다.
await page.evaluate(() => Promise.all([
  document.fonts.ready,
  ...[...document.images].map((img) => (img.complete ? img.decode().catch(() => {}) : new Promise((r) => { img.onload = r; img.onerror = r; }))),
]));
const out = path.join(root, "public", "og-card.png");
await page.screenshot({ path: out });
await browser.close();
console.log("wrote", out);
