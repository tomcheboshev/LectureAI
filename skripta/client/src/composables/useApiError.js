import { useUpgradeStore } from "../stores/upgrade.js";
import { useToastStore } from "../stores/toast.js";

// Every API error either needs a friendly toast, or — when the backend
// says the user hit a plan limit — the professional upgrade modal instead
// of a generic red error banner. Route every catch block through this so
// the two never diverge.
export function reportApiError(err) {
  if (err?.upgradeRequired) {
    useUpgradeStore().show({ reason: err.reason, message: err.message, limit: err.limit });
    return;
  }
  useToastStore().error(err?.message || "Something went wrong.");
}
