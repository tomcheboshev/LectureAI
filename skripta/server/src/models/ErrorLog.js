import mongoose from "mongoose";

const { Schema } = mongoose;

const ErrorLogSchema = new Schema(
  {
    level: { type: String, enum: ["error", "warn"], default: "error", index: true },
    message: { type: String, required: true },
    stack: String,
    context: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ErrorLogSchema.index({ createdAt: -1 });

export default mongoose.model("ErrorLog", ErrorLogSchema);
