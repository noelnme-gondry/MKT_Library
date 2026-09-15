// R0 · 도구 배선 인벤토리 (파생 — 손 목록 금지)
//
// 발행 도구를 routeMap에서 파생하고, 각 도구가 채워야 할 배선 칸을 실제
// 레지스트리에서 읽어 한 표로 낸다. 빈칸이 곧 R0의 발견 목록이다.
//
// 실행: node --import ./scripts/audit/alias-loader-register.mjs scripts/audit/tool-inventory.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const read = (p) => { try { return fs.readFileSync(path.join(ROOT, p), "utf8"); } catch { return null; } };
const exists = (p) => fs.existsSync(path.join(ROOT, p));

const { ROUTES, isRoutePublished, isRouteIndexable, publishedToolIds, EN_READY_TOOL_IDS, idToSlug } =
  await import("@/lib/routeMap");
const { TOOL_GROUP, DATA_GROUPS } = await import("@/lib/toolGroups");
const { TOOL_REQUIRED_FIELDS, TOOL_OPTIONAL_FIELDS } = await import("@/utils/csvConstants");
const { TOOL_GUIDE, TOOL_GUIDE_EN } = await import("@/utils/toolGuide");
const { CONNECTED_TOOLS, NEXT_TOOL_IDS, TOOL_JOURNEY } = await import("@/lib/toolConnections");
const searchContent = await import("@/lib/toolSearchContent");
const routeSeo = await import("@/lib/routeSeo").catch(() => null);

const tools = publishedToolIds();

// 도구 → 렌더 컴포넌트 파일(라우트의 component 태그는 문서용이라 파일과 1:1이 아님 §16)
const componentOf = Object.fromEntries(ROUTES.map((r) => [r.id, r.component]));
const findComponentFile = (name) => {
  const cands = [
    `src/components/tools/${name}.jsx`,
    `src/components/${name}.jsx`,
    `src/components/dashboard/${name}.jsx`,
    `src/components/content/${name}.jsx`,
  ];
  return cands.find(exists) || null;
};
const smokeFor = (name) => {
  const f = findComponentFile(name);
  if (!f) return null;
  const s = f.replace(/\.jsx$/, ".smoke.test.jsx");
  return exists(s) ? s : null;
};

// 검색 콘텐츠: CONTENT 키가 아니라 실제 조회 함수로 판정(폴백으로 붙은 도구가
// 가드를 비켜가는 것을 막기 위해 — §12.29)
const getSearch = searchContent.getToolSearchContent || (() => null);

const { buildDemoCsv } = await import("@/utils/demoData");
// 데모는 도구 id가 아니라 **데이터 그룹**으로 등록된다(BUILDERS[group]).
// id로 grep하면 전 도구가 "없음"으로 나온다 — 실제로 빌드를 시도해 판정한다.
const demoOk = (group) => { try { const d = buildDemoCsv(group); return d ? "O" : "—"; } catch { return "X"; } };
const seoSrc = read("src/lib/routeSeo.js") || "";

const rows = tools.map((id) => {
  const comp = componentOf[id];
  const file = findComponentFile(comp);
  const req = TOOL_REQUIRED_FIELDS?.[id];
  const opt = TOOL_OPTIONAL_FIELDS?.[id];
  const ko = (() => { try { return getSearch(id, "ko"); } catch { return null; } })();
  const en = (() => { try { return getSearch(id, "en"); } catch { return null; } })();
  return {
    id,
    slug: idToSlug[id],
    comp,
    // routeMap의 component는 문서용 태그라 파일과 1:1이 아니다(§16) — PageClient가
    // routeId로 디스패치하는 라우트는 파일이 없는 것이 정상이다.
    file: file ? "O" : "dispatch",
    lines: file ? read(file).split("\n").length : 0,
    smoke: smokeFor(comp) ? "O" : "dispatch",
    group: TOOL_GROUP[id] || "(fallback)",
    req: Array.isArray(req) ? req.length : "—",
    opt: Array.isArray(opt) ? opt.length : "—",
    guideKo: TOOL_GUIDE?.[id] ? "O" : "—",
    guideEn: TOOL_GUIDE_EN?.[id] ? "O" : "—",
    connected: CONNECTED_TOOLS?.[id] ? "O" : "—",
    next: (NEXT_TOOL_IDS?.[id] || []).length || "—",
    searchKo: ko?.answer ? "O" : "—",
    searchEn: en?.answer ? "O" : "—",
    enReady: EN_READY_TOOL_IDS.has(id) ? "O" : "—",
    seo: new RegExp(`["'\`]${id.replace(/-/g, "\\-")}["'\`]\\s*:`).test(seoSrc) ? "O" : "—",
    demo: demoOk(TOOL_GROUP[id] || "efficiency"),
  };
});

// TOOL_JOURNEY(질문 축) 커버리지
const journeyIds = new Set();
for (const branch of TOOL_JOURNEY || []) for (const t of branch.tools || branch.items || []) journeyIds.add(typeof t === "string" ? t : t.id);

const cols = ["id","slug","file","lines","smoke","group","req","opt","guideKo","guideEn","connected","next","searchKo","searchEn","enReady","seo","demo"];
console.log("| " + cols.join(" | ") + " | journey |");
console.log("|" + cols.map(() => "---").join("|") + "|---|");
for (const r of rows) console.log("| " + cols.map((c) => r[c]).join(" | ") + " | " + (journeyIds.has(r.id) ? "O" : "—") + " |");

// 빈칸 요약
console.log("\n## 빈칸 (칸 → 도구)");
for (const c of ["file","smoke","guideKo","guideEn","connected","next","searchKo","searchEn","enReady","seo","req","opt","demo"]) {
  const missing = rows.filter((r) => r[c] === "—" || r[c] === "?").map((r) => `${r.id}${r[c] === "?" ? "(?)" : ""}`);
  if (missing.length) console.log(`- **${c}**: ${missing.join(", ")}`);
}
const noJourney = rows.filter((r) => !journeyIds.has(r.id)).map((r) => r.id);
if (noJourney.length) console.log(`- **journey**: ${noJourney.join(", ")}`);

// 역방향: 레지스트리에 있는데 발행 도구가 아닌 id (죽은 엔트리)
console.log("\n## 레지스트리 잔여 (발행 도구가 아닌 키)");
const pubSet = new Set(tools);
const orphan = (name, obj) => {
  const keys = Object.keys(obj || {}).filter((k) => /^(5-|9-)/.test(k) && !pubSet.has(k));
  if (keys.length) console.log(`- **${name}**: ${keys.join(", ")}`);
};
orphan("TOOL_GROUP", TOOL_GROUP);
orphan("TOOL_REQUIRED_FIELDS", TOOL_REQUIRED_FIELDS);
orphan("TOOL_OPTIONAL_FIELDS", TOOL_OPTIONAL_FIELDS);
orphan("TOOL_GUIDE", TOOL_GUIDE);
orphan("TOOL_GUIDE_EN", TOOL_GUIDE_EN);
orphan("CONNECTED_TOOLS", CONNECTED_TOOLS);
orphan("NEXT_TOOL_IDS", NEXT_TOOL_IDS);
console.log(`\n발행 도구 ${tools.length}개 · 데이터 그룹 ${DATA_GROUPS.length}개`);
