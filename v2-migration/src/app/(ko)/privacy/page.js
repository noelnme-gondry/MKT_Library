import { SITE_URL } from "@/lib/routeMap";
import Link from "next/link";
import AnalyticsOptOut from "@/components/AnalyticsOptOut";
import PolicyPage from "@/components/PolicyPage";
import { withOpenGraphBase } from "@/lib/openGraph";

export const metadata = {
  title: { absolute: "개인정보처리방침 | Growth Opt Playbook" },
  description: "Growth Opt Playbook의 브라우저 내 CSV 처리, 분석 도구 이용 통계와 광고 관련 개인정보 처리 기준입니다.",
  alternates: {
    canonical: `${SITE_URL}/privacy`,
    languages: { ko: `${SITE_URL}/privacy`, en: `${SITE_URL}/en/privacy`, "x-default": `${SITE_URL}/en/privacy` },
  },
  openGraph: withOpenGraphBase({ url: `${SITE_URL}/privacy` }),
};

export default function PrivacyPage() {
  return (
    <PolicyPage
      updated="2026-08-27"
      eyebrow="PRIVACY"
      alternateHref="/en/privacy"
      title="개인정보처리방침"
      intro="분석 원본은 서버로 보내지 않습니다. 사이트 운영에 필요한 정보와 브라우저 저장 범위를 투명하게 안내합니다."
      sections={[
        {
          title: "이용권 결제와 복원",
          content: <p>이용권 구매 시 결제 처리와 환불·이용권 복원을 위해 주문번호·상품·금액·승인/취소 상태·이용 기간·복원 코드의 해시를 서버에 저장합니다. 결제 정보 입력과 처리는 토스페이먼츠 결제 화면에서 이루어지며 카드번호 전체나 비밀번호를 앱에서 저장하지 않습니다. 결제·공급 기록은 전자상거래법상 5년 보관 대상이며 브라우저 분석 데이터의 90일 정책과 별개입니다. 결제 복원을 위한 쿠키와 이용권 캐시를 사용합니다. CSV·분석 결과·프로젝트명·파일명은 결제 요청에 포함하지 않습니다. 개인정보 관련 열람·정정·삭제 요청은 아래 고객센터로 문의해 주세요. 법정 보관 의무가 있는 기록은 해당 기간 동안 삭제가 제한될 수 있습니다.</p>,
        },
        {
          title: "업로드 데이터",
          content: <p>CSV와 분석 원본 행은 <strong>서버로 전송하거나 서버에 저장하지 않고 현재 브라우저에서 처리</strong>합니다. 분석을 위해 업로드한 원본 데이터는 앱의 서버 측 데이터베이스로 수집되지 않습니다.</p>,
        },
        {
          title: "브라우저에 저장되는 정보",
          content: <p>테마·언어·표시 설정, 컬럼 매핑 레시피, 최근 연결한 공개 Google Sheets 주소 등 일부 정보는 편의를 위해 이 기기의 localStorage 또는 IndexedDB에 저장될 수 있습니다. 기본 설정에서는 사용자가 직접 올린 CSV·XLSX 원본 파일, 파일명·헤더·매핑과 결정 기록 요약을 이 브라우저의 IndexedDB/localStorage에 마지막 사용 후 90일까지 보관합니다. 원본은 서버로 전송하지 않습니다. 저장을 끄면 저장된 원본 파일과 결정 기록의 영속 사본을 즉시 지우며, 현재 세션 기록은 화면을 닫거나 새로고침하기 전까지 남을 수 있습니다. <Link href="/storage">이 기기에 저장된 것</Link>에서 파일별 삭제·전체 삭제와 저장 설정을 관리할 수 있습니다.</p>,
        },
        {
          title: "고급 분석의 외부 요청",
          content: <p>일부 도구의 <strong>고급 분석(회귀·Random Forest·MMM 챌린저)</strong>은 브라우저에서 R 코드를 실행하기 위해 <strong>WebR 런타임과 R 패키지를 외부 CDN에서 내려받습니다</strong>. 이때 전송되는 것은 파일 요청뿐이며 <strong>업로드한 CSV·매핑·분석 결과는 전송되지 않습니다</strong>. 계산은 전부 이 브라우저 안에서 끝납니다. 외부 요청을 원하지 않으면 고급 분석을 실행하지 않으면 되며, 기본 분석은 외부 요청 없이 동작합니다.</p>,
        },
        {
          title: "방문 통계와 광고",
          content: (
            <>
              <p>Google Analytics, Google Tag Manager, Google AdSense가 쿠키·기기 식별자·방문 정보를 처리할 수 있습니다. 해당 처리는 Google의 정책과 사용자의 브라우저·동의 설정을 따릅니다.</p>
              <p>지역과 관계없이 아래에서 방문 통계·광고 측정을 끌 수 있습니다. 선택은 이 브라우저에 저장되며 분석 도구의 동작에는 영향을 주지 않습니다.</p>
              <AnalyticsOptOut locale="ko" />
            </>
          ),
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
