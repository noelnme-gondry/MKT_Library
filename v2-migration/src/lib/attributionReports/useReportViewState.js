"use client";
import { useEffect, useState } from "react";
// Session-only, weakly owned by the imported rows. Source-derived selections
// never enter account sync or localStorage, but survive moving between views.
const cache = new WeakMap();
export function useReportViewState(key, raw, initial) {
  const fresh = () => typeof initial === "function" ? initial() : initial;
  const restore = () => raw && cache.get(raw)?.get(key) || fresh();
  const [snapshot, setSnapshot] = useState(() => ({ raw, value: restore() }));
  const current = snapshot.raw === raw ? snapshot : { raw, value: restore() };
  if (snapshot.raw !== raw) setSnapshot(current);
  useEffect(() => {
    if (!raw) return;
    if (!cache.has(raw)) cache.set(raw, new Map());
    cache.get(raw).set(key, current.value);
  }, [raw, key, current.value]);
  const setValue = next => setSnapshot(previous => {
    const value = previous.raw === raw ? previous.value : restore();
    return { raw, value: typeof next === "function" ? next(value) : next };
  });
  return [current.value, setValue];
}
