"use client";
import { useEffect, useState } from "react";
import { listWorkspaceDatasets } from "@/lib/workspace-storage";
import { listProjects } from "@/lib/project/repository";
import { PROJECT_LIMITS, bytesLabel } from "@/lib/project/projectLimits";

export default function ProjectStorageSummary({ locale = "ko", refreshKey = 0 }) {
  const en = locale === "en";
  const [usage, setUsage] = useState(null);
  useEffect(() => {
    let active = true;
    Promise.all([listWorkspaceDatasets(null), listProjects(), navigator.storage?.estimate?.(), navigator.storage?.persisted?.()]).then(([files, projects, estimate, persisted]) => {
      if (active) setUsage({ source: files.reduce((sum, file) => sum + file.byteSize, 0), metadata: new Blob([JSON.stringify(projects)]).size, estimate, persisted });
    }).catch(() => { if (active) setUsage({ unavailable: true }); });
    return () => { active = false; };
  }, [refreshKey]);
  return <section className="project-storage-summary" aria-labelledby="project-storage-heading">
    <h2 id="project-storage-heading">{en ? "How much can this browser store?" : "이 브라우저에 얼마나 저장할 수 있나요?"}</h2>
    <dl className="project-storage-stats">
      <div><dt>{en ? "Saved source files" : "저장된 원본 파일"}</dt><dd>{bytesLabel(usage?.source)}</dd></div>
      <div><dt>{en ? "Project records and branding (JSON size)" : "프로젝트 기록·브랜딩 (JSON 크기)"}</dt><dd>{bytesLabel(usage?.metadata)}</dd></div>
      <div><dt>{en ? "Browser-estimated origin usage / quota" : "브라우저 추정 사이트 사용량 / 할당량"}</dt><dd>{bytesLabel(usage?.estimate?.usage)} / {bytesLabel(usage?.estimate?.quota)}</dd></div>
    </dl>
    <p>{en ? `App storage limits: ${bytesLabel(PROJECT_LIMITS.metadataBytes)} of project records, ${bytesLabel(PROJECT_LIMITS.fileBytes)} per file, ${bytesLabel(PROJECT_LIMITS.projectBytes)} of source files per project, ${bytesLabel(PROJECT_LIMITS.workspaceBytes)} across this browser. Each project keeps the latest upload in each data category and up to 16 period snapshots.` : `앱 저장 한도: 프로젝트 기록 ${bytesLabel(PROJECT_LIMITS.metadataBytes)}, 파일당 ${bytesLabel(PROJECT_LIMITS.fileBytes)}, 프로젝트당 원본 합계 ${bytesLabel(PROJECT_LIMITS.projectBytes)}, 이 브라우저 전체 원본 합계 ${bytesLabel(PROJECT_LIMITS.workspaceBytes)}입니다. 프로젝트별 데이터 종류마다 최신 업로드 1개와 기간 집계 최대 16개를 보관합니다.`}</p>
    <p>{en ? "These are storage limits, not a guarantee of analysis speed or row capacity. Wide tables and large text need more memory. Browser estimates include other storage and caches belonging to this site; available disk space can change." : "저장 한도는 분석 속도나 처리 가능한 행 수를 보장하는 값이 아닙니다. 열이 많거나 긴 텍스트가 있으면 메모리가 더 필요합니다. 브라우저 추정치에는 이 사이트의 다른 저장 데이터와 캐시도 포함되며, 실제 여유 공간은 달라질 수 있습니다."}</p>
    <p>{en ? "Project data stays in this browser's IndexedDB. Decision summaries also use local storage. Nothing syncs between devices. Export a backup before clearing browser data, changing devices, or leaving a project unused for 90 days." : "프로젝트 데이터는 이 브라우저의 IndexedDB에 저장하고, 현재 결정 요약은 로컬 저장소도 사용합니다. 기기 간 자동 동기화는 없습니다. 브라우저 데이터 삭제·기기 변경·90일 미사용에 대비해 백업을 내보내세요."}</p>
    <p>{en ? `Persistent storage: ${usage?.persisted === true ? "granted" : usage?.persisted === false ? "not granted; the browser may evict data" : "unknown"}. Storage limits apply to free and paid plans alike.` : `영구 저장 권한: ${usage?.persisted === true ? "허용됨" : usage?.persisted === false ? "미허용 — 브라우저가 데이터를 정리할 수 있음" : "미확인"}. 저장 한도는 무료·유료에 동일하게 적용됩니다.`}</p>
    {usage?.unavailable && <p role="status">{en ? "Could not measure this browser's storage. No capacity is guaranteed." : "이 브라우저의 저장소를 측정하지 못했습니다. 저장 용량을 보장할 수 없습니다."}</p>}
  </section>;
}
