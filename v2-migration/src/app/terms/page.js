import { SITE_URL } from "@/lib/routeMap";

// 자기 자신을 canonical로(layout canonical 제거로 홈 누수 방지, GSC 대체페이지 이슈).
export const metadata = {
  // absolute: title이 이미 브랜드 접미사 포함 — layout.js title.template("%s | Growth
  // Opt Playbook") 중복 적용 방지.
  title: { absolute: "이용약관 | Growth Opt Playbook" },
  description: "Growth Opt Playbook 무료 마케팅 분석 도구와 실무 가이드의 이용 조건, 데이터 처리 방식과 책임 범위입니다.",
  alternates: { canonical: `${SITE_URL}/terms` },
  openGraph: { url: `${SITE_URL}/terms` },
};

export default function TermsPage() {
  return (
    <main id="main-content" style={{ maxWidth: "720px", margin: "0 auto", padding: "48px 20px", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: "24px", marginBottom: "24px" }}>이용약관</h1>
      <p>
        본 서비스(Growth Opt Playbook)는 퍼포먼스 마케팅 SOP 문서와 CSV 기반 분석 도구를
        무료로 제공합니다. 서비스는 &quot;있는 그대로(as-is)&quot; 제공되며, 분석 결과의
        정확성에 대해 어떠한 보증도 하지 않습니다. 실제 의사결정은 사용자의 판단과 책임 하에
        이루어져야 합니다.
      </p>
      <h2 style={{ fontSize: "18px", margin: "24px 0 8px" }}>데이터 처리</h2>
      <p>
        업로드한 데이터는 서버로 전송되지 않고 브라우저 내에서만 처리됩니다. 서비스 이용에
        따른 데이터 유출·손실에 대해 운영자는 책임을 지지 않습니다.
      </p>
      <h2 style={{ fontSize: "18px", margin: "24px 0 8px" }}>약관 변경</h2>
      <p>본 약관은 사전 고지 없이 변경될 수 있습니다.</p>
    </main>
  );
}
