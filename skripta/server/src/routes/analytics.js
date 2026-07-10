import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth.js";
import StudyPackage from "../models/StudyPackage.js";
import QuizAttempt from "../models/QuizAttempt.js";
import FlashcardReview from "../models/FlashcardReview.js";
import DailyActivity from "../models/DailyActivity.js";
import AiUsage from "../models/AiUsage.js";
import { computeStreak, addDaysUTC, todayKeyUTC } from "../services/analytics/activity.js";

const router = Router();
router.use(requireAuth);

// GET /api/analytics — dashboard aggregate for the current user. Deliberately
// not plan-gated: this is a retention/engagement feature available on every
// tier, not a monetized one.
router.get("/", async (req, res) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.userId);
    const since = addDaysUTC(todayKeyUTC(), -89); // last 90 days inclusive

    const [
      streak,
      activity,
      packageCount,
      quizAgg,
      flashcardAgg,
      aiAgg,
      aiByKind,
    ] = await Promise.all([
      computeStreak(ownerId),
      DailyActivity.find({ owner: ownerId, date: { $gte: since } }, "-_id date quizAttempts flashcardReviews packagesGenerated chatMessages")
        .sort({ date: 1 })
        .lean(),
      StudyPackage.countDocuments({ owner: ownerId, status: { $ne: "failed" } }),
      QuizAttempt.aggregate([
        { $match: { owner: ownerId } },
        { $group: { _id: null, totalAttempts: { $sum: 1 }, averageScorePct: { $avg: "$scorePct" } } },
      ]),
      FlashcardReview.aggregate([
        { $match: { owner: ownerId } },
        {
          $group: {
            _id: null,
            totalReviewed: { $sum: 1 },
            knownCount: { $sum: { $cond: ["$known", 1, 0] } },
          },
        },
      ]),
      AiUsage.aggregate([
        { $match: { owner: ownerId } },
        {
          $group: {
            _id: null,
            totalCalls: { $sum: 1 },
            totalTokens: { $sum: { $ifNull: ["$totalTokens", 0] } },
            estimatedCostUsd: { $sum: { $ifNull: ["$estimatedCostUsd", 0] } },
          },
        },
      ]),
      AiUsage.aggregate([
        { $match: { owner: ownerId } },
        { $group: { _id: "$kind", calls: { $sum: 1 }, tokens: { $sum: { $ifNull: ["$totalTokens", 0] } } } },
      ]),
    ]);

    const quiz = quizAgg[0] || { totalAttempts: 0, averageScorePct: 0 };
    const flashcards = flashcardAgg[0] || { totalReviewed: 0, knownCount: 0 };
    const ai = aiAgg[0] || { totalCalls: 0, totalTokens: 0, estimatedCostUsd: 0 };

    res.json({
      streak,
      activity,
      studyPackages: packageCount,
      quiz: {
        totalAttempts: quiz.totalAttempts,
        averageScorePct: Math.round(quiz.averageScorePct || 0),
      },
      flashcards: {
        totalReviewed: flashcards.totalReviewed,
        knownCount: flashcards.knownCount,
        unknownCount: flashcards.totalReviewed - flashcards.knownCount,
        masteryPct: flashcards.totalReviewed ? Math.round((flashcards.knownCount / flashcards.totalReviewed) * 100) : 0,
      },
      aiUsage: {
        totalCalls: ai.totalCalls,
        totalTokens: ai.totalTokens,
        estimatedCostUsd: ai.estimatedCostUsd,
        byKind: Object.fromEntries(aiByKind.map((k) => [k._id, { calls: k.calls, tokens: k.tokens }])),
      },
    });
  } catch (err) {
    console.error("Analytics fetch failed:", err);
    res.status(500).json({ error: "Could not load analytics." });
  }
});

export default router;
