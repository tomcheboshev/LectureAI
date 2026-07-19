import mongoose from "mongoose";

const { Schema } = mongoose;

// One document per Stripe invoice (paid or failed), synced by the
// invoice.paid / invoice.payment_failed webhook handlers — this is what
// powers the in-app billing history list. Stripe remains the source of
// truth; this is a local read cache so the settings page doesn't need a
// live Stripe API call on every load, and so a user's history survives
// even if their subscription is later canceled and its live Stripe data
// becomes harder to query.
const InvoiceSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    stripeInvoiceId: { type: String, required: true, unique: true },
    stripeSubscriptionId: String,
    status: { type: String, enum: ["paid", "open", "uncollectible", "void"], required: true },
    amountPaid: { type: Number, required: true }, // smallest currency unit (cents), matches Stripe
    currency: { type: String, required: true },
    // Direct links to Stripe-hosted pages — no need to proxy/store the PDF
    // ourselves, and they stay valid for as long as Stripe retains the
    // invoice (effectively forever for a real account).
    hostedInvoiceUrl: String,
    invoicePdfUrl: String,
    periodStart: Date,
    periodEnd: Date,
    createdAt: { type: Date, required: true },
    // Set by the charge.refunded / charge.dispute.created webhook handlers.
    // A charge (not the invoice itself) is what Stripe actually refunds or
    // disputes; these are flagged back onto the invoice they billed since
    // that's the unit this app's UI already lists.
    refunded: { type: Boolean, default: false },
    amountRefunded: Number, // smallest currency unit, only set once refunded
    disputed: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

InvoiceSchema.index({ owner: 1, createdAt: -1 });

export default mongoose.model("Invoice", InvoiceSchema);
