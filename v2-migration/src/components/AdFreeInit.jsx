"use client";
import { useEffect } from "react";
import { useAppStore } from "@/store/useDataStore";

// 광고 제외(ad-free) 활성화 — 비밀 URL 파라미터. 한 번 방문하면 store.adFree=true가
// persist(localStorage)로 저장돼 이후 영구 제외. 대외 공개해도 일반 유저는 토큰을 몰라
// 광고를 정상적으로 봄. 토큰은 클라이언트 번들에 노출되므로 "보안"이 아니라 "숨김"임.
//   켜기: /?adfree=<TOKEN>   끄기: /?adfree=off
// 적용 후 주소창에서 파라미터를 제거(공유 링크에 토큰이 남지 않게).
const ADFREE_TOKEN = "gondry-ops-2026";

export default function AdFreeInit() {
  const setAdFree = useAppStore((s) => s.setAdFree);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const v = params.get("adfree");
      if (v == null) return;
      if (v === ADFREE_TOKEN) setAdFree(true);
      else if (v === "off") setAdFree(false);
      // 파라미터 제거(히스토리 치환 — 뒤로가기 오염·토큰 유출 방지).
      params.delete("adfree");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? "?" + qs : "") + window.location.hash);
    } catch {
      /* SSR/파싱 실패 — 무시 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
