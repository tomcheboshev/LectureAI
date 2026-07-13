// One-off script to grant (or revoke) the "admin" role on a user account.
// There is no self-serve promotion endpoint anywhere in the app — this
// terminal script, run with direct database access, is the only way in.
//
// Usage:
//   cd server
//   node scripts/grant-admin.mjs user@example.com
//   node scripts/grant-admin.mjs user@example.com --revoke
import "dotenv/config";
import mongoose from "mongoose";
import User from "../src/models/User.js";

const email = process.argv[2];
const revoke = process.argv.includes("--revoke");

if (!email) {
  console.error("Usage: node scripts/grant-admin.mjs user@example.com [--revoke]");
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/Study";

async function main() {
  await mongoose.connect(MONGODB_URI);

  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user) {
    console.error(`No user found with email "${email}".`);
    process.exit(1);
  }

  user.role = revoke ? "user" : "admin";
  await user.save();

  console.log(`${user.email} is now role="${user.role}".`);
}

main()
  .catch((err) => {
    console.error("grant-admin failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
