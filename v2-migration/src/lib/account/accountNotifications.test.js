// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { accountRequest } from "./accountClient";
afterEach(() => vi.unstubAllGlobals());
it("broadcasts successful writes but not reads, failed writes or login preparation", async () => {
  const changed = vi.fn();
  window.addEventListener("gop-account-changed", changed);
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true })));
  try {
    await accountRequest("memos");
    await accountRequest("login", { method: "POST" });
    expect(changed).not.toHaveBeenCalled();
    await accountRequest("memos", { method: "POST" });
    await accountRequest("session", { method: "DELETE" });
    expect(changed).toHaveBeenCalledTimes(2);
    fetch.mockResolvedValueOnce(Response.json({ error: "FAILED" }, { status: 503 }));
    await expect(accountRequest("memos", { method: "POST" })).rejects.toThrow("FAILED");
    expect(changed).toHaveBeenCalledTimes(2);
  } finally { window.removeEventListener("gop-account-changed", changed); }
});
