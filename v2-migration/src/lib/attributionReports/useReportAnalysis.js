"use client";
import { useEffect, useMemo, useState } from "react";
import { createReportSession } from "./reportWorkerClient";
const DEFAULT_CONFIG = {};
export function useReportAnalysis(kind, csv, enabled, options, config = DEFAULT_CONFIG, revision = 0) {
  const [loaded, setLoaded] = useState(null), [computed, setComputed] = useState(null);
  const source = useMemo(() => ({ raw: csv?.raw, mapping: csv?.mapping, kind, config, revision }), [csv?.raw, csv?.mapping, kind, config, revision]);
  useEffect(() => {
    if (!enabled || !source.raw?.length) return undefined;
    let active = true, session;
    // Defer creation so the loading state can paint before fallback computation.
    Promise.resolve().then(() => {
      if (!active) return;
      session = createReportSession(kind, source.raw, source.mapping || {}, config);
      return session.ready.then(metadata => { if (active) setLoaded({ source, session, metadata }); });
    }).catch(error => { if (active) setLoaded({ source, error: error.message }); });
    return () => { active = false; session?.close(); };
  }, [source, enabled, kind, config]);
  const current = loaded?.source === source && enabled ? loaded : null;
  useEffect(() => {
    if (!current?.session) return undefined;
    let active = true;
    current.session.query(options).then(result => { if (active) setComputed({ source, options, result }); }).catch(error => { if (active) setComputed({ source, options, error: error.message }); });
    return () => { active = false; };
  }, [current, source, options]);
  const ready = computed?.source === source && computed.options === options && enabled ? computed : null;
  return { metadata: current?.metadata, result: ready?.result, error: current?.error || ready?.error, loading: Boolean(enabled && !ready?.result && !current?.error && !ready?.error) };
}
