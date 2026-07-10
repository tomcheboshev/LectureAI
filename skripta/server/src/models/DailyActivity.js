import mongoose from "mongoose";

const { Schema } = mongoose;

// One tiny document per user per UTC calendar day — the streak backbone.
// `date` is a plain "YYYY-MM-DD" string (not a Date) so day-diff math when
// walking the streak is trivial string/date-arithmetic, not timezone-aware
// Date comparison.
const DailyActivitySchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true },
    quizAttempts: { type: Number, default: 0 },
    flashcardReviews: { type: Number, default: 0 },
    packagesGenerated: { type: Number, default: 0 },
    chatMessages: { type: Number, default: 0 },
  },
  { timestamps: true }
);

DailyActivitySchema.index({ owner: 1, date: 1 }, { unique: true });

export default mongoose.model("DailyActivity", DailyActivitySchema);
