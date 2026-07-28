import { SITE_URL } from "@/lib/routeMap";
import PolicyPage from "@/components/PolicyPage";

export const metadata = {
  title: { absolute: "문의하기 | Growth Opt Playbook" },
  description: "Growth Opt Playbook의 비즈니스 제안, 협업, 제품 피드백과 개인정보 관련 문의 채널입니다.",
  alternates: {
    canonical: `${SITE_URL}/contact`,
    languages: { ko: `${SITE_URL}/contact`, en: `${SITE_URL}/en/contact`, "x-default": `${SITE_URL}/contact` },
  },
  openGraph: { url: `${SITE_URL}/contact`, locale: "ko_KR" },
};

export default function ContactPage() {
  return (
    <PolicyPage
      eyebrow="CONTACT"
      alternateHref="/en/contact"
      title="문의하기"
      intro="비즈니스 제안, 협업, 제품 피드백 모두 환영합니다. 편한 채널로 연락해 주세요."
      sections={[
        {
          title: "Business email",
          content: <div className="policy-page__contact"><a href="mailto:gondry.montauk@gmail.com">gondry.montauk@gmail.com</a><p>협업·제휴·인터뷰·제품 관련 문의에 적합합니다. 메일 제목에 문의 목적을 적어주시면 확인이 빠릅니다.</p></div>,
        },
        {
          title: "Instagram",
          content: <div className="policy-page__contact"><a href="https://www.instagram.com/gondry__workshop/" target="_blank" rel="noreferrer">@gondry__workshop ↗</a><p>간단한 질문이나 가벼운 대화는 DM으로 보내주세요.</p></div>,
        },
        {
          title: "보내주시면 좋은 내용",
          content: <ul><li>어떤 페이지 또는 분석 도구에 관한 문의인지</li><li>재현 가능한 문제라면 사용 환경과 증상</li><li>협업 문의라면 일정과 기대하는 결과</li></ul>,
        },
      ]}
    />
  );
}
