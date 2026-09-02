import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { OG_CARD_PATH, OG_CARD_URL, SITE_URL } from "@/lib/routeMap";

/**
 * 공용 소셜 카드 가드.
 *
 * 두 가지 사고를 막는다.
 *
 * ① **참조하는데 파일이 없다.** 30여 페이지가 `${SITE_URL}/og-card.png`를 가리키고
 *    있었는데 public에는 그 파일이 없었다(라우트가 그려 주고 있었다). 라우트를 지우면
 *    전 페이지의 카드가 조용히 404가 된다 — 공유 링크에 이미지가 사라져도 앱은 멀쩡히
 *    돌기 때문에 아무도 모른다.
 *
 * ② **빌드 타임에 카드를 그리지 않는다.** `next/og`로 카드를 그리던 경로가 Google
 *    Fonts에서 폰트를 받아 왔고, 응답이 잘리면 satori 폰트 파서가 RangeError를 던져
 *    배포 빌드 전체가 죽었다(PR #790). 카드는 `scripts/build-og-card.mjs`로 미리 그려
 *    저장소에 두고, 런타임/빌드타임 생성 경로를 다시 만들지 않는다.
 */

const APP = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(APP, "..", "..", "public");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith(".js") || full.endsWith(".jsx") ? [full] : [];
  });
}

describe("공용 소셜 카드", () => {
  it("참조되는 카드 파일이 실제로 있고 1200×630 PNG다", () => {
    const file = path.join(PUBLIC, OG_CARD_PATH.replace(/^\//, ""));
    const bytes = readFileSync(file);
    // PNG 시그니처 + IHDR의 가로·세로(빅엔디언 4바이트씩).
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(bytes.readUInt32BE(16)).toBe(1200);
    expect(bytes.readUInt32BE(20)).toBe(630);
    expect(OG_CARD_URL).toBe(`${SITE_URL}${OG_CARD_PATH}`);
  });

  it("카드를 그리는 런타임 경로를 두지 않는다", () => {
    const offenders = walk(APP)
      .filter((file) => !file.includes(".test."))
      .filter((file) => /from "next\/og"|new ImageResponse/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("페이지가 가리키는 소셜 이미지는 공용 카드 하나뿐이다", () => {
    const files = walk(APP).filter((file) => !file.includes(".test."));
    // 대상이 0이면 검사가 통째로 무의미해진다 — 규모부터 단언한다.
    const referencing = files.filter((file) => readFileSync(file, "utf8").includes("og-card.png"));
    expect(referencing.length).toBeGreaterThan(20);

    const other = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return [...source.matchAll(/images: \[([^\]]+)\]/g)]
        .map((match) => match[1].trim())
        .filter((expr) => !expr.includes("og-card.png") && !expr.includes("OG_CARD_URL") && !expr.includes("socialImage") && !expr.includes("post.ogImage"))
        .map((expr) => `${path.relative(APP, file)} :: ${expr}`);
    });
    expect(other).toEqual([]);
  });
});
