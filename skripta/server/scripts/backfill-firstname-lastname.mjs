// One-time migration: Phase 18 added required firstName/lastName fields to
// User, split out of the single `name` field that every account up to now
// was created with. Every existing account needs these backfilled once,
// otherwise the next user.save() call on that document (e.g. issueTokens()
// during login) fails schema validation.
//
// Splits `name` on the first space: firstName = first word, lastName = the
// rest. Single-word names (no space) get the same word in both fields
// rather than an empty lastName — users can correct this later in Settings.
//
// Safe to re-run: only touches documents where firstName/lastName are
// missing.
//
// Usage:
//   cd server
//   node scripts/backfill-firstname-lastname.mjs
import "dotenv/config";
import mongoose from "mongoose";
import User from "../src/models/User.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/Study";

function splitName(name) {
  const trimmed = (name || "").trim();
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) return { firstName: trimmed || "User", lastName: trimmed || "User" };
  return { firstName: trimmed.slice(0, spaceIndex), lastName: trimmed.slice(spaceIndex + 1).trim() || trimmed.slice(0, spaceIndex) };
}

async function main() {
  await mongoose.connect(MONGODB_URI);

  // Raw collection access (not the Mongoose model) to bypass the
  // firstName/lastName `required` validators while we're the ones filling
  // them in — going through User.find() here would itself throw on
  // documents missing these fields, before we ever get a chance to fix them.
  const collection = mongoose.connection.collection("users");
  const missing = await collection.find({ $or: [{ firstName: { $exists: false } }, { lastName: { $exists: false } }] }).toArray();

  console.log(`Found ${missing.length} user(s) missing firstName/lastName.`);
  for (const doc of missing) {
    const { firstName, lastName } = splitName(doc.name);
    await collection.updateOne({ _id: doc._id }, { $set: { firstName, lastName } });
    console.log(`  ${doc.email}: name="${doc.name}" -> firstName="${firstName}", lastName="${lastName}"`);
  }

  console.log("Backfill complete.");
}

main()
  .catch((err) => {
    console.error("backfill-firstname-lastname failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
