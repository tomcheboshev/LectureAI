import mongoose from "mongoose";

const { Schema } = mongoose;

const RefreshTokenSchema = new Schema(
  {
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    userAgent: String,
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },

    plan: { type: String, enum: ["free", "pro", "enterprise"], default: "free", index: true },

    emailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, select: false, index: true },
    emailVerificationExpires: { type: Date, select: false },

    passwordResetTokenHash: { type: String, select: false, index: true },
    passwordResetExpires: { type: Date, select: false },

    refreshTokens: { type: [RefreshTokenSchema], default: [], select: false },
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
