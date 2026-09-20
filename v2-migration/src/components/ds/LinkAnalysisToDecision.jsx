"use client";
import { useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/store/useDataStore";
import { serializeReviewEvidence } from "@/lib/reviewEvidence";
import { reviewEvidenceMatch } from "@/lib/reviewEvidenceMatch";
import { decisionReviewHref } from "@/lib/decisionReviewUi";
import ReviewSaveDialog from "@/components/ReviewSaveDialog";
import EvidenceCompatibility from "@/components/weekly-review/EvidenceCompatibility";

export default function LinkAnalysisToDecision({ evidence, toolId, metric, locale = "ko" }) {
  const en = locale === "en";
  const records = useAppStore(state => state.decisionRecords);
  const [selected, setSelected] = useState("");
  const [confirmedBasis, setConfirmedBasis] = useState("");
  const [pending, setPending] = useState(null);
  const [saved, setSaved] = useState("");
  const source = { evidence: serializeReviewEvidence(evidence), toolId, metric, dataOrigin: "real" };
  const candidates = records.filter(record => record.dataOrigin !== "demo").map(record => ({ record, match: reviewEvidenceMatch(record, source, locale) })).sort((a, b) => Number(b.match.recommended) - Number(a.match.recommended));
  const chosen = candidates.find(item => item.record.id === selected);
  const confirmationKey = JSON.stringify([source.evidence, chosen?.record]);
  const confirmed = confirmedBasis === confirmationKey;
  if (!candidates.length || !source.evidence) return null;
  return <section data-information-section="" className="decision-evidence"><header data-information-heading="">{en ? "Link this result to an existing decision" : "이 결과를 기존 결정에 연결"}</header>
    <p>{en ? "Attach this analysis snapshot without creating another decision. Source data stays on this device." : "새 결정을 추가하지 않고 이번 분석의 근거를 붙입니다. 원본 데이터는 기기에만 남습니다."}</p>
    <label>{en ? "Decision to review" : "결과를 검토할 결정"}<select value={selected} onChange={event => { setSelected(event.target.value); setConfirmedBasis(""); setSaved(""); }}><option value="">{en ? "Choose a decision" : "결정을 선택하세요"}</option>{candidates.map(({ record, match }) => <option key={record.id} value={record.id}>{match.recommended ? (en ? "Matching metric · " : "지표 일치 · ") : ""}{record.action} · {record.reviewDate}</option>)}</select></label>
    {chosen && <><EvidenceCompatibility match={chosen.match} locale={locale} /><label><input type="checkbox" checked={confirmed} onChange={event => setConfirmedBasis(event.target.checked ? confirmationKey : "")} />{en ? "I checked the metric, treatment direction, population and period, including differences or missing details." : "지표·처치 방향·집단·기간과 다르거나 미확인인 조건을 확인했습니다."}</label><button className="btn" disabled={!confirmed} onClick={() => setPending({ id: selected, evidence: serializeReviewEvidence({ ...evidence, capturedAt: new Date().toISOString() }) })}>{en ? "Save linked result" : "연결한 결과 저장"}</button></>}
    {saved && <p role="status"><Link href={decisionReviewHref(locale, saved)}>{en ? "Result linked. Continue reviewing this decision" : "결과를 연결했습니다. 이 결정 검토 이어가기"}</Link></p>}
    {pending && <ReviewSaveDialog locale={locale} onClose={() => setPending(null)} onConfirm={async () => {
      // Snapshot is captured at the click; account refresh must not change the saved result.
      if (!useAppStore.getState().decisionRecords.some(record => record.id === pending.id)) throw new Error("decision_missing");
      await useAppStore.getState().commitDecisionRecord(pending.id, { effectEvidence: pending.evidence, effectSourceId: "" });
      setSaved(pending.id);
    }} />}
  </section>;
}
