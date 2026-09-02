import DochiSprite from "@/components/assistant/DochiSprite";

const COPY = {
  ko: {
    title: "컬럼을 확인해 주세요!",
    body: "위 토글에서 제가 찾은 컬럼 역할을 확인할 수 있어요. 필요할 때 열어 수정해 주세요.",
    action: "확인",
  },
  en: {
    title: "Please check the columns!",
    body: "The toggle above contains the column roles I found. Open and edit it whenever you need to.",
    action: "Got it",
  },
};

export default function DochiMappingCoach({ locale = "ko", isLeaving = false, onReview }) {
  const C = COPY[locale] || COPY.ko;
  return <section className={`dochi-mapping-coach${isLeaving ? " is-leaving" : ""}`} role="status" aria-live="polite">
    <div className="dochi-mapping-coach__speech">
      <strong id="dochi-mapping-coach-title">{C.title}</strong>
      <p>{C.body}</p>
      <button type="button" className="ab-button" onClick={onReview}>{C.action}</button>
      <span className="dochi-mapping-coach__speech-tail" aria-hidden="true">
        <svg viewBox="0 0 48 36" preserveAspectRatio="none"><path d="M0 1L46 18L0 35" /></svg>
      </span>
    </div>
    <div className="dochi-mapping-coach__sprite" aria-hidden="true"><DochiSprite pose="point-up" /></div>
  </section>;
}
