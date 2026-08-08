import { rssResponse } from "@/lib/rssFeed";

// 영어 발행글의 독립 피드. KR 피드와 항목·본문 언어가 섞이지 않게 분리한다.
export const dynamic = "force-static";

export function GET() {
  return rssResponse("en");
}
