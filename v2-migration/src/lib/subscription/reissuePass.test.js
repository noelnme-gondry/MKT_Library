import { expect, it, vi } from "vitest";
import { reissuePass } from "./reissuePass";
const order = { id: "gop_12345678-1234-1234-1234-123456789abc", access_hash: "old", mode: "test", status: "paid", payment_key: "payment", amount: 5900, expires_at: "2099-01-01T00:00:00Z" };
const setup = () => ({ orderId: order.id, verifiedCase: "CASE_123", mode: "test", db: { query: vi.fn().mockResolvedValueOnce({ rows: [order] }).mockResolvedValueOnce({ rowCount: 1 }) }, fetchPayment: vi.fn(async () => ({ orderId: order.id, paymentKey: "payment", totalAmount: 5900, currency: "KRW", status: "DONE", approvedAt: "2026-09-01T00:00:00Z" })), writeSecret: vi.fn(), removeSecret: vi.fn() });
it("verifies provider state and rotates the hash without changing expiry", async () => {
  const args = setup(); const result = await reissuePass(args);
  expect(args.writeSecret.mock.calls[0][0]).toMatch(/^gop_.*\.[a-f0-9]{64}$/);
  expect(args.db.query.mock.calls[1][0]).not.toContain("expires_at=");
  expect(result.expiresAt).toBe(order.expires_at);
  expect(result.recoveryCode).toBeUndefined();
});
it("rejects refunds and does not create a credential", async () => {
  const args = setup(); args.fetchPayment.mockResolvedValue({ status: "CANCELED" });
  await expect(reissuePass(args)).rejects.toThrow("PAYMENT_NOT_VERIFIED"); expect(args.writeSecret).not.toHaveBeenCalled();
});
it("does not update if the secure file cannot be created", async () => {
  const args = setup(); args.writeSecret.mockRejectedValue(new Error("DISK"));
  await expect(reissuePass(args)).rejects.toThrow(); expect(args.db.query).toHaveBeenCalledTimes(1);
});
it("preserves the secret on an ambiguous DB response", async () => {
  const args = setup(); args.db.query = vi.fn().mockResolvedValueOnce({ rows: [order] }).mockRejectedValueOnce(new Error("NETWORK"));
  await expect(reissuePass(args)).rejects.toThrow(); expect(args.removeSecret).not.toHaveBeenCalled();
});
it("removes our new file when a concurrent revocation is confirmed", async () => {
  const args = setup(); args.db.query = vi.fn().mockResolvedValueOnce({ rows: [order] }).mockResolvedValueOnce({ rowCount: 0 });
  await expect(reissuePass(args)).rejects.toThrow("PASS_CHANGED"); expect(args.removeSecret).toHaveBeenCalledOnce();
});
