"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import ModalDialog from "@/components/ds/ModalDialog";
import { VIDEO_TUTORIALS, TUTORIAL_STEP_SECONDS, tutorialIdsForPath, tutorialMedia } from "@/lib/videoTutorials";
import { trackProductEvent } from "@/lib/analytics";

const OPEN_EVENT = "gop:video-tutorial";
export function VideoHelpButton({ topic, locale = "ko" }) {
  return <button type="button" className="tutorial-inline" onClick={event => {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { topic, trigger: event.currentTarget } }));
  }}><span aria-hidden="true">▷</span> {locale === "en" ? "Video guide" : "영상으로 보기"}</button>;
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
      if (!VIDEO_TUTORIALS.some(item => item.id === event.detail?.topic)) return;
      triggerRef.current = event.detail.trigger;
      setFailed(false);
      setChapter(0);
      setTopic(event.detail.topic);
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);
  if (!ids.length && !tutorial) return null;
  const close = () => { videoRef.current?.pause(); setTopic(null); };
  const event = name => trackProductEvent(name, { source: "video_tutorial", content_slug: topic, locale });
  return <>
    <button type="button" className="tutorial-launcher no-print" aria-haspopup="dialog" onClick={event => {
      triggerRef.current = event.currentTarget;
      const projectManagement = !!document.querySelector("#project-management");
      const contextual = tutorialIdsForPath(pathname, { projectManagement });
      select(contextual[0] || ids[0]);
    }}><span aria-hidden="true">▷</span><span>{en ? "Video guide" : "영상 사용 안내"}</span></button>
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
            <p id="tutorial-video-note" className="tutorial-note">{en ? "36 sec · silent, with on-screen instructions · synthetic demo data" : "36초 · 소리 없이 화면 설명으로 안내 · 가상 데모 데이터"}</p>
            {["import", "mapping", "sheets"].includes(topic) && <p className="tutorial-note">{en ? "Demonstrated in the dashboard. Required fields and supported file types differ by tool; use the input guide on your current screen." : "운영 대시보드의 입력 화면을 기준으로 설명합니다. 도구별 필수 컬럼과 지원 파일은 현재 화면의 입력 안내를 따르세요."}</p>}
            {failed && <p role="alert">{en ? "Video could not load. Read the steps below or reopen this guide to retry." : "영상을 불러오지 못했습니다. 아래 설명을 읽거나 안내를 다시 열어 재시도하세요."}</p>}
            <details className="tutorial-transcript"><summary>{en ? "Read the steps" : "단계별 설명 읽기"}</summary><ol>{tutorial.steps.map((step, index) => <li key={index}><button type="button" onClick={() => {
              const player = videoRef.current;
              if (player) {
                const time = index * TUTORIAL_STEP_SECONDS;
                setChapter(time);
                if (player.readyState > 0) player.currentTime = time;
                else { player.preload = "metadata"; player.load(); }
                player.focus();
              }
            }}>{String(index * TUTORIAL_STEP_SECONDS).padStart(2, "0")}s · {step[locale].title}</button><p>{step[locale].body}</p></li>)}</ol></details>
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
