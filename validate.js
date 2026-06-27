#!/usr/bin/env node
/* validate.js — 비배포 로컬 테스트 러너 (CLAUDE.md §2.1 예외).
 *
 * 역할: index.html의 인라인 <script>를 Node 샌드박스에 로드한 뒤,
 *       그 안에 정의된 모든 window.runXxxTests()를 실행하고 통과/실패를 리포팅한다.
 *       (DOMContentLoaded를 발화하지 않으므로 init/렌더 부작용 없이 함수 정의만 로드됨.)
 *
 * 원칙(관심사 분리): 이 파일엔 ① 브라우저 환경 shim ② 테스트 실행·리포팅 로직만 둔다.
 *       테스트 데이터·비즈니스 로직은 절대 두지 않는다 — 전부 index.html의 runXxxTests에 유지.
 *
 * 실패 판정(generic contract): 테스트가 throw하거나 / console.error를 호출하거나(✗ 관례) /
 *       false 또는 {fail>0}을 반환하면 실패. 종료코드는 실패 1개라도 있으면 1.
 *
 * 사용: node validate.js   (또는 npm test)
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

// 1) 인라인 스크립트 추출 (src/ld+json 제외) — 문서 순서 유지
function extractInlineScripts(html) {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    if (/\bsrc\s*=/i.test(m[1])) continue;
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(m[1])) continue;
    out.push(m[2]);
  }
  return out;
}
const blocks = extractInlineScripts(HTML);
const code = blocks.join("\n;\n");

// 2) 브라우저 환경 shim (generic no-op — 비즈니스 로직/데이터 없음)
const AnyStub = new Proxy(function () {}, {
  get(_t, p) {
    if (p === Symbol.toPrimitive) return () => "";
    if (p === Symbol.iterator) return function* () {};
    if (p === "length") return 0;
    return AnyStub;
  },
  apply() { return AnyStub; },
  construct() { return AnyStub; },
  set() { return true; },
});
const documentStub = {
  addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
  getElementById() { return AnyStub; },
  querySelector() { return AnyStub; },
  querySelectorAll() { return AnyStub; },        // AnyStub: [0]·forEach·iterator·length 모두 견딤
  getElementsByClassName() { return AnyStub; },
  getElementsByTagName() { return AnyStub; },
  createElement() { return AnyStub; },
  createTextNode() { return AnyStub; },
  createDocumentFragment() { return AnyStub; },
  body: AnyStub, head: AnyStub, documentElement: AnyStub,
  cookie: "", title: "", readyState: "complete",
};
const storageStub = {
  getItem() { return null; }, setItem() {}, removeItem() {}, clear() {}, key() { return null; }, length: 0,
};

const sandbox = {};
Object.assign(sandbox, {
  window: sandbox, self: sandbox, globalThis: sandbox, top: sandbox, parent: sandbox, frames: sandbox,
  document: documentStub,
  localStorage: storageStub, sessionStorage: storageStub,
  location: { hash: "", href: "http://localhost/", search: "", pathname: "/", host: "localhost", hostname: "localhost", protocol: "http:", origin: "http://localhost", port: "", replace() {}, assign() {}, reload() {} },
  history: { pushState() {}, replaceState() {}, back() {}, forward() {}, go() {}, length: 0, state: null },
  navigator: { userAgent: "node-validate", language: "ko", languages: ["ko"], onLine: true, platform: "node", clipboard: { writeText() { return Promise.resolve(); } } },
  console,
  setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
  requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
  queueMicrotask(fn) { try { fn(); } catch (_) {} },
  matchMedia() { return { matches: false, media: "", addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }; },
  getComputedStyle() { return { getPropertyValue() { return ""; } }; },
  fetch() { return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve("") }); },
  alert() {}, confirm() { return true; }, prompt() { return null; },
  scrollTo() {}, scrollBy() {}, scroll() {},
  open() { return null; }, close() {}, focus() {}, blur() {},
  performance: { now: () => Date.now() },
  CustomEvent: function () { return AnyStub; },
  Event: function () { return AnyStub; },
  MutationObserver: function () { return { observe() {}, disconnect() {}, takeRecords() { return []; } }; },
  ResizeObserver: function () { return { observe() {}, disconnect() {}, unobserve() {} }; },
  IntersectionObserver: function () { return { observe() {}, disconnect() {}, unobserve() {} }; },
  Chart: Object.assign(function () { return AnyStub; }, { register() {}, defaults: {}, registry: { addControllers() {} } }),
  Papa: { parse() { return { data: [], meta: { fields: [] } }; }, unparse() { return ""; } },
  XLSX: AnyStub,
  supabase: { createClient() { return AnyStub; } },
  gtag() {}, dataLayer: [],
  URL, URLSearchParams, TextEncoder, TextDecoder,
  crypto: globalThis.crypto || { getRandomValues(a) { return a; }, subtle: {} },
  btoa: (s) => Buffer.from(String(s), "binary").toString("base64"),
  atob: (s) => Buffer.from(String(s), "base64").toString("binary"),
});

// 3) 로드 (compile 자체가 syntax 검증 역할)
const context = vm.createContext(sandbox);
try {
  vm.runInContext(code, context, { filename: "index.html(inline)" });
} catch (e) {
  console.error("✗ 스크립트 로드 실패 (syntax 또는 top-level throw):", e.message);
  if (e.stack) console.error(e.stack.split("\n").slice(0, 5).join("\n"));
  process.exit(1);
}
console.log("✓ 스크립트 로드 OK (" + blocks.length + " blocks · " + code.length.toLocaleString() + " chars)");

// 4) 테스트 발견 (window.runXxxTests)
const testNames = Object.keys(sandbox)
  .filter((k) => /^run[A-Za-z0-9]*Tests$/.test(k) && typeof sandbox[k] === "function")
  .sort();
if (testNames.length === 0) {
  console.error("✗ runXxxTests 함수를 하나도 찾지 못했습니다.");
  process.exit(1);
}

// 5) 실행 + 실패 감지. console.log은 억제, console.error는 실패 신호로 캡처.
const realLog = console.log.bind(console);
const realErr = console.error.bind(console);
let failed = 0;
for (const name of testNames) {
  let errored = false;
  let detail = "";
  sandbox.console = {
    log() {}, info() {}, warn() {}, table() {}, group() {}, groupEnd() {}, debug() {}, dir() {}, trace() {},
    error() { errored = true; },
  };
  try {
    const r = sandbox[name](false);
    if (r === false) { errored = true; detail = "(returned false)"; }
    else if (r && typeof r === "object" && Number(r.fail) > 0) { errored = true; detail = `(fail=${r.fail})`; }
  } catch (e) {
    errored = true;
    detail = "throw: " + e.message;
  }
  sandbox.console = console;
  if (errored) { failed++; realErr(`  ✗ ${name} ${detail}`); }
  else realLog(`  ✓ ${name}`);
}

realLog(`\n${testNames.length - failed}/${testNames.length} 통과`);
process.exit(failed > 0 ? 1 : 0);
