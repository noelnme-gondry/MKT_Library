"use client";
// KR 홈("/") 전용 1회성 언어 자동 감지 — 서버 미들웨어/Accept-Language redirect는
// 크롤러 cloaking 리스크로 미채택(§ blog-en-translation-strategy 전례), 대신 순수
// 클라이언트 navigator.language 감지라 크롤러엔 영향 없음. pref가 이미 있으면(사용자가
// 언어 스위치 링크를 눌러본 적 있음) 절대 재이동하지 않음 — "/" -> "/en" 단방향만,
// 반대(EN -> KR) 자동 redirect는 만들지 않는다(직접 /en URL 진입자를 강제로 안 돌림).
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getLocalePref, setLocalePref } from "@/lib/localePref";

export default function LocaleAutoRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (getLocalePref()) return; // 이미 선택함 — 자동 이동 안 함

    const lang = navigator.language || (navigator.languages && navigator.languages[0]) || "";
    if (lang.toLowerCase().startsWith("en")) {
      setLocalePref("en"); // 재방문 시 또 자동 이동하지 않도록 즉시 기록
      router.replace("/en");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
