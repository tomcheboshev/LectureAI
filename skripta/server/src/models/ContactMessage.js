import mongoose from "mongoose";

const { Schema } = mongoose;

// No `owner` — this is the app's one genuinely public, unauthenticated
// write surface (a landing-page contact form), so senders aren't
// necessarily registered users.
const ContactMessageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 5000 },
    status: { type: String, enum: ["new", "read", "responded", "archived"], default: "new", index: true },
    adminNotes: { type: String, maxlength: 2000, default: null },
  },
  { timestamps: true }
);

ContactMessageSchema.index({ createdAt: -1 });

export default mongoose.model("ContactMessage", ContactMessageSchema);
