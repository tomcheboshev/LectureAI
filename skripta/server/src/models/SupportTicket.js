import mongoose from "mongoose";

const { Schema } = mongoose;

// Status-only from the ticket-filer's side by design — the user sees their
// ticket's status change but not a reply thread (no email/notification
// infra exists to alert them to a new message anyway). Admin discussion
// lives in `internalNotes`, never exposed to the user-facing GET routes.
const SupportTicketSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 5000 },
    status: { type: String, enum: ["open", "in_progress", "resolved", "closed"], default: "open", index: true },
    priority: { type: String, enum: ["low", "normal", "high"], default: "normal" },
    internalNotes: {
      type: [
        {
          admin: { type: Schema.Types.ObjectId, ref: "User" },
          note: { type: String, maxlength: 2000 },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

SupportTicketSchema.index({ owner: 1, createdAt: -1 });

export default mongoose.model("SupportTicket", SupportTicketSchema);
