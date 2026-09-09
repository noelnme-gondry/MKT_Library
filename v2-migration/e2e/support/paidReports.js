// Browser tests simulate a verified pass; they do not claim a real Toss approval.
export async function enablePaidReports(page) {
  await page.route("**/api/payments/access", route => route.fulfill({ json: { entitlement: { plan: "paid", payment: true, verifiedAt: Date.now(), expiresAt: Date.now() + 3600000, offlineUntil: Date.now() + 3600000 } } }));
}
