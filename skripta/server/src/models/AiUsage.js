import mongoose from "mongoose";

const { Schema } = mongoose;

// Append-only log, one document per AI provider chat-completion call.
// Nothing read the response's usage data before this — there was zero
// AI-cost/usage visibility anywhere in the app.
const AiUsageSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    package: { type: Schema.Types.ObjectId, ref: "StudyPackage", index: true },
    kind: {
      type: String,
      enum: ["generate", "generate_chunk", "generate_synthesis", "regenerate", "explain", "chat", "image_extract"],
      required: true,
      index: true,
    },
    model: String,
    promptTokens: Number,
    candidatesTokens: Number,
    totalTokens: Number,
    estimatedCostUsd: Number,
  },
  { timestamps: true }
);

AiUsageSchema.index({ owner: 1, createdAt: -1 });

export default mongoose.model("AiUsage", AiUsageSchema);
