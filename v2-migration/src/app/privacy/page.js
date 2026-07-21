import { SITE_URL } from "@/lib/routeMap";

// 자기 자신을 canonical로(layout canonical 제거로 홈 누수 방지, GSC 대체페이지 이슈).
export const metadata = {
  // absolute: title이 이미 브랜드 접미사 포함 — layout.js title.template("%s | Growth
  // Opt Playbook") 중복 적용 방지.
  title: { absolute: "개인정보처리방침 | Growth Opt Playbook" },
  description: "Growth Opt Playbook의 브라우저 내 CSV 처리, 분석 도구 이용 통계와 광고 관련 개인정보 처리 기준입니다.",
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: { url: `${SITE_URL}/privacy` },
};

export default function PrivacyPage() {
  return (
    <main id="main-content" style={{ maxWidth: "720px", margin: "0 auto", padding: "48px 20px", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: "24px", marginBottom: "24px" }}>개인정보처리방침</h1>
      <p>
        본 서비스(Growth Opt Playbook)는 사용자가 업로드하는 CSV 등 운영 데이터를
        <strong> 서버로 전송하거나 저장하지 않으며, 브라우저 메모리에서만 처리</strong>합니다.
        페이지를 새로고침하면 업로드한 데이터는 즉시 삭제됩니다.
      </p>
      <h2 style={{ fontSize: "18px", margin: "24px 0 8px" }}>수집하는 정보</h2>
      <p>
        서비스 이용 분석을 위해 Google Analytics(GA4), Google Tag Manager, Google AdSense가
        쿠키 및 기기 식별자를 통해 방문 통계·광고 관련 정보를 수집할 수 있습니다.
        이는 Google의 개인정보처리방침을 따릅니다.
      </p>
      <h2 style={{ fontSize: "18px", margin: "24px 0 8px" }}>블로그 이메일 구독</h2>
      <p>
        블로그에서 이메일 구독을 직접 신청하고 광고성 정보 수신에 동의한 경우, 이메일 주소·동의 버전·신청 경로를
        Buttondown을 통해 처리합니다. 새 글과 분석 인사이트 발송에만 사용하며, 각 이메일의 수신 거부 기능으로 언제든 철회할 수 있습니다.
        CSV·분석 결과 등 사용자가 도구에 넣은 운영 데이터는 이메일 구독 서비스로 전송하지 않습니다.
      </p>
      <h2 style={{ fontSize: "18px", margin: "24px 0 8px" }}>문의</h2>
      <p>개인정보 관련 문의는 서비스 운영자에게 별도로 연락해 주세요.</p>
    </main>
  );
}
