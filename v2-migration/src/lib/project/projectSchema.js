const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function assertSafe(value, depth = 0) {
  if (depth > 12) throw new Error("PROJECT_TOO_DEEP");
  if (Array.isArray(value)) {
    if (value.length > 500) throw new Error("PROJECT_ARRAY_TOO_LONG");
    value.forEach((item) => assertSafe(item, depth + 1));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      if (BLOCKED_KEYS.has(key)) throw new Error("PROJECT_UNSAFE_KEY");
      assertSafe(child, depth + 1);
    });
  } else if (typeof value === "string" && value.length > 20_000) {
    throw new Error("PROJECT_STRING_TOO_LONG");
  }
}

export function validateProjectFile(project) {
  assertSafe(project);
  if (!project || project.product !== "growthopt-playbook") throw new Error("PROJECT_PRODUCT_MISMATCH");
  if (project.schemaVersion !== 1) throw new Error(project?.schemaVersion > 1 ? "PROJECT_FUTURE_VERSION" : "PROJECT_VERSION_UNSUPPORTED");
  return project;
}

