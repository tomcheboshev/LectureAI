import User from "../../models/User.js";
import StudyPackage from "../../models/StudyPackage.js";
import { deleteAvatarIfOwned } from "./avatars.js";

// Runs the actual permanent deletion for every account whose 30-day
// recovery window (DELETE /api/auth/me) has passed. This is a periodic
// in-process job, NOT a lazy per-request check like billing's
// syncEffectivePlan() — a deletion exists for privacy/compliance reasons
// and must fire even if the user never logs in again after scheduling it,
// so deferring it until "next time they show up" would leave PII lingering
// indefinitely for abandoned accounts.
export async function purgeExpiredDeletions() {
  const due = await User.find({ deletionScheduledAt: { $lte: new Date() } }).select("_id pictureUrl");
  if (!due.length) return { purged: 0 };

  for (const user of due) {
    await StudyPackage.deleteMany({ owner: user._id });
    await deleteAvatarIfOwned(user.pictureUrl);
    await User.deleteOne({ _id: user._id });
    console.log(`[auth] Purged account ${user._id} (30-day deletion window elapsed).`);
  }
  return { purged: due.length };
}
