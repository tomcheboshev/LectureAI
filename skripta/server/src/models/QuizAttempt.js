import mongoose from "mongoose";

const { Schema } = mongoose;

// One document per completed quiz run-through (not per question) — matches
// how QuizPlayer.vue already works: one pass through all questions, then a
// final score screen fires a single submission.
const QuizAttemptSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    package: { type: Schema.Types.ObjectId, ref: "StudyPackage", required: true, index: true },
    answers: [
      {
        _id: false,
        questionIndex: Number,
        question: String,
        concept_tested: String,
        difficulty: String,
        selected: String,
        correct: Boolean,
      },
    ],
    score: { type: Number, required: true },
    total: { type: Number, required: true },
    // Stored (not computed on read) so aggregating an average across many
    // attempts is a cheap $avg rather than a per-document computation.
    scorePct: { type: Number, required: true },
  },
  { timestamps: true }
);

QuizAttemptSchema.index({ owner: 1, createdAt: -1 });

export default mongoose.model("QuizAttempt", QuizAttemptSchema);
