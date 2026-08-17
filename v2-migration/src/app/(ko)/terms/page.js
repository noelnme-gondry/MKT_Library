import { SITE_URL } from "@/lib/routeMap";
import Link from "next/link";
import PolicyPage from "@/components/PolicyPage";
import { withOpenGraphBase } from "@/lib/openGraph";

export const metadata = {
  title: { absolute: "이용약관 | Growth Opt Playbook" },
  description: "Growth Opt Playbook 무료 마케팅 분석 도구와 실무 가이드의 이용 조건, 데이터 처리 방식과 책임 범위입니다.",
  alternates: {
    canonical: `${SITE_URL}/terms`,
    languages: { ko: `${SITE_URL}/terms`, en: `${SITE_URL}/en/terms`, "x-default": `${SITE_URL}/en/terms` },
  },
  openGraph: withOpenGraphBase({ url: `${SITE_URL}/terms` }),
};

export default function TermsPage() {
  return (
    <PolicyPage
      eyebrow="LEGAL"
      alternateHref="/en/terms"
      title="이용약관"
      intro="Growth Opt Playbook의 분석 도구와 콘텐츠를 이용할 때 적용되는 기본 조건입니다."
      sections={[
        {
          title: "서비스와 이용 범위",
          content: <p>Growth Opt Playbook은 퍼포먼스 마케팅 가이드와 브라우저 기반 분석 도구를 제공합니다. 관련 법령을 위반하거나 서비스의 정상 운영을 방해하는 방식으로 이용해서는 안 됩니다.</p>,
        },
        {
          title: "분석 결과와 책임",
          content: <p>서비스와 분석 결과는 참고용으로 &quot;있는 그대로(as-is)&quot; 제공됩니다. 결과의 정확성·완전성·특정 목적 적합성을 보증하지 않으며, 예산·캠페인 등 실제 의사결정과 그 결과는 사용자의 책임입니다.</p>,
        },
        {
          title: "데이터 처리",
          content: <p>업로드한 CSV와 분석 원본은 서버로 전송하지 않고 브라우저에서 처리합니다. 브라우저에 저장되는 설정과 기록의 범위는 <Link href="/privacy">개인정보처리방침</Link>에서 확인할 수 있습니다.</p>,
        },
        {
          title: "콘텐츠와 외부 서비스",
          content: <p>사이트의 콘텐츠와 소프트웨어는 관련 권리의 보호를 받습니다. 출처를 오인하게 하거나 서비스를 복제·재판매해서는 안 됩니다. 연결된 외부 서비스에는 해당 서비스의 별도 약관이 적용됩니다.</p>,
        },
        {
          title: "변경과 문의",
          content: <p>서비스 또는 약관은 필요한 경우 변경될 수 있으며, 중요한 변경은 이 페이지의 업데이트 날짜로 알립니다. 문의는 <Link href="/contact">Contact 페이지</Link>를 이용해 주세요.</p>,
        },
      ]}
    />
  );
}
