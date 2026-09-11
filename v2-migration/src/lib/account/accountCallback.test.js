import { expect, it } from "vitest";
import { accountLoginFailure } from "./accountServer";
import { GET as googleCallback } from "@/app/api/account/callback/route";
import { GET as emailCallback } from "@/app/api/account/email-callback/route";

it.each([googleCallback, emailCallback])("returns a recoverable bilingual HTML page for an invalid callback", async callback => {
  const response = await callback(new Request("https://growthoptplaybook.com/api/account/callback"));
  expect(response.status).toBe(400);
  expect(response.headers.get("content-type")).toContain("text/html");
  const html = await response.text();
  expect(html).toContain("gop-account-failed");
  expect(html).toContain('href="/start"');
  expect(html).toContain('href="/en/start"');
  expect(html).not.toContain('window.close()');
});
it("explains restricted access without exposing raw exceptions", async () => {
  const response = accountLoginFailure(new Error("ACCOUNT_RESTRICTED"));
  expect(response.status).toBe(403);
  expect(await response.text()).toContain("저장한 기록을 삭제한 것은 아닙니다");
  expect(await accountLoginFailure(new Error('<script>alert("secret")</script>')).text()).not.toContain("secret");
});
