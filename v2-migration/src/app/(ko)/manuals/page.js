import Link from "next/link";

import { SITE_URL } from "@/lib/routeMap";
import { withOpenGraphBase } from "@/lib/openGraph";

// 방법론 매뉴얼 공개 페이지 — 기존 PDF는 5-18 도구 내부에서만 링크돼 있어
// 검색·인용 대상이 되지 못했다(routeMap 밖 독립 페이지, /templates와 동일 패턴).
export async function generateMetadata() {
  const title = "MMM 모델 매뉴얼 무료 다운로드 | 방법론 문서";
  const description =
    "마케팅 믹스 모델링(MMM)의 adstock·포화·기여 분해와 검증 절차를 정리한 PDF 매뉴얼을 무료로 받습니다. 회귀 계수 해석의 한계와 인과 확정 조건도 함께 설명합니다.";
  const canonical = `${SITE_URL}/manuals`;
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { ko: canonical, en: `${SITE_URL}/en/manuals`, "x-default": canonical },
    },
    openGraph: withOpenGraphBase({ title, description, url: canonical, images: [`${SITE_URL}/og-card.png`] }),
  };
}

const MANUALS = [
  {
    href: "/manuals/mmm-model-manual-ko.pdf",
    title: "MMM 모델 매뉴얼",
    summary: "마케팅 믹스 모델이 무엇을 계산하고 무엇을 계산하지 못하는지, 입력 데이터 요건부터 결과 해석까지 정리한 문서입니다.",
    contents: [
      "adstock(이월 효과)과 포화(수확체감)를 왜 함께 다뤄야 하는지",
      "채널 지출이 함께 움직일 때 기여도 분리가 불가능해지는 조건",
      "회귀 계수를 인과로 읽으면 안 되는 이유와 홀드아웃으로 넘어가는 기준",
      "예측 구간이 신뢰구간이 아니라 과거 잔차 기반 참고 범위인 이유",
    ],
    toolHref: "/tools/marketing-response",
    toolLabel: "MMM 기여 분석 열기",
  },
];

export default function Page() {
  return (
    <section className="manuals-page">
      <span className="manuals-page__eyebrow">방법론 문서</span>
      <h1>분석 방법론 매뉴얼</h1>
      <p className="manuals-page__lead">
        도구가 내부에서 어떤 가정을 두고 계산하는지 문서로 공개합니다. 결과를 보고에 쓰기 전에
        가정과 한계를 먼저 확인하세요. 가입이나 이메일 입력 없이 바로 받을 수 있습니다.
      </p>

      {MANUALS.map((manual) => (
        <article className="manuals-page__item" key={manual.href}>
          <h2>{manual.title}</h2>
          <p>{manual.summary}</p>
          <h3>문서에 담긴 내용</h3>
          <ul>
            {manual.contents.map((line) => <li key={line}>{line}</li>)}
          </ul>
          <div className="manuals-page__actions">
            <a className="btn primary" href={manual.href} download>PDF 내려받기</a>
            <Link className="btn ghost" href={manual.toolHref}>{manual.toolLabel}</Link>
          </div>
        </article>
      ))}

      <p className="manuals-page__note">
        문서는 도구의 현재 계산 방식과 함께 갱신됩니다. 인용하실 때는 이 페이지 주소를 함께 적어주세요.
      </p>
    </section>
  );
}
