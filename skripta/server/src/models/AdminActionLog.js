import mongoose from "mongoose";

const { Schema } = mongoose;

const AdminActionLogSchema = new Schema(
  {
    admin: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true },
    targetType: { type: String, default: null },
    targetId: { type: Schema.Types.Mixed, default: null },
    detail: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AdminActionLogSchema.index({ admin: 1, createdAt: -1 });
AdminActionLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export default mongoose.model("AdminActionLog", AdminActionLogSchema);
