import { Router } from "express";
import { respondError } from "../../utils/httpError.js";
import { getStripe } from "../../services/billing/stripe.js";

const router = Router();

// Thin proxy over Stripe's own Coupons/Promotion Codes API — no local Mongo
// model. Stripe already owns promo-code state (checkout uses
// allow_promotion_codes:true), so a parallel local model would just be a
// second, driftable source of truth.

// GET /api/admin/coupons — lists promotion codes (customer-facing codes),
// each expanded with its underlying coupon.
router.get("/", async (_req, res) => {
  try {
    const stripe = getStripe();
    const promotionCodes = await stripe.promotionCodes.list({ limit: 100, expand: ["data.promotion.coupon"] });
    res.json({ promotionCodes: promotionCodes.data });
  } catch (err) {
    console.error("Admin coupons list failed:", err);
    respondError(res, err, "Could not load coupons.");
  }
});

// POST /api/admin/coupons  { code?, percentOff?, amountOffCents?, currency?, duration, durationInMonths? }
// Creates a Coupon then a customer-facing Promotion Code for it in one call.
router.post("/", async (req, res) => {
  try {
    const { code, percentOff, amountOffCents, currency, duration, durationInMonths } = req.body;

    if (!percentOff && !amountOffCents) {
      return res.status(400).json({ error: "Provide either percentOff or amountOffCents." });
    }
    if (!["once", "repeating", "forever"].includes(duration)) {
      return res.status(400).json({ error: "duration must be one of: once, repeating, forever." });
    }
    if (duration === "repeating" && !durationInMonths) {
      return res.status(400).json({ error: "durationInMonths is required when duration is repeating." });
    }

    const stripe = getStripe();
    const coupon = await stripe.coupons.create({
      percent_off: percentOff || undefined,
      amount_off: amountOffCents || undefined,
      currency: amountOffCents ? currency || "usd" : undefined,
      duration,
      duration_in_months: duration === "repeating" ? durationInMonths : undefined,
    });
    const promotionCode = await stripe.promotionCodes.create({
      promotion: { type: "coupon", coupon: coupon.id },
      code: code || undefined,
    });

    res.status(201).json({ promotionCode });
  } catch (err) {
    console.error("Admin coupon create failed:", err);
    respondError(res, err, "Could not create this coupon.");
  }
});

// PATCH /api/admin/coupons/:id  { active }  — :id is a promotion code id
router.patch("/:id", async (req, res) => {
  try {
    const { active } = req.body;
    if (typeof active !== "boolean") return res.status(400).json({ error: "active (boolean) is required." });

    const stripe = getStripe();
    const promotionCode = await stripe.promotionCodes.update(req.params.id, { active });
    res.json({ promotionCode });
  } catch (err) {
    console.error("Admin coupon update failed:", err);
    respondError(res, err, "Could not update this coupon.");
  }
});

export default router;
