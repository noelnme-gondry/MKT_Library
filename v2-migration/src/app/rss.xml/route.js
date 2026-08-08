import { rssResponse } from "@/lib/rssFeed";

// 네이버 서치어드바이저 제출용 한국어 전체 본문 피드.
export const dynamic = "force-static";

export function GET() {
  return rssResponse("ko");
}
