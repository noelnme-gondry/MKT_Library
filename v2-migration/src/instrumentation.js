export async function register() {
  // Only the long-lived production start command enables background delivery.
  // Build, development, Edge and preview processes never send mail.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.GOP_SERVICE_WORKER === "true" && process.env.NODE_ENV === "production") {
    const { startAccountMailWorker } = await import("./lib/account/accountMailWorker");
    startAccountMailWorker();
  }
}
