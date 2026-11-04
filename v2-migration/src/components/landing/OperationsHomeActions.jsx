"use client";
import Link from "next/link";
import { useAppStore } from "@/store/useDataStore";
import { operationQueueState } from "@/lib/operations/actionQueue";
import { readOperationAction, OPERATION_ACTION_KINDS } from "@/lib/operations/actionContract";
import { OPERATIONS_PATH } from "@/lib/operations/operationsDemo";

export default function OperationsHomeActions({ locale = "ko" }) {
  const records = useAppStore(state => state.decisionRecords);
  const en = locale === "en", tr = (ko, english) => en ? english : ko;
  const now = new Date(), today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const active = records.filter(record => ["review", "progress"].includes(operationQueueState(record, today)));
  if (!active.length) return null;
  const reviews = active.filter(record => operationQueueState(record, today) === "review");
  const first = [...active].sort((a, b) => Number(operationQueueState(a, today) !== "review") - Number(operationQueueState(b, today) !== "review") || (a.reviewDate || "").localeCompare(b.reviewDate || ""))[0];
  const action = readOperationAction(first.operationAction);
  return <section className="home-operations-actions" aria-label={tr("내 운영 액션 이어가기", "Continue my operating actions")}>
    <div><h2>{tr("지금 확인할 운영 액션", "Operating actions to check now")}</h2><p>{tr(`현재 프로젝트 · 검토일이 된 액션 ${reviews.length}건 · 진행 중 ${active.length - reviews.length}건`, `Current project · ${reviews.length} reviews due · ${active.length - reviews.length} in progress`)}</p>
      <strong>{OPERATION_ACTION_KINDS[action.kind][en ? 1 : 0]} · {first.actionTarget}</strong><p>{tr("관측 결과는 플래너에서 현재 데이터와 함께 확인하세요.", "Open the planner to check observations against your current data.")}</p></div>
    <Link className="btn ghost" href={`${en ? "/en" : ""}${OPERATIONS_PATH}`}>{tr("플래너에서 이어가기", "Continue in planner")}</Link>
  </section>;
}
