"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import CsvUploader from "@/components/CsvUploader";
import DochiSprite from "@/components/assistant/DochiSprite";
import ModalDialog from "@/components/ds/ModalDialog";
import { trackProductEvent } from "@/lib/analytics";
import {
  dochiWelcomeServerSnapshot,
  markDochiWelcomeSessionSeen,
  readDochiWelcomeStorageSnapshot,
  shouldShowDochiWelcome,
  writeDochiWelcomeDismissed,
} from "@/lib/dochiWelcome";
import { useAppStore } from "@/store/useDataStore";

// 스냅샷이 바뀌는 일이 없으므로 구독은 빈 해지 함수만 돌려준다.
const subscribeWelcome = () => () => {};

// 첫 방문자 인사 오버레이 — 홈(랜딩)에 처음 들어온 사람에게 도치가 4단계로 말을
// 걸고, 마지막 단계에서 바로 CSV·구글시트를 받는다. 닫아도 우하단 상시 접수처
// (DochiAssistant)가 남으므로 여기서 안 올린 사람도 뒤에 올릴 수 있다.
//
// 노출 판정은 lib/dochiWelcome.js가 소유한다(§SSOT). 정적 프리렌더라 서버 HTML엔
// 이 오버레이가 없고, 마운트 후 저장소를 읽어 열리므로 크롤러는 가려진 화면을
// 보지 않는다.
//
// 단계별 포즈는 자산(public/assets/dochi)에 실제로 있는 것만 쓴다.
export const DOCHI_WELCOME_STEPS = [
  // 예전 4단계 중 앞 둘("안녕하세요!" · "저는 도치입니다!")은 §5.7의 네 역할
  // (상태·행동·오해 방지·오류 해결) 중 아무것도 하지 않으면서 첫 방문자에게
  // 클릭 두 번을 요구했다. 인사는 1단계 안 한 줄로 접는다.
  { id: "intro", pose: "point-up" },
  { id: "ask", pose: "delivery" },
];

// 단계 포즈 전부 + 가져오기 중 달리기. STEPS에서 파생하므로 단계를 늘려도 어긋나지 않는다.
const PRELOAD_POSES = [...DOCHI_WELCOME_STEPS.map((step) => step.pose), "run"];

export const DOCHI_WELCOME_COPY = {
  ko: {
    label: "도치의 첫 방문 안내",
    lines: [
      [
        "안녕하세요, 안내를 맡은 도치입니다.",
        "마케터가 캠페인 데이터로 다음 행동을 정하는 곳이에요.",
        "모든 계산은 브라우저에서 이뤄지고, 원본 행은 서버에 저장되지 않습니다.",
      ],
      [
        "데이터 파일이나 전체 공개된 스프레드시트 주소를 주시면",
        "발견된 문제와 지금 할 수 있는 분석을 정리해 드릴게요.",
      ],
    ],
    next: "다음",
    close: "안내 닫기",
    skip: "건너뛰기",
    dontShow: "다음 방문부터 보이지 않기",
    importing: "파일을 읽고 있어요.",
    progress: (current, total) => `${total}단계 중 ${current}단계`,
  },
  en: {
    label: "Dochi’s welcome for first-time visitors",
    lines: [
      [
        "Hello — I’m Dochi, your guide here.",
        "This is where marketers turn campaign data into the next decision.",
        "Everything is calculated in your browser, and source rows are never stored on a server.",
      ],
      [
        "Hand me a data file, or the address of a publicly shared spreadsheet,",
        "and I’ll lay out the problems I found and the analyses you can run.",
      ],
    ],
    next: "Next",
    close: "Close the welcome",
    skip: "Skip",
    dontShow: "Don’t show this again",
    importing: "Reading your file.",
    progress: (current, total) => `Step ${current} of ${total}`,
  },
};

export default function DochiWelcomeOverlay({ locale = "ko" }) {
  const copy = DOCHI_WELCOME_COPY[locale] || DOCHI_WELCOME_COPY.ko;
  const router = useRouter();
  const savedDatasets = useAppStore((state) => state.workspaceDatasetSummaries);
  const decisionPersistenceEnabled = useAppStore((state) => state.decisionPersistenceEnabled);
  const workspaceRestoreStatus = useAppStore((state) => state.workspaceRestoreStatus);
  const [closed, setClosed] = useState(false);
  const [step, setStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [importing, setImporting] = useState(false);
  const nextButtonRef = useRef(null);
  // 열림 여부는 effect의 setState가 아니라 렌더 파생이다(§5 set-state-in-effect).
  // 저장소 판정은 스냅샷이 소유한다. 기기 저장이 켜진 경우 IndexedDB 복원이
  // 끝날 때까지 기다려야 기존 사용자가 1단계로 잠깐 보였다가 4단계로 바뀌지 않는다.
  const storageAllows = useSyncExternalStore(
    subscribeWelcome,
    readDochiWelcomeStorageSnapshot,
    dochiWelcomeServerSnapshot,
  );
  const isRestoreResolved = decisionPersistenceEnabled !== true
    || workspaceRestoreStatus === "ready"
    || workspaceRestoreStatus === "failed";
  const displayStep = savedDatasets.length > 0 ? DOCHI_WELCOME_STEPS.length - 1 : step;
  const open = shouldShowDochiWelcome({
    dismissed: !storageAllows,
  }) && isRestoreResolved && !closed;

  useEffect(() => {
    if (!open) return;
    markDochiWelcomeSessionSeen();
    trackProductEvent("onboarding_welcome_viewed", { placement: "home_welcome", locale, state: "opened" });
    // open이 true가 되는 것은 생애 한 번뿐이라 이 effect도 한 번만 돈다.
  }, [open, locale]);

  const close = (state) => {
    if (dontShowAgain) writeDochiWelcomeDismissed();
    setClosed(true);
    trackProductEvent("onboarding_welcome_closed", {
      placement: "home_welcome",
      locale,
      state,
      rank: displayStep + 1,
    });
  };

  const goNext = () => {
    const nextStep = Math.min(displayStep + 1, DOCHI_WELCOME_STEPS.length - 1);
    setStep(nextStep);
    trackProductEvent("onboarding_welcome_step", {
      placement: "home_welcome",
      locale,
      state: DOCHI_WELCOME_STEPS[nextStep].id,
      rank: nextStep + 1,
    });
  };

  const isLast = displayStep === DOCHI_WELCOME_STEPS.length - 1;

  return (
    <ModalDialog
      open={open}
      onClose={() => close("dismissed")}
      ariaLabel={copy.label}
      overlayClassName="dochi-welcome-overlay"
      panelClassName="dochi-welcome"
    >
      <div className="dochi-welcome__inner" data-step={DOCHI_WELCOME_STEPS[displayStep].id} data-importing={importing ? "true" : "false"}>
        <button type="button" className="dochi-welcome__close" onClick={() => close("dismissed")} aria-label={copy.close}>
          ×
        </button>

        {/* key로 리마운트해 단계가 바뀔 때마다 등장 모션이 다시 재생된다
            (같은 노드에 재적용하면 CSS 애니메이션이 다시 돌지 않는다). */}
        <div className="dochi-welcome__stage" key={`stage-${displayStep}-${importing}`} aria-hidden="true">
          <DochiSprite pose={importing ? "run" : DOCHI_WELCOME_STEPS[displayStep].pose} priority />
        </div>

        {/* 다음 단계·가져오기 포즈를 미리 받아 둔다. 무대는 단계마다 key로 리마운트돼
            이미지 노드가 새로 생기므로, 미리 받지 않으면 단계를 넘길 때마다 첫 등장과
            같은 공백이 반복된다. 이 블록은 무대 밖이라 리마운트되지 않는다. */}
        <div className="dochi-welcome__preload" aria-hidden="true">
          {PRELOAD_POSES.filter((pose) => pose !== DOCHI_WELCOME_STEPS[displayStep].pose).map((pose) => (
            <DochiSprite key={pose} pose={pose} priority />
          ))}
        </div>

        <div className="dochi-welcome__speech" key={`speech-${displayStep}`}>
          <div aria-live="polite">
            {(importing ? [copy.importing] : copy.lines[displayStep]).map((line) => (
              <p className="dochi-welcome__line" key={line}>{line}</p>
            ))}
          </div>

          {isLast && !importing && (
            <div className="dochi-welcome__intake">
              <CsvUploader
                toolId="start-gate"
                locale={locale}
                entryVariant="dochi"
                sheetInitiallyOpen
                onImportStart={() => setImporting(true)}
                onPrepared={() => {
                  // 닫기·건너뛰기로 오버레이가 사라져도 시작된 가져오기는 유지된다.
                  // 준비 완료 콜백은 그대로 결과 화면으로 보낸다.
                  close("imported");
                  router.push(locale === "en" ? "/en/dochi-result" : "/dochi-result");
                }}
                onImportFailed={() => setImporting(false)}
              />
            </div>
          )}

        </div>

        <div className="dochi-welcome__controls">
          <p className="dochi-welcome__progress">{copy.progress(displayStep + 1, DOCHI_WELCOME_STEPS.length)}</p>
          <label className="dochi-welcome__optout">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(event) => setDontShowAgain(event.target.checked)}
            />
            <span>{copy.dontShow}</span>
          </label>
          {isLast ? (
            <button type="button" className="dochi-welcome__skip" onClick={() => close("skipped")}>
              {copy.skip}
            </button>
          ) : (
            <button type="button" className="dochi-welcome__next" ref={nextButtonRef} onClick={goNext}>
              {copy.next}
            </button>
          )}
        </div>
      </div>
    </ModalDialog>
  );
}
