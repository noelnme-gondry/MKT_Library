let runtimePromise = null;
let runtimeStatus = "idle";
let taskQueue = Promise.resolve();
const installedPackages = new Set();

async function initializeWebR() {
  if (typeof window === "undefined") throw new Error("webr_browser_required");
  runtimeStatus = "initializing";
  try {
    // Next.js 16 dynamic import: keep the R/Wasm loader out of the initial route
    // bundle and fetch the large runtime assets only when an eligible analysis starts.
    const { WebR } = await import("webr");
    const runtime = new WebR();
    await runtime.init();
    runtimeStatus = "ready";
    return runtime;
  } catch (error) {
    runtimePromise = null;
    runtimeStatus = "failed";
    throw error;
  }
}

export function getWebRRuntimeStatus() {
  return runtimeStatus;
}

export function getWebRRuntime() {
  if (!runtimePromise) runtimePromise = initializeWebR();
  return runtimePromise;
}

async function ensurePackages(runtime, packages = []) {
  const missing = [...new Set(packages)].filter((name) => !installedPackages.has(name));
  if (!missing.length) return;
  await runtime.installPackages(missing);
  missing.forEach((name) => installedPackages.add(name));
}

// One R runtime owns one global environment. Serialize tasks so separately
// mounted tools cannot overwrite each other's temporary bindings.
export function runWebRAdvancedTask({ packages = [], execute }) {
  const run = taskQueue.then(async () => {
    const runtime = await getWebRRuntime();
    await ensurePackages(runtime, packages);
    return execute(runtime);
  });
  taskQueue = run.catch(() => undefined);
  return run;
}
