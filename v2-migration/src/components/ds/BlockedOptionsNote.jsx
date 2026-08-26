/**
 * 비활성 사유를 화면 글자로.
 *
 * 왜 필요한가: 못 누르는 버튼의 이유가 `title`에만 있으면 마우스 hover로만 열린다.
 * 터치에서는 아예 안 뜨고, 키보드 사용자는 disabled 버튼에 포커스도 못 준다 —
 * **왜 막혔는지 알 길이 자체가 없다.** 화면 상태 계약(`docs/product-ssot.md` §5.4)은
 * 막힘 상태가 "무엇을 고치면 되는지"를 말하도록 요구한다.
 *
 * 사유가 있는 항목이 하나도 없으면 아무것도 그리지 않는다 — 조건이 갖춰졌는데
 * 빈 줄이 남아 있으면 그것대로 소음이다(§12.17).
 *
 * items: [{ label?, reason }] — label이 없으면 사유만 쓴다(선택지가 하나일 때).
 */
export default function BlockedOptionsNote({ items = [], className = "" }) {
  const blocked = items.filter((item) => item && item.reason);
  if (!blocked.length) return null;
  return (
    <p data-mobile-task=".blocked-options-note" className={`blocked-options-note ${className}`.trim()} role="note">
      {blocked.map((item, index) => (
        <span key={item.label || index}>
          {item.label ? <strong>{item.label}</strong> : null}
          {item.reason}
        </span>
      ))}
    </p>
  );
}
