"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import ModalDialog from "@/components/ds/ModalDialog";
import { VIDEO_TUTORIALS, TUTORIAL_STEP_SECONDS, tutorialIdsForPath, tutorialMedia } from "@/lib/videoTutorials";
import { trackProductEvent } from "@/lib/analytics";

const OPEN_EVENT = "gop:video-tutorial";
let pendingOpen = null;
const subscribeHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
export function VideoHelpButton({ topic, locale = "ko", className = "tutorial-inline", onOpen, children }) {
  const ready = useSyncExternalStore(subscribeHydration, clientReady, serverReady);
  return <button type="button" disabled={!ready} className={className} aria-haspopup="dialog" onClick={event => {
    const trigger = onOpen?.() || event.currentTarget;
    // Streaming hydration can make the uploader interactive before the root host.
    pendingOpen = { topic, trigger, pathname: window.location.pathname };
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: pendingOpen }));
  }}><span aria-hidden="true">▷</span> {children || (locale === "en" ? "Video guide" : "영상으로 보기")}</button>;
}

// 튜토리얼 진입은 헤더에 둔다. 예전에는 화면 오른쪽 아래에 떠 있는 버튼이었는데,
// 스크롤 위치에 따라 결과 카드·업로드 버튼·마감 영역을 번갈아 덮었다(2026-09-24 실측:
// 홈·/start·대시보드·도구 전부). 떠 있는 버튼은 어디에 두든 무언가를 덮는다.
export function TutorialHeaderButton({ locale = "ko" }) {
  const pathname = usePathname();
  const ready = useSyncExternalStore(subscribeHydration, clientReady, serverReady);
  if (!tutorialIdsForPath(pathname).length) return null;
  const en = locale === "en";
  return <button type="button" disabled={!ready} className="btn ghost tutorial-launcher no-print" aria-label={en ? "Tutorial" : "튜토리얼"} aria-haspopup="dialog" onClick={event => {
    pendingOpen = { trigger: event.currentTarget, pathname: window.location.pathname };
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: pendingOpen }));
  }}><span className="tutorial-launcher__icon" aria-hidden="true">?</span><span className="tutorial-launcher__label">{en ? "Tutorial" : "튜토리얼"}</span></button>;
}

function TutorialLauncher({ pathname, locale }) {
  const [topic, setTopic] = useState(null);
  const [failed, setFailed] = useState(false);
  const [chapter, setChapter] = useState(0);
  const videoRef = useRef(null);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const en = locale === "en";
  const ids = tutorialIdsForPath(pathname);
  const tutorial = VIDEO_TUTORIALS.find(item => item.id === topic);
  const media = tutorial ? tutorialMedia(tutorial.id, locale) : null;
  const select = id => { videoRef.current?.pause(); setFailed(false); setChapter(0); setTopic(id); };
  useEffect(() => {
    const open = event => {
      const requested = event.detail?.topic || tutorialIdsForPath(pathname, { projectManagement: !!document.querySelector("#project-management") })[0] || "import";
      if (!VIDEO_TUTORIALS.some(item => item.id === requested)) return;
      pendingOpen = null;
      triggerRef.current = event.detail?.trigger;
      setFailed(false);
      setChapter(0);
      setTopic(requested);
    };
    window.addEventListener(OPEN_EVENT, open);
    if (pendingOpen) {
      const request = pendingOpen;
      pendingOpen = null;
      if (request.trigger?.isConnected && request.pathname === window.location.pathname) open({ detail: request });
    }
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, [pathname]);
  if (!ids.length && !tutorial) return null;
  const close = () => { videoRef.current?.pause(); setTopic(null); };
  const event = name => trackProductEvent(name, { source: "video_tutorial", content_slug: topic, locale });
  return <>
    <ModalDialog open={!!tutorial} onClose={close} ariaLabel={en ? "Video guide" : "영상 사용 안내"} initialFocusRef={closeRef} returnFocusRef={triggerRef} overlayClassName="tutorial-overlay" panelClassName="tutorial-panel">
      {tutorial && <>
        <header className="tutorial-header"><div><p>{en ? "FOLLOW ALONG" : "화면을 보며 따라 하기"}</p><h2>{tutorial[locale]}</h2></div><button type="button" className="tutorial-close" ref={closeRef} onClick={close} aria-label={en ? "Close video guide" : "영상 안내 닫기"}>×</button></header>
        <div className="tutorial-layout">
          <div className="tutorial-main">
            <video key={topic} ref={videoRef} className="tutorial-video" controls playsInline preload="none" width="1280" height="720" poster={media.poster} aria-label={tutorial[locale]} aria-describedby="tutorial-video-note" onLoadedMetadata={() => { if (videoRef.current) videoRef.current.currentTime = chapter; }} onPlay={() => event("tutorial_video_started")} onEnded={() => event("tutorial_video_completed")} onError={() => setFailed(true)}>
              <source src={media.video} type="video/mp4" onError={() => setFailed(true)} />
              <track kind="captions" src={media.captions} srcLang={locale} label={en ? "English" : "한국어"} />
              {en ? "Read the steps below if video is unavailable." : "영상 재생이 지원되지 않으면 아래 설명을 확인하세요."}
            </video>
            <p id="tutorial-video-note" className="tutorial-note">{en ? `${tutorial.steps.length * TUTORIAL_STEP_SECONDS} sec · silent quick guide · synthetic demo data` : `${tutorial.steps.length * TUTORIAL_STEP_SECONDS}초 · 소리 없이 핵심만 · 가상 데모 데이터`}</p>
            {["import", "mapping", "sheets"].includes(topic) && <p className="tutorial-note">{en ? "Demonstrated in the dashboard. Required fields and supported file types differ by tool; use the input guide on your current screen." : "운영 대시보드의 입력 화면을 기준으로 설명합니다. 도구별 필수 컬럼과 지원 파일은 현재 화면의 입력 안내를 따르세요."}</p>}
            {failed && <p role="alert">{en ? "Video could not load. Read the steps below or reopen this guide to retry." : "영상을 불러오지 못했습니다. 아래 설명을 읽거나 안내를 다시 열어 재시도하세요."}</p>}
            <section className="tutorial-transcript"><h3>{en ? "Read the steps" : "단계별 설명 읽기"}</h3><ol>{tutorial.steps.map((step, index) => <li key={index}><button type="button" onClick={() => {
              const player = videoRef.current;
              if (player) {
                const time = index * TUTORIAL_STEP_SECONDS;
                setChapter(time);
                if (player.readyState > 0) player.currentTime = time;
                else { player.preload = "metadata"; player.load(); }
                player.focus();
              }
            }}>{String(index * TUTORIAL_STEP_SECONDS).padStart(2, "0")}s · {step[locale].title}</button><p>{step[locale].body}</p></li>)}</ol></section>
            <Link className="tutorial-guide-link" href={`${en ? "/en" : ""}${tutorial.guide}`} onClick={close}>{en ? "Open the related page" : "관련 화면 열기"} →</Link>
          </div>
          <nav className="tutorial-topics" aria-label={en ? "Tutorial topics" : "영상 안내 주제"}>{[...new Set([...ids, ...VIDEO_TUTORIALS.map(item => item.id)])].map(id => {
            const item = VIDEO_TUTORIALS.find(entry => entry.id === id);
            return <button key={id} type="button" aria-current={topic === id ? "true" : undefined} onClick={() => select(id)}><span aria-hidden="true">▷</span>{item[locale]}</button>;
          })}</nav>
        </div>
      </>}
    </ModalDialog>
  </>;
}
export default function VideoTutorialHelp({ locale = "ko" }) {
  const pathname = usePathname();
  return <TutorialLauncher key={pathname} pathname={pathname} locale={locale === "en" ? "en" : "ko"} />;
}
