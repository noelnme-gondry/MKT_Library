"use client";

/**
 * HelpTip — 지표·판정의 짧은 설명을 여는 `ⓘ` 도움말.
 *
 * 왜 필요한가: 설명 전체를 `title` 속성에만 두면 마우스 hover로만 열린다.
 * 터치에서는 아예 열리지 않고, 키보드 사용자는 존재조차 모르며, 보조기술 전달도
 * 브라우저마다 다르다(`docs/product-ssot.md` §6.3). 화면에 `ⓘ` 한 글자만 있고
 * 판단에 필요한 내용이 전부 title에 있던 자리가 실제로 3곳 있었다.
 *
 * 왜 `<details>`인가: 이 프로젝트는 이미 `.analysis-details`·`.stat-method`로
 * 접기를 쓰고, 네이티브 `<details>`는 키보드·터치·스크린리더가 JS 없이 전부 된다.
 * 팝오버로 띄우면 `backdrop-filter` 조상 안에서 위치가 어긋나고(§7) body 포털이
 * 필요해진다 — 설명 한 문단에 그만한 기계는 필요 없다.
 */
export default function HelpTip({ label, children, className = "" }) {
  return (
    <details className={`help-tip ${className}`.trim()}>
      {/* summary가 접근名을 가져야 스크린리더가 "무엇에 대한 도움말"인지 읽는다. */}
      <summary className="help-tip__toggle" aria-label={label}>
        <span aria-hidden="true">ⓘ</span>
      </summary>
      <span className="help-tip__body" role="note">{children}</span>
    </details>
  );
}
