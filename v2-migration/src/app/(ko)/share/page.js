import SharedDecision from "@/components/SharedDecision";

// 결론 공유 링크 수신 화면. 요약 문구가 URL 쿼리에 실려 오므로 색인 대상이 아니며
// sitemap·RSS에도 넣지 않는다(routeMap 밖 독립 페이지, /templates와 동일 패턴).
export const metadata = {
  title: "공유된 판단",
  description: "공유 링크로 전달된 분석 결론 요약입니다.",
  robots: { index: false, follow: true },
};

export default function Page() {
  return <SharedDecision locale="ko" />;
}
