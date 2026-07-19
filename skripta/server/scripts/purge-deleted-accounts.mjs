// Thin wrapper around services/auth/deletion.js's purgeExpiredDeletions()
// for deployments that prefer an external cron/scheduled task over this
// app's default in-process hourly interval (see src/index.js). Both are
// safe to run simultaneously — the query is idempotent (a purged account
// simply won't match `deletionScheduledAt <= now` again).
//
// Usage:
//   cd server
//   node scripts/purge-deleted-accounts.mjs
import "dotenv/config";
import mongoose from "mongoose";
import { purgeExpiredDeletions } from "../src/services/auth/deletion.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/Study";

async function main() {
  await mongoose.connect(MONGODB_URI);
  const { purged } = await purgeExpiredDeletions();
  console.log(`Purged ${purged} account(s) past their 30-day deletion window.`);
}

main()
  .catch((err) => {
    console.error("purge-deleted-accounts failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
