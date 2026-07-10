import mongoose from "mongoose";

const { Schema } = mongoose;

// One row per (owner, package, cardIndex), upserted on every review — bounded
// to at most flashcards.length rows per user per package, unlike an
// unbounded per-review event log.
const FlashcardReviewSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    package: { type: Schema.Types.ObjectId, ref: "StudyPackage", required: true, index: true },
    cardIndex: { type: Number, required: true },
    front: String, // snapshot, since flashcards can be regenerated later
    known: { type: Boolean, required: true },
    reviewCount: { type: Number, default: 1 },
    lastReviewedAt: Date,
  },
  { timestamps: true }
);

FlashcardReviewSchema.index({ owner: 1, package: 1, cardIndex: 1 }, { unique: true });

export default mongoose.model("FlashcardReview", FlashcardReviewSchema);
