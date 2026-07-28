import { SITE_URL } from "@/lib/routeMap";
import Link from "next/link";
import PolicyPage from "@/components/PolicyPage";

export const metadata = {
  title: { absolute: "개인정보처리방침 | Growth Opt Playbook" },
  description: "Growth Opt Playbook의 브라우저 내 CSV 처리, 분석 도구 이용 통계와 광고 관련 개인정보 처리 기준입니다.",
  alternates: {
    canonical: `${SITE_URL}/privacy`,
    languages: { ko: `${SITE_URL}/privacy`, en: `${SITE_URL}/en/privacy`, "x-default": `${SITE_URL}/privacy` },
  },
  openGraph: { url: `${SITE_URL}/privacy`, locale: "ko_KR" },
};

export default function PrivacyPage() {
  return (
    <PolicyPage
      eyebrow="PRIVACY"
      alternateHref="/en/privacy"
      title="개인정보처리방침"
      intro="분석 원본은 서버로 보내지 않습니다. 사이트 운영에 필요한 정보와 브라우저 저장 범위를 투명하게 안내합니다."
      sections={[
        {
          title: "업로드 데이터",
          content: <p>CSV와 분석 원본 행은 <strong>서버로 전송하거나 서버에 저장하지 않고 현재 브라우저에서 처리</strong>합니다. 분석을 위해 업로드한 원본 데이터는 앱의 서버 측 데이터베이스로 수집되지 않습니다.</p>,
        },
        {
          title: "브라우저에 저장되는 정보",
          content: <p>테마·언어·표시 설정, 컬럼 매핑 레시피, 최근 연결한 공개 Google Sheets 주소, 최근 분석 실행 요약 등 일부 정보는 편의를 위해 이 기기의 localStorage 또는 IndexedDB에 저장될 수 있습니다. 원본 CSV 행은 저장하지 않습니다. 브라우저의 사이트 데이터 삭제 기능으로 언제든 지울 수 있습니다.</p>,
        },
        {
          title: "방문 통계와 광고",
          content: <p>Google Analytics, Google Tag Manager, Google AdSense가 쿠키·기기 식별자·방문 정보를 처리할 수 있습니다. 해당 처리는 Google의 정책과 사용자의 브라우저·동의 설정을 따릅니다.</p>,
        },
        {
          title: "이메일 구독",
          content: <p>블로그 구독을 직접 신청하고 수신에 동의하면 이메일 주소·동의 버전·신청 경로를 Buttondown이 처리합니다. 새 글과 분석 인사이트 발송에만 사용하며 이메일의 수신 거부 링크로 철회할 수 있습니다. 분석 원본은 구독 서비스로 보내지 않습니다.</p>,
        },
        {
          title: "문의",
          content: <p>개인정보 관련 요청은 <Link href="/contact">Contact 페이지</Link> 또는 <a href="mailto:gondry.montauk@gmail.com">gondry.montauk@gmail.com</a>으로 보내주세요.</p>,
        },
      ]}
    />
  );
}
