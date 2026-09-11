import { dispatchAccountMail, mailEnabled } from "./accountMail";
import { accountsEnabled } from "./accountServer";

let timer;
let running = false;
export function startAccountMailWorker() {
  if (timer || !accountsEnabled() || !mailEnabled()) return;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await dispatchAccountMail();
      // Counts only: never recipient, memo text, provider response or credentials.
      console.info("account_mail_worker", result);
    } catch { console.error("account_mail_worker_unavailable"); }
    finally { running = false; }
  };
  // Database leases coordinate replicas; startup also discovers webhook-only receipts.
  timer = setInterval(tick, 15 * 60000);
  timer.unref?.();
  const first = setTimeout(tick, 10000);
  first.unref?.();
}
