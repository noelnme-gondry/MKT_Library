import { NextResponse } from "next/server";

const PRODUCTION_HOST = "growthoptplaybook.com";

function hostName(request) {
  return (request.headers.get("host") || "").split(":")[0].toLowerCase();
}

// 성장 사이트는 growthoptplaybook.com만 공개 대표 URL이다. Railway 기본/PR 도메인은
// 동일 콘텐츠의 별도 공개본이므로 운영 URL로 영구 이동시켜 canonical 신호를 한 곳에
// 모은다. 그 외 비운영 호스트는 QA를 깨지 않으면서 검색 엔진에만 noindex를 보낸다.
export function proxy(request) {
  const host = hostName(request);
  const isRailwayHost = host.endsWith(".up.railway.app");
  const isWwwHost = host === `www.${PRODUCTION_HOST}`;

  if (isRailwayHost || isWwwHost) {
    const destination = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${PRODUCTION_HOST}`);
    return NextResponse.redirect(destination, 301);
  }

  const response = NextResponse.next();
  if (host && host !== PRODUCTION_HOST && host !== "localhost" && host !== "127.0.0.1") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
