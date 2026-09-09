"use client";
import Link from "next/link";
import ModalDialog from "@/components/ds/ModalDialog";
import { useAppStore } from "@/store/useDataStore";
import { SUBSCRIPTION } from "@/lib/subscription/entitlement";

export default function SubscriptionPurchasePrompt() {
  const prompt = useAppStore(state => state.purchasePrompt);
  const en = prompt?.locale === "en";
  const close = () => useAppStore.setState({ purchasePrompt: null });
  return <ModalDialog open={Boolean(prompt)} onClose={close} ariaLabel={en ? "Take your analysis into your next meeting" : "분석을 다음 회의에서 바로 쓰세요"} overlayClassName="purchase-dialog-overlay" panelClassName="purchase-dialog">
    <button className="btn ghost purchase-dialog-close" type="button" onClick={close}>{en ? "Close" : "닫기"}</button>
    <h2>{en ? "Reports you can use and edit" : "전달하고 다시 계산할 수 있는 보고서"}</h2>
    <p>{en ? "Keep the conclusion, supporting evidence, and next actions together." : "결론과 근거, 다음 행동을 한 번에 정리해 가져가세요."}</p>
    <ul><li><strong>Word</strong> — {en ? "Meeting-ready conclusions, evidence tables, charts and limitations" : "회의용 결론·근거 표·차트·해석 한계"}</li><li><strong>Excel</strong> — {en ? "Source rows, mappings, calculation sheets and editable charts" : "원본·매핑·계산 시트·편집 가능한 차트"}</li></ul>
    <p>{en ? `KRW ${SUBSCRIPTION.monthlyKrw.toLocaleString("en-US")} for one month. No automatic renewal.` : `1개월 ${SUBSCRIPTION.monthlyKrw.toLocaleString("ko-KR")}원 · 자동 갱신 없음`}</p>
    <Link className="btn primary" href={en ? "/en/subscription#purchase" : "/subscription#purchase"} onClick={close}>{en ? "View the pass and purchase" : "이용권 확인하고 구매"}</Link>
    <p className="purchase-dialog-note">{en ? "Analysis stays free. Report generation happens in your browser; source data is not uploaded." : "분석은 계속 무료입니다. 보고서는 브라우저에서 생성하며 원본을 서버에 보내지 않습니다."}</p>
  </ModalDialog>;
}
