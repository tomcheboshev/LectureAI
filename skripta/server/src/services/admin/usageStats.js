import StudyPackage from "../../models/StudyPackage.js";
import AiUsage from "../../models/AiUsage.js";

const COST_TREND_DAYS = 30;

export async function getAiUsageStats() {
  const since = new Date(Date.now() - COST_TREND_DAYS * 24 * 60 * 60 * 1000);

  const [totals, byKind, byModel, costTrend] = await Promise.all([
    AiUsage.aggregate([
      { $group: { _id: null, totalCalls: { $sum: 1 }, totalTokens: { $sum: { $ifNull: ["$totalTokens", 0] } }, estimatedCostUsd: { $sum: { $ifNull: ["$estimatedCostUsd", 0] } } } },
    ]),
    AiUsage.aggregate([{ $group: { _id: "$kind", calls: { $sum: 1 }, tokens: { $sum: { $ifNull: ["$totalTokens", 0] } } } }]),
    AiUsage.aggregate([
      { $group: { _id: "$model", calls: { $sum: 1 }, tokens: { $sum: { $ifNull: ["$totalTokens", 0] } }, costUsd: { $sum: { $ifNull: ["$estimatedCostUsd", 0] } } } },
    ]),
    AiUsage.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, costUsd: { $sum: { $ifNull: ["$estimatedCostUsd", 0] } } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const total = totals[0] || { totalCalls: 0, totalTokens: 0, estimatedCostUsd: 0 };
  return {
    totalCalls: total.totalCalls,
    totalTokens: total.totalTokens,
    estimatedCostUsd: total.estimatedCostUsd,
    byKind: Object.fromEntries(byKind.map((k) => [k._id, { calls: k.calls, tokens: k.tokens }])),
    byModel: byModel.map((m) => ({ model: m._id || "unknown", calls: m.calls, tokens: m.tokens, costUsd: m.costUsd })),
    costTrend: costTrend.map((d) => ({ date: d._id, costUsd: d.costUsd })),
  };
}

// "Uploaded files" only counts sources[] entries that survived extraction —
// files that failed extraction never reach this array (see routes/packages.js
// failedFiles handling), so this undercounts raw upload attempts.
export async function getFileStorageStats() {
  const [fileAgg, storageAgg] = await Promise.all([
    StudyPackage.aggregate([
      { $project: { count: { $size: { $ifNull: ["$sources", []] } } } },
      { $group: { _id: null, totalFiles: { $sum: "$count" } } },
    ]),
    StudyPackage.aggregate([
      {
        $project: {
          size: {
            $add: [
              { $strLenCP: { $ifNull: ["$raw_transcript", ""] } },
              { $sum: { $map: { input: { $ifNull: ["$sources", []] }, as: "s", in: { $strLenCP: { $ifNull: ["$$s.extracted_text", ""] } } } } },
            ],
          },
        },
      },
      { $group: { _id: null, totalChars: { $sum: "$size" } } },
    ]),
  ]);

  return {
    totalFiles: fileAgg[0]?.totalFiles || 0,
    totalStorageChars: storageAgg[0]?.totalChars || 0,
  };
}

export async function getGenerationStats() {
  const [byStatus, bySourceType, durationAgg] = await Promise.all([
    StudyPackage.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    StudyPackage.aggregate([{ $group: { _id: "$source.type", count: { $sum: 1 } } }]),
    StudyPackage.aggregate([
      { $match: { status: "completed" } },
      { $project: { durationMs: { $subtract: ["$updatedAt", "$createdAt"] } } },
      { $group: { _id: null, avgDurationMs: { $avg: "$durationMs" } } },
    ]),
  ]);

  return {
    byStatus: Object.fromEntries(byStatus.map((s) => [s._id || "unknown", s.count])),
    bySourceType: Object.fromEntries(bySourceType.map((s) => [s._id || "unknown", s.count])),
    avgDurationSeconds: Math.round((durationAgg[0]?.avgDurationMs || 0) / 1000),
  };
}
