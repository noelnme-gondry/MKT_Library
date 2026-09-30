"use client";
import { useCallback, useEffect, useState } from "react";
import { accountRequest } from "@/lib/account/accountClient";
import { partitionForSync } from "./recipe";

// 계정에 이름 붙여 저장한 분석 설정(docs/result-autonomy-spec.md §4.5 · 2026-09-30 결정 "이름 붙여 저장").
// 목록은 도구별로 거르고, 저장할 때 사용자 데이터 값이 든 단계("Meta만 분석")는 빼고 보낸다.
// status: loading | signedOut | ready | failed
export function useAccountRecipes(toolId, vocabulary) {
  const [state, setState] = useState({ status: "loading", recipes: [], canApply: false });

  const load = useCallback(async () => {
    try {
      const data = await accountRequest("recipes");
      setState({ status: "ready", recipes: (data.recipes || []).filter((recipe) => recipe.toolId === toolId), canApply: Boolean(data.canApply) });
    } catch (error) {
      setState((prev) => ({ ...prev, status: error.message === "LOGIN_REQUIRED" ? "signedOut" : "failed" }));
    }
  }, [toolId]);

  useEffect(() => {
    // 마운트 직후 한 번 + 로그인·구매 등 계정이 바뀌면 다시 읽는다.
    const timer = setTimeout(load, 0);
    const onChange = () => load();
    window.addEventListener("gop-account-changed", onChange);
    return () => { clearTimeout(timer); window.removeEventListener("gop-account-changed", onChange); };
  }, [load]);

  const save = useCallback(async (name, steps) => {
    const { syncable, deviceOnly } = partitionForSync(steps, vocabulary);
    if (!syncable.length) return { ok: false, code: "NOTHING_TO_SAVE", skipped: deviceOnly.length };
    try {
      const data = await accountRequest("recipes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipe: { toolId, name, steps: syncable } }) });
      setState((prev) => ({ ...prev, status: "ready", recipes: (data.recipes || []).filter((recipe) => recipe.toolId === toolId) }));
      return { ok: true, skipped: deviceOnly.length };
    } catch (error) {
      if (error.message === "PRO_REQUIRED") setState((prev) => ({ ...prev, canApply: false }));
      return { ok: false, code: error.message, skipped: deviceOnly.length };
    }
  }, [toolId, vocabulary]);

  return { ...state, save, reload: load };
}
