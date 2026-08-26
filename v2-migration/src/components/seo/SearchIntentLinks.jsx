import Link from "next/link";

const ROLE_LABELS = {
  ko: {
    definition: "핵심 정의",
    diagnosis: "진단",
    method: "측정 방법",
    analysis: "직접 분석",
    guide: "실행 가이드",
  },
  en: {
    definition: "Core definition",
    diagnosis: "Diagnosis",
    method: "Measurement method",
    analysis: "Run the analysis",
    guide: "Implementation guide",
  },
};

/** 검색 질문의 대표 답변과 다음 실행 경로를 같은 SSOT에서 잇는다. */
export default function SearchIntentLinks({ links = [], locale = "ko" }) {
  if (!links.length) return null;
  const language = locale === "en" ? "en" : "ko";
  const labels = ROLE_LABELS[language];
  const title = language === "en" ? "Continue this topic" : "이 주제의 다음 단계";

  return (
    <nav className="content-related-links" aria-label={title}>
      <span>{title}</span>
      {links.map((link) => (
        <Link key={link.href} href={link.href}>
          {labels[link.role] || link.role} · {link.label}
        </Link>
      ))}
    </nav>
  );
}
